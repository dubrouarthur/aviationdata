"""ERA5 winds and temperature at three cruise levels, every 6 hours, for the days of the flight simulator.

Source: ERA5 (Hersbach et al., 2020, ECMWF / Copernicus Climate Change Service), regridded to 1.5
degree by WeatherBench 2 (Rasp et al., 2024) and served publicly at gs://weatherbench2 (HTTPS, no
account), 1959 to 2023-01-10. "Contains modified Copernicus Climate Change Service information."

For each day: 00, 06, 12 and 18 UTC, then 00 and 06 UTC the next day (a flight leaving at 18 UTC
lands within 12 hours), at 300, 250 and 200 hPa (about 9,200, 10,400 and 11,800 m, flight levels
300, 340 and 390), on the window of the explorer (22.5-72 N, 96 W-18 E).

    python3 etl/jet/era5_levels.py 1999-12-26 2020-02-08 ...
    python3 etl/jet/era5_levels.py --years 2019,2020,2021,2022
Writes data/raw/era5_levels/<day>.npz: u, v (m/s) and t (K), float16, shape [step, level, lat, lon];
lat, lon, levels, times; and with --years, year-<year>.npz with every 6-hourly step of the year.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import era5_daily  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "era5_levels"
LEVELS = [300, 250, 200]
WINDOW = (22.5, 72.0, -96.0, 18.0)


def window(a):
    """Crop by nearest grid index, exactly as build_jet.explorer_stack does (float coordinates)."""
    s, n, w, e = WINDOW
    a = era5_daily.box(a)
    la, lo = a.latitude.values, a.longitude.values
    i0, i1 = int(np.argmin(abs(la - s))), int(np.argmin(abs(la - n))) + 1
    j0, j1 = int(np.argmin(abs(lo - w))), int(np.argmin(abs(lo - e))) + 1
    return a.isel(latitude=slice(i0, i1), longitude=slice(j0, j1))


def stamps(day: str) -> list[str]:
    d = date.fromisoformat(day)
    nxt = (d + timedelta(days=1)).isoformat()
    return [f"{day}T{h:02d}" for h in (0, 6, 12, 18)] + [f"{nxt}T00", f"{nxt}T06"]


def fetch(ds, day: str) -> str:
    dest = OUT / f"{day}.npz"
    if dest.exists():
        return f"{day}: already there"
    times = np.array(stamps(day), dtype="datetime64[ns]")
    sub = ds.sel(time=times, level=LEVELS)
    out = {}
    for k, var in (("u", "u_component_of_wind"), ("v", "v_component_of_wind"), ("t", "temperature")):
        out[k] = window(sub[var]).transpose("time", "level", "latitude", "longitude").values.astype(np.float16)
    grid = window(sub.u_component_of_wind.isel(time=0, level=0))
    np.savez_compressed(
        dest,
        **out,
        lat=grid.latitude.values.astype(np.float32),
        lon=grid.longitude.values.astype(np.float32),
        levels=np.array(LEVELS),
        times=np.array(stamps(day)),
    )
    sp = np.hypot(out["u"].astype(float), out["v"].astype(float)) * 3.6
    return f"{day}: max {sp.max():.0f} km/h"


def year(ds, y: int) -> str:
    """Every 6-hourly step of a year at the three levels (for the statistics over 2019-2022)."""
    dest = OUT / f"year-{y}.npz"
    if dest.exists():
        return f"{y}: already there"
    times = ds.time.sel(time=slice(f"{y}-01-01", f"{y}-12-31T18")).values
    blocks = [times[i : i + 8] for i in range(0, len(times), 8)]

    def read(t):
        sub = ds.sel(time=t, level=LEVELS)
        return [
            window(sub[var]).transpose("time", "level", "latitude", "longitude").values.astype(np.float16)
            for var in ("u_component_of_wind", "v_component_of_wind", "temperature")
        ]

    with ThreadPoolExecutor(6) as pool:
        parts = list(pool.map(read, blocks))
    out = {k: np.concatenate([p[i] for p in parts]) for i, k in enumerate("uvt")}
    np.savez_compressed(dest, **out, times=np.array([str(t)[:13] for t in times]), levels=np.array(LEVELS))
    return f"{y}: {len(times)} steps"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    ds = era5_daily.open_store()
    if "--years" in sys.argv:
        for y in sys.argv[sys.argv.index("--years") + 1].split(","):
            print(year(ds, int(y)), flush=True)
    days = [d for d in sys.argv[1:] if not d.startswith("-") and len(d) == 10]
    with ThreadPoolExecutor(4) as pool:
        for line in pool.map(lambda d: fetch(ds, d), days):
            print(line, flush=True)
