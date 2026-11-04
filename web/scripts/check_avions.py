# ruff: noqa: E501  (the expected sentences are long)
"""« Le ciel, modèle par modèle » (modeles-d-avions), end to end: every number of its text recomputed in
Python from web/public/data/avions/monde.json (OpenSky) and us.json (BTS), the words the text derives
from them, the figures' values, the comparator, the sources, the glossary and the phone layout.
Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_avions.py [--base http://127.0.0.1:4173]

Exit 1 on any failure.
"""

import json
import re
import sys
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
W = json.loads((ROOT / "public" / "data" / "avions" / "monde.json").read_text())
U = json.loads((ROOT / "public" / "data" / "avions" / "us.json").read_text())
failures = []


def check(where, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + where + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(where)


norm = lambda s: re.sub(r"[\s  ]+", " ", s).strip()  # noqa: E731


def has(where, text, *needles):
    missing = [n for n in needles if norm(n) not in text]
    check(where, not missing, f"missing {missing}" if missing else "")


def fr(v, d=0):
    q = Decimal(str(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{abs(q):,.{d}f}".replace(",", " ").replace(".", ",")


pc = lambda v, d=0: f"{fr(v * 100, d)} %"  # noqa: E731
pt = lambda v: f"{fr(abs(v), 1)} point{'s' if abs(v) >= 2 else ''}"  # noqa: E731
km = lambda v: f"{fr(Decimal(str(v / 10)).quantize(Decimal(1), rounding=ROUND_HALF_UP) * 10)} km"  # noqa: E731
ten = lambda v: f"{fr(round(v * 10))} sur 10"  # noqa: E731


def group(t):
    if t["family"] in ("A320", "A320neo"):
        return "a320"
    if t["family"].startswith("737"):
        return "b737"
    return "regional" if t["kind"] == "regional" else "wide" if t["kind"] == "wide" else "other"


# ---------------------------------------------------------------- the world, again
years = [y["year"] for y in W["years"]]
FIRST, LAST = years[0], years[-1]
T = {c: t for c, t in W["types"].items()}
now = sorted(
    ({"code": c, **T[c], **m, "group": group(T[c])} for c, m in W["models"][str(LAST)].items()),
    key=lambda r: -r["flights"],
)
before = {c: m for c, m in W["models"][str(FIRST)].items()}
TOT = sum(r["flights"] for r in now)
TOT0 = sum(m["flights"] for m in before.values())
gshare = defaultdict(float)
for r in now:
    gshare[r["group"]] += r["flights"] / TOT
top2 = gshare["a320"] + gshare["b737"]
fam = defaultdict(int)
for r in now:
    k = (
        "Airbus A320"
        if r["group"] == "a320"
        else "Boeing 737"
        if r["group"] == "b737"
        else r["family"]
        if r["family"] == r["maker"]
        else f"{r['maker']} {r['family']}"
    )
    fam[k] += r["flights"]
families = sorted(((k, v / TOT) for k, v in fam.items()), key=lambda x: -x[1])
solid = [r for r in now if r["complete"] >= 5000]
by_km = sorted(solid, key=lambda r: r["kmMedian"])
by_use = sorted(
    (r for r in solid if r["flightsPerDay"] is not None and r["flights"] / TOT >= 0.01),
    key=lambda r: -r["flightsPerDay"],
)
change = sorted(
    (
        {
            **r,
            "share": r["flights"] / TOT,
            "share0": before[r["code"]]["flights"] / TOT0,
            "pp": (r["flights"] / TOT - before[r["code"]]["flights"] / TOT0) * 100,
        }
        for r in now
        if r["code"] in before
    ),
    key=lambda r: -r["pp"],
)
countries = defaultdict(lambda: {"total": 0, **{g: 0 for g in ("a320", "b737", "regional", "wide", "other")}})
for r in now:
    for cc, n in r["countries"]:
        countries[cc]["total"] += n
        countries[cc][r["group"]] += n
top_c = sorted(countries.items(), key=lambda kv: -kv[1]["total"])[:16]
lead = lambda c: max(("a320", "b737", "regional", "wide", "other"), key=lambda g: c[g])  # noqa: E731
n_a320 = sum(1 for _, c in top_c if lead(c) == "a320")
n_b737 = sum(1 for _, c in top_c if lead(c) == "b737")
model = {r["code"]: r for r in now}

# ---------------------------------------------------------------- the United States, again
M = U["models"]
big = sorted((m for m in M if m["operated"] >= 50000), key=lambda m: -m["ontime"])
best, worst = big[0], big[-1]
gap = lambda m: (m["ontime"] - m["ontimeExpected"]) * 100  # noqa: E731
by_gap = sorted(big, key=lambda m: -gap(m))
air = sorted((dict(a=a, **v) for a, v in U["airlines"].items() if v["flights"] >= 100000), key=lambda v: -v["ontime"])
across = (air[0]["ontime"] - air[-1]["ontime"]) * 100
cells = defaultdict(list)
for a, code, n, o in U["cells"]:
    cells[a].append(o)
within = [max(v) - min(v) for a, v in cells.items() if len(v) >= 2 and a in {x["a"] for x in air}]
within_mean = sum(within) / len(within) * 100
cm = [m for m in M if m["cancelRate"] is not None and m["cancelBase"] >= 20000]
reg = [m for m in cm if m["kind"] == "regional"]
main = [m for m in cm if m["kind"] != "regional"]
crate = lambda rows: sum(m["cancelled"] for m in rows) / sum(m["cancelBase"] for m in rows)  # noqa: E731
reg_exp = sum(m["cancelExpected"] * m["cancelBase"] for m in reg) / sum(m["cancelBase"] for m in reg)

# the words the text derives from the numbers must stay true
check("two families make close to two thirds of the flights (60 to 67 %)", 0.6 <= top2 < 0.67, f"{top2:.3f}")
check(
    "the A320 and the 737 are the two first families",
    [f for f, _ in families[:2]] == ["Airbus A320", "Boeing 737"],
    str(families[:2]),
)
check(
    "the most used aircraft is not a wide body, the least used is one",
    by_use[0]["kind"] != "wide" and by_use[-1]["kind"] == "wide",
)
med = lambda xs: sorted(xs)[len(xs) // 2]  # noqa: E731
check(
    "smaller aircraft fly more often: regional > single aisle > wide body (medians)",
    med([r["flightsPerDay"] for r in by_use if r["kind"] == "regional"])
    > med([r["flightsPerDay"] for r in by_use if r["kind"] == "narrow"])
    > med([r["flightsPerDay"] for r in by_use if r["kind"] == "wide"]),
)
check("the United States are the first country of departure", top_c[0][0] == "US", top_c[0][0])
check("most models stay within five points of their airlines", sum(1 for m in big if abs(gap(m)) < 5) > len(big) / 2)
check(
    "the airlines explain the regional jets' cancellations (within 0.3 point)",
    abs(crate(reg) - reg_exp) < 0.003,
    f"{crate(reg):.4f} {reg_exp:.4f}",
)
check("regional jets are cancelled more often than the others", crate(reg) > crate(main))
check(
    "the gap between airlines is at least the mean gap within one",
    across >= within_mean,
    f"{across:.1f} {within_mean:.1f}",
)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(f"{base}/modeles-d-avions", wait_until="networkidle")
    pg.wait_for_timeout(1000)
    txt = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    has("kicker", txt(".issue-kicker"), "Enquête n° 8", "Flottes")
    has(
        "opening",
        txt("#ouverture"),
        f"Cent vols d'avions de ligne en {LAST}, par famille",
        f"parmi les {fr(TOT)} vols d'avions de ligne",
    )
    counts = pg.evaluate("[...document.querySelectorAll('#open-waffle .waffle i')].length")
    check("opening: a hundred squares", counts == 100, str(counts))
    has(
        "standfirst",
        txt("#open-dek"),
        f"font {ten(top2)} des vols de ligne",
        f"{fr(U['flightsAll'])} vols de {U['year']}",
    )
    es = txt("#essentiel-list")
    has(
        "essentials",
        es,
        f"{pc(top2)} des vols de ligne suivis en {LAST}",
        f"un {by_use[0]['name']} enchaîne {fr(by_use[0]['flightsPerDay'], 1)} vols par jour de vol, un {by_use[-1]['name']} {fr(by_use[-1]['flightsPerDay'], 1)}",
        f"de {pc(worst['ontime'])} des vols pour le {worst['name']} à {pc(best['ontime'])} pour le {best['name']}",
        f"{pt(across)} d'écart",
    )

    f1, f2 = families[0], families[1]
    has(
        "chapter 1",
        txt("#familles"),
        f"le réseau OpenSky a suivi {fr(TOT)} vols",
        f"L'A320 et le 737, {ten(top2)} des vols",
        f"La famille A320 fait {pc(f1[1])} des vols, celle du 737 {pc(f2[1])}",
        f"font {pc(gshare['wide'])} des vols",
        f"moins de cent places, {pc(gshare['regional'])}",
    )
    rows = [norm(t) for t in pg.locator("#chart-fam .c-hbars li").all_inner_texts()]
    check(
        "figure 1: the families in order, with their shares",
        all(r.startswith(f) and r.endswith(pc(s, 1)) for (f, s), r in zip(families, rows, strict=False)),
        str(rows[:3]),
    )

    known = [r for r in by_km if r["flights"] / TOT >= 0.005]
    s_, l_ = known[0], known[-1]
    has(
        "chapter 2",
        txt("#distances"),
        f"Un {l_['name']} vole {fr(round(l_['kmMedian'] / s_['kmMedian']))} fois plus loin qu'un {s_['name']}",
        f"Le vol médian d'un {s_['name']} fait {km(s_['kmMedian'])}, celui d'un {l_['name']} {km(l_['kmMedian'])}",
        f"autour de {km(model['A320']['kmMedian'])} pour l'A320 et {km(model['B738']['kmMedian'])} pour le 737-800",
    )
    pts = pg.evaluate("[...document.querySelectorAll('#chart-km .av-st-l')].length")
    check("figure 2: one dot per model", pts == len(by_km), f"{pts} {len(by_km)}")

    u0, u1 = by_use[0], by_use[-1]
    has(
        "chapter 3",
        txt("#usage"),
        f"{fr(u0['flightsPerDay'], 1)} vols par jour pour un {u0['name']}, {fr(u1['flightsPerDay'], 1)} pour un {u1['name']}",
    )
    rows = [norm(t) for t in pg.locator("#chart-use .c-hbars li").all_inner_texts()]
    check(
        "figure 3: the models in order",
        len(rows) == len(by_use)
        and all(
            r.startswith(m["name"]) and r.endswith(fr(m["flightsPerDay"], 1))
            for m, r in zip(by_use, rows, strict=False)
        ),
        str(rows[:2]),
    )

    up = change[:3]
    has(
        "chapter 4",
        txt("#releve"),
        f"La part de l'{up[0]['name']} passe de {pc(up[0]['share0'], 1)} à {pc(up[0]['share'], 1)} des vols",
    )
    rows = [norm(t) for t in pg.locator("#chart-chg li").all_inner_texts()]
    shown = change[:6] + change[-6:]
    check(
        "figure 4: the six risers and six fallers",
        len(rows) == 12
        and all(
            r.startswith(m["name"]) and r.endswith(f"{'+' if m['pp'] >= 0 else '−'}{fr(abs(m['pp']), 1)} pt")
            for m, r in zip(shown, rows, strict=False)
        ),
        str(rows[:2]),
    )

    us_c = dict(top_c)["US"]
    has(
        "chapter 5",
        txt("#pays"),
        f"L'A320 domine en {n_a320} pays sur {len(top_c)}, le 737 en {n_b737}",
        f"le 737 fait {pc(us_c['b737'] / us_c['total'])} des vols et la famille A320 {pc(us_c['a320'] / us_c['total'])}",
    )
    cells_txt = [norm(t) for t in pg.locator("#chart-heat tbody tr").all_inner_texts()]
    check("figure 5: one row per country", len(cells_txt) == len(top_c), str(len(cells_txt)))

    has(
        "chapter 6",
        txt("#ponctualite"),
        f"de {pc(worst['ontime'])} à {pc(best['ontime'])} de vols à l'heure",
        f"En {U['year']}, {pc(U['modelledShare'])} de ces vols",
        f"Le {best['name']} arrive à l'heure dans {pc(best['ontime'])} des cas, le {worst['name']} dans {pc(worst['ontime'])}",
        f"le {by_gap[0]['name']} fait {pt(gap(by_gap[0]))} de mieux que ses compagnies, le {by_gap[-1]['name']} {pt(gap(by_gap[-1]))} de moins",
    )
    dots = pg.evaluate("[...document.querySelectorAll('#chart-ot .av-db-v')].map(t => t.textContent)")
    check(
        "figure 6: one row per model, its on-time share",
        [norm(d) for d in dots] == [pc(m["ontime"]) for m in big],
        str(dots[:3]),
    )

    has("chapter 7", txt("#compagnie"), f"l'écart est de {pt(across)}", f"s'écartent en moyenne de {pt(within_mean)}")
    has(
        "chapter 8",
        txt("#annulations"),
        f"{pc(crate(reg), 1)} de vols annulés pour les avions régionaux, {pc(crate(main), 1)} pour les autres",
        f"on attendait {pc(reg_exp, 1)} pour les avions régionaux",
        f"{pc(U['untailedCancelShare'])} des annulations n'en ont pas",
    )

    # the comparator: the A320neo and the 737 MAX 8 by default, then a choice and the address
    cmp = txt("#cmp-out")
    a, bm = W["models"][str(LAST)]["A20N"], W["models"][str(LAST)]["B38M"]
    has(
        "comparator: default pair",
        cmp,
        "Airbus A320neo",
        "Boeing 737 MAX 8",
        fr(a["flights"]),
        fr(b_ := bm["flights"]),
        km(a["kmMedian"]),
        km(bm["kmMedian"]),
    )
    ua = next(m for m in M if m["code"] == "A20N")
    has("comparator: the United States", cmp, pc(ua["ontime"], 1), pc(ua["cancelRate"], 2))
    pg.select_option("#cmp-a", "A388")
    pg.wait_for_timeout(200)
    cmp = txt("#cmp-out")
    has(
        "comparator: a model that does not fly in the United States",
        cmp,
        "Airbus A380",
        km(W["models"][str(LAST)]["A388"]["kmMedian"]),
    )
    check("comparator: the choice goes into the address", "a=A388" in pg.url, pg.url)

    for fig in pg.locator("main figure.panel").all():
        check(f"figure source: {norm(fig.locator('h3').inner_text())[:40]}", fig.locator(".source-line a").count() >= 1)
    check(
        "chapters list their data",
        pg.locator(".chapter-sources").count() >= 8,
        str(pg.locator(".chapter-sources").count()),
    )
    gl = pg.locator("main button.gloss")
    check("glossary: at least three terms", gl.count() >= 3, str(gl.count()))
    links = [x.get_attribute("href") for x in pg.locator("#sources-body a").all()]
    for need in ("zenodo.7923702", "transtats.bts.gov", "opensky-network.org/datasets", "ourairports.com"):
        check(f"sources link {need}", any(need in (h or "") for h in links))
    check("no console error", not errors, str(errors[:3]))

    mob = b.new_page(viewport={"width": 375, "height": 800})
    mob.goto(f"{base}/modeles-d-avions", wait_until="networkidle")
    mob.wait_for_timeout(800)
    over = mob.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("phone: no sideways scroll", over <= 0, str(over))
    b.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nall checks pass")
sys.exit(1 if failures else 0)
