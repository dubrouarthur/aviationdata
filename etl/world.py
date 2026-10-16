"""Routes and destinations: France -> countries (LSN) and airport pairs (PAP), plus the CO2 decomposition.

Outputs consumed by the front:
- monde.json : monthly passengers per destination country with a hub airport to draw arcs to
- routes.json: yearly passengers and flights per airport pair (detailed pairs only, see CLAUDE.md)
"""

from __future__ import annotations

import csv
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"
PARIS = {"nom": "Paris", "lat": 48.8566, "lon": 2.3522}
MONACO = {"code": "", "nom": "Monaco", "lat": 43.7384, "lon": 7.4246}
FR_PREFIXES = ("LF", "TF", "SO", "FM", "NT", "NW", "NL")


def _read(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_airports() -> dict[str, dict]:
    """All known airports: OurAirports world + French + manual completions (manual wins)."""
    out: dict[str, dict] = {}
    for name in ("airports_world.csv", "airports_fr.csv", "airports_world_manual.csv", "airports_manual.csv"):
        for r in _read(REF / name):
            out[r["code"]] = r
    return out


def load_countries() -> dict[str, dict]:
    return {r["dgac_name"]: r for r in _read(REF / "countries_fr.csv")}


def _month_axis(recs: list[dict]) -> list[str]:
    first = min(r["month"] for r in recs)
    last = max(r["month"] for r in recs)
    y, m = map(int, first.split("-"))
    ly, lm = map(int, last.split("-"))
    out = []
    while (y, m) <= (ly, lm):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _cont_label(c: str) -> str:
    c = (c or "").strip()
    return c[:1].upper() + c[1:].lower() if c else "Autre"


def build_monde(
    lsn: list[dict], airports: dict[str, dict], countries: dict[str, dict], pretty
) -> tuple[dict, list[str]]:
    months = _month_axis(lsn)
    idx = {m: i for i, m in enumerate(months)}
    n = len(months)
    per_country: dict[str, list[float]] = defaultdict(lambda: [0.0] * n)
    per_country_om: dict[str, list[float]] = defaultdict(lambda: [0.0] * n)
    others: dict[str, list[float]] = defaultdict(lambda: [0.0] * n)
    cont_of: dict[str, str] = {}
    warnings: list[str] = []
    for r in lsn:
        if not (r.get("seg") or "").upper().startswith("INTL"):
            continue
        dest = (r.get("dest") or "").strip()
        cont = _cont_label(r.get("cont"))
        pax = r["pax"] or 0.0
        i = idx[r["month"]]
        if not dest or "_AUTRE" in dest or dest not in countries:
            if dest and "_AUTRE" not in dest and dest not in countries:
                warnings.append(f"pays inconnu dans countries_fr.csv : {dest}")
            others[cont][i] += pax
            continue
        cont_of[dest] = cont
        per_country[dest][i] += pax
        if (r.get("origin") or "").upper().startswith("OUTRE"):
            per_country_om[dest][i] += pax

    out_countries = []
    for dest, series in per_country.items():
        meta = countries[dest]
        hub = airports.get(meta["hub"]) if meta.get("hub") else None
        if hub is None and meta["iso2"] == "MC":
            hub_out = MONACO
        elif hub is None:
            warnings.append(f"aéroport de référence introuvable pour {dest} ({meta.get('hub')})")
            continue
        else:
            hub_out = {
                "code": hub["code"],
                "nom": pretty(hub.get("municipality") or hub["name"]),
                "lat": float(hub["lat"]),
                "lon": float(hub["lon"]),
            }
        om = per_country_om.get(dest)
        out_countries.append(
            {
                "id": meta["iso2"],
                "nom": meta["label"],
                "cont": cont_of[dest],
                "hub": hub_out,
                "dist": round(_haversine(PARIS["lat"], PARIS["lon"], hub_out["lat"], hub_out["lon"])),
                "pax": [round(v) for v in series],
                "om": [round(v) for v in om] if om and any(om) else None,
            }
        )
    out_countries.sort(key=lambda c: -sum(c["pax"][-12:]))
    return (
        {
            "months": months,
            "origin": PARIS,
            "countries": out_countries,
            "autres": {k: [round(v) for v in s] for k, s in sorted(others.items())},
        },
        sorted(set(warnings)),
    )


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def build_routes(pap: list[dict], airports: dict[str, dict], pretty) -> tuple[dict, list[str]]:
    if not pap:
        return {"years": [], "airports": {}, "pairs": []}, ["série PAP absente : pas de carte des liaisons"]
    months_by_year: dict[int, set[str]] = defaultdict(set)
    for r in pap:
        months_by_year[int(r["month"][:4])].add(r["month"])
    # a pair is published only the months it meets the disclosure rule: a year counts when the
    # file covers 12 months overall, not necessarily for every pair
    years = sorted(y for y, ms in months_by_year.items() if len(ms) == 12)
    yi = {y: i for i, y in enumerate(years)}
    pax: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    mvt: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    dist: dict[str, float] = {}
    names: dict[str, str] = {}
    for r in pap:
        y = int(r["month"][:4])
        if y not in yi:
            continue
        pair = (r.get("pair") or "").strip().upper()
        if "_" not in pair:
            continue
        a, b = pair.split("_", 1)
        pax[pair][yi[y]] += r["pax"] or 0.0
        mvt[pair][yi[y]] += r.get("mvt") or 0.0
        if r.get("dist"):
            dist[pair] = r["dist"]
        names.setdefault(a, r.get("name1") or a)
        names.setdefault(b, r.get("name2") or b)

    used: dict[str, dict] = {}
    pairs, missing = [], set()
    for pair, series in pax.items():
        a, b = pair.split("_", 1)
        ok = True
        for code in (a, b):
            ref = airports.get(code)
            if ref is None:
                missing.add(code)
                ok = False
                continue
            used[code] = {
                "nom": pretty(names.get(code, code)),
                "lat": float(ref["lat"]),
                "lon": float(ref["lon"]),
                "pays": ref.get("country") or "",
                "fr": code.startswith(FR_PREFIXES),
            }
        if not ok:
            continue
        pairs.append(
            {
                "a": a,
                "b": b,
                "dist": round(
                    dist.get(pair) or _haversine(used[a]["lat"], used[a]["lon"], used[b]["lat"], used[b]["lon"])
                ),
                "pax": [round(v) for v in series],
                "vols": [round(v) for v in mvt[pair]],
            }
        )
    pairs.sort(key=lambda p: -max(p["pax"]))
    warnings = [f"aéroport sans coordonnées dans la série PAP : {c}" for c in sorted(missing)]
    return {"years": years, "airports": used, "pairs": pairs}, warnings


def co2_decomposition(co2: dict) -> dict:
    """LMDI split of the CO2 change between traffic growth and carbon intensity.

    CO2 = T x I with I in g/Peq-km and T the implied traffic (Peq-km) = CO2 / I.
    For each period: dC = L*ln(T1/T0) + L*ln(I1/I0) with L = (C1-C0)/ln(C1/C0); the two
    terms add up exactly to dC.
    """
    years = co2["years"]
    mt = co2["mt"]
    g = co2["g_peqkm"]
    last = max(y for i, y in enumerate(years) if mt.get("FRANCE_TOT", [None] * len(years))[i] is not None)
    periods = [(years[0], 2019), (2019, last), (years[0], last)]
    out = {"periods": [], "segments": {}}

    def split(seg: str, y0: int, y1: int) -> dict | None:
        if seg not in mt or seg not in g:
            return None
        i0, i1 = years.index(y0), years.index(y1)
        c0, c1, g0, g1 = mt[seg][i0], mt[seg][i1], g[seg][i0], g[seg][i1]
        if None in (c0, c1, g0, g1) or min(c0, c1, g0, g1) <= 0:
            return None
        t0, t1 = c0 / g0, c1 / g1
        lw = (c1 - c0) / math.log(c1 / c0) if c1 != c0 else c0
        return {
            "from": y0,
            "to": y1,
            "c0": c0,
            "c1": c1,
            "trafic": round(lw * math.log(t1 / t0), 3),
            "intensite": round(lw * math.log(g1 / g0), 3),
            "trafic_pct": round((t1 / t0 - 1) * 100, 1),
            "intensite_pct": round((g1 / g0 - 1) * 100, 1),
        }

    for y0, y1 in periods:
        d = split("FRANCE_TOT", y0, y1)
        if d:
            out["periods"].append(d)
    for seg in co2.get("segments", []):
        if seg == "FRANCE_TOT":
            continue
        d = split(seg, years[0], last)
        if d:
            out["segments"][seg] = d
    return out
