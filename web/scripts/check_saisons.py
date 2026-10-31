# ruff: noqa: E501  (the expected sentences are long)
"""The seasons story (calendrier-du-ciel), end to end: every number of its text recomputed in Python from
web/public/data/eu/eu.json and compared with the page, the calendar's interactions (pick, year, order,
keyboard), the map, the sources and the phone layout. Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_saisons.py [--base http://127.0.0.1:4173]

Exit 1 on any failure.
"""

import calendar
import json
import re
import sys
import unicodedata
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
D = json.loads((ROOT / "public" / "data" / "eu" / "eu.json").read_text())
Y, AY, LAST = D["years"], D["airportYears"], D["meta"]["last"]
Z = {z["code"]: z for z in D["zones"]}
C = [z for z in D["zones"] if z["code"] != "EU27_2020"]
failures = []


def check(where, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + where + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(where)


def has(where, text, *needles):
    missing = [n for n in needles if norm(n) not in text]
    check(where, not missing, f"missing {missing}" if missing else "")


def fr(v, d=0):
    q = Decimal(str(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{abs(q):,.{d}f}".replace(",", " ").replace(".", ",")


norm = lambda s: re.sub(r"[\s  ]+", " ", s)  # noqa: E731
up = lambda v, d=0: f"{fr(v, d)} %"  # noqa: E731
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
mname = lambda m: MONTHS[m - 1]  # noqa: E731
de = lambda w: f"d'{w}" if w[0] in "aeiouyéèêàâîôûh" else f"de {w}"  # noqa: E731


def months(z):
    out, (y, m) = [], map(int, z["monthStart"].split("-"))
    while f"{y}-{m:02d}" <= z["monthLast"]:
        out.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


# ---------------------------------------------------------------- the facts, again
def season(z, y, kind="total"):
    """Passengers per day of each month of a complete year, against the year's daily mean."""
    ser = dict(zip(months(z), z["monthly"][kind], strict=True))
    vals = [ser.get(f"{y}-{m:02d}") for m in range(1, 13)]
    if any(v is None or v <= 0 for v in vals):
        return None
    days = [calendar.monthrange(y, m)[1] for m in range(1, 13)]
    pd = [v / d for v, d in zip(vals, days, strict=True)]
    pk, lo = pd.index(max(pd)), pd.index(min(pd))
    return {"peak": pk + 1, "low": lo + 1, "gap": pd[pk] / pd[lo], "pd": pd}


SY = [y for y in Y if y not in (2020, 2021, 2022) and all(season(z, y) for z in D["zones"])]
sea = lambda code, y, kind="total": season(Z[code], y, kind)  # noqa: E731
hr, ue, fi, gr = (sea(c, LAST) for c in ("HR", "EU27_2020", "FI", "EL"))
sea_last = {z["code"]: sea(z["code"], LAST) for z in C}
gap_from = {z["code"]: sea(z["code"], SY[0])["gap"] for z in C}
gap_to = {z["code"]: sea(z["code"], LAST)["gap"] for z in C}
narrower = [c for c in gap_from if gap_to[c] < gap_from[c]]
eu_gaps = [sea("EU27_2020", y)["gap"] for y in SY]
fi_dec = LAST
while fi_dec - 1 in SY and sea("FI", fi_dec - 1)["peak"] == 12:
    fi_dec -= 1
eser = dict(zip(months(Z["EU27_2020"]), Z["EU27_2020"]["monthly"]["total"], strict=True))
jan22 = 100 * (1 - eser["2022-01"] / eser["2019-01"])
iL = Y.index(LAST)
kinds = sorted(
    (
        {
            "code": z["code"],
            "name": z["name"],
            "nat": sea(z["code"], LAST, "nat"),
            "intl": sea(z["code"], LAST, "intl"),
        }
        for z in D["zones"]
        if z["nat"][iL] / z["total"][iL] >= 0.05
    ),
    key=lambda r: -r["intl"]["gap"],
)
kinds = [r for r in kinds if r["nat"] and r["intl"]]
kd = {r["code"]: r for r in kinds}
odd = [r["code"] for r in kinds if r["code"] != "EU27_2020" and r["nat"]["gap"] >= r["intl"]["gap"]]
july_low = [r["code"] for r in kinds if r["code"] != "EU27_2020" and r["nat"]["low"] == 7]


def dw(r, d=1):
    return f"un jour {de(mname(r['peak']))} compte {fr(r['gap'], d)} fois plus de passagers qu'un jour {de(mname(r['low']))}"


def plain(name):
    """A name as the French alphabet sorts it: accents ignored."""
    return "".join(c for c in unicodedata.normalize("NFD", name.lower()) if not unicodedata.combining(c))


def latitude(code, y):
    i = AY.index(y)
    pts = [(a["pax"][i], a["lat"]) for a in D["airports"] if a["country"] == code and a["box"] and a["pax"][i]]
    return sum(p * la for p, la in pts) / sum(p for p, _ in pts)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(base + "/calendrier-du-ciel", wait_until="networkidle")
    pg.wait_for_timeout(2000)
    text = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    rows = len(C)
    n_aug = sum(r["peak"] == 8 for r in sea_last.values())
    n_jul = sum(r["peak"] == 7 for r in sea_last.values())
    has(
        "standfirst",
        text("#open-dek"),
        f"en Croatie, {dw(hr)}. En Finlande, à peine {fr(fi['gap'], 1)} fois plus",
    )
    has(
        "essentials",
        text("#essentiel"),
        f"Août, dans {n_aug} pays sur {rows} ; juillet dans {n_jul}. Par jour, janvier est partout le plus creux",
        f"×{fr(hr['gap'], 1)}",
        f"En Croatie : {dw(hr)}. Dans l'Union, {fr(ue['gap'], 1)} fois",
        f"×{fr(kd['EU27_2020']['nat']['gap'], 1)}",
        f"dans l'Union, leur écart saisonnier est de {fr(kd['EU27_2020']['nat']['gap'], 1)}, contre {fr(kd['EU27_2020']['intl']['gap'], 1)} pour les vols internationaux",
        f"Elle s'atténue dans {len(narrower)} pays sur {rows} depuis {SY[0]}",
    )
    check("the busiest month of the year is August for most", n_aug > rows / 2)
    check(
        "Bulgaria narrows clearly, Croatia and Greece widen",
        gap_to["BG"] / gap_from["BG"] < 0.6 and all(gap_to[c] > gap_from[c] for c in ("HR", "EL")),
    )
    check("national flights smooth the Union's year", kd["EU27_2020"]["nat"]["gap"] < kd["EU27_2020"]["intl"]["gap"])
    # the calendar
    n_rows = pg.locator("#cal-chart g.cal-row").count()
    check("calendar: the Union and every country", n_rows == len(D["zones"]), str(n_rows))
    check(
        "calendar: twelve cells a row", pg.locator("#cal-chart g.cal-row").first.locator("rect.cal-cell").count() == 12
    )
    has("calendar: the Union by default", text("#cal-readout"), f"Union européenne, {LAST} : {dw(ue)}")
    order_y = lambda: pg.eval_on_selector_all(  # noqa: E731
        "#cal-chart g.cal-row:not(.eu)",
        "gs => gs.map(g => [g.querySelector('.cal-name').textContent, +g.getAttribute('transform').match(/,([\\d.]+)/)[1]]).sort((a, b) => a[1] - b[1]).map(x => x[0])",
    )
    by_gap = [z["name"] for z in sorted(C, key=lambda z: -sea_last[z["code"]]["gap"])]
    check("calendar: rows by seasonal gap", order_y() == by_gap, str(order_y()[:3]))
    pg.hover("#cal-chart g.cal-row:not(.eu) .cal-name >> text='Croatie'")
    pg.wait_for_timeout(200)
    has(
        "calendar: a country picked",
        text("#cal-readout"),
        f"Croatie, {LAST} : {dw(hr)}, contre {fr(ue['gap'], 1)} dans l'Union",
    )
    check("calendar: a country already drawn is not drawn twice", pg.locator("#chart-pf .pf-line.extra").count() == 0)
    pg.hover("#cal-chart g.cal-row:not(.eu) .cal-name >> text='Pologne'")
    pg.wait_for_timeout(200)
    check("calendar: the profiles add the picked country", pg.locator("#chart-pf .pf-line.extra").count() == 1)
    pg.mouse.move(5, 5)
    pg.evaluate(
        "() => { const i = document.querySelector('#cal-controls input[type=range]'); i.value = 0; i.dispatchEvent(new Event('input', { bubbles: true })); }"
    )
    pg.wait_for_timeout(900)
    u0 = sea("EU27_2020", SY[0])
    has("calendar: another year", text("#cal-readout"), f"Union européenne, {SY[0]} : {dw(u0)}")
    by_gap0 = [z["name"] for z in sorted(C, key=lambda z: -sea(z["code"], SY[0])["gap"])]
    check("calendar: rows by gap that year", order_y() == by_gap0, str(order_y()[:3]))
    pg.click("#cal-controls button:has-text('Du nord au sud')")
    pg.wait_for_timeout(900)
    by_lat = [z["name"] for z in sorted(C, key=lambda z: -latitude(z["code"], SY[0]))]
    check("calendar: rows from north to south", order_y() == by_lat, str(order_y()[:3]))
    pg.click("#cal-controls button:has-text('Par nom')")
    pg.wait_for_timeout(900)
    check("calendar: rows by name", order_y() == sorted(order_y(), key=plain), str(order_y()[:3]))
    pg.focus("#cal-chart")
    pg.mouse.move(2, 2)
    pg.keyboard.press("Escape")
    pg.keyboard.press("ArrowDown")
    pg.wait_for_timeout(200)
    check(
        "calendar: the keyboard picks the first row",
        text("#cal-readout").startswith(f"{order_y()[0]}, {SY[0]}"),
        text("#cal-readout")[:40],
    )
    pg.keyboard.press("Escape")
    pg.evaluate(
        "() => { const i = document.querySelector('#cal-controls input[type=range]'); i.value = i.max; i.dispatchEvent(new Event('input', { bubbles: true })); }"
    )
    pg.click("#cal-controls button:has-text('Les plus saisonniers')")
    pg.wait_for_timeout(700)
    check("calendar: back to the last year", order_y() == by_gap)
    check("the years shown", SY == [*range(2010, 2020), *range(2023, LAST + 1)], str(SY))

    # chapter 1: the profiles
    has(
        "profiles",
        text("#profils"),
        f"En Croatie, {dw(hr, 0)}",
        f"Dans l'Union, un jour d'août compte {fr(ue['gap'], 1)} fois plus de passagers qu'un jour de janvier. Mais chaque pays a son calendrier : en Finlande, le mois le plus chargé ne compte que {fr(fi['gap'], 1)} fois plus de passagers par jour que le plus creux",
        "La Croatie et la Grèce, les plus saisonnières",
        f"En {LAST}, janvier est, par jour, le mois le plus creux dans les {rows} pays. Le pic tombe en août dans {n_aug} pays, en juillet dans {n_jul}",
        f"La Grèce suit la Croatie, avec un écart de {fr(gr['gap'], 1)}",
        f"Jusqu'en 2019, le mois le plus chargé de la Finlande, par jour, était juin. Depuis {fi_dec}, c'est décembre",
        f"en janvier 2022 encore, l'Union comptait {up(jan22)} de passagers de moins qu'en janvier 2019",
    )
    tops = lambda y: {c for c, _ in sorted(((z["code"], sea(z["code"], y)["gap"]) for z in C), key=lambda t: -t[1])[:2]}  # noqa: E731
    check("Croatia and Greece top every year shown", all(tops(y) == {"HR", "EL"} for y in SY))
    check("Greece second", sorted(sea_last, key=lambda c: -sea_last[c]["gap"])[1] == "EL")
    check("January the quietest month everywhere", all(r["low"] == 1 for r in sea_last.values()))
    fin = {y: s_["peak"] for y in Y if (s_ := sea("FI", y))}
    check(
        "Finland: June every year to 2019, not December in 2022",
        all(fin[y] == 6 for y in fin if y <= 2019) and fin[2022] != 12 and fin[LAST] == 12,
    )
    check("four profiles drawn", pg.locator("#chart-pf .pf-line").count() == 4)

    # chapter 2: the map
    g = lambda c: sea_last[c]["gap"]  # noqa: E731
    bottom = sorted(sea_last, key=g)[:2]
    has(
        "map",
        text("#carte"),
        "La saison ne suit pas la latitude",
        f"La Slovaquie, avec un écart de {fr(g('SK'), 1)}, l'est davantage que Chypre, à {fr(g('CY'), 1)}",
        f"En {LAST}, l'Espagne varie moins que l'Allemagne, la Slovaquie plus que Chypre ou Malte",
        "La Finlande et les Pays-Bas sont les moins saisonniers",
    )
    check("Spain below Germany, Slovakia above Cyprus and Malta", g("ES") < g("DE") and g("SK") > max(g("CY"), g("MT")))
    check("Finland and the Netherlands the least seasonal", bottom == ["FI", "NL"], str(bottom))
    coloured = pg.evaluate("() => [...document.querySelectorAll('#chart-gm path.gm-cty.in')].length")
    check("map: every country coloured", coloured >= len(C) - 2, str(coloured))

    # chapter 3: national flights
    names_fr = {"PT": "au Portugal", "FI": "en Finlande", "SE": "en Suède"}
    has(
        "national flights",
        text("#interieurs"),
        "Les vols intérieurs lissent l'année, sauf " + " et ".join(names_fr[c] for c in odd),
        f"Dans l'Union, l'écart saisonnier des vols intérieurs est de {fr(kd['EU27_2020']['nat']['gap'], 1)}, celui des vols internationaux de {fr(kd['EU27_2020']['intl']['gap'], 1)}",
        f"En Grèce, l'écart est de {fr(kd['EL']['nat']['gap'], 1)} pour les vols intérieurs et de {fr(kd['EL']['intl']['gap'], 1)} pour les vols internationaux",
        "En "
        + " et en ".join({"SE": "Suède", "FI": "Finlande"}[c] for c in july_low)
        + ", juillet est même le mois le plus creux des vols intérieurs",
        "Le Portugal et la Finlande font exception : leurs vols intérieurs varient davantage que leurs vols internationaux",
    )
    check("the exceptions are Portugal and Finland", odd == ["PT", "FI"] or sorted(odd) == ["FI", "PT"], str(odd))
    check("July lowest for national flights in Sweden and Finland", sorted(july_low) == ["FI", "SE"], str(july_low))
    check("one row per country with 5 % national flights", pg.locator("#chart-kd g.kd").count() == len(kinds))

    # chapter 4: the gap over time
    bg_x = lambda m: sea("BG", LAST)["pd"][m - 1] / sea("BG", SY[0])["pd"][m - 1]  # noqa: E731
    has(
        "the gap over time",
        text("#evolution"),
        f"La Bulgarie a presque divisé par deux son écart saisonnier depuis {SY[0]}",
        f"Dans l'Union, l'écart saisonnier oscille entre {fr(min(eu_gaps), 1)} et {fr(max(eu_gaps), 1)} depuis {SY[0]}. Il s'est resserré dans {len(narrower)} pays sur {rows}",
        "L'écart se resserre en Bulgarie, il se creuse en Croatie et en Grèce",
        f"En Bulgarie, il est passé de {fr(gap_from['BG'], 1)} en {SY[0]} à {fr(gap_to['BG'], 1)} en {LAST}. En Islande, de {fr(gap_from['IS'], 1)} à {fr(gap_to['IS'], 1)}",
        f"En Bulgarie, un jour de janvier compte {fr(bg_x(1), 1)} fois plus de passagers qu'en {SY[0]}, un jour d'août {fr(bg_x(8), 1)} fois : l'hiver s'est rempli plus vite que l'été",
        f"À l'inverse, l'écart s'est creusé en Croatie, de {fr(gap_from['HR'], 1)} à {fr(gap_to['HR'], 1)}. En Grèce, de {fr(gap_from['EL'], 1)} à {fr(gap_to['EL'], 1)}",
        "Jusqu'en 2019, l'Espagne était plus saisonnière que l'Allemagne. Depuis 2023, c'est l'inverse",
    )
    check("Bulgaria: nearly halved", 0.5 < gap_to["BG"] / gap_from["BG"] < 0.6)
    check("Iceland narrower", gap_to["IS"] < gap_from["IS"])
    check("Bulgaria: January grew faster than August", bg_x(1) > bg_x(8))
    check(
        "Spain and Germany swap",
        all(sea("ES", y)["gap"] > sea("DE", y)["gap"] for y in SY if y <= 2019)
        and all(sea("ES", y)["gap"] < sea("DE", y)["gap"] for y in SY if y >= 2023),
    )
    check("one line per zone", pg.locator("#chart-gaps g.gl").count() == len(D["zones"]))
    check("EU gap stays within 1.7-1.9", 1.65 <= min(eu_gaps) and max(eu_gaps) < 1.95)
    has(
        "the answer",
        text("#reponse-prose"),
        f"dans l'Union, {dw(ue)}",
        f"de la Croatie (×{fr(hr['gap'], 1)}) à la Finlande (×{fr(fi['gap'], 1)})",
        f"l'écart s'est resserré dans {len(narrower)} pays sur {rows} depuis {SY[0]}",
    )
    # sources, method, errors
    srcs = pg.evaluate(
        "() => [...document.querySelectorAll('main .panel')].filter(p => !p.querySelector('.source-line a[href^=\"http\"]')).length"
    )
    check("every figure names its source", srcs == 0, f"{srcs} without")
    has(
        "method",
        text("#sources"),
        "Eurostat autorise la réutilisation de ses données, source citée",
        "passagers par jour",
        f"{up(jan22)} de passagers de moins",
    )
    check("no page error", not errors, str(errors))
    m = b.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    m.goto(base + "/calendrier-du-ciel", wait_until="networkidle")
    m.wait_for_timeout(1500)
    wide = m.evaluate("() => document.documentElement.scrollWidth - innerWidth")
    check("phone: no horizontal scroll", wide <= 1, f"{wide}px")
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
