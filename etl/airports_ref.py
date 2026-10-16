"""Build data/ref/airports_fr.csv: coordinates of French airports by ICAO code.

Source: OurAirports (public domain), https://github.com/davidmegginson/ourairports-data
Kept: metropolitan France (LF) and overseas territories (TF, SO, FM, NT, NW, NL).
"""

from __future__ import annotations

import csv
import io
import sys
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"
PREFIXES = ("LF", "TF", "SO", "FM", "NT", "NW", "NL")
OUT = Path(__file__).resolve().parent.parent / "data" / "ref" / "airports_fr.csv"


def main() -> int:
    raw = urllib.request.urlopen(URL, timeout=120).read().decode("utf-8")
    rows = []
    for r in csv.DictReader(io.StringIO(raw)):
        code = (r.get("ident") or "").strip()
        if len(code) == 4 and code.startswith(PREFIXES):
            rows.append(
                {
                    "code": code,
                    "name": r["name"],
                    "municipality": r.get("municipality", ""),
                    "lat": round(float(r["latitude_deg"]), 4),
                    "lon": round(float(r["longitude_deg"]), 4),
                    "country": r.get("iso_country", ""),
                }
            )
    rows.sort(key=lambda x: x["code"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} airports -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
