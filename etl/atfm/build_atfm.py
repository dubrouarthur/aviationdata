"""data/raw/atfm/ (fetch_atfm.py) -> web/public/data/atfm/atfm.json, « Qui retarde les avions en Europe ? ».

En-route ATFM delay: the minutes a flight waits on the ground because a control centre on its route cannot take it
(EUROCONTROL's Network Manager allots the slot, and attributes the delay to the centre that asked for the
restriction, with the reason it declared). It is one part of a flight's delay, not all of it.

- The network = the row « EUROCONTROL Area (MS) » (each flight counted once). Providers = the rows « ANSP (AUA) »,
  merged by country when a provider changed its name (PROVIDERS); a flight crossing three countries is counted by
  each: provider flights never add up to the network's.
- Causes: the regulation's declared reason, grouped (GROUPS). The last full year is the last one with December.

    python3 etl/atfm/build_atfm.py
"""

import bz2
import csv
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "atfm"
OUT = ROOT / "web" / "public" / "data" / "atfm" / "atfm.json"
AREA = "EUROCONTROL Area (MS)"

# the declared reason of a regulation (EUROCONTROL codes), grouped for the reader
GROUPS = {
    "capacite": ("Capacité du contrôle", "C R M G"),
    "effectifs": ("Effectifs du contrôle", "S"),
    "meteo": ("Météo", "W D"),
    "greves": ("Grèves", "I N"),
    "autres": ("Pannes, événements, autres", "T E P O A V NA"),
}
GROUP_OF = {c: g for g, (_, cs) in GROUPS.items() for c in cs.split()}
CODES = list(GROUP_OF)

# provider (as named in the files, every name it has had) -> country code, French name, provider's current name
PROVIDERS = {
    "FR": ("France", "DSNA", ["DSNA"]),
    "DE": ("Allemagne", "DFS", ["DFS"]),
    "ES": ("Espagne", "ENAIRE", ["ENAIRE"]),
    "HU": ("Hongrie", "HungaroControl", ["HungaroControl (EC)"]),
    "MU": ("Maastricht (Benelux et nord de l'Allemagne, en altitude)", "MUAC", ["MUAC"]),
    "UK": ("Royaume-Uni", "NATS", ["NATS (Continental)"]),
    "GR": ("Grèce", "HASP", ["HASP", "HCAA"]),
    "AT": ("Autriche", "Austro Control", ["Austro Control"]),
    "HR": ("Croatie", "Croatia Control", ["Croatia Control"]),
    "CH": ("Suisse", "Skyguide", ["Skyguide"]),
    "RS": ("Serbie et Monténégro", "SMATSA", ["SMATSA"]),
    "CY": ("Chypre", "DCAC Cyprus", ["DCAC Cyprus"]),
    "IT": ("Italie", "ENAV", ["ENAV"]),
    "PL": ("Pologne", "PANSA", ["PANSA"]),
    "PT": ("Portugal", "NAV Portugal", ["NAV Portugal (Continental)"]),
    "CZ": ("Tchéquie", "ANS CR", ["ANS CR"]),
    "BE": ("Belgique", "skeyes", ["skeyes", "Belgocontrol"]),
    "MK": ("Macédoine du Nord", "M-NAV", ["M-NAV"]),
    "NL": ("Pays-Bas", "LVNL", ["LVNL"]),
    "RO": ("Roumanie", "ROMATSA", ["ROMATSA"]),
    "SK": ("Slovaquie", "LPS SR", ["LPS", "LPS SR"]),
    "BG": ("Bulgarie", "BULATSA", ["BULATSA"]),
    "SE": ("Suède", "LFV", ["LFV"]),
    "TR": ("Turquie", "DHMI", ["DHMI"]),
    "NO": ("Norvège", "Avinor", ["Avinor", "Avinor ANS (Continental)"]),
    "DK": ("Danemark", "Naviair", ["NAVIAIR"]),
    "GE": ("Géorgie", "Sakaeronavigatsia", ["Sakaeronavigatsia"]),
    "SI": ("Slovénie", "Slovenia Control", ["Slovenia Control"]),
    "AL": ("Albanie", "Albcontrol", ["Albcontrol"]),
    "EE": ("Estonie", "EANS", ["EANS"]),
    "FI": ("Finlande", "Fintraffic ANS", ["Finavia", "ANS Finland", "Fintraffic ANS"]),
    "IE": ("Irlande", "AirNav Ireland", ["IAA", "AirNav Ireland"]),
    "LV": ("Lettonie", "LGS", ["LGS"]),
    "MT": ("Malte", "MATS", ["MATS"]),
    "UA": ("Ukraine", "UkSATSE", ["UkSATSE"]),
    "LU": ("Luxembourg", "ANA LUX", ["ANA LUX"]),
    "AM": ("Arménie", "ARMATS", ["ARMATS"]),
    "MD": ("Moldavie", "MoldATSA", ["MoldATSA", "MOLDATSA"]),
    "LT": ("Lituanie", "Oro Navigacija", ["Oro Navigacija"]),
}
CODE_OF = {n: c for c, (_, _, names) in PROVIDERS.items() for n in names}
# rows that repeat another (a provider's total next to its continental part) or have no country
SKIP = {"NAV Portugal", "Avinor ANS", "Avinor ANS (Oceanic)", "Isavia", "Avians", "SES Area (RP1)"}


def num(x):
    return float(x) if x else 0.0


rows = []
for f in sorted(RAW.glob("ert_dly_ansp_*.csv.bz2")):
    with bz2.open(f, "rt", encoding="utf-8-sig") as fh:
        rows += list(csv.DictReader(fh))
if not rows:
    raise SystemExit(f"{RAW} est vide (python3 etl/atfm/fetch_atfm.py)")
unknown = {r["ENTITY_NAME"] for r in rows} - set(CODE_OF) - SKIP - {AREA}
assert not unknown, f"prestataires inconnus : {sorted(unknown)}"


def groups(r):
    g = dict.fromkeys(GROUPS, 0.0)
    for c in CODES:
        g[GROUP_OF[c]] += num(r.get(f"DLY_ERT_{c}_1"))
    return g


# ------------------------------------------------------------------ the network, day by day
net = {}
for r in rows:
    if r["ENTITY_NAME"] != AREA:
        continue
    d = r["FLT_DATE"][:10]
    net[d] = {
        "f": num(r["FLT_ERT_1"]),
        "d": num(r["DLY_ERT_1"]),
        "n": num(r["FLT_ERT_1_DLY"]),
        "n15": num(r["FLT_ERT_1_DLY_15"]),
        "g": groups(r),
    }
days = sorted(net)
first, last = days[0], days[-1]
d0 = date.fromisoformat(first)
assert (date.fromisoformat(last) - d0).days + 1 == len(days), "un jour manque dans la série du réseau"
years = sorted({d[:4] for d in days})
full = [y for y in years if f"{y}-12-31" in net and f"{y}-01-01" in net]
last_full = full[-1]
# the months of the current year, to compare like with like
ytd_to = last[5:7]


def agg(keys):
    f = sum(net[k]["f"] for k in keys)
    d = sum(net[k]["d"] for k in keys)
    g = {gk: sum(net[k]["g"][gk] for k in keys) for gk in GROUPS}
    return {
        "flights": round(f),
        "delay": round(d),
        "perFlight": round(d / f, 3) if f else None,
        "delayed": round(sum(net[k]["n"] for k in keys)),
        "delayed15": round(sum(net[k]["n15"] for k in keys)),
        "groups": {gk: round(v) for gk, v in g.items()},
    }


out = {
    "meta": {
        "first": first,
        "last": last,
        "lastFull": int(last_full),
        "ytdTo": ytd_to,
        "groups": {g: lab for g, (lab, _) in GROUPS.items()},
    },
    "years": {y: agg([d for d in days if d[:4] == y]) for y in years},
    # the same months as the current year, every year (January to the last month available)
    "ytd": {y: agg([d for d in days if d[:4] == y and d[5:7] <= ytd_to]) for y in years},
    "months": {},
    "daily": {
        "start": first,
        "flights": [round(net[d]["f"]) for d in days],
        "delay": [round(net[d]["d"]) for d in days],
        # the day's first declared reason, as an index in GROUPS (-1: no delay)
        "top": [
            (max(range(len(GROUPS)), key=lambda i, d=d: net[d]["g"][list(GROUPS)[i]]) if net[d]["d"] > 0 else -1)
            for d in days
        ],
    },
}
for d in days:
    m = d[:7]
    o = out["months"].setdefault(m, {"flights": 0, "delay": 0, "groups": dict.fromkeys(GROUPS, 0)})
    o["flights"] += round(net[d]["f"])
    o["delay"] += round(net[d]["d"])
    for g in GROUPS:
        o["groups"][g] += round(net[d]["g"][g])

# ------------------------------------------------------------------ the providers, by country
prov = defaultdict(lambda: defaultdict(lambda: {"f": 0.0, "d": 0.0, "g": dict.fromkeys(GROUPS, 0.0)}))
prov_day = defaultdict(lambda: defaultdict(float))
for r in rows:
    c = CODE_OF.get(r["ENTITY_NAME"])
    if not c:
        continue
    y = r["YEAR"]
    o = prov[c][y]
    o["f"] += num(r["FLT_ERT_1"])
    o["d"] += num(r["DLY_ERT_1"])
    for g, v in groups(r).items():
        o["g"][g] += v
    prov_day[r["FLT_DATE"][:10]][c] += num(r["DLY_ERT_1"])
out["providers"] = {}
for c, (country, name, _) in PROVIDERS.items():
    ys = prov[c]
    out["providers"][c] = {
        "country": country,
        "name": name,
        "years": {
            y: {
                "flights": round(o["f"]),
                "delay": round(o["d"]),
                "groups": {g: round(v) for g, v in o["g"].items()},
            }
            for y, o in sorted(ys.items())
        },
    }

# ------------------------------------------------------------------ the worst days
worst = sorted(days, key=lambda d: -net[d]["d"])[:12]
out["worst"] = []
for d in worst:
    g = net[d]["g"]
    top = max(g, key=g.get)
    pd = prov_day[d]
    c = max(pd, key=pd.get)
    out["worst"].append(
        {
            "date": d,
            "delay": round(net[d]["d"]),
            "flights": round(net[d]["f"]),
            "perFlight": round(net[d]["d"] / net[d]["f"], 2),
            "group": top,
            "groupShare": round(g[top] / net[d]["d"], 3),
            "provider": c,
            "providerShare": round(pd[c] / sum(pd.values()), 3),
        }
    )

# ---------------------------------------------- the week, in summer (June to August), last full year
wk = [[0.0, 0.0] for _ in range(7)]
for d in days:
    if d[:4] == last_full and "06" <= d[5:7] <= "08":
        w = date.fromisoformat(d).weekday()
        wk[w][0] += net[d]["f"]
        wk[w][1] += net[d]["d"]
out["week"] = [round(d / f, 3) for f, d in wk]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(f"{OUT.relative_to(ROOT)} : {OUT.stat().st_size // 1024} ko, {first} à {last}, dernière année pleine {last_full}")
for y in years:
    a = out["years"][y]
    g = a["groups"]
    print(
        f"  {y} {a['flights'] / 1e6:5.2f} M vols, {a['perFlight']:.2f} min/vol, "
        f"{a['delayed15'] / a['flights']:.1%} > 15 min, "
        + " ".join(f"{k} {v / a['delay']:.0%}" for k, v in g.items() if a["delay"])
    )
y = last_full
top = sorted(out["providers"].items(), key=lambda x: -x[1]["years"].get(y, {"delay": 0})["delay"])[:8]
tot = sum(p["years"].get(y, {"delay": 0})["delay"] for p in out["providers"].values())
print(
    "  ",
    ", ".join(
        f"{c} {p['years'][y]['delay'] / tot:.0%} ({p['years'][y]['delay'] / p['years'][y]['flights']:.2f})"
        for c, p in top
    ),
)
print("  pires jours :", [(w["date"], w["delay"], w["group"], w["provider"]) for w in out["worst"][:6]])
print("  semaine été :", out["week"])
