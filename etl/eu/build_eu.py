"""Air passengers in Europe since 2004: the dashboard of the fourth investigation.

Inputs: data/raw/eurostat/ (eurostat.py): Eurostat avia_paoc (passengers carried by reporting country,
monthly and annual) and avia_paoa (by reporting airport, annual); OurAirports coordinates;
data/ref/eu_airports.csv (French names of the main airports, coordinates of the closed ones).

Scope:
- the 27 countries of the European Union and the three EFTA countries that report to Eurostat (Norway,
  Switzerland, Iceland). The United Kingdom stops in January 2020 and the candidate countries start
  between 2015 and 2025: they are left out, so that every year compares the same countries;
- from 2004: Regulation 437/2003 makes the series comparable from 2003, some countries reporting in full
  from 2005 (Eurostat metadata avia_pa_esms, 15.2); Bulgaria starts in 2007 and Croatia in 2008, as does
  the Union's own aggregate. Comparisons across Europe start in 2008;
- "passengers carried": a passenger counts once per flight. A country counts its arrivals and departures,
  its national passengers once; the Union's aggregate counts once a passenger between two of its
  countries (Eurostat removes the mirror declarations). An airport counts its own arrivals and departures:
  airports never add up to a country.

Writes web/public/data/eu/eu.json:
- zones: the Union and 30 countries, annual totals per coverage (total, national, international,
  intra-EU, extra-EU) for 2004-2025, and the monthly series since 2004 (total, national, international);
- airports: every airport above 250 000 passengers a year at least once since 2008, annual since 2008,
  with its coordinates;
- barycentre: the centre of gravity of the passengers of every airport, each year since 2008 (airports
  between 27° and 72° north, 32° west and 45° east: French overseas departments and Svalbard left out);
- meta: Eurostat's update stamp, the last month of each series, what is left out and why.
"""

from __future__ import annotations

import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "eurostat"
REF = ROOT / "data" / "ref" / "eu_airports.csv"
OUT = ROOT / "web" / "public" / "data" / "eu"

FIRST, CROSS, LAST = 2004, 2008, 2025
COVERAGES = {
    "total": "TOTAL",
    "nat": "NAT",
    "intl": "INTL",
    "ieu": "INTL_IEU27_2020",
    "xeu": "INTL_XEU27_2020",
}
MONTHLY = ("total", "nat", "intl")
COUNTRIES = {
    "BE": "Belgique",
    "BG": "Bulgarie",
    "CZ": "Tchéquie",
    "DK": "Danemark",
    "DE": "Allemagne",
    "EE": "Estonie",
    "IE": "Irlande",
    "EL": "Grèce",
    "ES": "Espagne",
    "FR": "France",
    "HR": "Croatie",
    "IT": "Italie",
    "CY": "Chypre",
    "LV": "Lettonie",
    "LT": "Lituanie",
    "LU": "Luxembourg",
    "HU": "Hongrie",
    "MT": "Malte",
    "NL": "Pays-Bas",
    "AT": "Autriche",
    "PL": "Pologne",
    "PT": "Portugal",
    "RO": "Roumanie",
    "SI": "Slovénie",
    "SK": "Slovaquie",
    "FI": "Finlande",
    "SE": "Suède",
    "IS": "Islande",
    "NO": "Norvège",
    "CH": "Suisse",
}
EU27 = set(COUNTRIES) - {"IS", "NO", "CH"}
# ISO 3166 numeric codes, as in world-atlas (the map of the countries)
ISO_NUM = {
    "BE": 56, "BG": 100, "CZ": 203, "DK": 208, "DE": 276, "EE": 233, "IE": 372, "EL": 300, "ES": 724,
    "FR": 250, "HR": 191, "IT": 380, "CY": 196, "LV": 428, "LT": 440, "LU": 442, "HU": 348, "MT": 470,
    "NL": 528, "AT": 40, "PL": 616, "PT": 620, "RO": 642, "SI": 705, "SK": 703, "FI": 246, "SE": 752,
    "IS": 352, "NO": 578, "CH": 756,
}  # fmt: skip
BOX = (27.0, 72.0, -32.0, 45.0)  # south, north, west, east: the barycentre's Europe
MAP_MIN = 250_000  # an airport is drawn if it passed this once since 2008


def jsonstat(name: str):
    """Every value of a Eurostat JSON-stat file, keyed by its category codes, with its flag."""
    d = json.loads((RAW / name).read_text())
    ids, size = d["id"], d["size"]
    cats = [[c for c, _ in sorted(d["dimension"][k]["category"]["index"].items(), key=lambda x: x[1])] for k in ids]
    strides = [math.prod(size[i + 1 :]) for i in range(len(size))]
    status = d.get("status", {})
    out = {}
    for k, v in d["value"].items():
        i = int(k)
        key = tuple(cats[j][(i // strides[j]) % size[j]] for j in range(len(size)))
        out[key] = (v, status.get(k))
    return d, ids, out


def country_tables():
    """zone -> coverage -> year -> passengers (annual), and zone -> coverage -> month -> passengers."""
    annual = defaultdict(lambda: defaultdict(dict))
    monthly = defaultdict(lambda: defaultdict(dict))
    flagged = []
    for name, store, key in (("avia_paoc_A.json", annual, int), ("avia_paoc_M.json", monthly, str)):
        _, ids, out = jsonstat(name)
        g, c, t = ids.index("geo"), ids.index("tra_cov"), ids.index("time")
        for k, (v, f) in out.items():
            if v is None or (k[g] not in COUNTRIES and k[g] != "EU27_2020"):
                continue
            if int(k[t][:4]) < FIRST:
                continue
            if f:
                flagged.append((name, k[g], k[c], k[t], f))
            store[k[g]][k[c]][key(k[t])] = v
    if flagged:
        sys.exit(f"flagged values since {FIRST}: {flagged[:5]} (decide how to show them first)")
    return annual, monthly


def months_between(a: str, b: str) -> list[str]:
    y, m = int(a[:4]), int(a[5:])
    out = []
    while f"{y:04d}-{m:02d}" <= b:
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def zones_json(annual, monthly):
    years = list(range(FIRST, LAST + 1))
    zones = []
    for code in ["EU27_2020", *COUNTRIES]:
        a = annual[code]
        first = min(y for y in a["TOTAL"] if y >= FIRST)
        # a year counts only when its twelve months are there (the annual table says the same thing)
        z = {
            "code": code,
            "name": "Union européenne" if code == "EU27_2020" else COUNTRIES[code],
            "eu": code == "EU27_2020" or code in EU27,
            "iso": ISO_NUM.get(code),
            "first": first,
        }
        for k, cov in COVERAGES.items():
            z[k] = [a[cov].get(y) for y in years]
        m = monthly[code]["TOTAL"]

        def months_match(y, m=m, a=a):
            ms = [m.get(f"{y}-{i:02d}") for i in range(1, 13)]
            return None not in ms and abs(sum(ms) - a["TOTAL"][y]) <= 2

        # the monthly series starts with the first year whose months add up to the year, every year after too
        # (Cyprus in 2004, for one, reports by month only part of its traffic)
        mfirst = next(
            y for y in range(first, LAST + 1) if all(months_match(x) for x in range(y, LAST + 1) if a["TOTAL"].get(x))
        )
        start = f"{mfirst:04d}-01"
        last = max(m)
        z["monthStart"], z["monthLast"] = start, last
        z["monthly"] = {k: [monthly[code][COVERAGES[k]].get(x) for x in months_between(start, last)] for k in MONTHLY}
        if mfirst != first:
            print(f"  {code}: annual from {first}, monthly from {mfirst} (months short of the year before)")
        zones.append(z)
    return years, zones


def references():
    """OurAirports coordinates by ICAO code, then our own table (French names, closed airports)."""
    coords = {}
    with open(RAW / "ourairports.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            for c in (r["ident"], r["gps_code"], r["icao_code"]):
                if c and len(c) == 4 and c not in coords:
                    coords[c] = {
                        "lat": float(r["latitude_deg"]),
                        "lon": float(r["longitude_deg"]),
                        # "Verona Villafranca Airport" -> "Verona Villafranca": the town alone is ambiguous
                        "city": re.sub(r"\s+(International\s+)?Air(port|field)$", "", r["name"]).strip(),
                    }
    names = {}
    with open(REF, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            names[r["code"]] = r["name"]
            if r["lat"]:
                coords[r["code"]] = {"lat": float(r["lat"]), "lon": float(r["lon"]), "city": r["name"]}
    return coords, names


def airports_json(coords, names):
    d, ids, out = jsonstat("avia_paoa_A.json")
    labels = d["dimension"]["rep_airp"]["category"]["label"]
    a, t = ids.index("rep_airp"), ids.index("time")
    series = defaultdict(dict)
    for k, (v, f) in out.items():
        y = int(k[t])
        if v is None or y < CROSS or y > LAST:
            continue
        if f:
            sys.exit(f"flagged airport value {k} {f}")
        series[k[a]][y] = v
    years = list(range(CROSS, LAST + 1))
    kept, left = [], defaultdict(float)
    for rep, s in series.items():
        cc, code = rep.split("_", 1)
        if cc not in COUNTRIES:
            continue
        system = not code.isalpha()  # "LF90 Paris airport system", "LZ99 unknown", "OTH": not airports
        where = coords.get(code)
        inside = where and BOX[0] <= where["lat"] <= BOX[1] and BOX[2] <= where["lon"] <= BOX[3]
        for y, v in s.items():
            if system:
                left[("system", y)] += v
            elif not where:
                left[("nocoord", y)] += v
            elif not inside:
                left[("outside", y)] += v
        if system or not where:
            continue
        kept.append(
            {
                "code": code,
                "country": cc,
                "name": names.get(code) or where["city"] or labels[rep].removesuffix(" airport").title(),
                "named": code in names,
                "lat": round(where["lat"], 4),
                "lon": round(where["lon"], 4),
                "box": bool(inside),
                "pax": [s.get(y) for y in years],
            }
        )
    return years, kept, left


def barycentre(years, airports):
    """Weighted mean of the airports' positions on the sphere, each year (airports inside BOX)."""
    out = []
    for i, y in enumerate(years):
        x = yy = z = w = south = 0.0
        n = 0
        for ap in airports:
            v = ap["pax"][i]
            if not v or not ap["box"]:
                continue
            la, lo = math.radians(ap["lat"]), math.radians(ap["lon"])
            x += v * math.cos(la) * math.cos(lo)
            yy += v * math.cos(la) * math.sin(lo)
            z += v * math.sin(la)
            w += v
            south += v if ap["lat"] < 45 else 0
            n += 1
        out.append(
            {
                "y": y,
                "lat": round(math.degrees(math.atan2(z, math.hypot(x, yy))), 4),
                "lon": round(math.degrees(math.atan2(yy, x)), 4),
                "airports": n,
                "pax": w,
                "south45": round(100 * south / w, 3),  # share of the passengers south of the 45th parallel
            }
        )
    return out


def main() -> int:
    annual, monthly = country_tables()
    years, zones = zones_json(annual, monthly)
    coords, names = references()
    ap_years, airports, left = airports_json(coords, names)
    bary = barycentre(ap_years, airports)
    # the airports not on the map: aggregates, codes without a position, airports far from Europe
    left_out = {kind: [round(left.get((kind, y), 0)) for y in ap_years] for kind in ("system", "nocoord", "outside")}
    drawn = [ap for ap in airports if max(v or 0 for v in ap["pax"]) >= MAP_MIN]
    manifest = json.loads((RAW / "manifest.json").read_text())
    meta = {
        "updated": manifest["files"]["avia_paoc_A.json"]["updated"],
        "fetched": manifest["fetched"],
        "first": FIRST,
        "cross": CROSS,
        "last": LAST,
        "box": BOX,
        "mapMin": MAP_MIN,
        "leftOut": left_out,
        "airportsAll": len(airports),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    data = {
        "meta": meta,
        "years": years,
        "zones": zones,
        "airportYears": ap_years,
        "airports": sorted(drawn, key=lambda a: -(a["pax"][-1] or 0)),
        "barycentre": bary,
    }
    (OUT / "eu.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    eu = zones[0]
    print(
        f"eu.json: {len(zones)} zones, {len(drawn)} airports drawn of {len(airports)}, "
        f"EU {eu['total'][years.index(2019)] / 1e6:.1f} M (2019) -> {eu['total'][-1] / 1e6:.1f} M ({LAST}), "
        f"barycentre {bary[0]['lat']},{bary[0]['lon']} -> {bary[-1]['lat']},{bary[-1]['lon']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
