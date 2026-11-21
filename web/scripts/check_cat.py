"""Check « Le ciel clair est-il plus agité ? » (web/turbulences/): every number of the text recomputed in Python from
web/public/data/cat/cat.json, without reading web/src/cat/facts.js; cat.json itself checked against the raw
reductions (data/raw/cat/<year>.npz, era5_cat.py) when they are there; then the page: figures, sources, the
« Lecture » lines, the season controls, the phone.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/check_cat.py [--base URL]
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
C = json.loads((ROOT / "web/public/data/cat/cat.json").read_text())
FAIL = []


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))
    if not ok:
        FAIL.append(name)


# ------------------------------------------------------------------ French formatting, as fmtNum
def fr(v, d=0):
    s = f"{abs(v):,.{d}f}".replace(",", " ").replace(".", ",")
    return ("−" if v < 0 and round(abs(v), d) else "") + s


def pc(v, d=1):
    return f"{fr(v * 100, d)} %"


def chg(r):
    return "0 %" if abs(r) < 0.005 else f"{'+' if r >= 0 else '−'}{fr(abs(r) * 100, 0)} %"


def hrs(f):
    h = f * 8766
    return f"{fr(round(h) if h < 50 else round(h / 5) * 5)} heures"


def rnd(v):
    """Math.round, half up"""
    import math

    return math.floor(v + 0.5)


def one_in(f):
    return f"une heure sur {fr(rnd(1 / f))}"


CRUISE = 900


def fmin(r):
    return r["km"] / CRUISE * 60


def rmin(r, s):
    return r["seasons"][s] * fmin(r)


def mins(m):
    return f"{fr(rnd(m))} minutes"


def dur(m):
    t = rnd(m / 5) * 5
    return f"{t // 60} h {t % 60:02d}"


WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"]


def times(r):
    n = round(r)
    if 2 <= n <= 10 and abs(r - n) < 0.15:
        q = "près de " if r < n - 0.03 else "plus de " if r > n + 0.03 else ""
        return f"{q}{WORDS[n]} fois"
    return f"{fr(r, 1)} fois"


def mean(v):
    x = [a for a in v if a is not None]
    return sum(x) / len(x)


def lat(la):
    return f"{fr(abs(la))}° {'N' if la >= 0 else 'S'}"


MONTHS = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
]

# ------------------------------------------------------------------ recompute
years = C["meta"]["years"]
first, last = years[0], years[-1]
LOCAL = ["atlantique", "pacifique", "europe", "amerique", "asie"]
R = {}
for k, r in C["regions"].items():
    a = r["annual"]
    d0, d1 = mean(a[:10]), mean(a[-10:])
    sc = {s: mean(r["seasons"][s]) for s in ("DJF", "MAM", "JJA", "SON")}
    R[k] = {"clim": mean(a), "change": d1 / d0 - 1, "first": d0, "last": d1, "sc": sc, "label": r["label"]}
    sev = r["annualSev"]
    R[k]["sev"] = mean(sev[-10:]) / mean(sev[:10]) - 1
    check(
        f"{k}: decades of cat.json",
        abs(r["decades"]["change"] - R[k]["change"]) < 1e-3,
        f"{r['decades']['change']} {R[k]['change']}",
    )
atl = R["atlantique"]
byclim = sorted(LOCAL, key=lambda k: -R[k]["clim"])
up = [k for k in LOCAL if R[k]["change"] > 0]
pny = next(r for r in C["routes"] if r["key"] == "CDG-JFK")
step, lat0 = C["meta"]["step"], C["meta"]["lat0"]
north = max(
    (
        (v, lat0 + i * step, m)
        for m, row in enumerate(C["zonal"]["all"])
        for i, v in enumerate(row)
        if lat0 + i * step > 0
    )
)
south = max(
    (
        (v, lat0 + i * step, m)
        for m, row in enumerate(C["zonal"]["all"])
        for i, v in enumerate(row)
        if lat0 + i * step < 0
    )
)
lv = {L: C["regions"]["nord"]["levels"][str(L)] for L in (200, 250, 300)}
top = max(lv, key=lv.get)
fl = {200: 390, 250: 340, 300: 300}
dec0, dec1 = f"{first}-{first + 9}", f"{last - 9}-{last}"

# cat.json against the raw reductions, when they are there
raw = ROOT / "data/raw/cat"
if (raw / f"{last}.npz").exists():
    import numpy as np

    z = np.load(raw / f"{last}.npz")
    k = list(z["thresh"]).index(C["meta"]["thrMod"]) if C["meta"]["thrMod"] in list(z["thresh"]) else None
    check("raw: the threshold is one of era5_cat.THRESH", k is not None, str(C["meta"]["thrMod"]))
    if k is not None:
        la, lo = z["lat"], z["lon"]
        rows = (la >= 40) & (la <= 65)
        cols = (lo >= 290) & (lo <= 350)
        w = np.cos(np.radians(la[rows]))[:, None] * np.ones(cols.sum())
        e = z["exc"][1, :, k][:, rows][:, :, cols].sum(0)
        f = (e * w).sum() / w.sum() / z["steps"].sum()
        check(
            f"raw: North Atlantic {last} from the npz",
            abs(f - C["regions"]["atlantique"]["annual"][-1]) < 2e-5,
            f"{f} {C['regions']['atlantique']['annual'][-1]}",
        )
else:
    print("skip raw: data/raw/cat is empty (python3 etl/cat/era5_cat.py)")

# ------------------------------------------------------------------ the page
from playwright.sync_api import sync_playwright  # noqa: E402


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " ")).strip()


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(f"{BASE}/turbulences", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    T = norm(pg.inner_text("main"))
    t = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    def has(name, text, where=None):
        src = t(where) if where else T
        check(name, norm(text) in src, text)

    check("no error in the console", not errors, "; ".join(errors[:3]))
    # opening
    has(
        "opening: hours over the North Atlantic",
        f"environ {hrs(atl['clim'])} par an, {times(atl['sc']['DJF'] / atl['sc']['JJA'])} plus l'hiver que l'été",
        "#open-dek",
    )
    has("opening: decade change", f"De la décennie {dec0} à la décennie {dec1}", "#open-dek")
    # essentials
    E = t("#essentiel-list")
    for name, s in [
        ("essentiel: top region", f"{hrs(R[byclim[0]]['clim'])} par an de conditions propices"),
        ("essentiel: season", f"{times(atl['sc']['DJF'] / atl['sc']['JJA'])} plus de conditions propices l'hiver"),
        ("essentiel: level", f"niveau {fl[top]}"),
        ("essentiel: Paris – New York", f"{mins(rmin(pny, 'DJF'))} sur les {dur(fmin(pny))} du trajet"),
        ("essentiel: Paris – New York, summer", f"L'été, {mins(rmin(pny, 'JJA'))}"),
        ("essentiel: trend", f"{chg(atl['change'])} au-dessus de l'Atlantique Nord"),
        ("essentiel: strongest", f"Les plus fortes, {chg(R['atlantique']['sev'])}"),
        ("essentiel: north band", f"jusqu'à {lat(north[1])} en {MONTHS[north[2]]}"),
    ]:
        check(name, norm(s) in E, s)
    # chapters
    has("ch1: top three", f"{hrs(R[byclim[1]]['clim'])}, et", "#carte-after")
    has("ch1: Europe", f"en compte {hrs(R['europe']['clim'])}", "#carte-after")
    has(
        "ch1: threshold share",
        f"ne dépasse que dans {pc(C['meta']['pctMod'], 1)} des situations du globe",
        "#carte-aside",
    )
    M = t("#tc-measure")
    check(
        "measure: one hour in",
        norm(f"{pc(C['meta']['pctMod'], 1)} des situations du globe, {one_in(C['meta']['pctMod'])}") in M,
        M[:200],
    )
    check("measure: the strongest", norm(f"{pc(C['meta']['pctSev'], 2)} des situations") in M, M[:300])
    check("measure: 1 % = 88 hours", "1 % du temps, c'est 88 heures par an" in M and round(0.01 * 8766) == 88)
    has(
        "ch2: winter and summer",
        f"réunies {one_in(atl['sc']['DJF'])} de décembre à février, contre {one_in(atl['sc']['JJA'])} de juin à août",
        "#saisons-after",
    )
    us = R["amerique"]["sc"]
    has("ch2: the United States", f"{times(us['DJF'] / us['JJA'])} plus l'hiver que l'été", "#saisons-after")
    has(
        "ch3: the southern band",
        f"à {lat(south[1])} en {MONTHS[south[2]]}, les conditions y sont réunies {one_in(south[0])}"
        + (
            ", autant qu'au plus fort du nord"
            if rnd(1 / south[0]) == rnd(1 / north[0])
            else f", contre {one_in(north[0])}"
        ),
        "#latitudes-after",
    )
    has(
        "ch4: levels",
        f"réunies {one_in(lv[250])} dans l'hémisphère nord ; au niveau 300, {one_in(lv[300])}",
        "#altitude-after",
    )
    has("ch4: FL390", f"{one_in(lv[200])} seulement", "#altitude-after")
    paris = sorted([r for r in C["routes"] if r["key"].startswith("CDG")], key=lambda r: -r["seasons"]["DJF"])
    has(
        "ch5: the most exposed route",
        f"Sur {paris[0]['label']}, {mins(rmin(paris[0], 'DJF'))} des {dur(fmin(paris[0]))} du trajet",
        "#routes-after",
    )
    has(
        "ch6: hours, first and last decade",
        f"passe de {hrs(atl['first'])} à {hrs(atl['last'])} par an",
        "#atlantique-prose",
    )
    has("ch6: strongest", f"la hausse est de {chg(atl['sev'])}", "#atlantique-after")
    hi = max(LOCAL, key=lambda k: R[k]["change"])
    lo = min(LOCAL, key=lambda k: R[k]["change"])
    has("ch7: lowest and highest", f"de {chg(R[lo]['change'])} au-dessus", "#tendance-prose")
    has("ch7: highest", f"à {chg(R[hi]['change'])} au-dessus", "#tendance-prose")
    vws = C["regions"]["atlantique"]["trendVws"]["change"]
    moved = (
        "n'a presque pas changé"
        if abs(vws) < 0.03
        else (f"a augmenté de {pc(vws, 0)}" if vws > 0 else f"a baissé de {pc(-vws, 0)}")
    )
    has("ch8: the shear", f"le cisaillement moyen au niveau 340 {moved} de {first} à {last}", "#evolution-prose")
    D = C["decades"]
    sv = C["regions"]["atlantique"]["decadesSev"]
    for name, yrs, f in [("first", D["first"], sv["first"]), ("last", D["last"], sv["last"])]:
        h = hrs(f).replace(" heures", " h")
        has(f"opening: {name} decade", f"{yrs[0]}-{yrs[1]} Conditions les plus fortes : {h} par an", ".tc-open")
    has(
        "opening: the reading sentence",
        f"les conditions les plus fortes de turbulence en air clair {round(sv['first'] * 8766)} heures par an "
        f"en {D['first'][0]}-{D['first'][1]}. En {D['last'][0]}-{D['last'][1]}, {round(sv['last'] * 8766)} heures",
        "#tc-read",
    )
    has(
        "answer",
        f"{chg(atl['change'])} de la décennie {dec0} à la décennie {dec1}, {chg(atl['sev'])} pour les plus fortes",
        "#reponse-prose",
    )
    # words: conditions, not turbulence felt; no cause asserted in the story
    check(
        "never « turbulence ressentie » or « à cause du réchauffement »",
        not re.search(r"turbulences? ressentie|à cause du réchauffement|provoqu", T),
        "",
    )
    # figures: a source line and a Lecture line each
    figs = pg.locator("main figure.panel")
    for i in range(figs.count()):
        f = figs.nth(i)
        h = norm(f.locator("h3").inner_text())
        check(f"figure « {h} »: source line", f.locator(".source-line a").count() > 0)
        check(
            f"figure « {h} »: Lecture line",
            f.locator(".lecture").count() == 1 and "Lecture" in f.locator(".lecture").inner_text(),
        )
        check(f"figure « {h} »: drawn", f.locator("svg, canvas").count() > 0)
    check(
        "every chapter lists its data",
        pg.locator(".story-chapter:not(#en-bref) .chapter-sources").count() == 8,
    )
    has("answer: Paris – New York minutes", f"environ {mins(rmin(pny, 'DJF'))} du trajet", "#reponse-prose")
    check(
        "routes: the data table gives minutes",
        f"{rnd(rmin(pny, 'DJF'))} min"
        in norm(pg.locator("#chart-routes + details.data").evaluate("n => n.textContent")),
    )
    # controls
    pg.click("#levels-seg button[data-v=DJF]")
    pg.wait_for_timeout(200)
    check(
        "levels: the season control draws winter",
        pg.locator("#levels-seg button[data-v=DJF][aria-pressed=true]").count() == 1,
    )
    before = pg.evaluate("document.querySelector('#chart-routes canvas').toDataURL().length")
    pg.click("#routes-seg button[data-v=JJA]")
    pg.wait_for_timeout(300)
    after = pg.evaluate("document.querySelector('#chart-routes canvas').toDataURL().length")
    check("routes: the season control redraws the map", before != after)
    # phone
    ph = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    ph.goto(f"{BASE}/turbulences", wait_until="networkidle")
    ph.wait_for_timeout(2000)
    sw = ph.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scroll", sw <= 391, str(sw))
    b.close()

print(f"\n{len(FAIL)} échec(s)" if FAIL else "\ntout est bon")
sys.exit(1 if FAIL else 0)
