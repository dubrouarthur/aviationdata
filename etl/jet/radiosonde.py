"""Winds measured by the weather balloons of Météo-France at Trappes (Yvelines), WMO station 07145.

Source: NOAA NCEI, Integrated Global Radiosonde Archive version 2 (IGRA 2), station
FRM00007145, period of record. Durre, I., X. Yin, R. S. Vose, S. Applequist, J. Arnfield
(2016), Integrated Global Radiosonde Archive (IGRA), Version 2, NOAA NCEI,
doi:10.7289/V5X63K0Q. The soundings are made by Météo-France and exchanged through the WMO.

Format (IGRA 2 data, fixed width): a header line starting with '#' per sounding, then one
line per level. Columns used: LVLTYP1 (1), LVLTYP2 (2), PRESS (10-15, Pa), WDIR (41-45,
degrees), WSPD (47-51, tenths of m/s); -9999 / -8888 mean missing.

    python3 etl/jet/radiosonde.py
Writes data/raw/igra/FRM00007145-data.txt.zip (downloaded) and data/raw/igra/trappes_250.csv
(one row per sounding with a wind at 250 hPa: date, hour, direction, speed in km/h, and the
speeds at 300 and 200 hPa when reported).
"""

import csv
import io
import urllib.request
import zipfile
from pathlib import Path

URL = "https://www.ncei.noaa.gov/data/integrated-global-radiosonde-archive/access/data-por/FRM00007145-data.txt.zip"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "igra"


def parse(lines, level_pa: int = 25000, around=(30000, 20000)):
    """Yield (YYYY-MM-DD, hour, wdir, wspd_kmh, below_kmh, above_kmh) for every sounding with a
    wind at the given level; below/above are the speeds at the neighbouring standard levels
    (300 and 200 hPa), None when missing, used to reject isolated spikes."""
    date = hour = None
    levels = {}

    def flush():
        if date is not None and level_pa in levels:
            wdir, wspd = levels[level_pa]
            yield (
                date,
                hour,
                wdir,
                kmh(wspd),
                *(kmh(levels[p][1]) if p in levels else None for p in around),
            )

    for line in lines:
        if line.startswith("#"):
            yield from flush()
            date = f"{line[13:17]}-{line[18:20]}-{line[21:23]}"
            hour = int(line[24:26]) if line[24:26].strip().isdigit() else 99
            levels = {}
            continue
        if date is None or len(line) < 51:
            continue
        try:
            press = int(line[9:15])
            wdir = int(line[40:45])
            wspd = int(line[46:51])
        except ValueError:
            continue
        if press in (level_pa, *around) and wdir >= 0 and wspd >= 0:
            levels[press] = (wdir, wspd)
    yield from flush()


def kmh(tenths_ms: int) -> float:
    return round(tenths_ms / 10 * 3.6, 1)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    z = OUT / "FRM00007145-data.txt.zip"
    if not z.exists():
        urllib.request.urlretrieve(URL, z)
    with zipfile.ZipFile(z) as zf:
        name = zf.namelist()[0]
        with zf.open(name) as f, open(OUT / "trappes_250.csv", "w", newline="") as out:
            w = csv.writer(out)
            w.writerow(["date", "hour", "wdir", "wspd_kmh", "wspd300_kmh", "wspd200_kmh"])
            n = 0
            for row in parse(io.TextIOWrapper(f, encoding="ascii", errors="replace")):
                w.writerow(row)
                n += 1
    print(f"trappes_250.csv: {n} soundings with a 250 hPa wind")
