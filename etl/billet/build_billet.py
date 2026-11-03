"""Write web/public/data/billet/hicp.json from data/raw/hicp/ (see hicp.py).

The page « Le billet d'avion est-il plus cher ? » reads it with prix.json (DGAC IPTAP, written by
etl/build.py): the DGAC index of airfares from France against the general price level in France.
Months from January 2012 (the first month of the DGAC series), index 2015 = 100 as Eurostat gives it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "hicp" / "prc_hicp_minr_FR.json"
OUT = ROOT / "web" / "public" / "data" / "billet" / "hicp.json"
SERIES = {"TOTAL": "all", "CP0733": "air", "CP0731": "rail"}
START = "2012-01"


def read(path: Path = RAW) -> dict:
    d = json.loads(path.read_text())
    dims = d["id"]
    sizes = d["size"]
    cats = {k: d["dimension"][k]["category"]["index"] for k in dims}
    times = sorted(cats["time"], key=cats["time"].get)
    stride = {}
    acc = 1
    for k, n in zip(reversed(dims), reversed(sizes), strict=True):
        stride[k] = acc
        acc *= n
    months = [t for t in times if t >= START]
    out = {"months": months, "updated": d.get("updated")}
    for code, key in SERIES.items():
        if code not in cats["coicop18"]:
            raise SystemExit(f"hicp: {code} missing from {path.name}")
        base = cats["coicop18"][code] * stride["coicop18"]
        vals = []
        for t in months:
            i = base + cats["time"][t] * stride["time"]
            v = d["value"].get(str(i))
            vals.append(None if v is None else round(float(v), 2))
        out[key] = vals
    # the last month must exist for all three series, or the page would compare different months
    while out["months"] and any(out[k][-1] is None for k in SERIES.values()):
        for k in ("months", *SERIES.values()):
            out[k].pop()
    return out


def main() -> int:
    if not RAW.exists():
        print(f"missing {RAW}: run python3 etl/billet/hicp.py", file=sys.stderr)
        return 1
    out = read()
    out["source"] = "Eurostat, prc_hicp_minr (IPCH, ECOICOP 2), France, indice 2015 = 100"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {out['months'][0]} to {out['months'][-1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
