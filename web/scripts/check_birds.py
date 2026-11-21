# ruff: noqa: E501  (the sentences checked are long)
"""Check « Quand les avions heurtent-ils des oiseaux ? » (web/oiseaux/): every number of the text recomputed in Python
from web/public/data/birds/birds.json, without reading web/src/birds/facts.js; birds.json itself checked against the
FAA file (data/raw/wildlife/strikes.csv, fetch_birds.py) when it is there; then the page: figures, sources, « Lecture »
lines, the words (reports, never a risk), the phone.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/check_birds.py [--base URL]
"""

import csv
import json
import os
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
B = json.loads((ROOT / "web/public/data/birds/birds.json").read_text())
FAIL = []
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
WORDS = "zéro un deux trois quatre cinq six sept huit neuf dix onze douze".split()
NIGHT = [21, 22, 23, 0, 1, 2, 3, 4]
PHASES = ["décollage", "montée", "croisière", "approche", "atterrissage"]


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))
    if not ok:
        FAIL.append(name)


def rnd(v):
    return int(Decimal(str(v)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def fr(v, d=0):
    q = Decimal(str(abs(v))).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{q:,.{d}f}".replace(",", " ").replace(".", ",")


def pc(v, d=0):
    return f"{fr(v * 100, d)} %"


def times(r):
    n = round(r)
    if 2 <= n <= 12 and abs(r - n) < 0.15:
        return ("près de " if r < n - 0.03 else "plus de " if r > n + 0.03 else "") + f"{WORDS[n]} fois"
    return f"{fr(r, 1)} fois"


# ------------------------------------------------------------------ recompute
m = B["meta"]
p0, p1 = m["profile"]
n = m["reports"]
years = sorted(int(y) for y in B["years"])
first, last = years[0], m["lastFull"]
r0, d0 = B["years"][str(first)][:2]
r1, d1 = B["years"][str(last)][:2]
night = [sum(B["clock"][h][k] for h in NIGHT) for k in range(12)]
allk = [sum(B["clock"][h][k] for h in range(24)) for k in range(12)]
nshare = [night[k] / allk[k] for k in range(12)]
spring = max([2, 3, 4], key=lambda k: nshare[k])
autumn = max([8, 9, 10], key=lambda k: nshare[k])
L = B["light"]
night_light = L["nuit"] / (L["jour"] + L["nuit"] + L["aube"] + L["crépuscule"])
months = [v / n for v in B["months"]]
top, low = months.index(max(months)), months.index(min(months))
H = [{"n": a, "d": b, "rate": b / a} for a, b in B["heights"]]
kh = m["knownHeight"]
low500 = sum(h["n"] for h in H[:3]) / kh
ground, high = H[0], H[-1]
kp = sum(B["phases"][p][0] for p in PHASES)
ph = {p: {"share": B["phases"][p][0] / kp, "rate": B["phases"][p][1] / B["phases"][p][0]} for p in PHASES}
near = sum(B["phases"][p][0] for p in ("décollage", "atterrissage", "approche", "montée")) / kp
parts = {k: {"s": s, "d": d, "rate": d / s} for k, (s, d) in B["parts"].items()}
most = max(parts, key=lambda k: parts[k]["s"])
S = {k: {"n": a, "d": b, "rate": b / a} for k, (a, b) in B["sizes"].items()}
sized = sum(v["n"] for v in S.values())
sp = {s["key"]: s | {"rate": s["dmg"] / s["n"]} for s in B["species"]}
most_rep = max(sp.values(), key=lambda s: s["n"])
most_dmg = max(sp.values(), key=lambda s: s["dmg"])
high_rate = max((s for s in sp.values() if s["n"] >= 300), key=lambda s: s["rate"])

# birds.json against the FAA file, when it is there
raw = ROOT / "data/raw/wildlife/strikes.csv"
if raw.exists():
    rep = dmg = 0
    years_raw = {}
    with open(raw, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            try:
                y = int(r["INCIDENT_YEAR"])
            except ValueError:
                continue
            years_raw[y] = years_raw.get(y, 0) + 1
            if p0 <= y <= p1:
                rep += 1
                dmg += r["DAMAGE_LEVEL"] in {"M", "M?", "S", "D"}
    check("raw: reports of the profile years", rep == n, f"{rep} {n}")
    check("raw: damaging strikes", dmg == m["damage"], f"{dmg} {m['damage']}")
    check("raw: reports of the first and last full year", years_raw[first] == r0 and years_raw[last] == r1)
else:
    print("skip raw: data/raw/wildlife/strikes.csv is missing (python3 etl/birds/fetch_birds.py)")
check("sizes: the shares of the text add up", abs(sum(v["n"] for v in S.values()) - sized) == 0)

# ------------------------------------------------------------------ the page
from playwright.sync_api import sync_playwright  # noqa: E402


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " ")).strip()


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    pg.goto(f"{BASE}/oiseaux", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    T = norm(pg.inner_text("main"))

    def t(sel):
        return norm(pg.inner_text(sel))

    def has(name, text, where=None):
        src = t(where) if where else T
        check(name, norm(text) in src, text)

    check("no error in the console", not errors, "; ".join(errors[:3]))
    per_year = n / (p1 - p0 + 1)
    has("opening: reports a year", f"en moyenne {fr(round(per_year / 100) * 100)} déclarations", "#open-dek")
    has("opening: a day", f"{p0} à {p1}, {fr(per_year / 365.25)} par jour", "#open-dek")
    has("opening: one in", f"Un sur {rnd(1 / (m['damage'] / n))} a abîmé l'avion", "#open-dek")
    stats = [norm(x) for x in pg.locator("#bd-open-stats .ck-stat b").all_inner_texts()]
    check(
        "opening stats",
        stats == [fr(per_year / 365.25), f"{rnd(low500 * 10)} sur 10", f"1 sur {rnd(1 / S['grand']['rate'])}"],
        str(stats),
    )
    E = t("#essentiel-list")
    for name, s in [
        ("essentiel: night", f"{pc(night_light)} des impacts ont lieu de nuit"),
        (
            "essentiel: night peaks",
            f"en {MONTHS[spring]} et en {MONTHS[autumn]}, quand {pc(nshare[spring])} et {pc(nshare[autumn])}",
        ),
        (
            "essentiel: season",
            f"{times(months[top] / months[low])} plus d'impacts déclarés en {MONTHS[top]} qu'en {MONTHS[low]}",
        ),
        ("essentiel: height", f"{pc(low500)} des impacts dont la hauteur est connue"),
        (
            "essentiel: height damage",
            f"{pc(high['rate'])} au-dessus de 3 000 mètres, contre {pc(ground['rate'])} au sol",
        ),
        ("essentiel: size", f"{pc(S['grand']['rate'])} des impacts de gros oiseau"),
        ("essentiel: small", f"Pour un petit oiseau, {pc(S['petit']['rate'], 1)}"),
        ("essentiel: reports", f"{times(r1 / r0)} plus de déclarations en {last} qu'en {first}"),
        ("essentiel: damage ratio", f"multipliés que par {fr(d1 / d0, 1)}"),
    ]:
        check(name, norm(s) in E, s)
    has(
        "ch1: May and July",
        f"{pc(nshare[spring])} des impacts horodatés tombent entre 21 h et 5 h ; en juillet, {pc(nshare[6])}",
        "#horloge-after",
    )
    has("ch1: the known hours", f"connue pour {pc(m['timed'] / n)} des impacts", "#horloge-aside")
    has("ch2: July to October", f"{pc(sum(months[6:10]))} des déclarations", "#saisons-prose")
    has(
        "ch3: ground", f"{pc(ground['n'] / kh)} ont lieu au sol, et {pc(low500)} à moins de 500 pieds", "#hauteur-prose"
    )
    has(
        "ch3: damage by height",
        f"{pc(ground['rate'])} des impacts abîment l'avion. Au-dessus de 10 000 pieds, 3 000 mètres, {pc(high['rate'])} : {times(high['rate'] / ground['rate'])} plus",
        "#hauteur-after",
    )
    has("ch3: the Hudson", f"à {fr(B['hudson']['height'])} pieds", "#hauteur-after")
    has("ch4: near an airport", f"{pc(near)} des impacts dont la phase est connue", "#phases-prose")
    has("ch4: approach", f"L'approche concentre {pc(ph['approche']['share'])}", "#phases-after")
    has(
        "ch4: cruise",
        f"n'en comptent que {pc(ph['croisière']['share'])}, mais {pc(ph['croisière']['rate'])}",
        "#phases-after",
    )
    has("ch5: most struck", f"Les {most} reçoivent le plus d'impacts déclarés, {fr(parts[most]['s'])}", "#pieces-prose")
    has(
        "ch5: engines",
        f"touchés {fr(parts['moteurs']['s'])} fois ; un impact sur {rnd(1 / parts['moteurs']['rate'])}",
        "#pieces-after",
    )
    has(
        "ch5: effects",
        f"{fr(B['effects']['landing'])} atterrissages de précaution, {fr(B['effects']['aborted'])} décollages interrompus et {fr(B['effects']['shutdown'])} moteurs coupés",
        "#pieces-after",
    )
    has("ch6: small share", f"{pc(S['petit']['n'] / sized)} des impacts dont la taille est connue", "#especes-prose")
    has("ch6: most damaging", f"{fr(most_dmg['dmg'])} impacts avec dégâts, {pc(most_dmg['rate'])}", "#especes-after")
    has("ch6: highest rate", f"dans {pc(high_rate['rate'])} des cas", "#especes-after")
    has("ch6: most reported", f"dans {pc(most_rep['rate'], 1)}", "#especes-after")
    has("ch7: reports", f"En {first}, la FAA a reçu {fr(r0)} déclarations ; en {last}, {fr(r1)}", "#declarations-prose")
    has("ch7: damage", f"passés de {fr(d0)} à {fr(d1)}", "#declarations-prose")
    has(
        "ch7: shares",
        f"{pc(d0 / r0)} des déclarations faisaient état de dégâts ; en {last}, {pc(d1 / r1, 1)}",
        "#declarations-after",
    )
    has("answer", f"multipliées par {fr(r1 / r0, 1)} depuis {first}, les dégâts par {fr(d1 / d0, 1)}", "#reponse-prose")
    # words: reports, not risk
    check(
        "never « plus de risque » or « plus dangereux qu'avant »",
        not re.search(r"plus de risques?|risque (a|est) (augmenté|monté)(?! ou)|plus dangereux qu'avant", T),
    )
    check("the text says the reporting is voluntary", "volontaire" in T)
    # figures
    figs = pg.locator("main figure.panel")
    for i in range(figs.count()):
        f = figs.nth(i)
        h = norm(f.locator("h3").inner_text())
        check(f"figure « {h} »: source line", f.locator(".source-line a").count() > 0)
        check(
            f"figure « {h} »: Lecture line",
            f.locator(".lecture").count() == 1 and "Lecture" in f.locator(".lecture").inner_text(),
        )
        check(f"figure « {h} »: drawn", f.locator("svg").count() > 0)
    check("seven figures", figs.count() == 7, str(figs.count()))
    check("the opening clock is drawn", pg.locator("#bd-open-clock svg path").count() == 288)
    check("every chapter lists its data", pg.locator(".story-chapter:not(#en-bref) .chapter-sources").count() == 7)
    # phone
    ph_ = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    ph_.goto(f"{BASE}/oiseaux", wait_until="networkidle")
    ph_.wait_for_timeout(2000)
    sw = ph_.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scroll", sw <= 391, str(sw))
    b.close()

print(f"\n{len(FAIL)} échec(s)" if FAIL else "\ntout est bon")
sys.exit(1 if FAIL else 0)
