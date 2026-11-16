"""Check « D'où vient le kérosène des avions européens ? » (web/kerosene/): every number of the text recomputed in
Python from web/public/data/kero/kero.json, without reading web/src/kero/facts.js; kero.json itself checked against
the raw Eurostat files (data/raw/kero/, fetch_kero.py) when they are there; then the page: figures, sources, the
« Lecture » lines, no cause asserted, the phone.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/check_kero.py [--base URL]
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
K = json.loads((ROOT / "web/public/data/kero/kero.json").read_text())
FAIL = []
EU = set("BE BG CZ DK DE EE IE EL ES FR HR IT CY LV LT LU HU MT NL AT PL PT RO SI SK FI SE".split())
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


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))
    if not ok:
        FAIL.append(name)


def fr(v, d=0):
    s = f"{abs(v):,.{d}f}".replace(",", " ").replace(".", ",")
    return ("−" if v < 0 and round(abs(v), d) else "") + s


def pc(v, d=0):
    return f"{fr(v * 100, d)} %"


def tonnes(kt):
    return (
        f"{fr(kt / 1000, 1)} million{'s' if kt >= 2000 else ''} de tonnes"
        if kt >= 1000
        else f"{fr(round(kt) * 1000)} tonnes"
    )


def span(a, z):
    if a[:4] == z[:4]:
        return f"{MONTHS[int(a[5:]) - 1]}-{MONTHS[int(z[5:]) - 1]} {z[:4]}"
    return f"{MONTHS[int(a[5:]) - 1]} {a[:4]}-{MONTHS[int(z[5:]) - 1]} {z[:4]}"


# ------------------------------------------------------------------ recompute
m = K["months"]
idx = lambda a, z: [i for i, t in enumerate(m) if a <= t <= z]  # noqa: E731
B, A = idx(*K["meta"]["before"]), idx(*K["meta"]["after"])
tot = K["eu"]["total"]
S = lambda v, ii: sum(v[i] or 0 for i in ii)  # noqa: E731
totB, totA = S(tot, B), S(tot, A)
g = {k: (S(v, B) / totB, S(v, A) / totA) for k, v in K["eu"]["groups"].items()}
parts = {p: (S(v, B) / totB, S(v, A) / totA) for p, v in K["eu"]["partners"].items()}
after_rank = sorted(parts, key=lambda p: -parts[p][1])
y25 = idx("2025-01", "2025-12")
tot25 = S(tot, y25)
p25 = sorted(((S(v, y25) / tot25, p) for p, v in K["eu"]["partners"].items()), reverse=True)
golfe25 = S(K["eu"]["groups"]["golfe"], y25) / tot25
bal = K["balance"]["EU27_2020"]
b25 = [i for i, t in enumerate(bal["months"]) if t.startswith("2025")]
refinery, deliveries = S(bal["refinery"], b25), S(bal["deliveries"], b25)
C = K["comext"]
ci = lambda a, z: [i for i, t in enumerate(C["months"]) if a <= t <= z]  # noqa: E731
eur = lambda ii: sum(C["eurPerT"][i] * C["tonnes"][i] for i in ii) / sum(C["tonnes"][i] for i in ii)  # noqa: E731
eurB, eurA = eur(ci(*K["meta"]["before"])), eur(ci(*K["meta"]["after"]))
P = K["prices"]["monthly"]
jetPre = (P["jet"][P["months"].index("2026-01")] + P["jet"][P["months"].index("2026-02")]) / 2
LABEL = {p: v["label"] for p, v in K["partners"].items()}
check(
    "the comparison spans the same months a year apart",
    [t[5:] for t in K["meta"]["before"]] == [t[5:] for t in K["meta"]["after"]],
)
check("the Gulf share fell", g["golfe"][1] < g["golfe"][0])

# kero.json against the raw files
raw = ROOT / "data/raw/kero/imports-EU27_2020.json"
if raw.exists():
    d = json.loads(raw.read_text())
    dims, size = d["id"], d["size"]
    ix = {k: d["dimension"][k]["category"]["index"] for k in dims}
    mult = [1] * len(dims)
    for i in range(len(dims) - 2, -1, -1):
        mult[i] = mult[i + 1] * size[i + 1]
    month = K["meta"]["last"]
    tsum = 0.0
    for k, v in d["value"].items():
        c = [int(k) // mm % s for mm, s in zip(mult, size, strict=True)]
        p = [x for x, j in ix["partner"].items() if j == c[dims.index("partner")]][0]
        t = [x for x, j in ix["time"].items() if j == c[dims.index("time")]][0]
        if t == month and len(p) == 2 and p not in EU:
            tsum += v
    check(f"raw: imports from outside the Union in {month}", abs(tsum - tot[-1]) < 0.5, f"{tsum} {tot[-1]}")
else:
    print("skip raw: data/raw/kero is empty (python3 etl/kero/fetch_kero.py)")

# ------------------------------------------------------------------ the page
from playwright.sync_api import sync_playwright  # noqa: E402


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " ")).strip()


DE = {"US": "des États-Unis", "IN": "de l'Inde", "UK": "du Royaume-Uni"}
LE = {"US": "les États-Unis", "IN": "l'Inde", "UK": "le Royaume-Uni"}
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    pg.goto(f"{BASE}/kerosene", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    T = norm(pg.inner_text("main"))
    t = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    def has(name, text, where=None):
        src = t(where) if where else T
        check(name, norm(text) in src, text)

    check("no error in the console", not errors, "; ".join(errors[:3]))
    sb, sa = span(*K["meta"]["before"]), span(*K["meta"]["after"])
    a1, a2 = after_rank[0], after_rank[1]
    has("opening: before", f"{tonnes(totB / len(B))} par mois, {pc(g['golfe'][0])} du Golfe", "#kr-h0")
    has("opening: after", f"{tonnes(totA / len(A))} par mois, {pc(g['golfe'][1])} du Golfe", "#kr-h1")
    has("dek: the Gulf after", f"En {sa}, {pc(g['golfe'][1])}", "#open-dek")
    has("dek: the price", f"a augmenté de {pc(eurA / eurB - 1)}", "#open-dek")
    E = t("#essentiel-list")
    for name, s in [
        ("essentiel: refineries", f"{pc(refinery / deliveries)} de ce qui est livré en 2025"),
        ("essentiel: imported in 2025", f"Elle en a importé {tonnes(tot25)}"),
        ("essentiel: the Gulf in 2025", f"{pc(golfe25)} des pays du Golfe en 2025"),
        ("essentiel: Kuwait", f"Le Koweït à lui seul, {pc(p25[0][0])}"),
        ("essentiel: after", f"{pc(g['golfe'][1])} des importations viennent encore du Golfe"),
        ("essentiel: fall", f"ont baissé de {pc(1 - totA / totB)}"),
        ("essentiel: first supplier", f"{pc(parts[a1][1])} des importations viennent {DE.get(a1, 'du ' + LABEL[a1])}"),
        ("essentiel: second supplier", f"{pc(parts[a2][1])}, contre {pc(parts[a1][0])} et {pc(parts[a2][0])}"),
        ("essentiel: price", f"{fr(eurB)} € la tonne en {sb}, {fr(eurA)} € en {sa}"),
    ]:
        check(name, norm(s) in E, s)
    has("ch1: refinery output", f"ont produit {tonnes(refinery)} de kérosène", "#dependance-prose")
    has("ch1: deliveries", f"ont atteint {tonnes(deliveries)}", "#dependance-prose")
    has("ch2: Kuwait", f"pèse à lui seul {pc(p25[0][0])}", "#fournisseurs-after")
    years = sorted({x[:4] for x in m if x[:4] < K["meta"]["closure"][:4] and sum(1 for y in m if y[:4] == x[:4]) == 12})
    gy = {
        y: S(K["eu"]["groups"]["golfe"], idx(f"{y}-01", f"{y}-12")) / S(tot, idx(f"{y}-01", f"{y}-12")) for y in years
    }
    has(
        "ch3: title",
        f"Depuis {years[0]}, entre {pc(min(gy.values()))} et {pc(max(gy.values()))} venaient du Golfe",
        "#h-histoire",
    )
    kw = K["eu"]["partners"]["KW"]
    zero = next((m[i] for i in range(m.index(K["meta"]["closure"]), len(m)) if kw[i] == 0), None)
    if zero:
        has("ch4: Kuwait at zero", f"Le Koweït à zéro en {MONTHS[int(zero[5:]) - 1]} {zero[:4]}", "#h-ormuz")
    has("ch4: fall", f"{pc(1 - totA / totB)} de kérosène en moins", "#ormuz-after")
    has("ch5: title", f"{LE.get(a1, LABEL[a1]).capitalize()[0]}", "#h-relais")
    has("ch6: border price", f"coûtait en moyenne {fr(eurA)} €, contre {fr(eurB)} €", "#prix-prose")
    has("ch6: spot before", f"coûtait {fr(jetPre, 2)} $ le gallon en janvier-février 2026", "#prix-after")
    has("ch6: spot last", f"{fr(K['prices']['daily']['jet'][-1], 2)} $", "#prix-after")
    c = K["countries"]["FR"]
    has(
        "ch7: France before",
        f"la France achetait au Golfe {pc(c['before']['golfe'] / c['before']['total'])}",
        "#pays-prose",
    )
    has("ch7: France after", f"En {sa}, {pc(c['after']['golfe'] / c['after']['total'])}.", "#pays-prose")
    check("no cause asserted", not re.search(r"à cause d|en raison d|provoqu|parce que", T), "")
    figs = pg.locator("main figure.panel")
    for i in range(figs.count()):
        f = figs.nth(i)
        h = norm(f.locator("h3").inner_text())
        check(f"figure « {h} »: source line", f.locator(".source-line a").count() > 0)
        check(f"figure « {h} »: Lecture line", f.locator(".lecture").count() == 1)
        check(f"figure « {h} »: drawn", f.locator("svg, canvas").count() > 0)
    check("the closure marked on the months", pg.locator("#chart-heat line.k-mark").count() == 1)
    check("every chapter lists its data", pg.locator(".story-chapter:not(#en-bref) .chapter-sources").count() == 7)
    ph = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    ph.goto(f"{BASE}/kerosene", wait_until="networkidle")
    ph.wait_for_timeout(2000)
    sw = ph.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scroll", sw <= 391, str(sw))
    b.close()

print(f"\n{len(FAIL)} échec(s)" if FAIL else "\ntout est bon")
sys.exit(1 if FAIL else 0)
