# ruff: noqa: E501  (the expected sentences are long)
"""« Le ciel des jets privés » (jets-prives), end to end: every number of its text recomputed in Python from
web/public/data/jets/jets.json, independently of src/jets/facts.js, then read on the page; the figures'
rows, the home page's lead, the sources, and the absence of any aircraft identifier in the published
file. Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_jets.py [--base http://127.0.0.1:4173]

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
RAW_TEXT = (ROOT / "public" / "data" / "jets" / "jets.json").read_text()
J = json.loads(RAW_TEXT)
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
km = lambda v: f"{fr(Decimal(str(v / 10)).quantize(Decimal(1), rounding=ROUND_HALF_UP) * 10)} km"  # noqa: E731
lst = lambda xs: xs[0] if len(xs) < 2 else f"{', '.join(xs[:-1])} et {xs[-1]}"  # noqa: E731
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
DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
month_label = lambda m: f"{MONTHS[int(m[5:]) - 1]} {m[:4]}"  # noqa: E731

# ------------------------------------------------------------------ the facts, again
M = J["months"]
first, last = J["compare"][0], J["compare"][-1]
yi = lambda y: [i for i, m in enumerate(M) if m.startswith(str(y))]  # noqa: E731
P = J["fleet"]
share = [j / (j + a) for j, a in zip(P["jets"], P["liners"])]
year_share = lambda y: sum(P["jets"][i] for i in yi(y)) / sum(P["jets"][i] + P["liners"][i] for i in yi(y))  # noqa: E731
s0 = year_share(first)
# the panel's figures stop at the end of 2020 (later levels do not compare with 2019): the peak is in them
to = M.index("2020-12") + 1
peak_i = max(range(to), key=lambda i: (share[i], -i))
index = lambda a: [None if i < 12 else a[i] / a[i % 12] * 100 for i in range(len(a))]  # noqa: E731
ij, il = index(P["jets"]), index(P["liners"])
feb, april, july = M.index("2020-02"), M.index("2020-04"), M.index("2020-07")
WORDS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"]


def half_up(v):
    return int(Decimal(str(v)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def times(r):
    n = half_up(r)
    if 2 <= n <= 10 and abs(r - n) < 0.15:
        q = "près de " if r < n - 0.03 else "plus de " if r > n + 0.03 else ""
        return f"{q}{WORDS[n]} fois"
    return f"{fr(r, 1)} fois"


def on_ten(v, noun="vols"):
    n = half_up(v * 10)
    q = "près de " if v < n / 10 - 0.005 else "plus de " if v > n / 10 + 0.005 else ""
    return f"{q}{WORDS[n]} {noun} sur dix"


Yj, Yl = J["jets"]["year"][str(last)], J["liners"]["year"][str(last)]
Yj0 = J["jets"]["year"][str(first)]
short_j, short_l = Yj["shortEu"] / Yj["placed"], Yl["shortEu"] / Yl["placed"]
short_fr = Yj["shortFr"] / Yj["placedFr"]


def classes(h):
    n = sum(h)
    lims = [0, 250, 500, 1000, 2000, 4000, math.inf]
    return [sum(v for i, v in enumerate(h) if lo <= i * J["kmBin"] < hi) / n for lo, hi in zip(lims, lims[1:])]


label = lambda a: J["airports"][a]["label"]  # noqa: E731


def ordered(a, b):
    if a == "LFPB" or (a.startswith("LF") and b != "LFPB" and not b.startswith("LF")):
        return a, b
    return b, a


routes = [(*ordered(a, b), n, k) for a, b, n, k in J["routesFr"][str(last)][:10]]
LONDON = {"EGLF", "EGGW", "EGKB", "EGLC", "EGSS", "EGWU", "EGLL", "EGKK"}


def corr(a, b):
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return num / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


def profile(ident):
    a = J["airports"][ident]
    if "jets" not in a:
        return None
    ys = [a["jets"][M.index(f"{y}-01") : M.index(f"{y}-01") + 12] for y in J["compare"]]
    if any(sum(m) < 300 for m in ys):
        return None
    profs = [[v / (sum(m) / 12) for v in m] for m in ys]
    if not corr(profs[0], profs[-1]) >= 0.7:
        return None
    prof = [sum(p[k] for p in profs) / len(profs) for k in range(12)]
    pk = max(range(12), key=lambda k: (prof[k], -k))
    return {
        "ident": ident,
        "label": a["label"],
        "prof": prof,
        "peak": pk,
        "weight": prof[pk],
        "movements": sum(a["jets"]),
    }


pool = sorted(filter(None, (profile(a) for a in J["airports"])), key=lambda s: (-s["movements"], s["ident"]))
big = pool[:12]
extra = sorted(pool[12:], key=lambda s: -s["weight"])[:10]
seasons = sorted(big + extra, key=lambda s: (s["peak"], -s["weight"]))
most = max(seasons, key=lambda s: s["weight"])
strong = [s for s in seasons if s["weight"] >= 1.9]
winter = [s for s in strong if s["peak"] <= 2 or s["peak"] == 11]
summer = [s for s in strong if 5 <= s["peak"] <= 7]
steady = [s for s in big if s["weight"] < 1.9]
steady_max = math.ceil(max(s["weight"] for s in steady[:2]) * 10) / 10
week = lambda w: [v / (sum(w) / 7) for v in w]  # noqa: E731
wj, wl = week(Yj["weekday"]), week(Yl["weekday"])
busy = max(range(7), key=lambda k: wj[k])
quiet = min(range(7), key=lambda k: wj[k])
cs = lambda c: {k: v / sum(c.values()) for k, v in c.items()}  # noqa: E731
cs1 = cs(Yj["callsign"])
csL, csM = cs(J["callsignWtc"][str(last)]["L"]), cs(J["callsignWtc"][str(last)]["M"])
models = J["jets"]["models"][str(last)]
wtc = J["callsignWtc"][str(last)]
light = sum(wtc["L"].values()) / (sum(wtc["L"].values()) + sum(wtc["M"].values()))
one_in = lambda v: round(1 / v)  # noqa: E731

# ------------------------------------------------------------------ the published file
hexes = re.findall(r'"([0-9a-fA-F]{6})"', RAW_TEXT)
check("jets.json carries no transponder address", not hexes, str(hexes[:3]))


def strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for k, v in x.items():
            yield k
            yield from strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v)


# a registration (F-HABC, N123AB) or a flight callsign (VJT123, NJE3A): none may leave data/raw/
IDENT = re.compile(r"^([A-Z0-9]{1,2}-[A-Z0-9]{3,5}|N\d{1,5}[A-Z]{0,2}|[A-Z]{3}\d{1,4}[A-Z]{0,2})$")
leaks = sorted({v for v in strings(J) if IDENT.match(v) and v not in J["types"]})  # type codes (GLF4) are not identifiers
check("jets.json carries no registration or callsign", not leaks, str(leaks[:5]))
check("jets.json carries no transponder key", not re.search(r'"icao24"\s*:', RAW_TEXT))
check("jets.json ranks no airport", not {"topEu", "topFr", "panel"} & set(J), str(set(J)))
check(
    "the fleet panel holds aircraft",
    P["jetsAircraft"] > 500 and P["linersAircraft"] > 5000,
    f"{P['jetsAircraft']} / {P['linersAircraft']}",
)

# ------------------------------------------------------------------ the page
with sync_playwright() as p:
    b = (
        p.chromium.launch(executable_path="/usr/bin/google-chrome")
        if Path("/usr/bin/google-chrome").exists()
        else p.chromium.launch()
    )
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(f"{base}/jets-prives", wait_until="networkidle")
    pg.wait_for_selector("#chart-days .jp-days", timeout=20000)
    text = lambda sel: norm(pg.locator(sel).inner_text())  # noqa: E731
    check("no script error", not errors, str(errors[:2]))

    has("opening", text("#jp-open-big"), f"{fr(round(s0 * 100))} sur 100", f"{fr(round(share[peak_i] * 100))} sur 100")
    check("opening shows 2019 and the peak", pg.locator("#jp-open-big .jp-dots").count() == 2)
    has(
        "standfirst",
        text("#open-dek"),
        "Parmi les vols que le réseau OpenSky suivait",
        f"un sur {one_in(s0)} était celui",
        f"un sur {one_in(share[peak_i])}",
        month_label(M[peak_i]),
        f"À {winter[0]['label']}, ils viennent surtout l'hiver ; à {summer[0]['label']}, l'été ;",
        f"moins le {DAYS[quiet]}",
    )
    has(
        "essentials",
        text("#essentiel-list"),
        pc(s0, 1),
        f"Un vol sur {one_in(s0)}",
        pc(share[peak_i]),
        f"{fr(ij[april])} % des vols des jets d'affaires d'avril {first}",
        f"Les avions de ligne, {fr(il[april])} %",
        f"remontent à {fr(ij[july])} %",
        pc(short_j),
        pc(short_l),
        f"{fr(most['weight'], 1)} fois",
        f"{fr(Yj['medianDays'])} jours",
        f"{fr(Yl['medianDays'])} jours",
    )
    # chapter 1
    has("chapter 1 title", text("#h-part-du-ciel"), f"Un vol sur {one_in(s0)} avant le Covid, un sur {one_in(share[peak_i])} au printemps 2020")
    ch1 = text("#part-du-ciel")
    has("chapter 1", ch1, pc(s0, 1), pc(share[peak_i]), f"un vol sur {one_in(share[peak_i])}", fr(P["jetsAircraft"]), fr(P["linersAircraft"]))
    check("chapter 1 draws one line", pg.locator("#chart-share svg .c-line").count() == 1)
    n_rows = pg.locator("figure:has(#chart-share) details tbody tr").count()
    check("chapter 1 stops at the end of 2020", n_rows == to, f"{n_rows} months")
    # chapter 2
    ch2 = text("#covid")
    has(
        "chapter 2",
        ch2,
        f"{fr(il[april])} % de leurs vols d'avril {first}",
        f"en font encore {fr(ij[april])} %",
        f"les jets d'affaires à {fr(ij[july])}, les avions de ligne à {fr(il[july])}",
        f"déjà à l'indice {fr(ij[feb])}, contre {fr(il[feb])}",
        f"leur indice est {times(ij[april] / il[april])} celui des avions de ligne, contre {fr(ij[feb] / il[feb], 1)} fois en février",
    )
    n_rows = pg.locator("figure:has(#chart-index) details tbody tr").count()
    check("chapter 2 draws 2020 only", n_rows == 12, f"{n_rows} months")
    # no level of the later years is compared with 2019 in the panel's chapters (CLAUDE.md, n° 9)
    check("chapters 1-2 say nothing of 2021-2022", not re.search(r"(?<!2019-)202[12]", ch1 + ch2), re.findall(r".{30}(?<!2019-)202[12].{10}", ch1 + ch2)[:2])
    # chapter 3
    cj, cl = classes(Yj["kmEu"]), classes(Yl["kmEu"])
    ch3 = text("#distances")
    has("chapter 3", ch3, km(Yj["medianKm"]), km(Yl["medianKm"]), pc(short_j), pc(short_l), pc(short_fr))
    rows = pg.locator("#chart-km .jp-pairs li")
    check("chapter 3 draws six distance classes", rows.count() == 6, str(rows.count()))
    got = [norm(rows.nth(k).locator(".jp-bar.jets b").inner_text()) for k in range(rows.count())]
    check("chapter 3 classes are the data's", got == [pc(v) for v in cj], f"{got} vs {[pc(v) for v in cj]}")
    got = [norm(rows.nth(k).locator(".jp-bar.liners b").inner_text()) for k in range(rows.count())]
    check("chapter 3 airliner classes are the data's", got == [pc(v) for v in cl], str(got))
    # chapter 4
    ch4 = text("#routes")
    a, b0, n, k = routes[0]
    has(
        "chapter 4",
        ch4,
        f"{label(a)} – {label(b0)}",
        f"{fr(n)} vols en {last}",
        f"{sum(1 for r in routes if r[3] < J['shortKm'])} sur dix",
    )
    has(
        "chapter 4, Paris and London",
        ch4,
        f"{sum(1 for r in routes if 'LFPB' in r[:2])} routes",
        f"Londres en compte {sum(1 for r in routes if LONDON & set(r[:2]))}",
    )
    got = [norm(t) for t in pg.eval_on_selector_all("#chart-routes .c-hb-val", "bs => bs.map(b => b.textContent)")]
    check("chapter 4 routes are the data's", got == [f"{fr(r[2])} vols" for r in routes], str(got[:3]))
    # chapter 5
    ch5 = text("#saisons")
    has(
        "chapter 5",
        ch5,
        f"À {most['label']}, {MONTHS[most['peak']]} pèse {fr(most['weight'], 1)} fois un mois moyen",
        f"{fr(len(pool))} aéroports d'Europe passent ces deux tests ; la figure en montre {len(seasons)}",
        f"L'hiver, {lst([s['label'] for s in winter])} ont leur mois le plus chargé",
        f"À {steady[0]['label']} et à {steady[1]['label']}, le mois le plus chargé ne dépasse pas {fr(steady_max, 1)} fois",
    )
    got = [norm(t) for t in pg.eval_on_selector_all("#chart-season tbody th", "ts => ts.map(t => t.textContent)")]
    check(
        "chapter 5 airports are the data's",
        got == [s["label"] for s in seasons],
        f"{got[:4]} vs {[s['label'] for s in seasons][:4]}",
    )
    peaks = pg.eval_on_selector_all(
        "#chart-season tbody tr",
        "rs => rs.map(r => [...r.querySelectorAll('td')].findIndex(td => td.classList.contains('peak')))",
    )
    check("chapter 5 peaks are the data's", peaks == [s["peak"] for s in seasons], str(peaks[:5]))
    # chapter 6
    ch6 = text("#semaine")
    has(
        "chapter 6",
        ch6,
        f"Le {DAYS[quiet]}, le jour creux",
        f"Le {DAYS[quiet]}, {pc(1 - wj[quiet])} de vols de moins",
        f"Le {DAYS[busy]} est le jour le plus chargé",
        fr(wj[busy] * 100),
        f"le {DAYS[quiet]}",
        fr(wj[quiet] * 100),
        fr(min(wl) * 100),
        fr(max(wl) * 100),
    )
    # chapter 7
    ch7 = text("#exploitants")
    has("chapter 7", ch7, pc(csL["registration"]), pc(csM["registration"]), pc(light))
    top = models[0][0]
    has("chapter 7, the first model", ch7, f"{J['types'][top]['maker']} {J['types'][top]['name']}")
    # chapter 8
    ch8 = text("#usage")
    has(
        "chapter 8",
        ch8,
        f"un jour sur {fr(365 / Yj['medianDays'])}",
        f"{fr(Yj['medianDays'])} jours de vol par an, contre {fr(Yl['medianDays'])}",
        f"{fr(Yj['flightsPerDay'], 1)} {'vol' if Yj['flightsPerDay'] < 2 else 'vols'}, contre {fr(Yl['flightsPerDay'], 1)}",
        f"{fr(Yj['daysQ'][0])} et {fr(Yj['daysQ'][1])} jours",
    )
    lit = pg.eval_on_selector_all("#chart-days .jp-yr", "ys => ys.map(y => y.querySelectorAll('i.on').length)")
    check("chapter 8 lights the median days", lit == [round(Yj["medianDays"]), round(Yl["medianDays"])], str(lit))
    # the answer, the method, the sources
    has(
        "answer",
        text("#reponse-prose"),
        pc(s0, 1),
        f"Leur part est alors {times(share[peak_i] / share[peak_i % 12])} celle de {MONTHS[peak_i % 12]} {first}",
        pc(short_j),
        f"l'hiver à {winter[0]['label']}, l'été à {summer[0]['label']}",
        f"n'est pas vu en vol {fr(365 - Yj['medianDays'])} jours",
        f"{on_ten(cs1['operator']).capitalize()} se font sous le code d'un exploitant",
    )
    no_lecture = pg.eval_on_selector_all(
        "main figure.panel", "fs => fs.filter(f => !f.querySelector('.lecture')).map(f => f.querySelector('h3')?.id)"
    )
    check("every figure has its Lecture line", not no_lecture, str(no_lecture))
    has(
        "sources",
        text("#sources-body"),
        *(f"{fr(J['flightsSeen'][str(y)])} vols en {y}" for y in J["years"]),
        pc(Yj["coverage"]["both"] / Yj["coverage"]["seen"]),
    )
    check(
        "the glossary explains its words",
        pg.locator("#how-words dt, #how-words li, #how-words .gloss-item").count() >= 5,
        str(pg.locator("#how-words *").count()),
    )
    check("no euro, no tonne of CO2 in the text", "€" not in text("main") and "CO2 émis" not in text("main"))

    # the phone
    mp = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mp.goto(f"{base}/jets-prives", wait_until="networkidle")
    mp.wait_for_selector("#chart-days .jp-days", timeout=20000)
    over = mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("phone: nothing wider than the screen", over <= 1, f"{over}px")
    b.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nall checks passed")
sys.exit(1 if failures else 0)
