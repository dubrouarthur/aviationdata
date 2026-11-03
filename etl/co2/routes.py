"""Download Eurostat's air routes of France (avia_par_fr) into data/raw/routes/: for each pair of airports,
each quarter, passengers carried (PAS_CRD), seats offered (ST_PAS) and commercial passenger flights
(CAF_PAS), both directions together. Routes whose figures would reveal one carrier are confidential
(status "C"): Eurostat lists the pair without its numbers.

Eurostat (reuse authorised, source acknowledged, changes stated:
https://ec.europa.eu/eurostat/help/copyright-notice). The dissemination API answers from the cloud session.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "routes"
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
QUERY = "avia_par_fr?format=JSON&lang=fr&freq=Q&sinceTimePeriod=2023-Q1&tra_meas=PAS_CRD&tra_meas=ST_PAS&tra_meas=CAF_PAS"
NAME = "avia_par_fr_Q.json"


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(API + QUERY, headers={"User-Agent": "aviationdata (open-data magazine)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        body = r.read()
    data = json.loads(body)
    if not data.get("value"):
        print("avia_par_fr: empty answer", file=sys.stderr)
        return 1
    (RAW / NAME).write_bytes(body)
    manifest = {
        "fetched": datetime.now(UTC).isoformat(timespec="seconds"),
        "files": {NAME: {"url": API + QUERY, "updated": data.get("updated"), "values": len(data["value"])}},
    }
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"{NAME}: {len(data['value'])} values, updated {data.get('updated')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
