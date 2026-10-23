"""Monthly North Atlantic Oscillation index from the NOAA Climate Prediction Center.

Source: NOAA CPC, "North Atlantic Oscillation (NAO)", standardised monthly index since 1950
(rotated principal component analysis of 500 hPa heights, Barnston & Livezey 1987).
https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/nao.shtml. Public domain.

    python3 etl/jet/nao.py
Writes data/raw/nao/nao_monthly.txt (year, month, index), refreshed on every run.
"""

import urllib.request
from pathlib import Path

URL = "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.monthly.b5001.current.ascii"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "nao"


def parse(text: str) -> dict:
    """{(year, month): index} from the CPC text table ('1950    1    0.9200')."""
    out = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0].isdigit():
            out[(int(parts[0]), int(parts[1]))] = float(parts[2])
    if not out:
        raise ValueError("NAO: no row read, has the CPC format changed?")
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL, timeout=60) as r:
        text = r.read().decode("ascii")
    rows = parse(text)
    (OUT / "nao_monthly.txt").write_text(text)
    last = max(rows)
    print(f"nao_monthly.txt: {len(rows)} months, last {last[0]}-{last[1]:02d}")
