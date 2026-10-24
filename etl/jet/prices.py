"""Download the price of jet fuel and the dollar-euro rate, monthly, into data/raw/prices/.

- EIA (U.S. Energy Information Administration): U.S. Gulf Coast kerosene-type jet fuel spot price FOB,
  dollars per gallon, monthly since 1990 (series EER_EPJK_PF4_RGC_DPG), the only jet fuel price published
  as open data.
- ECB: US dollar per euro reference rate, monthly average (EXR.M.USD.EUR.SP00.A).

Usage: python3 etl/jet/prices.py
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "prices"
FILES = {
    "eia_jet_gulf.xls": "https://www.eia.gov/dnav/pet/hist_xls/EER_EPJK_PF4_RGC_DPGm.xls",
    "ecb_usd_eur.csv": "https://data-api.ecb.europa.eu/service/data/EXR/M.USD.EUR.SP00.A?format=csvdata&startPeriod=2010-01",
}


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        req = urllib.request.Request(url, headers={"User-Agent": "aviationdata (open-data journalism)"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if len(data) < 2000:
            raise SystemExit(f"{name}: only {len(data)} bytes from {url}")
        (RAW / name).write_bytes(data)
        print(f"  {name}: {len(data) // 1024} KB")


if __name__ == "__main__":
    main()
