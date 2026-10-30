"""Download the Eurostat air passenger tables and the OurAirports coordinates into data/raw/eurostat/.

Eurostat (reuse authorised for any purpose, source acknowledged and changes stated:
https://ec.europa.eu/eurostat/help/copyright-notice):
- avia_paoc, passengers carried by reporting country, monthly and annual, every transport coverage
  (total, national, international, intra-EU, extra-EU), all schedules together;
- avia_paoa, passengers carried by reporting airport, annual.
OurAirports (public domain, https://ourairports.com/data/): airport coordinates.

The Eurostat dissemination API answers from the cloud session. Each file is kept with the table's
"updated" stamp in manifest.json, which build_eu.py writes into the page's meta.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "eurostat"
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
TABLES = {
    "avia_paoc_M.json": "avia_paoc?format=JSON&lang=en&freq=M&unit=PAS&tra_meas=PAS_CRD&schedule=TOTAL",
    "avia_paoc_A.json": "avia_paoc?format=JSON&lang=en&freq=A&unit=PAS&tra_meas=PAS_CRD&schedule=TOTAL",
    "avia_paoa_A.json": "avia_paoa?format=JSON&lang=en&freq=A&unit=PAS&tra_meas=PAS_CRD&tra_cov=TOTAL&schedule=TOTAL",
}
OURAIRPORTS = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "aviationdata (open-data magazine)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = {"fetched": datetime.now(UTC).isoformat(timespec="seconds"), "files": {}}
    for name, query in TABLES.items():
        body = get(API + query)
        data = json.loads(body)
        if "value" not in data or not data["value"]:
            print(f"{name}: empty answer", file=sys.stderr)
            return 1
        (RAW / name).write_bytes(body)
        manifest["files"][name] = {"url": API + query, "updated": data.get("updated"), "values": len(data["value"])}
        print(f"{name}: {len(data['value'])} values, updated {data.get('updated')}")
    (RAW / "ourairports.csv").write_bytes(get(OURAIRPORTS))
    manifest["files"]["ourairports.csv"] = {"url": OURAIRPORTS}
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
