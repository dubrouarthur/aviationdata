"""Does forecasting the wind pay? Every Paris-New York departure of 2020, planned on what was known in
advance, then flown in the wind that actually blew.

Inputs (data/raw/):
- forecasts/<model>-2020.npz (forecasts.py): ECMWF HRES and Pangu-Weather at 250 hPa, issued 12 h and
  108 h (4.5 days) before each departure, valid at departure, +6 h and +12 h;
- era5_levels/year-<y>.npz (era5_levels.py): ERA5, the wind that blew (truth), and 2019-2022 for the
  climatology (the mean wind of the month at the same hours).

For each day and direction (Paris -> New York at 12 UTC, New York -> Paris at 00 UTC), a Boeing
777-300ER at Mach 0.84 at flight level 340 (250 hPa). Each plan is the fastest route on its wind,
solved with sim.best_route_stack at a standard temperature (220.8 K), so plans differ only by the wind
they assume; every plan is then flown with sim.path_time in the ERA5 wind and temperature.
Plans: the great circle (no wind data), the climatology, each forecast, and the ERA5 wind itself
(perfect knowledge).

Writes web/public/data/jet/forecast.json: per direction, the minutes flown by each plan every day,
their means, and the error of each forecast on the wind along the route (km/h).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import analysis as A
import numpy as np
import sim as S

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data" / "jet"
CDG = (49.0097, 2.5479)
JFK = (40.6413, -73.7781)
MACH = 0.84  # Boeing 777-300ER cruise Mach (OpenAP), as in build_sim.AIRCRAFT
ISA = 220.8  # K, standard temperature at 250 hPa: plans differ only by their wind
LEVEL = 1  # 250 hPa in the era5_levels files (300, 250, 200)
MODELS = {"hres": "ECMWF HRES", "pangu": "Pangu-Weather"}
DIRS = {"west": (CDG, JFK, 12), "east": (JFK, CDG, 0)}


def era5(years):
    zs = [np.load(RAW / "era5_levels" / f"year-{y}.npz") for y in years]
    times = np.concatenate([z["times"] for z in zs])
    pick = lambda k: np.concatenate([z[k][:, LEVEL] for z in zs]).astype(np.float32)  # noqa: E731
    return {str(t): i for i, t in enumerate(times)}, pick("u"), pick("v"), pick("t")


def stamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H")


def along_track(pu, pv, g, iso, mid_la, mid_lo, trk):
    """Mean wind along the route (km/h, positive = tailwind) six hours after departure, every day."""
    F = S.StackField(pu[:, :, None], pv[:, :, None], iso, g["lat0"], g["lon0"], g["d"])
    uu, vv, _ = F.sample(mid_la, mid_lo, np.full((F.days, len(mid_la)), 6.0), 0)
    return (uu * np.sin(trk) + vv * np.cos(trk)).mean(axis=1) * 3.6


def build() -> dict | None:
    need = [RAW / "forecasts" / f"{m}-2020.npz" for m in MODELS] + [
        RAW / "era5_levels" / f"year-{y}.npz" for y in range(2019, 2023)
    ]
    if missing := [p.name for p in need if not p.exists()]:
        print(f"  forecast.json: missing {missing} (forecasts.py, era5_levels.py --years)")
        return None
    g = json.loads((OUT / "winds.json").read_text())
    idx, U, V, T = era5(range(2019, 2023))
    fc = {m: np.load(RAW / "forecasts" / f"{m}-2020.npz") for m in MODELS}
    days = [str(d) for d in fc["hres"]["days"]]
    leads = [int(x) for x in fc["hres"]["leads"]]
    dirs = [str(d) for d in fc["hres"]["directions"]]
    ny, nx = U.shape[1:]
    if fc["hres"]["u"].shape[-2:] != (ny, nx):
        raise SystemExit(f"forecast grid {fc['hres']['u'].shape[-2:]} differs from ERA5 {(ny, nx)}")
    out = {
        "year": 2020,
        "aircraft": "Boeing 777-300ER",
        "mach": MACH,
        "fl": 340,
        "leads": leads,
        "models": MODELS,
        "plans": ["gc", "clim"] + [f"{m}{lead}" for lead in sorted(leads, reverse=True) for m in MODELS] + ["perfect"],
        "days": days,
    }
    for key, (a, b, hour) in DIRS.items():
        k = dirs.index(key)
        deps = [datetime.fromisoformat(d) + timedelta(hours=hour) for d in days]
        steps = [[idx[stamp(t + timedelta(hours=h))] for h in (0, 6, 12)] for t in deps]
        truth_u, truth_v, truth_t = U[steps], V[steps], T[steps]  # [day, step, lat, lon]
        # the climatology: mean wind of the calendar month at the same hours, 2019-2022
        clim_u = np.zeros_like(truth_u)
        clim_v = np.zeros_like(truth_v)
        stamps = list(idx)
        for di, t in enumerate(deps):
            for s, h in enumerate((0, 6, 12)):
                hh = (t + timedelta(hours=h)).hour
                same = [idx[x] for x in stamps if x[5:7] == f"{t.month:02d}" and int(x[11:13]) == hh]
                clim_u[di, s] = U[same].mean(axis=0)
                clim_v[di, s] = V[same].mean(axis=0)
        winds = {"perfect": (truth_u, truth_v), "clim": (clim_u, clim_v)}
        for m in MODELS:
            for li, lead in enumerate(leads):
                f = fc[m]
                winds[f"{m}{lead}"] = (f["u"][k, li].astype(np.float32), f["v"][k, li].astype(np.float32))
        lat, lon = A.lattice(a, b, S.LATTICE["n"], S.LATTICE["spacing"], S.LATTICE["m"])
        D = len(days)
        iso = np.full((D, 3, 1, ny, nx), ISA, dtype=np.float32)
        flown = {}
        for plan, (pu, pv) in winds.items():
            F = S.StackField(pu[:, :, None], pv[:, :, None], iso, g["lat0"], g["lon0"], g["d"])
            r = S.best_route_stack(F, a, b, 0.0, MACH, level=0)
            pts = [
                np.stack([lat[np.arange(len(lat)), r["path"][d]], lon[np.arange(len(lon)), r["path"][d]]], axis=1)
                for d in range(D)
            ]
            flown[plan] = pts
        flown["gc"] = [S.great_circle_points(a, b)] * D
        minutes = {p: np.zeros(D) for p in out["plans"]}
        for d in range(D):
            truth = S.Field(truth_u[d][:, None], truth_v[d][:, None], truth_t[d][:, None], g["lat0"], g["lon0"], g["d"])
            for p in out["plans"]:
                minutes[p][d] = S.path_time(truth, flown[p][d], 0.0, 0, MACH)[0]
        # how wrong each forecast was on the wind along the great circle, at departure + 6 h (km/h)
        gc = S.great_circle_points(a, b)
        mid_la, mid_lo = (gc[1:, 0] + gc[:-1, 0]) / 2, (gc[1:, 1] + gc[:-1, 1]) / 2
        trk = np.radians(A.bearing(gc[:-1, 0], gc[:-1, 1], gc[1:, 0], gc[1:, 1]))
        iso1 = np.full((D, 3, 1, ny, nx), ISA, dtype=np.float32)

        true_along = along_track(truth_u, truth_v, g, iso1, mid_la, mid_lo, trk)
        err = {
            p: round(float(np.abs(along_track(*winds[p], g, iso1, mid_la, mid_lo, trk) - true_along).mean()), 1)
            for p in winds
            if p != "perfect"
        }
        means = {p: round(float(minutes[p].mean()), 2) for p in out["plans"]}
        out[key] = {
            "hour": hour,
            "km": round(float(A.haversine(*a, *b)), 1),
            "minutes": {p: [round(float(x), 2) for x in minutes[p]] for p in out["plans"]},
            "mean": means,
            "wind_error": err,
            "tailwind": [round(float(x)) for x in true_along],
        }
        gain = means["gc"] - means["perfect"]
        caught = {p: round(100 * (means["gc"] - means[p]) / gain) for p in out["plans"] if p not in ("gc", "perfect")}
        print(f"  forecast {key}: great circle {means['gc']:.1f} min, perfect {means['perfect']:.1f} min")
        print(f"    share of the gain {caught}, wind error {err}")
    (OUT / "forecast.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"  forecast.json: {(OUT / 'forecast.json').stat().st_size // 1024} KB")
    return out


if __name__ == "__main__":
    build()
