"""Download the French harmonised index of consumer prices (Eurostat prc_hicp_minr, ECOICOP 2) into
data/raw/hicp/: all items (TOTAL), passenger transport by air (CP0733) and by railway (CP0731),
monthly, index 2015 = 100.

Eurostat (reuse authorised for any purpose, source acknowledged and changes stated:
https://ec.europa.eu/eurostat/help/copyright-notice). prc_hicp_midx stopped in December 2025 and
points to prc_hicp_minr. The dissemination API answers from the cloud session.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "hicp"
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
QUERY = "prc_hicp_minr?format=JSON&lang=fr&geo=FR&unit=I15&coicop18=TOTAL&coicop18=CP0733&coicop18=CP0731"
NAME = "prc_hicp_minr_FR.json"


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(API + QUERY, headers={"User-Agent": "aviationdata (open-data magazine)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        body = r.read()
    data = json.loads(body)
    if not data.get("value"):
        print("prc_hicp_minr: empty answer", file=sys.stderr)
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
