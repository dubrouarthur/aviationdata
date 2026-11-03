"""Write web/public/data/co2/liaisons.json for the CO2 calculator of « Combien de CO2 pour un vol ? »:
every pair of airports Eurostat publishes for France (avia_par_fr, quarterly, see routes.py) with its
passengers, seats and flights per quarter (both directions together), the confidential pairs, and each
airport's position, French name and zone (metropolitan France, overseas France, abroad).

- "LF90" (Paris airport system) and codes that are not airports are dropped (CLAUDE.md, Eurostat).
- A domestic pair is published from both ends (FR_A_FR_B and FR_B_FR_A): the one with more passengers
  is kept; the two differ by a few hundred passengers a quarter.
- Names: the DGAC's French names (aeroports.json) for French airports, eu_airports.csv for Europe,
  OurAirports for the rest; countries in French from countries_fr.csv (Eurostat writes UK and EL).
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "routes" / "avia_par_fr_Q.json"
OURAIRPORTS = ROOT / "data" / "raw" / "eurostat" / "ourairports.csv"
OUT = ROOT / "web" / "public" / "data" / "co2" / "liaisons.json"
UNIT = {"PAS_CRD": "PAS", "ST_PAS": "SEAT", "CAF_PAS": "FLIGHT"}
NOT_AIRPORTS = {"LF90", "XX99", "OTH"}
OVERSEAS = {"GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF", "NC", "PF", "WF"}
EUROSTAT_ISO = {"UK": "GB", "EL": "GR"}


def read_cube(path: Path):
    d = json.loads(path.read_text())
    dims, size = d["id"], d["size"]
    idx = {k: d["dimension"][k]["category"]["index"] for k in dims}
    inv = {k: {v: c for c, v in idx[k].items()} for k in dims}
    status = d.get("status", {})

    def coords(key: str):
        i, out = int(key), []
        for n in reversed(size):
            out.append(i % n)
            i //= n
        return {k: inv[k][c] for k, c in zip(dims, reversed(out), strict=True)}

    values = {}
    for key, v in d["value"].items():
        c = coords(key)
        if UNIT[c["tra_meas"]] == c["unit"]:
            values[(c["airp_pr"], c["tra_meas"], c["time"])] = v
    conf = {coords(k)["airp_pr"] for k, s in status.items() if "c" in s.lower()}
    times = sorted(idx["time"], key=idx["time"].get)
    return d.get("updated"), times, list(idx["airp_pr"]), values, conf


def main() -> int:
    for p in (SRC, OURAIRPORTS):
        if not p.exists():
            print(f"missing {p}: run etl/co2/routes.py and etl/eu/eurostat.py", file=sys.stderr)
            return 1
    updated, times, pairs, values, conf = read_cube(SRC)
    # the last complete year, and the one before it
    years = sorted({t[:4] for t in times if all(f"{t[:4]}-Q{q}" in times for q in range(1, 5))})[-2:]
    quarters = [f"{y}-Q{q}" for y in years for q in range(1, 5)]

    routes, secret = {}, set()
    for p in pairs:
        _, a, _, b = p.split("_")
        if a in NOT_AIRPORTS or b in NOT_AIRPORTS:
            continue
        key = tuple(sorted((a, b)))
        series = {m: [values.get((p, m, t)) for t in quarters] for m in UNIT}
        if all(v is None for v in series["PAS_CRD"]):
            if p in conf:
                secret.add(key)
            continue
        total = sum(v or 0 for v in series["PAS_CRD"])
        if key in routes and routes[key][0] >= total:
            continue
        routes[key] = (total, a, b, series)
    secret -= set(routes)

    used = {c for k in [*routes, *secret] for c in k}
    names = {}
    aero = json.loads((ROOT / "web" / "public" / "data" / "aeroports.json").read_text())["airports"]
    names.update({a["code"]: a["nom"] for a in aero})
    with (ROOT / "data" / "ref" / "eu_airports.csv").open(encoding="utf-8") as f:
        names.update({r["code"]: r["name"] for r in csv.DictReader(f) if r["name"]})
    with (ROOT / "data" / "ref" / "countries_fr.csv").open(encoding="utf-8") as f:
        country_fr = {r["iso2"]: r["label"] for r in csv.DictReader(f)}
    country_fr.setdefault("FR", "France")
    country_fr.update(
        {
            "GP": "Guadeloupe",
            "MQ": "Martinique",
            "GF": "Guyane",
            "RE": "La Réunion",
            "YT": "Mayotte",
            "PM": "Saint-Pierre-et-Miquelon",
            "BL": "Saint-Barthélemy",
            "MF": "Saint-Martin",
            "NC": "Nouvelle-Calédonie",
            "PF": "Polynésie française",
            "WF": "Wallis-et-Futuna",
        }
    )
    airports = {}
    with OURAIRPORTS.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["ident"] not in used:
                continue
            cc = r["iso_country"]
            zone = "MET" if cc == "FR" else "OM" if cc in OVERSEAS else "INT"
            airports[r["ident"]] = {
                "code": r["ident"],
                "iata": r["iata_code"] or "",
                "name": names.get(r["ident"]) or r["name"],
                "city": r["municipality"] or "",
                "country": country_fr.get(cc, cc),
                "zone": zone,
                "lat": round(float(r["latitude_deg"]), 4),
                "lon": round(float(r["longitude_deg"]), 4),
            }
    missing = used - airports.keys()
    if missing:
        print(f"airports missing from OurAirports, routes dropped: {sorted(missing)}", file=sys.stderr)
    out_routes = [
        {"a": a, "b": b, "pax": s["PAS_CRD"], "seats": s["ST_PAS"], "flights": s["CAF_PAS"]}
        for (_, a, b, s) in sorted(routes.values(), key=lambda r: -r[0])
        if a in airports and b in airports
    ]
    out = {
        "source": "Eurostat, avia_par_fr (liaisons aériennes de la France), trimestriel",
        "updated": updated,
        "years": [int(y) for y in years],
        "quarters": quarters,
        "airports": sorted(airports.values(), key=lambda a: a["name"]),
        "routes": out_routes,
        "confidential": sorted([list(k) for k in secret if all(c in airports for c in k)]),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(
        f"{OUT.relative_to(ROOT)}: {len(out_routes)} routes, {len(out['confidential'])} confidential, "
        f"{len(airports)} airports, {quarters[0]} to {quarters[-1]}, {OUT.stat().st_size // 1024} KB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
