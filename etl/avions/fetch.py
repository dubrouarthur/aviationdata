"""Download what the investigation « Les avions, modèle par modèle » reads, into data/raw/:

- bts/: the US Bureau of Transportation Statistics' Reporting Carrier On-Time Performance, one zip a
  month (every domestic flight of the large US airlines: tail number, times, delays and their causes,
  cancellations, diversions). Public domain (US government work).
- aircraft/: the OpenSky Network's aircraft database (registration, ICAO type code, manufacturer, model)
  and ICAO Doc 8643 aircraft types, to turn a tail number or a type code into a model; the FAA's
  Aircraft Characteristics Database (faa_acd.xlsx: length, wingspan, engines of each type, from the
  manufacturers' manuals; public domain), for the drawings to scale (etl/avions/build_dims.py).
- opensky/flightlist/: the OpenSky Network's flight lists on Zenodo (record 7923702: every flight its
  receivers saw, with the aircraft's type code, origin and destination airports, first and last seen).
  Non-commercial use, no redistribution of the raw data: only aggregates by model leave data/raw/.

    python3 etl/avions/fetch.py [--bts 2025] [--opensky 2019 2022]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
BTS = "https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{y}_{m}.zip"
OPENSKY_META = "https://s3.opensky-network.org/data-samples/metadata/"
ZENODO = "https://zenodo.org/api/records/7923702"
UA = {"User-Agent": "aviationdata (open-data magazine)"}
FAA_ACD = "https://www.faa.gov/airports/engineering/aircraft_char_database/aircraft_data"


def get(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(4):  # the BTS server sometimes resets a long transfer: start the file again
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r, tmp.open("wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            break
        except (ConnectionError, TimeoutError, OSError) as err:
            print(f"{dest.name}: {err}, attempt {attempt + 1}", flush=True)
            if attempt == 3:
                raise
            time.sleep(10 * (attempt + 1))
    tmp.rename(dest)
    print(f"{dest.relative_to(ROOT)}: {dest.stat().st_size // 1_000_000} MB", flush=True)


def intact(path: Path, meta: dict) -> bool:
    if path.stat().st_size != meta["size"]:
        return False
    algo, want = meta["checksum"].split(":")
    h = hashlib.new(algo)
    with path.open("rb") as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    return h.hexdigest() == want


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bts", type=int, default=2025)
    ap.add_argument("--opensky", type=int, nargs="*", default=[2019, 2022])
    a = ap.parse_args()
    for f in ("aircraftDatabase-2024-04.csv", "doc8643AircraftTypes.csv", "doc8643Manufacturers.csv"):
        get(OPENSKY_META + f, RAW / "aircraft" / f)
    get(FAA_ACD, RAW / "aircraft" / "faa_acd.xlsx")
    for m in range(1, 13):
        get(BTS.format(y=a.bts, m=m), RAW / "bts" / f"ot_{a.bts}_{m}.zip")
    rec = json.loads(urllib.request.urlopen(urllib.request.Request(ZENODO, headers=UA), timeout=120).read())
    files = {f["key"]: f["links"]["self"] for f in rec["files"]}
    meta = {f["key"]: f for f in rec["files"]}
    (RAW / "opensky" / "flightlist").mkdir(parents=True, exist_ok=True)
    (RAW / "opensky" / "flightlist" / "record.json").write_text(
        json.dumps({"id": rec["id"], "title": rec["metadata"]["title"], "version": rec["metadata"].get("version"),
                    "license": rec["metadata"].get("license")}, indent=1))
    for y in a.opensky:
        for key in sorted(k for k in files if k.startswith(f"flightlist_{y}")):
            dest = RAW / "opensky" / "flightlist" / key
            # a transfer cut short can end without an error: a file is kept only at Zenodo's size and md5
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
