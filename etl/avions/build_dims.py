"""The size of each airliner, for the drawings to scale: web/public/data/avions/dims.json.

Source: Federal Aviation Administration, Aircraft Characteristics Database (data/raw/aircraft/faa_acd.xlsx,
etl/avions/fetch.py; public domain, values from the manufacturers' manuals). For each ICAO type of
etl/avions/types_table.py: overall length, wingspan (with winglets or sharklets when the type has them,
the span at the gate), number and class of engines. Where the engines hang comes from MOUNT
(types_table.py). A type absent from the database (the CRJ1000 in the October 2024 edition) gets no
drawing rather than a borrowed size.

    python3 etl/avions/build_dims.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from types_table import MOUNT, TYPES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "aircraft" / "faa_acd.xlsx"
OUT = ROOT / "web" / "public" / "data" / "avions" / "dims.json"
FT = 0.3048


def metres(v) -> float | None:
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v) * FT, 1)


def main() -> int:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}: run python3 etl/avions/fetch.py")
    df = pd.read_excel(SRC, sheet_name="ACD_Data")
    need = {"ICAO_Code", "Physical_Class_Engine", "Num_Engines", "Length_ft"}
    if missing := need - set(df.columns):
        raise SystemExit(f"{SRC.name}: columns missing {sorted(missing)}")
    df = df[df["ICAO_Code"].isin(TYPES)].drop_duplicates("ICAO_Code").set_index("ICAO_Code")
    types = {}
    for code in TYPES:
        if code not in df.index:
            continue
        r = df.loc[code]
        span = metres(r["Wingspan_ft_with_winglets_sharklets"]) or metres(r["Wingspan_ft_without_winglets_sharklets"])
        length = metres(r["Length_ft"])
        if not span or not length:
            continue
        types[code] = {
            "len": length,
            "span": span,
            "eng": int(r["Num_Engines"]),
            "prop": str(r["Physical_Class_Engine"]).strip() == "Turboprop",
            "mount": MOUNT.get(code, "wing"),
        }
    out = {
        "source": "FAA, Aircraft Characteristics Database (octobre 2024)",
        "unit": "m",
        "types": types,
        "absent": sorted(set(TYPES) - set(types)),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {len(types)} types, absent {out['absent']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
