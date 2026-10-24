"""Wind forecasts at flight level 340 for every Paris-New York departure of 2020, from two forecast systems.

Sources, regridded to 1.5 degree by WeatherBench 2 (Rasp et al., 2024) and read over HTTPS (no account):
- HRES, the high-resolution forecast of the European Centre for Medium-Range Weather Forecasts (ECMWF),
  a physics-based model, initialised at 00 and 12 UTC;
- Pangu-Weather (Bi et al., 2023, Nature), a machine-learning model trained on ERA5, same initial times.

For each day of 2020 and each direction (Paris -> New York leaving at 12 UTC, New York -> Paris leaving
at 00 UTC), the forecast issued LEAD hours before departure, valid at departure, +6 h and +12 h, at
250 hPa, on the window of the simulator. Each archive chunk holds 8 lead times x 13 levels of the
whole globe (10 MB): leads 12 h and 108 h each fit in one chunk.

    python3 etl/jet/forecasts.py [--models hres,pangu] [--workers 12]
Writes data/raw/forecasts/<model>-2020.npz: u, v (m/s, float16, shape [direction, lead, day, step,
lat, lon]), days, leads, directions.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path

import fsspec
import numpy as np
import xarray as xr

sys.path.insert(0, str(Path(__file__).resolve().parent))
import era5_levels  # noqa: E402

BASE = "https://storage.googleapis.com/weatherbench2/datasets/"
STORES = {
    "hres": BASE + "hres/2016-2022-0012-240x121_equiangular_with_poles_conservative.zarr",
    "pangu": BASE + "pangu/2018-2022_0012_240x121_equiangular_with_poles_conservative.zarr",
}
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "forecasts"
YEAR = 2020
LEADS = [12, 108]  # hours between the forecast and the departure
DIRECTIONS = [("west", 12), ("east", 0)]  # departure hour, UTC
STEPS = [0, 6, 12]  # hours after departure


def open_store(url):
    fs = fsspec.filesystem("https", client_kwargs={"trust_env": True})
    ds = xr.open_zarr(fs.get_mapper(url), consolidated=True, chunks=None)
    return ds.sortby("latitude")


def days():
    d0 = date(YEAR, 1, 1)
    return [(d0 + timedelta(days=i)).isoformat() for i in range((date(YEAR + 1, 1, 1) - d0).days)]


def model(name: str, workers: int) -> str:
    dest = OUT / f"{name}-{YEAR}.npz"
    if dest.exists():
        return f"{name}: already there"
    ds = open_store(STORES[name])
    dd = days()
    tasks = [(k, li, i) for k in range(len(DIRECTIONS)) for li in range(len(LEADS)) for i in range(len(dd))]

    def read(task):
        k, li, i = task
        dep = datetime.fromisoformat(dd[i]) + timedelta(hours=DIRECTIONS[k][1])
        init = np.datetime64(dep - timedelta(hours=LEADS[li]), "ns")
        # lead times are stored as integer hours (Pangu starts at 6 h, HRES at 0 h)
        sub = ds.sel(time=init, prediction_timedelta=[LEADS[li] + s for s in STEPS], level=250)
        return [
            era5_levels.window(sub[v]).transpose("prediction_timedelta", "latitude", "longitude").values
            for v in ("u_component_of_wind", "v_component_of_wind")
        ]

    grid = era5_levels.window(ds.u_component_of_wind.isel(time=0, prediction_timedelta=0, level=0))
    shape = (len(DIRECTIONS), len(LEADS), len(dd), len(STEPS), grid.sizes["latitude"], grid.sizes["longitude"])
    u = np.full(shape, np.nan, dtype=np.float16)
    v = np.full(shape, np.nan, dtype=np.float16)
    with ThreadPoolExecutor(workers) as pool:
        for n, (task, (uu, vv)) in enumerate(zip(tasks, pool.map(read, tasks), strict=True)):
            u[task], v[task] = uu, vv
            if n % 200 == 0:
                print(f"  {name}: {n}/{len(tasks)}", flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        dest,
        u=u,
        v=v,
        days=np.array(dd),
        leads=np.array(LEADS),
        directions=np.array([d for d, _ in DIRECTIONS]),
        lat=grid.latitude.values.astype(np.float32),
        lon=grid.longitude.values.astype(np.float32),
    )
    sp = np.hypot(u.astype(float), v.astype(float)) * 3.6
    return f"{name}: {len(tasks)} forecasts, max {np.nanmax(sp):.0f} km/h, missing {int(np.isnan(sp).sum())}"


if __name__ == "__main__":
    names = sys.argv[sys.argv.index("--models") + 1].split(",") if "--models" in sys.argv else list(STORES)
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 12
    for m in names:
        print(model(m, workers), flush=True)
