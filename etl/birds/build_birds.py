"""data/raw/wildlife/strikes.csv (fetch_birds.py) -> web/public/data/birds/birds.json, « Quand les avions heurtent-ils
des oiseaux ? ».

The FAA National Wildlife Strike Database: every strike of an animal by a civil aircraft reported to the FAA since
1990, by pilots, airports, airlines and mechanics. Reporting is voluntary: the number of reports says how much is
reported, not how much happens. The profiles (hour, month, height, phase, parts, species) are taken over the last
eleven full years (PROFILE), the series over every full year. A strike « with damage » = DAMAGE_LEVEL minor (M),
uncertain (M?), substantial (S) or destroyed (D). Only aggregates leave data/raw/.

    python3 etl/birds/build_birds.py
"""

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wildlife" / "strikes.csv"
OUT = ROOT / "web" / "public" / "data" / "birds" / "birds.json"

DAMAGE = {"M", "M?", "S", "D"}
# phases of flight, grouped (FAA wording -> the page's)
PHASES = {
    "Approach": "approche",
    "Arrival": "approche",
    "Landing Roll": "atterrissage",
    "Take-off Run": "décollage",
    "Climb": "montée",
    "Departure": "montée",
    "En Route": "croisière",
    "Descent": "croisière",
}
PARTS = {
    "RAD": "radôme",
    "WINDSHLD": "pare-brise",
    "NOSE": "nez",
    "ENG": "moteurs",
    "PROP": "hélices",
    "WING_ROT": "ailes",
    "FUSE": "fuselage",
    "LG": "train",
    "TAIL": "empennage",
    "LGHTS": "feux",
}
# height bands, in feet above ground: [low, high]
BANDS = [
    [0, 0],
    [1, 100],
    [101, 500],
    [501, 1000],
    [1001, 2000],
    [2001, 3000],
    [3001, 5000],
    [5001, 10000],
    [10001, 99999],
]
# French names of the species the page names (the most reported, the most damaging)
FR = {
    "Mourning dove": "Tourterelle triste",
    "Barn swallow": "Hirondelle rustique",
    "Killdeer": "Pluvier kildir",
    "Horned lark": "Alouette hausse-col",
    "American kestrel": "Crécerelle d'Amérique",
    "Eastern meadowlark": "Sturnelle des prés",
    "European starling": "Étourneau sansonnet",
    "Cliff swallow": "Hirondelle à front blanc",
    "Red-tailed hawk": "Buse à queue rousse",
    "Western meadowlark": "Sturnelle de l'Ouest",
    "Rock pigeon": "Pigeon biset",
    "American robin": "Merle d'Amérique",
    "Chimney swift": "Martinet ramoneur",
    "Brazilian free-tailed bat": "Molosse du Brésil (chauve-souris)",
    "Turkey vulture": "Urubu à tête rouge",
    "Canada goose": "Bernache du Canada",
    "White-tailed deer": "Cerf de Virginie",
    "Black vulture": "Urubu noir",
    "Bald eagle": "Pygargue à tête blanche",
    "Gulls": "Goélands et mouettes",
    "Mallard": "Canard colvert",
    "Osprey": "Balbuzard pêcheur",
    "Hawks": "Buses",
    "Snow goose": "Oie des neiges",
    "Sandhill crane": "Grue du Canada",
    "Red-winged blackbird": "Carouge à épaulettes",
    "Savannah sparrow": "Bruant des prés",
    "Hoary bat": "Chauve-souris cendrée",
    "Barn owl": "Effraie des clochers",
    "Coyote": "Coyote",
    "White-headed gull complex": "Goélands à tête blanche",
    "Northern pintail": "Canard pilet",
    "Great blue heron": "Grand héron",
    "Double-crested cormorant": "Cormoran à aigrettes",
    "Eurasian collared-dove": "Tourterelle turque",
    "Horned lark ": "Alouette hausse-col",
}


def year_of(row):
    try:
        return int(row["INCIDENT_YEAR"])
    except ValueError:
        return None


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


rows = []
with open(RAW, encoding="utf-8", errors="replace") as f:
    for r in csv.DictReader(f):
        y = year_of(r)
        if y is None:
            continue
        rows.append(r)

years_all = sorted({int(r["INCIDENT_YEAR"]) for r in rows})
# a full year: every month reported, and not the current one (the last year of the file is still being reported)
last_full = max(years_all) - 1
PROFILE = [last_full - 10, last_full]

series = {y: [0, 0, 0] for y in range(years_all[0], last_full + 1)}  # reports, with damage, deaths
for r in rows:
    y = int(r["INCIDENT_YEAR"])
    if y in series:
        series[y][0] += 1
        series[y][1] += r["DAMAGE_LEVEL"] in DAMAGE
        series[y][2] += int(num(r["NR_FATALITIES"]) or 0)

prof = [r for r in rows if PROFILE[0] <= int(r["INCIDENT_YEAR"]) <= PROFILE[1]]
n = len(prof)
dmg = sum(r["DAMAGE_LEVEL"] in DAMAGE for r in prof)

# hour x month (local time of the report), and day / night as reported
clock = [[0] * 12 for _ in range(24)]
timed = 0
months = [0] * 12
light = Counter()
for r in prof:
    m = int(r["INCIDENT_MONTH"]) - 1
    months[m] += 1
    light[r["TIME_OF_DAY"] or "?"] += 1
    t = re.match(r"^(\d{1,2}):(\d{2})", r["TIME"] or "")
    if t and int(t.group(1)) < 24:
        clock[int(t.group(1))][m] += 1
        timed += 1

# height above ground
heights = [[0, 0] for _ in BANDS]
known_h = 0
for r in prof:
    h = num(r["HEIGHT"])
    if h is None:
        continue
    known_h += 1
    for k, (lo, hi) in enumerate(BANDS):
        if lo <= h <= hi:
            heights[k][0] += 1
            heights[k][1] += r["DAMAGE_LEVEL"] in DAMAGE
            break

phases = defaultdict(lambda: [0, 0])
known_p = 0
for r in prof:
    p = PHASES.get(r["PHASE_OF_FLIGHT"])
    if r["PHASE_OF_FLIGHT"]:
        known_p += 1
    if p:
        phases[p][0] += 1
        phases[p][1] += r["DAMAGE_LEVEL"] in DAMAGE

parts = {}
for key, name in PARTS.items():
    cols = [f"{key}{i}" for i in range(1, 5)] if key == "ENG" else [key]
    s = sum(any(r[f"STR_{c}"] == "1" for c in cols) for r in prof)
    d = sum(any(r[f"DAM_{c}"] == "1" for c in cols) for r in prof)
    parts[name] = [s, d]

sizes = {}
for s, name in [("Small", "petit"), ("Medium", "moyen"), ("Large", "grand")]:
    sel = [r for r in prof if r["SIZE"] == s]
    sizes[name] = [len(sel), sum(r["DAMAGE_LEVEL"] in DAMAGE for r in sel)]

sp = defaultdict(lambda: {"n": 0, "dmg": 0, "months": [0] * 12, "size": Counter()})
for r in prof:
    name = r["SPECIES"].strip()
    if not name or name.startswith("Unknown"):
        continue
    e = sp[name]
    e["n"] += 1
    e["dmg"] += r["DAMAGE_LEVEL"] in DAMAGE
    e["months"][int(r["INCIDENT_MONTH"]) - 1] += 1
    if r["SIZE"]:
        e["size"][r["SIZE"]] += 1
identified = sum(e["n"] for e in sp.values())
by_n = sorted(sp, key=lambda k: -sp[k]["n"])[:14]
by_d = sorted(sp, key=lambda k: -sp[k]["dmg"])[:14]
keep = list(dict.fromkeys(by_n + by_d))
missing = [k for k in keep if k not in FR]
assert not missing, f"espèces sans nom français : {missing}"
species = [
    {
        "key": k,
        "name": FR[k],
        "n": sp[k]["n"],
        "dmg": sp[k]["dmg"],
        "months": sp[k]["months"],
        "size": {"Small": "petit", "Medium": "moyen", "Large": "grand"}.get(
            sp[k]["size"].most_common(1)[0][0] if sp[k]["size"] else "", ""
        ),
    }
    for k in keep
]

effects = Counter()
for r in prof:
    e = r["EFFECT"] or ""
    for k, name in [
        ("Precautionary Landing", "landing"),
        ("Aborted Take-off", "aborted"),
        ("Engine Shutdown", "shutdown"),
    ]:
        if k in e:
            effects[name] += 1

# the Hudson, 15 January 2009 (NTSB AAR-10/03): the database's own record, as reported
hud = next(
    r
    for r in rows
    if r["AIRPORT_ID"] == "KLGA" and r["INCIDENT_DATE"].startswith("01/15/09") and r["SPECIES"] == "Canada goose"
)

out = {
    "meta": {
        "first": years_all[0],
        "lastFull": last_full,
        "profile": PROFILE,
        "reports": n,
        "damage": dmg,
        "timed": timed,
        "knownHeight": known_h,
        "knownPhase": known_p,
        "identified": identified,
        "currentYear": max(years_all),
        "currentReports": sum(1 for r in rows if int(r["INCIDENT_YEAR"]) == max(years_all)),
    },
    "years": {str(y): v for y, v in series.items()},
    "clock": clock,
    "months": months,
    "light": {"jour": light["Day"], "nuit": light["Night"], "aube": light["Dawn"], "crépuscule": light["Dusk"]},
    "bands": BANDS,
    "heights": heights,
    "phases": dict(phases),
    "parts": parts,
    "sizes": sizes,
    "species": species,
    "effects": dict(effects),
    "hudson": {"height": int(num(hud["HEIGHT"])), "phase": hud["PHASE_OF_FLIGHT"], "year": 2009},
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(
    f"{OUT.relative_to(ROOT)} : {OUT.stat().st_size // 1024} ko ; {n} impacts {PROFILE[0]}-{PROFILE[1]}",
    f"{dmg} avec dégâts",
)
