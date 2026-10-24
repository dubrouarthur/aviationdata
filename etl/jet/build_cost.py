"""What the fuel costs, and how loaded a Paris-New York flight is: the money side of the simulator.

Inputs:
- data/raw/prices/ (prices.py): EIA U.S. Gulf Coast jet fuel spot price (dollars per gallon, monthly) and
  the ECB dollar-euro reference rate (monthly average);
- data/raw/trafic/*ASP_PAP_<year>.csv (DGAC, etl/fetch.py): traffic per airport pair, both directions,
  with movements (PAP_MVT), passengers and passenger-equivalents (passengers + 100 kg of freight each);
- web/public/data/co2.json: the DGAC long-haul CO2 factor in g per passenger-equivalent-km.

Called by build_jet.py; writes web/public/data/jet/cost.json:
- prices: [month, euros per tonne] since 2019; year: the last complete year's mean; last: the last month;
  recent: the mean of the last twelve months, the price the story uses;
- pair: Paris-CDG <-> New York-JFK per complete year: movements, passengers, passenger-equivalents;
- factors: tonnes of CO2 per tonne of fuel (ICAO), litres per US gallon, kg per litre, g CO2 per Peq-km.

A flight's fuel, used by the page: g_peqkm x km x (passenger-equivalents per movement) / 3.16.
"""

from __future__ import annotations

import csv
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "etl"))
import dgac  # noqa: E402

RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data" / "jet"
CO2_PER_FUEL = 3.16  # t of CO2 per t of jet fuel burnt (ICAO Carbon Emissions Calculator methodology)
LITRES_PER_GALLON = 3.785411784
KG_PER_LITRE = 0.8  # jet A-1 is 0.775 to 0.840 kg/L at 15 C
PAIR = ("LFPG", "KJFK")
FIRST = "2019-01"


def dollars_per_gallon() -> dict[str, float]:
    import pandas as pd

    x = pd.read_excel(RAW / "prices" / "eia_jet_gulf.xls", sheet_name="Data 1", engine="xlrd", skiprows=2)
    x.columns = ["date", "usd_gal"]
    x = x.dropna()
    return {pd.Timestamp(d).strftime("%Y-%m"): float(v) for d, v in zip(x.date, x.usd_gal, strict=True)}


def dollars_per_euro() -> dict[str, float]:
    text = (RAW / "prices" / "ecb_usd_eur.csv").read_text(encoding="utf-8")
    rows = csv.DictReader(io.StringIO(text))
    return {r["TIME_PERIOD"]: float(r["OBS_VALUE"]) for r in rows if r["OBS_VALUE"]}


def euros_per_tonne() -> list[list]:
    usd, fx = dollars_per_gallon(), dollars_per_euro()
    per_tonne = 1000 / KG_PER_LITRE / LITRES_PER_GALLON  # gallons in a tonne
    months = sorted(m for m in usd if m in fx and m >= FIRST)
    if not months:
        raise SystemExit("cost: no month with both an EIA price and an ECB rate")
    return [[m, round(usd[m] * per_tonne / fx[m], 1)] for m in months]


def pair_traffic() -> list[dict]:
    """Paris-CDG <-> New York-JFK, per complete year (12 months published)."""
    years: dict[str, dict] = {}
    for path in sorted((RAW / "trafic").glob("*ASP_PAP_*.csv")):
        t = dgac.read_table(path)
        c = {k: t.col(k) for k in ("ANMOIS", "PAP", "PAP_MVT", "PAP_PAX", "PAP_PEQ", "PAP_DIST")}
        if None in c.values():
            raise SystemExit(f"cost: {path.name} lacks {[k for k, v in c.items() if v is None]}")
        for r in t.rows:
            if set(r[c["PAP"]].strip().split("_")) != set(PAIR):
                continue
            m = dgac.to_month(r[c["ANMOIS"]])
            y = years.setdefault(m[:4], {"months": set(), "mvt": 0, "pax": 0, "peq": 0, "km": 0})
            y["months"].add(m)
            y["mvt"] += dgac.to_num(r[c["PAP_MVT"]]) or 0
            y["pax"] += dgac.to_num(r[c["PAP_PAX"]]) or 0
            y["peq"] += dgac.to_num(r[c["PAP_PEQ"]]) or 0
            y["km"] = dgac.to_num(r[c["PAP_DIST"]]) or y["km"]
    out = [
        {"y": int(y), "mvt": int(v["mvt"]), "pax": int(v["pax"]), "peq": int(v["peq"]), "km": int(v["km"])}
        for y, v in sorted(years.items())
        if len(v["months"]) == 12 and v["mvt"]
    ]
    if not out:
        raise SystemExit("cost: no complete year of Paris-CDG <-> New York-JFK in the DGAC PAP files")
    return out


def build() -> dict:
    prices = euros_per_tonne()
    full = sorted({m[:4] for m, _ in prices if sum(1 for n, _ in prices if n[:4] == m[:4]) == 12})
    year = full[-1]
    co2 = json.loads((ROOT / "web" / "public" / "data" / "co2.json").read_text())
    out = {
        "prices": prices,
        "year": {"y": int(year), "eur_t": round(sum(p for m, p in prices if m[:4] == year) / 12, 1)},
        "last": {"m": prices[-1][0], "eur_t": prices[-1][1]},
        # the reference price of the story: the mean of the last twelve months published
        "recent": {
            "from": prices[-12][0],
            "to": prices[-1][0],
            "eur_t": round(sum(p for _, p in prices[-12:]) / 12, 1),
        },
        "pair": pair_traffic(),
        "factors": {
            "co2_per_fuel": CO2_PER_FUEL,
            "litres_per_gallon": LITRES_PER_GALLON,
            "kg_per_litre": KG_PER_LITRE,
            "g_peqkm": co2["g_peqkm"]["INTL_LC"][-1],
            "g_peqkm_year": co2["years"][-1],
        },
    }
    (OUT / "cost.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    p = out["pair"][-1]
    print(
        f"  cost.json: fuel {out['year']['eur_t']} EUR/t in {year}, {out['last']['eur_t']} in {out['last']['m']};"
        f" CDG-JFK {p['y']}: {p['mvt']} movements, {p['peq'] / p['mvt']:.0f} Peq per movement"
    )
    return out


if __name__ == "__main__":
    build()
