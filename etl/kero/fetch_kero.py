"""Download what « D'où vient le kérosène des avions européens ? » reads, into data/raw/kero/.

- Eurostat nrg_ti_oilm: imports of kerosene-type jet fuel (SIEC O4661) by partner, monthly, thousand tonnes, for
  the EU and its largest importers (JSON-stat, API without account).
- Eurostat nrg_cb_oilm: monthly balance of jet fuel (refinery output, imports, exports, stock change, deliveries).
- Eurostat Comext ds-045409: EU imports of CN 27101921 (kerosene-type jet fuel) by partner, monthly, quantity
  (100 kg) and value (euros): the price paid at the border, origin by origin.
- EIA (US Energy Information Administration): daily spot prices, US Gulf Coast kerosene-type jet fuel ($/gallon)
  and Brent ($/barrel), public domain.

    python3 etl/kero/fetch_kero.py
"""

import json
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "kero"
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"
COMEXT = "https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/ds-045409"
GEOS = ["EU27_2020", "FR", "DE", "NL", "BE", "ES", "IT"]
SINCE = "2015-01"


def get(url, dest, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                body = r.read()
            dest.write_bytes(body)
            return len(body)
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise SystemExit(f"{url}: {e}") from e
            time.sleep(3 * (i + 1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for g in GEOS:
        n = get(f"{API}/nrg_ti_oilm?geo={g}&siec=O4661&unit=THS_T&sinceTimePeriod={SINCE}", OUT / f"imports-{g}.json")
        print(f"imports {g}: {n // 1024} ko")
    for g in ["EU27_2020", "FR"]:
        n = get(f"{API}/nrg_cb_oilm?geo={g}&siec=O4661&unit=THS_T&sinceTimePeriod={SINCE}", OUT / f"balance-{g}.json")
        print(f"balance {g}: {n // 1024} ko")
    for ind in ["QUANTITY_IN_100KG", "VALUE_IN_EUROS"]:
        url = f"{COMEXT}?freq=M&reporter=EU27_2020&product=27101921&flow=1&indicators={ind}&sinceTimePeriod=2019-01"
        n = get(url, OUT / f"comext-{ind}.json")
        d = json.loads((OUT / f"comext-{ind}.json").read_text())
        assert d.get("value"), f"Comext {ind}: vide"
        print(f"comext {ind}: {n // 1024} ko")
    for name, series in [("jet", "EER_EPJK_PF4_RGC_DPG"), ("brent", "RBRTE")]:
        n = get(f"https://www.eia.gov/dnav/pet/hist_xls/{series}d.xls", OUT / f"eia-{name}.xls")
        print(f"EIA {name}: {n // 1024} ko")


if __name__ == "__main__":
    main()
