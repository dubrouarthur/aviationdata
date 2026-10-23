"""Upper-air winds over the North Atlantic from the NCEP/NCAR Reanalysis 1 (NOAA PSL).

Kalnay et al. (1996), "The NCEP/NCAR 40-Year Reanalysis Project", BAMS 77. Data provided by
the NOAA PSL, Boulder, Colorado, USA, from their website at https://psl.noaa.gov. Public
domain (US government work). Subsets are requested from the THREDDS NetCDF Subset Service,
so only the North Atlantic box and the flight levels travel:

- monthly means, 1948 to the last complete month, at 200, 250 and 300 hPa;
- 6-hourly fields at 250 hPa, one file per year, for the years of the flight analysis.

    python3 etl/jet/reanalysis.py [--years 2019,2020,2021,2022] [--monthly]
Writes data/raw/reanalysis/{u,v}wnd.mon.nc and {u,v}wnd.250.<year>.nc.
"""

import sys
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "reanalysis"
NCSS = "https://psl.noaa.gov/thredds/ncss/grid/Datasets/ncep.reanalysis"
BOX = {"north": 80, "south": 10, "west": -110, "east": 40}  # North Atlantic, Europe and North America


def get(path: str, params: dict, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"{dest.name}: already there")
        return
    url = f"{NCSS}/{path}?{urllib.parse.urlencode({**params, **BOX, 'accept': 'netcdf'})}"
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(url, timeout=600) as resp, open(tmp, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    tmp.rename(dest)
    print(f"{dest.name}: {dest.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    years = sys.argv[sys.argv.index("--years") + 1].split(",") if "--years" in sys.argv else []
    for var in ("uwnd", "vwnd"):
        if "--monthly" in sys.argv:
            for lev in (200, 250, 300):
                get(
                    f"Monthlies/pressure/{var}.mon.mean.nc",
                    {
                        "var": var,
                        "vertCoord": lev,
                        "time_start": "1948-01-01T00:00:00Z",
                        "time_end": "2030-01-01T00:00:00Z",
                    },
                    OUT / f"{var}.mon.{lev}.nc",
                )
        for y in years:
            get(
                f"pressure/{var}.{y}.nc",
                {
                    "var": var,
                    "vertCoord": 250,
                    "time_start": f"{y}-01-01T00:00:00Z",
                    "time_end": f"{y}-12-31T18:00:00Z",
                },
                OUT / f"{var}.250.{y}.nc",
            )
