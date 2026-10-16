"""Turn the raw DGAC files into the JSON the dashboard reads (web/public/data/).

python3 etl/build.py                 # real data from data/raw/
python3 etl/build.py --demo          # synthetic data, flagged demo=true
python3 etl/build.py --raw X --out Y # custom paths (tests)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dgac
import world

ROOT = Path(__file__).resolve().parent.parent
REF_AIRPORTS = ROOT / "data" / "ref" / "airports_fr.csv"
MANUAL_AIRPORTS = ROOT / "data" / "ref" / "airports_manual.csv"
FSC_ORDER = ["MET_RAD", "MET_TRA", "MET_OM", "OM_OM", "MET_INTL", "OM_INTL"]
IPTAP_COLS = [
    "MET_INTER_MET",
    "MET_INTER_OM",
    "MET_INTER_TOT",
    "MET_INTAL_MC",
    "MET_INTAL_LC",
    "MET_INTAL_TOT",
    "MET_ENS",
    "DOM_ENS",
    "FRA_ENS",
]
AGGREGATE_NAME = re.compile(r"autre|divers|moins de|inf[ée]rieur|<|total|regroup", re.IGNORECASE)
BRANDS = [  # editorial grouping of legal entities into brands
    (re.compile(r"^EASYJET"), "easyJet"),
    (re.compile(r"^RYANAIR|^MALTA AIR|^BUZZ|^LAUDA"), "Ryanair"),
    (re.compile(r"^TRANSAVIA"), "Transavia"),
    (
        re.compile(r"^HOP|^REGIONAL|^BRIT AIR|^AIRLINAIR|^REGIONAL COMPAGNIE"),
        "HOP! (Air France)",
    ),
    (re.compile(r"^AIR FRANCE"), "Air France"),
    (re.compile(r"^WIZZ"), "Wizz Air"),
    (re.compile(r"^VUELING"), "Vueling"),
    (re.compile(r"^VOLOTEA"), "Volotea"),
    (re.compile(r"^EUROWINGS|^GERMANWINGS"), "Eurowings"),
    (re.compile(r"^NORWEGIAN"), "Norwegian"),
    (re.compile(r"^JET2"), "Jet2"),
]
LOWCOST = {
    "easyJet",
    "Ryanair",
    "Transavia",
    "Wizz Air",
    "Vueling",
    "Volotea",
    "Eurowings",
    "Norwegian",
    "Jet2",
}


# ---------------------------------------------------------------- helpers
def month_range(first: str, last: str) -> list[str]:
    y, m = map(int, first.split("-"))
    ly, lm = map(int, last.split("-"))
    out = []
    while (y, m) <= (ly, lm):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def complete_years(months: set[str]) -> list[int]:
    by_year = defaultdict(set)
    for mo in months:
        by_year[int(mo[:4])].add(mo)
    return sorted(y for y, ms in by_year.items() if len(ms) == 12)


# DGAC names are upper-case without accents; restore the common ones (word level)
ACCENTS = {
    "aeroport": "Aéroport",
    "aime": "Aimé",
    "algerie": "Algérie",
    "bale": "Bâle",
    "barthelemy": "Barthélemy",
    "beziers": "Béziers",
    "boutheon": "Bouthéon",
    "caraibes": "Caraïbes",
    "cesaire": "Césaire",
    "chateauroux": "Châteauroux",
    "conde": "Condé",
    "cote": "Côte",
    "deols": "Déols",
    "eboue": "Éboué",
    "ecole": "École",
    "etienne": "Étienne",
    "exupery": "Exupéry",
    "fecamp": "Fécamp",
    "felix": "Félix",
    "hyeres": "Hyères",
    "ile": "Île",
    "iles": "Îles",
    "lezignan": "Lézignan",
    "mare": "Maré",
    "mediterranee": "Méditerranée",
    "merignac": "Mérignac",
    "metropole": "Métropole",
    "nimes": "Nîmes",
    "noumea": "Nouméa",
    "orleans": "Orléans",
    "ouvea": "Ouvéa",
    "perigord": "Périgord",
    "pyrenees": "Pyrénées",
    "region": "Région",
    "reunion": "Réunion",
    "tille": "Tillé",
    "vallee": "Vallée",
}
PARTICLES = {"de", "du", "des", "la", "le", "les", "sur", "en", "et", "d", "l", "aux"}
ELIDED = {"d", "l"}  # d'Azur, l'Oyapock: capital after the apostrophe
SAINTS = {"st": "Saint", "ste": "Sainte"}


def _word(w: str) -> str:
    return ACCENTS.get(w.lower(), w)


def brand(name: str) -> str:
    up = name.upper().strip()
    for pat, label in BRANDS:
        if pat.search(up):
            return label
    small = {"DE", "DU", "DES", "LA", "LE", "ET"}
    words = []
    for w in up.split():
        if w in small:
            words.append(w.lower())
        elif len(w) <= 3 and w.isalpha() and w not in {"AIR", "SKY", "SUN", "JET"}:
            words.append(w)  # acronyms: KLM, TAP, SAS, ASL
        else:
            words.append(_word(w.capitalize()))
    return " ".join(words)


def pretty_name(raw: str) -> str:
    """'NICE-COTE D'AZUR' -> "Nice-Côte d'Azur"; 'ST-BARTHELEMY' -> 'Saint-Barthélemy'; "FAA'A" -> "Faa'a"."""
    parts = re.split(r"([\s\-/'()])", raw.strip().lower())
    out: list[str] = []
    prev_word: str | None = None
    for i, p in enumerate(parts):
        if not p or re.fullmatch(r"[\s\-/'()]", p):
            out.append(p)
            continue
        after_apostrophe = i >= 1 and parts[i - 1] == "'"
        if after_apostrophe and prev_word not in ELIDED:
            out.append(p)  # Faa'a, not Faa'A
        elif p in SAINTS and i + 1 < len(parts) and parts[i + 1] == "-":
            out.append(SAINTS[p])
        elif p in PARTICLES and prev_word is not None and not after_apostrophe:
            out.append(p)
        elif p in ACCENTS:
            out.append(ACCENTS[p])
        elif re.fullmatch(r"[ivx]+", p) and prev_word is not None:
            out.append(p.upper())
        else:
            out.append(p[:1].upper() + p[1:])
        prev_word = p
    return "".join(out)


def load_ref_airports(path: Path = REF_AIRPORTS, manual: Path = MANUAL_AIRPORTS) -> dict[str, dict]:
    ref: dict[str, dict] = {}
    for p in (path, manual):  # manual entries (closed airports) complete OurAirports
        if p.exists():
            with p.open(encoding="utf-8") as f:
                ref |= {r["code"]: r for r in csv.DictReader(f)}
    return ref


def is_metro(lat: float, lon: float) -> bool:
    return 41.0 <= lat <= 51.6 and -5.6 <= lon <= 10.0


# ---------------------------------------------------------------- traffic
def load_traffic(raw: Path) -> dict[str, list[dict]]:
    """All traffic records per series, most recent file wins for a given month."""
    files = sorted((raw / "trafic").glob("*.csv")) if (raw / "trafic").exists() else []
    recs: dict[str, list[dict]] = {"apt": [], "lsn": [], "cie": [], "pap": []}
    required = ("apt", "lsn", "cie")  # PAP only feeds the route maps
    loaded = []
    for path in files:
        table = dgac.read_table(path)
        s = dgac.series_of(table)
        if s in recs:
            rows = dgac.records(table, s, 0)
            if rows:
                loaded.append((max(r["month"] for r in rows), path.name, s, rows))
    # the file reaching the most recent month is treated as the most recent publication
    for rank, (_, _, s, rows) in enumerate(sorted(loaded)):
        for r in rows:
            r["_rank"] = rank
        recs[s].extend(rows)
    for s in recs:
        if not recs[s]:
            if s in required:
                raise dgac.SchemaError(f"no {s.upper()} file found in {raw / 'trafic'}")
            continue
        recs[s] = dgac.latest_per_month(recs[s])
    return recs


def build_fracture(lsn: list[dict]) -> dict:
    months = month_range(min(r["month"] for r in lsn), max(r["month"] for r in lsn))
    idx = {m: i for i, m in enumerate(months)}
    fsc = defaultdict(lambda: [0.0] * len(months))
    seen_fsc: set[str] = set()
    annual = defaultdict(lambda: defaultdict(float))  # seg -> year -> pax
    cont = defaultdict(lambda: defaultdict(float))
    by_fsc_year = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0]))  # fsc -> year -> [pax, pkt, frp]
    present = set()
    for r in lsn:
        pax = r["pax"] or 0.0
        code = (r["fsc"] or "AUTRE").upper()
        seen_fsc.add(code)
        fsc[code][idx[r["month"]]] += pax
        acc = by_fsc_year[code][int(r["month"][:4])]
        acc[0] += pax
        acc[1] += r.get("pkt") or 0.0
        acc[2] += r.get("frp") or 0.0
        present.add(r["month"])
        seg = "NAT" if (r["seg"] or "").upper().startswith("NAT") else "INTL"
        annual[seg][int(r["month"][:4])] += pax
        if seg == "INTL" and r.get("cont"):
            cont[r["cont"].strip().upper()][int(r["month"][:4])] += pax
    years = complete_years(present)
    order = [f for f in FSC_ORDER if f in seen_fsc] + sorted(seen_fsc - set(FSC_ORDER))
    return {
        "months": months,
        "faisceaux": {f: [round(v) for v in fsc[f]] for f in order},
        "annual": {
            "years": years,
            "NAT": [round(annual["NAT"][y]) for y in years],
            "INTL": [round(annual["INTL"][y]) for y in years],
            "TOTAL": [round(annual["NAT"][y] + annual["INTL"][y]) for y in years],
        },
        "continents": {
            "years": years,
            "series": {c: [round(v[y]) for y in years] for c, v in sorted(cont.items()) if "AUTRE" not in c},
        },
        # yearly passengers, passenger-km and freight (t) per faisceau: average trip length = pkt / pax
        "par_faisceau": {
            f: {
                "pax": [round(by_fsc_year[f][y][0]) for y in years],
                "pkt": [round(by_fsc_year[f][y][1]) for y in years],
                "fret": [round(by_fsc_year[f][y][2]) for y in years],
            }
            for f in order
        },
    }


def build_airports(apt: list[dict], ref: dict[str, dict]) -> dict:
    months = month_range(min(r["month"] for r in apt), max(r["month"] for r in apt))
    idx = {m: i for i, m in enumerate(months)}
    n = len(months)
    series: dict[str, list] = {}
    flights: dict[str, list] = {}
    freight: dict[str, list] = {}
    names: dict[str, str] = {}
    national = {"pax": [0.0] * n, "vols": [0.0] * n, "vols_cargo": [0.0] * n, "fret": [0.0] * n}
    for r in apt:
        code = (r["code"] or "").strip().upper()
        if not code:
            continue
        i = idx[r["month"]]
        pax = (r["pax_dep"] or 0.0) + (r["pax_arr"] or 0.0)
        fret = (r.get("frp_dep") or 0.0) + (r.get("frp_arr") or 0.0)
        s = series.setdefault(code, [None] * n)
        s[i] = (s[i] or 0) + pax
        fl = flights.setdefault(code, [None] * n)
        if r.get("mvt") is not None:
            fl[i] = (fl[i] or 0) + r["mvt"]
        fr = freight.setdefault(code, [None] * n)
        fr[i] = (fr[i] or 0) + fret
        names[code] = r["name"] or names.get(code, code)
        national["pax"][i] += pax
        national["vols"][i] += r.get("mvt") or 0.0
        national["vols_cargo"][i] += r.get("mvt_cgo") or 0.0
        national["fret"][i] += fret
    years = complete_years(set(months))

    def annual(arr: list) -> list:
        out = []
        for y in years:
            vals = [arr[idx[f"{y}-{m:02d}"]] for m in range(1, 13)]
            vals = [v for v in vals if v is not None]
            out.append(round(sum(vals)) if vals else None)
        return out

    airports, aggregates, missing = [], [], []
    for code, s in series.items():
        pax = [None if v is None else round(v) for v in s]
        name = names[code]
        if not re.fullmatch(r"[A-Z]{4}", code) or AGGREGATE_NAME.search(name):
            aggregates.append({"code": code, "nom": name, "pax": pax})
            continue
        geo = ref.get(code)
        if geo is None:
            missing.append(code)
            continue
        lat, lon = float(geo["lat"]), float(geo["lon"])
        airports.append(
            {
                "code": code,
                "nom": pretty_name(name),
                "ville": geo.get("municipality") or "",
                "zone": "MET" if is_metro(lat, lon) else "OM",
                "lat": lat,
                "lon": lon,
                "pax": pax,
                "vols": annual(flights[code]),
                "fret": annual(freight[code]),
            }
        )
    airports.sort(key=lambda a: -sum(v or 0 for v in a["pax"][-12:]))
    return {
        "months": months,
        "years": years,
        "airports": airports,
        "aggregates": aggregates,
        "national": {k: [round(v) for v in arr] for k, arr in national.items()},
        "missing_coords": sorted(missing),
    }


def build_carriers(cie: list[dict], top_n: int = 12) -> dict:
    present = {r["month"] for r in cie}
    years = complete_years(present)
    yi = {y: i for i, y in enumerate(years)}
    per = defaultdict(lambda: [0.0] * len(years))
    nat: dict[str, str] = {}
    others = defaultdict(lambda: [0.0] * len(years))
    total = [0.0] * len(years)
    for r in cie:
        y = int(r["month"][:4])
        if y not in yi:
            continue
        pax = r["pax"] or 0.0
        total[yi[y]] += pax
        name = r["name"] or ""
        if AGGREGATE_NAME.search(name):
            key = "F" if (r.get("nat") or "").upper().startswith("F") else "E"
            others[key][yi[y]] += pax
            continue
        b = brand(name)
        per[b][yi[y]] += pax
        if (r.get("nat") or "").upper().startswith("F"):
            nat[b] = "F"
        else:
            nat.setdefault(b, "E")
    keep = set()
    for i in range(len(years)):
        ranked = sorted(per, key=lambda b: -per[b][i])[:top_n]
        keep.update(ranked)
    carriers = [
        {
            "nom": b,
            "nat": nat.get(b, "E"),
            "lowcost": b in LOWCOST,
            "pax": [round(v) for v in per[b]],
        }
        for b in sorted(keep, key=lambda b: -per[b][-1] if years else 0)
    ]
    rest = [round(total[i] - sum(c["pax"][i] for c in carriers)) for i in range(len(years))]
    return {
        "years": years,
        "carriers": carriers,
        "rest": rest,
        "aggregated": {k: [round(v) for v in vals] for k, vals in others.items()},
        "total": [round(v) for v in total],
        "lowcost_share": [
            round(sum(per[b][i] for b in per if b in LOWCOST) / total[i], 4) if total[i] else None
            for i in range(len(years))
        ],
    }


# ---------------------------------------------------------------- prices
def build_prices(raw: Path) -> dict:
    files = sorted((raw / "iptap").glob("*.csv")) if (raw / "iptap").exists() else []
    candidates = []
    for path in files:
        table = dgac.read_table(path)
        if table.col("FRA_ENS") is None:
            continue
        get_month = dgac.month_getter(table)
        cols = {c: table.col(c) for c in IPTAP_COLS if table.col(c) is not None}
        data = {}
        for r in table.rows:
            mo = get_month(r)
            if mo:
                data[mo] = {c: dgac.to_num(r[i]) if i < len(r) else None for c, i in cols.items()}
        v2023 = [data[m]["FRA_ENS"] for m in data if m.startswith("2023") and data[m].get("FRA_ENS")]
        base2023 = bool(v2023) and abs(sum(v2023) / len(v2023) - 100) < 3
        candidates.append(
            {
                "path": path.name,
                "data": data,
                "last": max(data) if data else "",
                "base2023": base2023,
            }
        )
    usable = [c for c in candidates if c["base2023"]]
    if not usable:
        raise dgac.SchemaError(f"no IPTAP file in base 2023 found among {[c['path'] for c in candidates]}")
    usable.sort(key=lambda c: c["last"], reverse=True)  # most recent series first
    merged: dict[str, dict] = {}
    for c in usable:
        for mo, vals in c["data"].items():
            merged.setdefault(mo, vals)
    months = month_range(min(merged), max(merged))
    cols = [c for c in IPTAP_COLS if any(merged.get(m, {}).get(c) is not None for m in months)]
    return {
        "months": months,
        "base": "2023 = 100",
        "series": {
            c: [None if merged.get(m, {}).get(c) is None else round(merged[m][c], 2) for m in months] for c in cols
        },
        "sources": [c["path"] for c in usable],
    }


# ---------------------------------------------------------------- CO2
YEAR = re.compile(r"(19|20)\d{2}")
CO2_TOTAL = "FRANCE_TOT"


def _co2_table(table: dgac.Table) -> tuple[str, dict[str, dict[int, float]]]:
    """Return (kind, {segment: {year: value}}); kind is 'mt' or 'g' (g CO2 / passenger-eq-km).

    DGAC files are wide (years in the header, one row per segment, label in the
    first column). A long file (year column + value column) is read as the total.
    """
    head = " ".join(table.header).lower()
    year_cols = [i for i, h in enumerate(table.header) if YEAR.fullmatch(h.strip())]
    series: dict[str, dict[int, float]] = {}
    if len(year_cols) >= 5:
        for r in table.rows:
            label = (r[0] if r else "").strip().upper() or CO2_TOTAL
            vals = {int(table.header[i]): dgac.to_num(r[i]) for i in year_cols if i < len(r)}
            vals = {y: v for y, v in vals.items() if v is not None}
            if len(vals) >= 5:
                series[label] = vals
    else:
        total: dict[int, float] = {}
        for r in table.rows:
            year = next((int(c) for c in r if YEAR.fullmatch(c.strip())), None)
            nums = [dgac.to_num(c) for c in r if not YEAR.fullmatch(c.strip())]
            nums = [n for n in nums if n is not None]
            if year and nums:
                total[year] = nums[0]
        if total:
            series[CO2_TOTAL] = total
    if not series:
        raise dgac.SchemaError(f"{table.path.name}: could not read CO2 values; header {table.header}")
    if re.search(r"gramme|g ?co2 ?/|/ ?p|pkt|peq|km", head):
        kind = "g"
    elif re.search(r"\bmt\b|million|mtco2|tonnes", head):
        kind = "mt"
    else:  # no unit in the header: national/segment totals are < 30 Mt, intensities 60-200 g
        ref = series.get(CO2_TOTAL) or next(iter(series.values()))
        vals = sorted(ref.values())
        kind = "mt" if vals[len(vals) // 2] < 50 else "g"
    return kind, series


def build_co2(raw: Path) -> dict:
    files = sorted((raw / "co2").glob("*.csv")) if (raw / "co2").exists() else []
    found: dict[str, dict[str, dict[int, float]]] = {}
    for path in files:
        kind, series = _co2_table(dgac.read_table(path))
        found[kind] = series
    if CO2_TOTAL not in found.get("mt", {}):
        raise dgac.SchemaError(f"no {CO2_TOTAL} row in a CO2 (Mt) file among {[p.name for p in files]}")
    mt, g = found["mt"], found.get("g", {})
    years = sorted({y for s in [*mt.values(), *g.values()] for y in s})
    segments = list(dict.fromkeys([*mt, *g]))
    return {
        "years": years,
        "segments": segments,
        "mt": {s: [mt[s].get(y) for y in years] for s in segments if s in mt},
        "g_peqkm": {s: [g[s].get(y) for y in years] for s in segments if s in g},
    }


# ---------------------------------------------------------------- main
def manifest_sources(raw: Path) -> list[dict]:
    p = raw / "manifest.json"
    if not p.exists():
        return []
    m = json.loads(p.read_text(encoding="utf-8"))
    return [{k: r.get(k) for k in ("dataset", "title", "last_modified", "id")} for r in m.get("resources", [])]


def build(raw: Path, out: Path, demo: bool = False, ref: dict | None = None) -> dict:
    ref = load_ref_airports() if ref is None else ref
    traffic = load_traffic(raw)
    fracture = build_fracture(traffic["lsn"])
    airports = build_airports(traffic["apt"], ref)
    carriers = build_carriers(traffic["cie"])
    prices = build_prices(raw)
    co2 = build_co2(raw)
    years = fracture["annual"]["years"]
    tot = dict(zip(years, fracture["annual"]["TOTAL"]))
    co2["pax"] = [tot.get(y) for y in co2["years"]]
    co2["decomp"] = world.co2_decomposition(co2)
    world_airports = world.load_airports()
    # French names for foreign hubs come from the DGAC pair labels when available ("LISBONNE-...")
    for r in traffic["pap"]:
        _, _, b = (r.get("pair") or "").partition("_")
        label = r.get("name2") or ""
        if b in world_airports and label and not world_airports[b].get("_dgac"):
            world_airports[b] = {**world_airports[b], "municipality": label.split("-")[0].strip(), "_dgac": True}
    monde, w1 = world.build_monde(traffic["lsn"], world_airports, world.load_countries(), pretty_name)
    routes, w2 = world.build_routes(traffic["pap"], world_airports, pretty_name)
    meta = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "demo": demo,
        "coverage": {
            "trafic": [fracture["months"][0], fracture["months"][-1]],
            "prix": [prices["months"][0], prices["months"][-1]],
            "co2": [co2["years"][0], co2["years"][-1]],
            "compagnies": [carriers["years"][0], carriers["years"][-1]] if carriers["years"] else None,
        },
        "sources": manifest_sources(raw),
        "missing_coords": airports["missing_coords"],
        "warnings": w1 + w2,
    }
    out.mkdir(parents=True, exist_ok=True)
    outputs = {
        "meta": meta,
        "fracture": fracture,
        "aeroports": airports,
        "compagnies": carriers,
        "prix": prices,
        "co2": co2,
        "monde": monde,
        "routes": routes,
    }
    for name, payload in outputs.items():
        (out / f"{name}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    return outputs


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--raw", type=Path, default=ROOT / "data" / "raw")
    p.add_argument("--out", type=Path, default=ROOT / "web" / "public" / "data")
    p.add_argument(
        "--demo",
        action="store_true",
        help="generate synthetic raw files first (flagged demo)",
    )
    args = p.parse_args(argv)
    raw = args.raw
    if args.demo:
        import demo

        raw = ROOT / "data" / "demo-raw"
        demo.generate(raw)
    outputs = build(raw, args.out, demo=args.demo)
    m = outputs["meta"]
    print(f"built {', '.join(outputs)} -> {args.out}  (demo={m['demo']}, trafic {m['coverage']['trafic']})")
    for w in m["warnings"]:
        print(f"WARNING {w}")
    if m["missing_coords"]:
        print(f"WARNING airports without coordinates (not on the map): {', '.join(m['missing_coords'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
