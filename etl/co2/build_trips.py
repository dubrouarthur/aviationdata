"""Write web/public/data/co2/trajets.json: a few trips from Paris, each with the great-circle distance
between its two airports (OurAirports coordinates, data/raw/eurostat/ourairports.csv, fetched by
etl/eu/eurostat.py) and the DGAC segment whose emissions per passenger-kilometre it takes.

The page « Combien de CO2 pour un vol ? » multiplies that distance by the segment's grams of CO2 per
passenger-equivalent-kilometre (co2.json, DGAC). The DGAC computes cruise on great-circle distances
(TARMAAC); a long-haul flight is one of more than 4 h 30, to overseas France or beyond Europe and the
Mediterranean (DGAC, Bilan des émissions de CO2 du transport aérien 2024).
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "eurostat" / "ourairports.csv"
OUT = ROOT / "web" / "public" / "data" / "co2" / "trajets.json"
R_KM = 6371.0

# from, to, French names, DGAC segment (keys of co2.json)
TRIPS = [
    ("LFPO", "LFBO", "Paris-Orly", "Toulouse", "MET_INTERIEUR"),
    ("LFPO", "LFMN", "Paris-Orly", "Nice", "MET_INTERIEUR"),
    ("LFPG", "LIRF", "Paris-CDG", "Rome", "INTL_MC"),
    ("LFPO", "GMMX", "Paris-Orly", "Marrakech", "INTL_MC"),
    ("LFPG", "KJFK", "Paris-CDG", "New York", "INTL_LC"),
    ("LFPO", "TFFR", "Paris-Orly", "Pointe-à-Pitre", "MET-OM_ET_OM-OM"),
    ("LFPO", "FMEE", "Paris-Orly", "La Réunion", "MET-OM_ET_OM-OM"),
    ("LFPG", "RJTT", "Paris-CDG", "Tokyo", "INTL_LC"),
]


def great_circle(a: tuple[float, float], b: tuple[float, float]) -> float:
    (la1, lo1), (la2, lo2) = (map(math.radians, p) for p in (a, b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_KM * math.asin(math.sqrt(h))


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}: run python3 etl/eu/eurostat.py", file=sys.stderr)
        return 1
    want = {c for t in TRIPS for c in t[:2]}
    pos = {}
    with SRC.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["ident"] in want:
                pos[row["ident"]] = (float(row["latitude_deg"]), float(row["longitude_deg"]))
    missing = want - pos.keys()
    if missing:
        print(f"airports missing from OurAirports: {sorted(missing)}", file=sys.stderr)
        return 1
    trips = [
        {"from": a, "to": b, "fromName": fa, "toName": fb, "segment": seg, "km": round(great_circle(pos[a], pos[b]))}
        for a, b, fa, fb, seg in TRIPS
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"trips": trips, "source": "OurAirports, distance orthodromique"}, ensure_ascii=False, indent=1))
    for t in trips:
        print(f"{t['fromName']} – {t['toName']}: {t['km']} km ({t['segment']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
