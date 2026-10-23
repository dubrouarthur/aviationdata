"""Transatlantic flights between France and North America, from the OpenSky Network COVID-19 dataset.

Source: Zenodo record 7923702 ("Crowdsourced air traffic data from The OpenSky Network 2020"),
one gzipped CSV per month, January 2019 to December 2022. Each monthly file (75-210 MB) is
streamed and filtered on the fly: only flights between a French airport (ICAO prefix LF) and
a North American one (K, C, P prefixes) are kept.

Licence (OpenSky General Terms of Use): non-profit research and education only, no
redistribution of the data set, aircraft identifiers anonymised in any publication, and the
publication must cite "The OpenSky Network, https://opensky-network.org" and be reported to
OpenSky. This script therefore keeps no callsign, icao24 or registration: only the airline
prefix of the callsign (AFR, DAL...), the aircraft type and the timings. The output stays in
data/raw/ (not versioned); only aggregates reach web/public/data/.

    python3 etl/jet/opensky.py [--workers 4] [--months 2019-01,2019-02]
Writes data/raw/opensky/<YYYY-MM>.csv, one per month (skipped when already present).
"""

import csv
import gzip
import io
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RECORD = "https://zenodo.org/api/records/7923702"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "opensky"
NORTH_AMERICA = ("K", "C", "P")  # contiguous US, Canada, Alaska/Hawaii/Pacific US
FIELDS = [
    "airline",
    "typecode",
    "origin",
    "destination",
    "firstseen",
    "lastseen",
    "day",
    "latitude_1",
    "longitude_1",
    "altitude_1",
    "latitude_2",
    "longitude_2",
    "altitude_2",
]


def is_transatlantic(o: str, d: str) -> bool:
    fr = lambda c: c.startswith("LF")  # noqa: E731
    na = lambda c: c[:1] in NORTH_AMERICA and len(c) == 4  # noqa: E731
    return (fr(o) and na(d)) or (na(o) and fr(d))


def airline_of(callsign: str) -> str:
    """'AFR022 ' -> 'AFR'; anything not starting with three letters gives ''."""
    c = (callsign or "").strip().upper()
    return c[:3] if len(c) >= 4 and c[:3].isalpha() else ""


def filter_rows(lines):
    """Yield the kept, anonymised rows of a flight list (an iterable of CSV text lines)."""
    for r in csv.DictReader(lines):
        o, d = (r.get("origin") or "").strip(), (r.get("destination") or "").strip()
        if not is_transatlantic(o, d):
            continue
        yield {
            "airline": airline_of(r.get("callsign", "")),
            "typecode": (r.get("typecode") or "").strip(),
            "origin": o,
            "destination": d,
            **{k: r.get(k, "") for k in FIELDS[4:]},
        }


def monthly_files():
    with urllib.request.urlopen(RECORD, timeout=60) as resp:
        rec = json.load(resp)
    out = {}
    for f in rec["files"]:
        k = f["key"]
        if k.startswith("flightlist_") and k.endswith(".csv.gz"):
            start = k.split("_")[1]  # 20190101
            out[f"{start[:4]}-{start[4:6]}"] = f["links"]["self"]
    return dict(sorted(out.items()))


def fetch_month(month: str, url: str) -> str:
    dest = OUT / f"{month}.csv"
    if dest.exists():
        return f"{month}: already there"
    tmp = dest.with_suffix(".part")
    kept = 0
    with urllib.request.urlopen(url, timeout=120) as resp, open(tmp, "w", newline="") as out:
        w = csv.DictWriter(out, FIELDS)
        w.writeheader()
        lines = io.TextIOWrapper(gzip.GzipFile(fileobj=resp), encoding="utf-8", newline="")
        for row in filter_rows(lines):
            w.writerow(row)
            kept += 1
    tmp.rename(dest)
    return f"{month}: {kept} transatlantic flights kept"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 4
    months = monthly_files()
    if "--months" in sys.argv:
        keep = set(sys.argv[sys.argv.index("--months") + 1].split(","))
        months = {m: u for m, u in months.items() if m in keep}
    with ThreadPoolExecutor(workers) as pool:
        for msg in pool.map(lambda kv: fetch_month(*kv), months.items()):
            print(msg, flush=True)
