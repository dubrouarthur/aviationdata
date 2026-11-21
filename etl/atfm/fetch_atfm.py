"""Download EUROCONTROL's daily en-route ATFM delays by air navigation service provider into data/raw/atfm/.

Source: EUROCONTROL Performance Review Unit, Aviation Intelligence Portal (ansperformance.eu), « En-route ATFM
delays (AUA) », one bzip2 CSV a year since 2014: for each day and each provider, the flights it handled and the
minutes of en-route ATFM delay attributed to it, by cause. Free reuse with the source acknowledged.

    python3 etl/atfm/fetch_atfm.py [--from 2014]
"""

import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "atfm"
URL = "https://www.eurocontrol.int/performance/data/download/csv/ert_dly_ansp_{y}.csv.bz2"


def main():
    first = int(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else 2014
    OUT.mkdir(parents=True, exist_ok=True)
    for y in range(first, date.today().year + 1):
        for i in range(4):
            try:
                with urllib.request.urlopen(URL.format(y=y), timeout=120) as r:
                    body = r.read()
                break
            except Exception as e:  # noqa: BLE001
                if i == 3:
                    raise SystemExit(f"{y}: {e}") from e
                time.sleep(3 * (i + 1))
        assert body[:3] == b"BZh", f"{y}: not a bzip2 file"
        (OUT / f"ert_dly_ansp_{y}.csv.bz2").write_bytes(body)
        print(f"{y}: {len(body) // 1024} ko")


if __name__ == "__main__":
    main()
