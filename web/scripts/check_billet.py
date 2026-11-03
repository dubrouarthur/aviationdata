# ruff: noqa: E501  (the expected sentences are long)
"""« Le billet d'avion est-il plus cher ? » (prix-des-billets), end to end: every number of its text
recomputed in Python from web/public/data/prix.json (DGAC) and web/public/data/billet/hicp.json
(Eurostat) and looked for on the page, the four figures, the flight plan, the sources, the glossary and
the phone layout. Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_billet.py [--base http://127.0.0.1:4173]

Exit 1 on any failure.
"""

import json
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
P = json.loads((ROOT / "public" / "data" / "prix.json").read_text())
H = json.loads((ROOT / "public" / "data" / "billet" / "hicp.json").read_text())
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
signed = lambda v: ("+" if round(v) > 0 else "−" if round(v) < 0 else "") + pc(v)  # noqa: E731
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()


def year_mean(months, values, y):
    v = [x for m, x in zip(months, values, strict=True) if m.startswith(f"{y}-")]
    return sum(v) / 12 if len(v) == 12 and all(x is not None for x in v) else None


dg = lambda y, k="FRA_ENS": year_mean(P["months"], P["series"][k], y)  # noqa: E731
hi = lambda y, k="all": year_mean(H["months"], H[k], y)  # noqa: E731
ch = lambda a, b: (a / b - 1) * 100  # noqa: E731

# ---------------------------------------------------------------- the facts, again
FIRST = int(P["months"][0][:4])
LAST = min(int(P["months"][-1][:4]), int(H["months"][-1][:4]))
while dg(LAST) is None or hi(LAST) is None:
    LAST -= 1
total = ch(dg(LAST), dg(FIRST))
inflation = ch(hi(LAST), hi(FIRST))
real = ((1 + total / 100) / (1 + inflation / 100) - 1) * 100
flat = ch(dg(2021), dg(FIRST))
flat_infl = ch(hi(2021), hi(FIRST))
jump = ch(dg(2023), dg(2021))
since = ch(dg(LAST), dg(2023))
vals = [x for m, x in zip(P["months"], P["series"]["FRA_ENS"], strict=True) if m.startswith(f"{LAST}-")]
mean = sum(vals) / 12
dev = [ch(v, mean) for v in vals]
pk, lo = dev.index(max(dev)), dev.index(min(dev))
peak_low = ch(vals[pk], vals[lo])
SEG = {
    "MET_INTER_MET": "Vols intérieurs",
    "MET_INTAL_MC": "Moyen-courrier",
    "MET_INTER_OM": "Métropole–outre-mer",
    "DOM_ENS": "Départs d'outre-mer",
    "MET_INTAL_LC": "Long-courrier",
}
seg = sorted(((SEG[k], ch(dg(LAST, k), dg(2019, k))) for k in SEG), key=lambda r: -r[1])
all2019 = ch(dg(LAST), dg(2019))
air, allp, rail = (ch(hi(LAST, k), hi(2019, k)) for k in ("air", "all", "rail"))
last_m = P["months"][-1]
ly, n = int(last_m[:4]), int(last_m[5:])
s = lambda y: sum(
    x for m, x in zip(P["months"], P["series"]["FRA_ENS"], strict=True) if m.startswith(f"{y}-") and int(m[5:]) <= n
)  # noqa: E731
ytd = ch(s(ly), s(ly - 1)) if ly > LAST else None

# the words the text derives from the numbers must stay true
check("the answer is yes", total > 0 and jump > 0)
check("ten flat years: within 2 % from 2012 to 2021", abs(flat) < 2, f"{flat:.2f}")
check("a third more at the peak than at the low (30 to 40 %)", 30 <= peak_low < 40, f"{peak_low:.1f}")
check("domestic flights rose most", seg[0][0] == "Vols intérieurs", str(seg[0]))
check("the plane rose more than twice as fast as the train", air / rail >= 2, f"{air / rail:.2f}")
check("since Covid the train follows inflation, the plane outruns it", abs(rail - allp) < 5 and air > allp + 10)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(f"{base}/prix-des-billets", wait_until="networkidle")
    pg.wait_for_timeout(800)
    txt = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    has("kicker", txt(".issue-kicker"), "En 5 minutes, n° 6", "Prix")
    has(
        "short answer",
        txt("#court-answer"),
        "Oui,",
        f"En {LAST}, un billet au départ de France coûte {pc(total)} de plus qu'en {FIRST}.",
        "2022 et 2023, après dix ans de prix immobiles.",
        f"Retirée l'inflation, le billet n'a pris que {pc(real)}.",
    )
    fp = pg.locator("#flightplan li")
    check("flight plan: four steps and the answer", fp.count() == 5, str(fp.count()))
    has(
        "flight plan names the steps",
        txt("#flightplan"),
        "Combien coûte un billet, comparé à 2012 ?",
        "Et le train ?",
        "La réponse",
    )

    has(
        "step 1",
        txt("#depuis-2012"),
        "plus de 300 000 tarifs",
        "Dix ans de prix immobiles, puis un bond",
        f"De {FIRST} à 2021, l'indice des billets ne bouge presque pas : {signed(flat)}.",
        f"l'ensemble des prix monte de {pc(flat_infl)}",
        f"De 2021 à 2023, le prix des billets bondit de {pc(jump)}.",
        f"{signed(since)} de 2023 à {LAST}.",
        f"de {FIRST} à {LAST}, le billet prend {pc(total)} et l'ensemble des prix {pc(inflation)}.",
        f"L'écart, une fois l'inflation retirée, est de {pc(real)}.",
    )
    ends = norm(" ".join(pg.locator("#chart-prix .c-end-v").all_text_contents()))
    check(
        "figure 1 ends on the two indices",
        fr(dg(LAST) / dg(FIRST) * 100) in ends and fr(hi(LAST) / hi(FIRST) * 100) in ends,
        ends,
    )

    has(
        "step 2",
        txt("#saison"),
        f"Partir en {MONTHS[pk]} coûte un tiers de plus qu'en {MONTHS[lo]}",
        f"En {LAST}, les voyages de {MONTHS[pk]} coûtent {pc(dev[pk])} de plus",
        f"ceux de {MONTHS[lo]} {pc(dev[lo])} de moins.",
        f"l'écart atteint {pc(peak_low)}",
    )
    bars = pg.locator("#chart-saison .c-bar")
    check("figure 2: twelve months", bars.count() == 12, str(bars.count()))
    labels = norm(" ".join(pg.locator("#chart-saison .c-val").all_text_contents()))
    check("figure 2 labels the peak and the low", f"+{pc(dev[pk])}" in labels and f"−{pc(dev[lo])}" in labels, labels)

    has(
        "step 3",
        txt("#vols"),
        f"l'ensemble prend {pc(all2019)}",
        f"coûte {pc(seg[0][1])} de plus qu'en 2019",
        f"Pour un long-courrier, la hausse est de {pc(dict(seg)['Long-courrier'])}.",
    )
    rows = [norm(t) for t in pg.locator("#chart-vols .c-hbars li").all_inner_texts()]
    check(
        "figure 3: one bar per kind of flight, in order",
        [r.split(" ")[0] for r in rows] == [l.split(" ")[0] for l, _ in seg],
        str(rows),
    )
    for (label, v), r in zip(seg, rows, strict=False):
        check(f"figure 3: {label}", r.endswith(f"+{pc(v)}"), r)

    has(
        "step 4",
        txt("#train"),
        "L'avion a monté plus de deux fois plus vite que le train",
        f"les billets d'avion prennent {pc(air)} dans l'indice des prix, ceux du train {pc(rail)}.",
        f"L'ensemble des prix, lui, monte de {pc(allp)}",
    )

    reponse = [
        f"Oui, le billet d'avion est plus cher qu'avant 2022 : {pc(jump)} de plus en deux ans",
        f"il ne dépasse l'inflation que de {pc(real)}.",
        f"C'est en partant en {MONTHS[pk]}, sur un vol intérieur",
    ]
    if ytd is not None:
        reponse.append(
            f"De janvier à {MONTHS[n - 1]}, les billets coûtent {pc(ytd)} de plus qu'aux mêmes mois de {ly - 1}."
        )
    has("the answer", txt("#en-bref"), *reponse)

    # every figure names its source; the chapters list them; the method box and the glossary work
    for fig in pg.locator("main figure.panel").all():
        check(f"figure source: {norm(fig.locator('h3').inner_text())[:40]}", fig.locator(".source-line a").count() >= 1)
    check(
        "chapters list their data",
        pg.locator(".chapter-sources").count() == 4,
        str(pg.locator(".chapter-sources").count()),
    )
    check("method in four steps", pg.locator("#comment .how-steps li").count() == 4)
    gl = pg.locator("main button.gloss")
    check("glossary: at least three terms", gl.count() >= 3, str(gl.count()))
    gl.first.click()
    check("glossary: a term opens its definition", pg.locator("#gloss-pop").is_visible())
    pg.keyboard.press("Escape")
    check("glossary: Escape closes it", not pg.locator("#gloss-pop").is_visible())
    links = [a.get_attribute("href") for a in pg.locator("#sources-body a").all()]
    for need in ("data.gouv.fr/datasets/indices-des-prix", "prc_hicp_minr", "IPTAP%20166", "copyright-notice"):
        check(f"sources link {need}", any(need in (h or "") for h in links))
    check("no console error", not errors, str(errors[:3]))

    mob = b.new_page(viewport={"width": 375, "height": 800})
    mob.goto(f"{base}/prix-des-billets", wait_until="networkidle")
    mob.wait_for_timeout(600)
    over = mob.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("phone: no sideways scroll", over <= 0, str(over))
    narrow = mob.evaluate(
        "Math.min(...[...document.querySelectorAll('#flightplan a')].map(a => a.getBoundingClientRect().width))"
    )
    check("phone: flight plan steps read on one line width", narrow > 200, str(narrow))
    b.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nall checks pass")
sys.exit(1 if failures else 0)
