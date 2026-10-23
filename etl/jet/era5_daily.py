"""Six-hourly ERA5 winds at 250 hPa over the North Atlantic, 1.5 degree, for the flight analysis.

Source: ERA5 (Hersbach et al., 2020, ECMWF / Copernicus Climate Change Service), regridded to
1.5 degree by WeatherBench 2 (Rasp et al., 2024, JAMES, doi:10.1029/2023MS004019) and served
publicly at gs://weatherbench2 (read over HTTPS, no account). "Contains modified Copernicus
Climate Change Service information." The archive ends on 2023-01-10.

Each chunk of the archive holds 8 time steps (two days) at 13 levels on the whole globe
(about 10 MB); the 250 hPa level over 15-75 N, 100 W-20 E is kept.

    python3 etl/jet/era5_daily.py --years 2019,2020,2021,2022 [--workers 6]
Writes data/raw/era5_daily/<year>.npz: time (ISO strings), lat, lon, u and v (m/s, float16,
shape time x lat x lon).
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fsspec
import numpy as np
import xarray as xr

STORE = (
    "https://storage.googleapis.com/weatherbench2/datasets/era5/"
    "1959-2023_01_10-6h-240x121_equiangular_with_poles_conservative.zarr"
)
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "era5_daily"


def open_store():
    fs = fsspec.filesystem("https", client_kwargs={"trust_env": True})
    return xr.open_zarr(fs.get_mapper(STORE), consolidated=True, chunks=None)


def box(a):
    """North Atlantic box, longitudes -100..20, latitudes 15..75 ascending."""
    a = a.sel(latitude=slice(15, 75))
    west = a.sel(longitude=slice(259.5, 358.5))
    east = a.sel(longitude=slice(0, 20))
    return xr.concat([west.assign_coords(longitude=west.longitude - 360), east], dim="longitude")


def year(ds, y: int) -> str:
    dest = OUT / f"{y}.npz"
    if dest.exists():
        return f"{y}: already there"
    times = ds.time.sel(time=slice(f"{y}-01-01", f"{y}-12-31T18")).values
    # read chunk by chunk (8 steps), in parallel
    blocks = [times[i : i + 8] for i in range(0, len(times), 8)]

    def read(t):
        sub = ds.sel(time=t, level=250)
        return box(sub.u_component_of_wind).values, box(sub.v_component_of_wind).values

    with ThreadPoolExecutor(WORKERS) as pool:
        parts = list(pool.map(read, blocks))
    u = np.concatenate([p[0] for p in parts]).astype(np.float16)
    v = np.concatenate([p[1] for p in parts]).astype(np.float16)
    grid = box(ds.u_component_of_wind.isel(time=0, level=0))
    np.savez_compressed(
        dest,
        time=np.array([str(t)[:13] for t in times]),
        lat=grid.latitude.values.astype(np.float32),
        lon=grid.longitude.values.astype(np.float32),
        u=u,
        v=v,
    )
    return f"{y}: {len(times)} steps, max {float(np.nanmax(np.hypot(u.astype(float), v.astype(float)))) * 3.6:.0f} km/h"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    WORKERS = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 6
    ds = open_store()
    for y in sys.argv[sys.argv.index("--years") + 1].split(","):
        print(year(ds, int(y)), flush=True)
