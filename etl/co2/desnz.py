"""Write web/public/data/co2/classes.json from the UK government's 2025 greenhouse gas conversion
factors (DESNZ, flat file, Open Government Licence v3.0), downloaded into data/raw/desnz/:

    https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025

The calculator of « Combien de CO2 pour un vol ? » keeps the DGAC's average grams per passenger-km and
takes from DESNZ only two things: how much a seat of each cabin class weighs against the average
passenger (business takes more floor than economy), and how much the effects other than CO2 (contrails,
NOx: "radiative forcing") add, as DESNZ counts them. Kept raw, kg CO2 per passenger-km; the ratios are
computed by the page (web/src/carbone/calc.js) and again by web/scripts/check_carbone.py.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "desnz" / "flat2025.xlsx"
URL = "https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx"
OUT = ROOT / "web" / "public" / "data" / "co2" / "classes.json"
HAULS = {"Short-haul, to/from UK": "short", "Long-haul, to/from UK": "long"}
CLASSES = {
    "Average passenger": "average",
    "Economy class": "economy",
    "Premium economy class": "premium",
    "Business class": "business",
    "First class": "first",
}


def main() -> int:
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "aviationdata (open-data magazine)"})
        with urllib.request.urlopen(req, timeout=120) as r:
            RAW.write_bytes(r.read())
    import openpyxl  # only here: the build of the site does not need it

    rows = openpyxl.load_workbook(RAW, read_only=True).worksheets[-1].iter_rows(values_only=True)
    out = {h: {"without_rf": {}, "with_rf": {}} for h in HAULS.values()}
    for r in rows:
        if r[2] != "Business travel- air" or r[7] != "passenger.km" or r[8] != "kg CO2e of CO2 per unit":
            continue
        haul, cls, rf = HAULS.get(r[4]), CLASSES.get(r[5]), r[6]
        if haul and cls and rf in ("With RF", "Without RF"):
            out[haul]["with_rf" if rf == "With RF" else "without_rf"][cls] = r[9]
    need = {"short": {"average", "economy", "business"}, "long": set(CLASSES.values())}
    for h, cls in need.items():
        missing = cls - out[h]["without_rf"].keys() - set()
        if missing or "average" not in out[h]["with_rf"]:
            print(f"DESNZ {h}: missing {sorted(missing)}", file=sys.stderr)
            return 1
    doc = {
        "source": "DESNZ, UK Government GHG Conversion Factors for Company Reporting 2025 (flat file), Business travel - air, kg CO2e of CO2 per passenger.km",
        "url": URL,
        "year": 2025,
        **out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1))
    print(f"{OUT.relative_to(ROOT)}: short {out['short']['without_rf']}, long {out['long']['without_rf']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
