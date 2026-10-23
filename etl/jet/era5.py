"""Winds at 250 hPa over the North Atlantic from ERA5 (ECMWF), through the public ARCO-ERA5 copy.

Source: Hersbach, H. et al. (2020), The ERA5 global reanalysis, QJRMS 146, 1999-2049, produced
by ECMWF for the Copernicus Climate Change Service (C3S). Read from Google's public
Analysis-Ready Cloud-Optimized copy (gs://gcp-public-data-arco-era5, Carver & Merose, 2023),
over HTTPS without an account. Attribution required by the Copernicus licence:
"Contains modified Copernicus Climate Change Service information".

Each hourly chunk of the archive holds the whole globe at 37 levels (about 4 s to read); only
the 250 hPa level over 15-75 N, 100 W-20 E is kept, averaged to 0.5 degree.

    python3 etl/jet/era5.py --start 2019-01-01 --end 2022-12-31 --hours 0,12 [--workers 6]
    python3 etl/jet/era5.py --dates 2020-02-09T00,2023-01-15T12
Writes data/raw/era5/<YYYY-MM-DDTHH>.npz (u, v in m/s, float16; lat, lon in degrees).
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import fsspec
import numpy as np
import xarray as xr

STORE = "https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "era5"
LAT = (75.0, 15.0)
LON_WEST, LON_EAST = -100.0, 20.0


def open_store():
    fs = fsspec.filesystem("https", client_kwargs={"trust_env": True})
    return xr.open_zarr(fs.get_mapper(STORE), consolidated=True, chunks=None, zarr_format=2)


def subset(ds, stamp: str):
    """u, v at 250 hPa on the North Atlantic box, longitudes from -100 to 20, every 0.5 degree."""
    out = {}
    for name, var in (("u", "u_component_of_wind"), ("v", "v_component_of_wind")):
        a = ds[var].sel(time=stamp, level=250).sel(latitude=slice(*LAT))
        west = a.sel(longitude=slice(360 + LON_WEST, 359.75))
        east = a.sel(longitude=slice(0, LON_EAST))
        both = xr.concat([west.assign_coords(longitude=west.longitude - 360), east], dim="longitude")
        out[name] = both.coarsen(latitude=2, longitude=2, boundary="trim").mean()
    return out


def fetch(ds, stamp: str) -> str:
    dest = OUT / f"{stamp[:13]}.npz"
    if dest.exists():
        return f"{stamp}: already there"
    s = subset(ds, stamp)
    np.savez_compressed(
        dest,
        u=s["u"].values.astype(np.float16),
        v=s["v"].values.astype(np.float16),
        lat=s["u"].latitude.values.astype(np.float32),
        lon=s["u"].longitude.values.astype(np.float32),
    )
    return f"{stamp}: max {float(np.hypot(s['u'], s['v']).max()) * 3.6:.0f} km/h"


def stamps():
    if "--dates" in sys.argv:
        return [d if len(d) > 10 else f"{d}T00" for d in sys.argv[sys.argv.index("--dates") + 1].split(",")]
    start = date.fromisoformat(sys.argv[sys.argv.index("--start") + 1])
    end = date.fromisoformat(sys.argv[sys.argv.index("--end") + 1])
    hours = [int(h) for h in sys.argv[sys.argv.index("--hours") + 1].split(",")] if "--hours" in sys.argv else [12]
    out, d = [], start
    while d <= end:
        out += [f"{d.isoformat()}T{h:02d}" for h in hours]
        d += timedelta(days=1)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 6
    todo = [s for s in stamps() if not (OUT / f"{s}.npz").exists()]
    ds = open_store()
    with ThreadPoolExecutor(workers) as pool:
        for i, msg in enumerate(pool.map(lambda s: fetch(ds, f"{s}:00"), todo)):
            if i % 50 == 0 or i == len(todo) - 1:
                print(f"{i + 1}/{len(todo)} {msg}", flush=True)
