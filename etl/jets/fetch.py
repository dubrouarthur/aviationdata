"""Download what the investigation « Les jets privés » reads, into data/raw/:

- opensky/flightlist/: the OpenSky Network's flight lists on Zenodo (record 7923702), every month from
  January 2019 to December 2022: each flight its receivers saw, with the aircraft's ICAO type code, the
  airports of departure and arrival when the network saw them, and the times it was first and last seen.
  Non-commercial use, no redistribution of the raw data: only aggregates leave data/raw/.
- aircraft/: the OpenSky Network's aircraft database (April 2024), to give a type code to the flights
  that carry none (by transponder address), and ICAO Doc 8643 aircraft types.
- eurostat/ourairports.csv: airport coordinates and countries (OurAirports, public domain).

    python3 etl/jets/fetch.py [--years 2019 2020 2021 2022]

Every file is kept only at Zenodo's size and md5 (etl/avions/fetch.py: a transfer can stop silently).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "avions"))
from fetch import OPENSKY_META, RAW, UA, ZENODO, get, intact  # noqa: E402

OURAIRPORTS = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, nargs="*", default=[2019, 2020, 2021, 2022])
    a = ap.parse_args()
    for f in ("aircraftDatabase-2024-04.csv", "doc8643AircraftTypes.csv"):
        get(OPENSKY_META + f, RAW / "aircraft" / f)
    get(OURAIRPORTS, RAW / "eurostat" / "ourairports.csv")
    rec = json.loads(urllib.request.urlopen(urllib.request.Request(ZENODO, headers=UA), timeout=120).read())
    files = {f["key"]: f["links"]["self"] for f in rec["files"]}
    meta = {f["key"]: f for f in rec["files"]}
    out = RAW / "opensky" / "flightlist"
    out.mkdir(parents=True, exist_ok=True)
    (out / "record.json").write_text(
        json.dumps(
            {
                "id": rec["id"],
                "title": rec["metadata"]["title"],
                "version": rec["metadata"].get("version"),
                "license": rec["metadata"].get("license"),
            },
            indent=1,
        )
    )
    for y in a.years:
        for key in sorted(k for k in files if k.startswith(f"flightlist_{y}")):
            dest = out / key
            for _ in range(3):
                if dest.exists() and not intact(dest, meta[key]):
                    print(f"{key}: incomplete, downloaded again", flush=True)
                    dest.unlink()
                get(files[key], dest)
                if intact(dest, meta[key]):
                    break
            else:
                raise SystemExit(f"{key}: still incomplete after three downloads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
