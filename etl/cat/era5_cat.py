"""Clear-air turbulence conditions in ERA5, 1979-2022: the Ellrod index at three cruise levels, reduced on the fly.

Source: ERA5 (Hersbach et al., 2020, ECMWF / Copernicus Climate Change Service), regridded to 1.5 degree
by WeatherBench 2 (Rasp et al., 2024) and served publicly at gs://weatherbench2 (HTTPS, no account), every
6 hours. "Contains modified Copernicus Climate Change Service information."

Ellrod and Knapp (1992) index TI1 = vertical wind shear x (deformation + convergence), the standard
clear-air turbulence diagnostic (Williams & Joshi 2013, Storer et al. 2017). At level L (200, 250, 300 hPa)
the shear is taken between the levels above and below, over the heights of the ICAO standard atmosphere
(no geopotential is read: only u and v, about 160 GB over the 44 years). Horizontal derivatives are centred
differences on the sphere, between 78 S and 78 N.

Nothing raw is kept. For each year, data/raw/cat/<year>.npz holds:
  steps[month]                         number of 6-hourly analyses
  exc[level, month, thr, lat, lon]     uint8, analyses with TI1 above each threshold of THRESH
  ws[level, month, lat, lon]           mean wind speed (m/s), float32
  vws[level, month, lat, lon]          mean vertical shear (1/s), float32
  hist[level, month, bin]              cos(latitude)-weighted histogram of log10(TI1), BINS (TI1 <= 0 in bin 0)

    python3 etl/cat/era5_cat.py [--years 1979-2022] [--workers 8]
Resumable: a year already written is skipped.
"""

import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import numcodecs
import numpy as np

STORE = (
    "https://storage.googleapis.com/weatherbench2/datasets/era5/"
    "1959-2023_01_10-6h-240x121_equiangular_with_poles_conservative.zarr"
)
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "cat"
T0 = datetime(1959, 1, 1)
LEVELS = [200, 250, 300]  # hPa: about FL390, FL340, FL300
# archive level index (50, 100, 150, 200, 250, 300, 400, ...) of each level and its neighbours
IDX = {150: 2, 200: 3, 250: 4, 300: 5, 400: 6}
NEIGH = {200: (150, 250), 250: (200, 300), 300: (250, 400)}
Z_STD = {150: 13608.0, 200: 11784.0, 250: 10363.0, 300: 9164.0, 400: 7185.0}  # m, ICAO standard atmosphere
THRESH = np.array([2, 4, 6, 8, 10, 13, 16, 20]) * 1e-7  # s^-2, around the 99th percentile at 1.5 degree
BINS = np.linspace(-10, -4, 241)  # log10(TI1)
R = 6371000.0
LAT = np.linspace(-90, 90, 121)
LAT_MAX = 78.0


def fetch(var, k, tries=8):
    url = f"{STORE}/{var}/{k}.0.0.0"
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                raw = r.read()
            return np.frombuffer(CODEC.decode(raw), "<f4").reshape(8, 13, 240, 121)
        except Exception:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def ti1(u, v):
    """u, v [level(13), lat, lon] -> TI1, wind speed, shear, each [len(LEVELS), lat, lon]; NaN beyond LAT_MAX."""
    phi = np.radians(LAT)[:, None]
    dy = R * np.radians(1.5)
    dx = R * np.cos(phi) * np.radians(1.5)
    out_t, out_w, out_s = [], [], []
    for L in LEVELS:
        a, b = (IDX[n] for n in NEIGH[L])
        i = IDX[L]
        uu, vv = u[i], v[i]
        dudx = (np.roll(uu, -1, 1) - np.roll(uu, 1, 1)) / (2 * dx)
        dvdx = (np.roll(vv, -1, 1) - np.roll(vv, 1, 1)) / (2 * dx)
        dudy = np.full_like(uu, np.nan)
        dvdy = np.full_like(vv, np.nan)
        dudy[1:-1] = (uu[2:] - uu[:-2]) / (2 * dy)
        dvdy[1:-1] = (vv[2:] - vv[:-2]) / (2 * dy)
        dst = dudx - dvdy
        dsh = dvdx + dudy
        defo = np.sqrt(dst**2 + dsh**2)
        cvg = -(dudx + dvdy)
        vws = np.hypot(u[a] - u[b], v[a] - v[b]) / (Z_STD[NEIGH[L][0]] - Z_STD[NEIGH[L][1]])
        t = vws * (defo + cvg)
        out_t.append(t)
        out_w.append(np.hypot(uu, vv))
        out_s.append(vws)
    t, w, s = (np.array(x) for x in (out_t, out_w, out_s))
    far = np.abs(LAT) > LAT_MAX
    t[:, far], s[:, far] = np.nan, np.nan
    return t, w, s


WEIGHT = np.broadcast_to(np.cos(np.radians(LAT))[:, None], (121, 240))


def year(y, workers):
    dest = OUT / f"{y}.npz"
    if dest.exists():
        return f"{y}: déjà là"
    i0 = int((datetime(y, 1, 1) - T0).total_seconds() // 21600)
    i1 = int((datetime(y + 1, 1, 1) - T0).total_seconds() // 21600)  # exclusive
    chunks = range(i0 // 8, (i1 - 1) // 8 + 1)
    nl, nt = len(LEVELS), len(THRESH)
    exc = np.zeros((nl, 12, nt, 121, 240), np.uint16)
    ws = np.zeros((nl, 12, 121, 240))
    vws = np.zeros((nl, 12, 121, 240))
    hist = np.zeros((nl, 12, len(BINS)))
    steps = np.zeros(12, int)

    def work(k):
        u, v = fetch("u_component_of_wind", k), fetch("v_component_of_wind", k)
        res = []
        for s in range(8):
            idx = k * 8 + s
            if not i0 <= idx < i1:
                continue
            m = (T0 + timedelta(hours=6 * idx)).month - 1
            t, w, sh = ti1(u[s].transpose(0, 2, 1), v[s].transpose(0, 2, 1))
            res.append((m, t, w, sh))
        return res

    with ThreadPoolExecutor(workers) as pool:
        for res in pool.map(work, chunks):
            for m, t, w, sh in res:
                steps[m] += 1
                exc[:, m] += (t[:, None] > THRESH[None, :, None, None])
                ws[:, m] += w
                vws[:, m] += np.nan_to_num(sh)
                lg = np.log10(np.where(t > 0, t, 1e-30))
                b = np.clip(np.searchsorted(BINS, lg), 0, len(BINS) - 1)
                ok = ~np.isnan(t)
                for li in range(nl):
                    hist[li, m] += np.bincount(b[li][ok[li]], WEIGHT[ok[li]], len(BINS))
    assert exc.max() < 256
    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        dest, steps=steps, exc=exc.astype(np.uint8), ws=(ws / steps[None, :, None, None]).astype(np.float32),
        vws=(vws / steps[None, :, None, None]).astype(np.float32), hist=hist, levels=np.array(LEVELS),
        thresh=THRESH, bins=BINS, lat=LAT, lon=np.arange(240) * 1.5,
    )
    return f"{y}: {steps.sum()} analyses"


CODEC = None

if __name__ == "__main__":
    meta = json.load(urllib.request.urlopen(f"{STORE}/.zmetadata", timeout=60))["metadata"]
    CODEC = numcodecs.get_codec(meta["u_component_of_wind/.zarray"]["compressor"])
    assert meta["u_component_of_wind/.zattrs"]["_ARRAY_DIMENSIONS"] == ["time", "level", "longitude", "latitude"]
    yrs = sys.argv[sys.argv.index("--years") + 1] if "--years" in sys.argv else "1979-2022"
    a, b = (int(x) for x in yrs.split("-")) if "-" in yrs else (int(yrs), int(yrs))
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 8
    for y in range(a, b + 1):
        t = time.time()
        print(year(y, workers), f"({time.time() - t:.0f} s)", flush=True)
