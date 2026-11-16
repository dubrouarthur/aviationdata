"""data/raw/kero/ (fetch_kero.py) -> web/public/data/kero/kero.json, « D'où vient le kérosène des avions européens ? ».

Imports are those from outside the EU (the partners that are not member states), so that a cargo landed in
Rotterdam and sent on to Germany is counted once. « Avant » and « après » are the same months a year apart (the
four months after the transition of March 2026, when cargoes loaded before the closure of Hormuz were still at
sea), so that seasons do not weigh on the comparison.

    python3 etl/kero/build_kero.py
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
import xlrd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "kero"
OUT = ROOT / "web" / "public" / "data" / "kero" / "kero.json"

EU = set("BE BG CZ DK DE EE IE EL ES FR HR IT CY LV LT LU HU MT NL AT PL PT RO SI SK FI SE".split())
CLOSURE = "2026-03"  # Hormuz closed on 28 February 2026 (FACTS.hormuz of web/src/modules/sources.js)
AFTER_FROM = "2026-04"  # March 2026: cargoes loaded before the closure still landing

# groups of suppliers; Oman and the UAE also have ports outside the strait: the text never says a group was cut
GROUPS = {
    "golfe": ("Pays du Golfe", "KW SA AE BH QA OM IQ IR"),
    "inde": ("Inde", "IN"),
    "asie": ("Asie de l'Est", "KR CN JP SG TW MY TH ID"),
    "ameriques": ("Amériques", "US CA BR MX AR VE TT CO"),
    "afrique": ("Afrique", "NG EG DZ LY MA TN ZA AO GH CI SN CM GA"),
    "europe": ("Europe hors Union", "UK NO TR CH RS BA ME MK AL IS UA BY"),
    "russie": ("Russie", "RU"),
}
# French names and ISO 3166 numeric codes (to place each supplier on the map, world-atlas ids)
PARTNERS = {
    "KW": ("Koweït", 414),
    "SA": ("Arabie saoudite", 682),
    "AE": ("Émirats arabes unis", 784),
    "BH": ("Bahreïn", 48),
    "QA": ("Qatar", 634),
    "OM": ("Oman", 512),
    "IQ": ("Irak", 368),
    "IR": ("Iran", 364),
    "IN": ("Inde", 356),
    "KR": ("Corée du Sud", 410),
    "CN": ("Chine", 156),
    "JP": ("Japon", 392),
    "SG": ("Singapour", 702),
    "TW": ("Taïwan", 158),
    "MY": ("Malaisie", 458),
    "TH": ("Thaïlande", 764),
    "ID": ("Indonésie", 360),
    "US": ("États-Unis", 840),
    "CA": ("Canada", 124),
    "BR": ("Brésil", 76),
    "MX": ("Mexique", 484),
    "AR": ("Argentine", 32),
    "VE": ("Venezuela", 862),
    "TT": ("Trinité-et-Tobago", 780),
    "CO": ("Colombie", 170),
    "NG": ("Nigeria", 566),
    "EG": ("Égypte", 818),
    "DZ": ("Algérie", 12),
    "LY": ("Libye", 434),
    "MA": ("Maroc", 504),
    "TN": ("Tunisie", 788),
    "ZA": ("Afrique du Sud", 710),
    "AO": ("Angola", 24),
    "GH": ("Ghana", 288),
    "CI": ("Côte d'Ivoire", 384),
    "SN": ("Sénégal", 686),
    "CM": ("Cameroun", 120),
    "GA": ("Gabon", 266),
    "IL": ("Israël", 376), "UK": ("Royaume-Uni", 826),
    "NO": ("Norvège", 578),
    "TR": ("Turquie", 792),
    "CH": ("Suisse", 756),
    "RS": ("Serbie", 688),
    "BA": ("Bosnie-Herzégovine", 70),
    "ME": ("Monténégro", 499),
    "MK": ("Macédoine du Nord", 807),
    "AL": ("Albanie", 8),
    "IS": ("Islande", 352),
    "UA": ("Ukraine", 804),
    "BY": ("Biélorussie", 112),
    "RU": ("Russie", 643),
}
GROUP_OF = {p: g for g, (_, ps) in GROUPS.items() for p in ps.split()}


def jsonstat(path, row_dim, fixed=None):
    """A JSON-stat file -> (row codes, time codes, array [row, time]) along row_dim, other dims at one value."""
    d = json.loads(path.read_text())
    dims, size = d["id"], d["size"]
    idx = {k: d["dimension"][k]["category"]["index"] for k in dims}
    labels = {k: d["dimension"][k]["category"].get("label", {}) for k in dims}
    rows = sorted(idx[row_dim], key=lambda c: idx[row_dim][c])
    times = sorted(idx["time"], key=lambda c: idx["time"][c])
    mult = [1] * len(dims)
    for i in range(len(dims) - 2, -1, -1):
        mult[i] = mult[i + 1] * size[i + 1]
    A = np.full((len(rows), len(times)), np.nan)
    for k, v in d["value"].items():
        k = int(k)
        c = [k // m % s for m, s in zip(mult, size, strict=True)]
        if fixed and any(c[dims.index(dk)] != idx[dk][dv] for dk, dv in fixed.items()):
            continue
        A[c[dims.index(row_dim)], c[dims.index("time")]] = v
    return rows, times, A, labels[row_dim]


def r(x, d=1):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), d)


def last_complete(times, A):
    """the last month with data for the total"""
    ok = [j for j in range(len(times)) if not np.isnan(A[:, j]).all()]
    return ok[-1]


def imports(geo):
    rows, times, A, labels = jsonstat(RAW / f"imports-{geo}.json", "partner")
    tot = A[rows.index("TOTAL")]
    j_last = max(j for j in range(len(times)) if not np.isnan(tot[j]))
    times = times[: j_last + 1]
    A = A[:, : j_last + 1]
    ext = [i for i, p in enumerate(rows) if len(p) == 2 and p not in EU and p != geo]
    E = np.nan_to_num(A[ext])
    total = E.sum(0)
    by_group = {g: np.zeros(len(times)) for g in [*GROUPS, "autres"]}
    by_partner = {}
    for k, i in enumerate(ext):
        p = rows[i]
        g = GROUP_OF.get(p, "autres")
        by_group[g] += E[k]
        by_partner[p] = E[k]
    unknown = {rows[i]: labels.get(rows[i]) for i in ext if rows[i] not in PARTNERS and E[ext.index(i)].sum() > 0}
    return times, total, by_group, by_partner, unknown


def window(times, a, z):
    return [j for j, t in enumerate(times) if a <= t <= z]


def shift_year(t, dy):
    return f"{int(t[:4]) + dy}{t[4:]}"


out = {"groups": {g: lab for g, (lab, _) in GROUPS.items()} | {"autres": "Autres"}}
out["groups"] = {g: {"label": lab} for g, lab in out["groups"].items()}

# ------------------------------------------------------------------ the EU and its large importers
times, total, by_group, by_partner, unknown = imports("EU27_2020")
last = times[-1]
after = window(times, AFTER_FROM, last)
before = window(times, shift_year(AFTER_FROM, -1), shift_year(last, -1))
assert len(after) == len(before) >= 3, (len(after), len(before))
big = sorted(by_partner, key=lambda p: -by_partner[p][window(times, "2019-01", last)].sum())
top = [
    p
    for p in big
    if by_partner[p][window(times, "2019-01", last)].sum() > 0.005 * total[window(times, "2019-01", last)].sum()
]
missing = [p for p in top if p not in PARTNERS]
assert not missing, f"partenaires sans nom français : {missing}"
out["meta"] = {
    "first": times[0],
    "last": last,
    "closure": CLOSURE,
    "after": [times[after[0]], times[after[-1]]],
    "before": [times[before[0]], times[before[-1]]],
    "unknownPartners": sorted(unknown),
}
out["months"] = times
out["eu"] = {
    "total": [r(x) for x in total],
    "groups": {g: [r(x) for x in v] for g, v in by_group.items()},
    "partners": {p: [r(x) for x in by_partner[p]] for p in top},
}
out["partners"] = {
    p: {"label": PARTNERS[p][0], "iso": PARTNERS[p][1], "group": GROUP_OF.get(p, "autres")} for p in PARTNERS
}

out["countries"] = {}
for geo, name in [
    ("FR", "France"),
    ("DE", "Allemagne"),
    ("NL", "Pays-Bas"),
    ("BE", "Belgique"),
    ("ES", "Espagne"),
    ("IT", "Italie"),
]:
    t2, tot2, g2, p2, _ = imports(geo)
    t2 = [t for t in t2 if t <= last]
    a2 = window(t2, AFTER_FROM, last)
    b2 = window(t2, shift_year(AFTER_FROM, -1), shift_year(last, -1))
    y25 = window(t2, "2025-01", "2025-12")
    out["countries"][geo] = {
        "label": name,
        "last": t2[-1],
        "year": {g: r(v[y25].sum()) for g, v in g2.items()} | {"total": r(tot2[y25].sum())},
        "before": {g: r(v[b2].sum()) for g, v in g2.items()} | {"total": r(tot2[b2].sum())},
        "after": {g: r(v[a2].sum()) for g, v in g2.items()} | {"total": r(tot2[a2].sum())},
        "top2025": [[p, r(v[y25].sum())] for p, v in sorted(p2.items(), key=lambda x: -x[1][y25].sum())[:6]],
    }

# ---------------------------------------------- the balance: what Europe refines, buys, sells, burns
bal = {}
for geo in ["EU27_2020", "FR"]:
    rows, bt, B, _ = jsonstat(RAW / f"balance-{geo}.json", "nrg_bal")
    pick = {"refinery": "TO_RPI_RO", "imports": "IMP", "exports": "EXP", "stock": "STK_CHG", "deliveries": "GID_OBS"}
    ser = {k: B[rows.index(c)] for k, c in pick.items()}
    j = [i for i, t in enumerate(bt) if t in times]
    bal[geo] = {"months": [bt[i] for i in j]} | {k: [r(v[i]) for i in j] for k, v in ser.items()}
out["balance"] = bal


# ---------------------------------------------- Comext: tonnes and euros by origin, the price at the border
def comext(ind):
    rows, ct, C, _ = jsonstat(RAW / f"comext-{ind}.json", "partner")
    return rows, ct, C


crow, ct, Q = comext("QUANTITY_IN_100KG")
crow2, ct2, V = comext("VALUE_IN_EUROS")
assert crow == crow2 and ct == ct2
jl = max(j for j in range(len(ct)) if not np.isnan(Q[:, j]).all())
ct = ct[: jl + 1]
Q, V = np.nan_to_num(Q[:, : jl + 1]) / 10, np.nan_to_num(V[:, : jl + 1])  # tonnes, euros
ext = [i for i, p in enumerate(crow) if len(p) == 2 and p not in EU and p not in ("EU", "XX")]
cq, cv = Q[ext].sum(0), V[ext].sum(0)
out["comext"] = {
    "months": ct,
    "tonnes": [r(x, 0) for x in cq],
    "eurPerT": [r(v / q, 0) if q > 0 else None for q, v in zip(cq, cv, strict=True)],
    "partners": {},
}
for p in top:
    if p in crow:
        i = crow.index(p)
        out["comext"]["partners"][p] = {
            "tonnes": [r(x, 0) for x in Q[i]],
            "eurPerT": [r(v / q, 0) if q > 1000 else None for q, v in zip(Q[i], V[i], strict=True)],
        }


# ------------------------------------------------------------------ prices: EIA daily, monthly means
def eia(name):
    b = xlrd.open_workbook(RAW / f"eia-{name}.xls")
    sh = b.sheet_by_name("Data 1")
    rows = [sh.row_values(i) for i in range(3, sh.nrows)]
    return [(xlrd.xldate_as_datetime(x, b.datemode).date(), y) for x, y in rows if y != ""]


jet, brent = eia("jet"), eia("brent")
since = date(2024, 1, 1)


def monthly(series):
    m = {}
    for d, v in series:
        m.setdefault(d.strftime("%Y-%m"), []).append(v)
    return {k: round(sum(v) / len(v), 3) for k, v in m.items()}


mj, mb = monthly(jet), monthly(brent)
out["prices"] = {
    "daily": {
        "dates": [d.isoformat() for d, _ in jet if d >= since],
        "jet": [round(v, 3) for d, v in jet if d >= since],
        "brent": {d.isoformat(): round(v, 2) for d, v in brent if d >= since},
    },
    "monthly": {
        "months": sorted(m for m in mj if m >= times[0]),
        "jet": [mj[m] for m in sorted(mj) if m >= times[0]],
        "brent": [mb.get(m) for m in sorted(mj) if m >= times[0]],
    },
    "last": jet[-1][0].isoformat(),
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))


# ------------------------------------------------------------------ what it says
def share(g, cols):
    return by_group[g][cols].sum() / total[cols].sum()


print(
    f"{OUT.relative_to(ROOT)} : {OUT.stat().st_size // 1024} ko, {times[0]} à {last}, "
    f"Comext jusqu'à {ct[-1]}, prix jusqu'à {out['prices']['last']}"
)
print(f"  avant {times[before[0]]}..{times[before[-1]]}  après {times[after[0]]}..{times[after[-1]]}")
print(
    f"  importations hors UE : {total[before].sum() / len(before):.0f} -> {total[after].sum() / len(after):.0f} kt/mois"
)
for g in [*GROUPS, "autres"]:
    print(f"  {g:10s} {share(g, before):6.1%} -> {share(g, after):6.1%}")
print("  partenaires inconnus :", unknown)
