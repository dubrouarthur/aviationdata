# ruff: noqa: E501  (the expected sentences are long)
"""« Combien de CO2 pour un vol ? » (co2-par-passager), end to end: every number of its text recomputed in
Python from web/public/data/co2.json (DGAC) and web/public/data/co2/trajets.json (distances), and looked
for on the page, the four figures, the flight plan, the sources, the glossary and the phone layout.
Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_carbone.py [--base http://127.0.0.1:4173]

Exit 1 on any failure.
"""

import json
import math
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
C = json.loads((ROOT / "public" / "data" / "co2.json").read_text())
T = json.loads((ROOT / "public" / "data" / "co2" / "trajets.json").read_text())["trips"]
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


pc = lambda v: f"{fr(v)} %"  # noqa: E731
kg = lambda v: f"{fr(round(v / 10) * 10)} kg"  # noqa: E731
t1 = lambda v: f"{fr(v / 1000, 1)} tonne"  # noqa: E731
g0 = lambda v: f"{fr(v)} g"  # noqa: E731
mt = lambda v: f"{fr(abs(v), 1)} millions de tonnes"  # noqa: E731

# ---------------------------------------------------------------- the facts, again
Y = C["years"]
FIRST, LAST = Y[0], Y[-1]
g = lambda k: C["g_peqkm"][k][-1]  # noqa: E731
dom, lc, allg = g("MET_INTERIEUR"), g("INTL_LC"), g("FRANCE_TOT")
seg = sorted(
    (
        ("Vol intérieur", dom),
        ("Moyen-courrier", g("INTL_MC")),
        ("Long-courrier", lc),
        ("Outre-mer", g("MET-OM_ET_OM-OM")),
    ),
    key=lambda r: -r[1],
)
trips = {t["toName"]: {**t, "ret": 2 * t["km"] * g(t["segment"]) / 1000} for t in T}
ny, tls = trips["New York"], trips["Toulouse"]
inten = C["g_peqkm"]["FRANCE_TOT"]
inten_ch = (inten[-1] / inten[0] - 1) * 100
tot = C["mt"]["FRANCE_TOT"]
tot_ch = (tot[-1] / tot[0] - 1) * 100
d = next(p for p in C["decomp"]["periods"] if p["from"] == FIRST and p["to"] == LAST)

# the distances are great circles between OurAirports coordinates, as in the jet story (5 834 km to JFK)
check("Paris-CDG – New York-JFK is the jet story's 5 834 km", ny["km"] == 5834, str(ny["km"]))
# the words the text derives from the numbers must stay true
check("domestic flights emit most per km", seg[0][0] == "Vol intérieur")
check("a third less per passenger since 2000 (30 to 36 %)", -36 < inten_ch <= -30, f"{inten_ch:.1f}")
check("the total rose", tot_ch > 0, f"{tot_ch:.1f}")
check("traffic and efficiency add up to the change", abs(d["trafic"] + d["intensite"] - (tot[-1] - tot[0])) < 0.05)
check("New York weighs more per trip, Toulouse more per km", ny["ret"] > tls["ret"] and dom > lc)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(f"{base}/co2-par-passager", wait_until="networkidle")
    pg.wait_for_timeout(800)
    txt = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    has("kicker", txt(".issue-kicker"), "En 5 minutes, n° 7", "Climat")
    has(
        "short answer",
        txt("#court-answer"),
        t1(ny["ret"]),
        "de CO2 par passager pour un aller-retour Paris–New York,",
        f"{kg(tls['ret'])} pour un Paris–Toulouse.",
        f"Chaque passager émet un tiers de moins qu'en {FIRST}.",
    )
    check("flight plan: four steps and the answer", pg.locator("#flightplan li").count() == 5)

    has(
        "step 1",
        txt("#au-kilometre"),
        "Par kilomètre, le vol intérieur émet le plus",
        f"chaque passager émet {g0(dom)} de CO2 par kilomètre ; sur un long-courrier, {g0(lc)}.",
        f"le vol intérieur émet donc {pc((dom / lc - 1) * 100)} de plus",
    )
    rows = [norm(t) for t in pg.locator("#chart-km .c-hbars li").all_inner_texts()]
    for (label, v), r in zip(seg, rows, strict=True):
        check(f"figure 1: {label}", r.startswith(label) and r.endswith(g0(v)), r)

    has(
        "step 2",
        txt("#voyage"),
        f"Un aller-retour Paris–New York : {t1(ny['ret'])} de CO2 par passager",
        f"Un aller-retour Paris–New York émet {kg(ny['ret'])} de CO2 par passager, celui de Paris à Toulouse {kg(tls['ret'])}.",
        f"New York pèse {fr(round(ny['ret'] / tls['ret']))} fois plus : sa distance est {fr(round(ny['km'] / tls['km']))} fois plus longue.",
    )
    rows = [norm(t) for t in pg.locator("#chart-trajet .c-hbars li").all_inner_texts()]
    want = sorted(trips.values(), key=lambda t: t["ret"])
    check("figure 2: every trip, shortest first", len(rows) == len(want), str(len(rows)))
    for t, r in zip(want, rows, strict=False):
        check(f"figure 2: {t['toName']}", t["toName"] in r and r.endswith(kg(t["ret"])) and f"{fr(t['km'])} km" in r, r)

    has(
        "step 3",
        txt("#efficacite"),
        f"Chaque passager émet un tiers de moins qu'en {FIRST}",
        f"En {FIRST}, un passager émettait {g0(inten[0])} de CO2 par kilomètre ; en {LAST}, {g0(allg)}.",
        f"La baisse est de {pc(inten_ch)} en vingt-quatre ans",
    )
    check("twenty-four years", LAST - FIRST == 24, str(LAST - FIRST))
    ends = norm(" ".join(pg.locator("#chart-efficacite .c-end-v").all_text_contents()))
    check("figure 3 ends on the last year", g0(allg) in ends, ends)

    has(
        "step 4",
        txt("#total"),
        "Le trafic a monté plus vite que les avions ne se sont améliorés",
        f"augmente de {pc(d['trafic_pct'])}",
        f"il ajouterait {mt(d['trafic'])} de CO2.",
        f"Les progrès par passager en retirent {mt(d['intensite'])}.",
        f"les vols de France émettent {mt(tot[-1])} en {LAST}, contre {fr(tot[0], 1)} en {FIRST}.",
    )
    vals = [norm(t) for t in pg.locator("#chart-total .c-hb-val").all_inner_texts()]
    check(
        "figure 4: traffic, efficiency, total",
        vals == [f"+{fr(d['trafic'], 1)} Mt", f"−{fr(abs(d['intensite']), 1)} Mt", f"+{fr(tot[-1] - tot[0], 1)} Mt"],
        str(vals),
    )

    has(
        "the answer",
        txt("#en-bref"),
        f"Un aller-retour Paris–New York émet environ {t1(ny['ret'])} de CO2 par passager ; un Paris–Toulouse, {kg(tls['ret'])}.",
        f"le total a augmenté de {pc(tot_ch)}, parce que l'on vole davantage.",
    )

    for fig in pg.locator("main figure.panel").all():
        check(f"figure source: {norm(fig.locator('h3').inner_text())[:40]}", fig.locator(".source-line a").count() >= 1)
    check("chapters list their data", pg.locator(".chapter-sources").count() == 4)
    check("method in four steps", pg.locator("#comment .how-steps li").count() == 4)
    gl = pg.locator("main button.gloss")
    check("glossary: at least three terms", gl.count() >= 3, str(gl.count()))
    gl.first.click()
    check("glossary: a term opens its definition", pg.locator("#gloss-pop").is_visible())
    pg.keyboard.press("Escape")
    links = [a.get_attribute("href") for a in pg.locator("#sources-body a").all()]
    for need in ("emissions-nettes-annuelles-de-co2", "Bilan_emissions_CO2_transport_aerien_2024", "ourairports.com"):
        check(f"sources link {need}", any(need in (h or "") for h in links))
    check("no console error", not errors, str(errors[:3]))

    mob = b.new_page(viewport={"width": 375, "height": 800})
    mob.goto(f"{base}/co2-par-passager", wait_until="networkidle")
    mob.wait_for_timeout(600)
    over = mob.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("phone: no sideways scroll", over <= 0, str(over))
    b.close()

assert math.isfinite(tot_ch)
print(f"\n{len(failures)} failure(s)" if failures else "\nall checks pass")
sys.exit(1 if failures else 0)
