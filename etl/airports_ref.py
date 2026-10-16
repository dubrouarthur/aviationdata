"""Build airport coordinate references from OurAirports (public domain).

- data/ref/airports_fr.csv: French airports (metropolitan and overseas ICAO prefixes)
- data/ref/airports_world.csv: every airport referenced by the DGAC airport-pair series (PAP)
  or by data/ref/countries_fr.csv (country hubs), plus large scheduled airports worldwide

Source: https://github.com/davidmegginson/ourairports-data
"""

from __future__ import annotations

import csv
import glob
import io
import sys
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"
PREFIXES = ("LF", "TF", "SO", "FM", "NT", "NW", "NL")
ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"


def needed_codes() -> set[str]:
    codes: set[str] = set()
    for f in glob.glob(str(ROOT / "data" / "raw" / "trafic" / "*ASP_PAP_*.csv")):
        with open(f, encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                codes.update((r.get("PAP") or "").split("_"))
    with open(REF / "countries_fr.csv", encoding="utf-8") as fh:
        codes.update(r["hub"] for r in csv.DictReader(fh) if r["hub"])
    return {c for c in codes if len(c) == 4}


def main() -> int:
    raw = urllib.request.urlopen(URL, timeout=180).read().decode("utf-8")
    want = needed_codes()
    fr, world = [], []
    for r in csv.DictReader(io.StringIO(raw)):
        code = (r.get("ident") or "").strip()
        if len(code) != 4:
            continue
        row = {
            "code": code,
            "name": r["name"],
            "municipality": r.get("municipality", ""),
            "lat": round(float(r["latitude_deg"]), 4),
            "lon": round(float(r["longitude_deg"]), 4),
            "country": r.get("iso_country", ""),
        }
        if code.startswith(PREFIXES):
            fr.append(row)
        if code in want or (r.get("type") == "large_airport" and r.get("scheduled_service") == "yes"):
            world.append(row)
    for name, rows in (("airports_fr.csv", fr), ("airports_world.csv", world)):
        rows.sort(key=lambda x: x["code"])
        with (REF / name).open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"{len(rows)} airports -> {REF / name}")
    missing = sorted(want - {r["code"] for r in world})
    if missing:
        print("WARNING codes not found in OurAirports:", ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
