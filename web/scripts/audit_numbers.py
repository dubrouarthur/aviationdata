"""Check every number written in the story against an independent recomputation from the JSON data.

The page computes its sentences in JavaScript; this script recomputes the same figures in Python, straight
from web/public/data/*.json, and checks that the rendered text says the same thing. Exit 1 on any mismatch.

    python3 web/scripts/audit_numbers.py [--url http://127.0.0.1:4173/]
"""

import json
import re
import statistics as st
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
D = {k: json.loads((ROOT / "public" / "data" / f"{k}.json").read_text()) for k in
     ("fracture", "aeroports", "compagnies", "prix", "co2", "monde", "routes")}  # fmt: skip
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
failures = []


def fr(v, d=0):
    """French number: 1 774 / 183,0 (regular spaces; page text is normalised the same way)."""
    s = f"{v:,.{d}f}".replace(",", " ").replace(".", ",")
    return s


def pct(a, b):
    return (b / a - 1) * 100


def month_name(ym):
    return f"{MONTHS[int(ym[5:7]) - 1]} {ym[:4]}"


def check(where, text, *needles):
    missing = [n for n in needles if n not in text]
    print(("PASS " if not missing else "FAIL ") + where + (f"  missing {missing}" if missing else ""))
    if missing:
        failures.append(where)


# ---------------------------------------------------------------- expected values
F = D["fracture"]
fa, FM, FS = F["annual"], F["months"], F["faisceaux"]
Y = fa["years"]
iL, i19 = len(Y) - 1, Y.index(2019)
last = Y[-1]


def fsum(keys, y):
    return sum(sum(FS[k][j] or 0 for k in keys) for j, m in enumerate(FM) if m.startswith(str(y)))


tot_m = [sum(FS[k][j] or 0 for k in FS) for j in range(len(FM))]
nat_keys = ["MET_RAD", "MET_TRA", "MET_OM", "OM_OM"]
peak = max(range(len(FM)), key=lambda j: tot_m[j])
low = min((j for j in range(len(FM)) if FM[j] >= "2020-01"), key=lambda j: tot_m[j])

A = D["aeroports"]
AM, N, AY = A["months"], A["national"], A["years"]


def asum(arr, y):
    return sum(arr[j] or 0 for j, m in enumerate(AM) if m.startswith(str(y)))


ai = AM.index
covid = {k: pct(N[k][ai("2019-04")], N[k][ai("2020-04")]) for k in ("pax", "vols", "fret", "vols_cargo")}


def back(k, level):
    for m in AM:
        if m > "2020-05" and N[k][ai(m)] / N[k][ai("2019-" + m[5:])] * 100 >= level:
            return m


C = D["compagnies"]
car = sorted(C["carriers"], key=lambda c: -(c["pax"][-1] or 0))
rya = next(c for c in C["carriers"] if c["nom"] == "Ryanair")

P = D["prix"]
PM, PS = P["months"], P["series"]


def pmean(k, y):
    return st.mean(PS[k][j] for j, m in enumerate(PM) if m.startswith(str(y)) and PS[k][j] is not None)


L = len(PM) - 1


def yoy(k, j):
    return pct(PS[k][j - 12], PS[k][j])


cur = yoy("FRA_ENS", L)
since = next(PM[j] for j in range(L - 1, 12, -1) if PS["FRA_ENS"][j] is not None and yoy("FRA_ENS", j) >= cur)

CO = D["co2"]["decomp"]["periods"]
M = D["monde"]
MM, MC = M["months"], M["countries"]


def wsum(i):
    return sum(c["pax"][i] or 0 for c in MC) + sum(s[i] or 0 for s in M["autres"].values())


def wyear(c, y):
    return sum(c["pax"][j] or 0 for j, m in enumerate(MM) if m.startswith(str(y)))


intl_year = {y: sum(wsum(j) for j, m in enumerate(MM) if m.startswith(str(y))) for y in (1990, 2019, last)}
top3 = [c["nom"] for c in sorted(MC, key=lambda c: -wyear(c, last))[:3]]
movers = [c for c in MC if wyear(c, 2019) > 400000]
gain = sorted(movers, key=lambda c: -pct(wyear(c, 2019), wyear(c, last)))[:4]

# ---------------------------------------------------------------- read the page
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)

    def text(sel):
        return re.sub(r"[  ]", " ", page.locator(sel).inner_text())

    def tab(group, key):
        page.click(f'#{group} [data-k="{key}"]')
        page.wait_for_timeout(250)

    check(
        "hero",
        text("#hero-dek"),
        f"{fr(fa['TOTAL'][iL] / 1e6, 1)} millions",
        f"{fr(abs(pct(fa['INTL'][i19], fa['INTL'][iL])), 1)} %",
        f"{fr(abs(pct(fa['NAT'][i19], fa['NAT'][iL])), 1)} %",
    )
    tab("globe-moments", str(last))
    check("globe, last year", text("#globe-caption"), f"{fr(intl_year[last] / 1e6, 1)} millions", *top3)
    tab("globe-moments", "1990")
    check(
        "globe, 1990",
        text("#globe-caption"),
        f"{fr(intl_year[1990] / 1e6, 1)} millions",
        f"{fr(intl_year[last] / intl_year[1990], 1)} fois moins",
    )
    tab("globe-moments", "2020-04")
    check(
        "globe, April 2020",
        text("#globe-caption"),
        fr(wsum(MM.index("2020-04"))),
        f"{fr(pct(wsum(MM.index('2019-04')), wsum(MM.index('2020-04'))), 1)} %".replace("-", "−"),
    )
    tab("globe-moments", "delta")
    check("globe, gainers", text("#globe-caption"), *[c["nom"] for c in gain])
    check(
        "rings",
        text("#spirale-text"),
        month_name(FM[peak]),
        f"{fr(tot_m[peak] / 1e6, 1)} M",
        fr(tot_m[low]),
        *[f"{fr(fsum(nat_keys, y) / fsum(list(FS), y) * 100)} %" for y in (1990, 2000, last)],
    )
    check(
        "fuller planes",
        text("#rempl-text"),
        f"{fr(abs(pct(asum(N['pax'], 2000), asum(N['pax'], AY[-1]))))} %",
        f"{fr(abs(pct(asum(N['vols'], 2000), asum(N['vols'], AY[-1]))))} %",
        f"{fr(asum(N['pax'], AY[-1]) / asum(N['vols'], AY[-1]))} passagers",
        f"contre {fr(asum(N['pax'], 2000) / asum(N['vols'], 2000))} en 2000",
    )
    check(
        "covid",
        text("#covid-text"),
        f"{fr(abs(covid['pax']), 1)} %",
        f"{fr(abs(covid['vols']))} %",
        f"{fr(abs(covid['fret']))} %",
        f"{fr(covid['vols_cargo'])} %".replace("-", "−"),
        month_name(back("fret", 100)),
        month_name(back("pax", 90)),
    )
    rad = {y: fsum(["MET_RAD"], y) for y in range(1990, last + 1)}
    peak_rad = max(rad, key=rad.get)
    tab("france-moments", "peak")
    check("France, peak", text("#france-caption"), str(peak_rad), f"{fr(rad[peak_rad] / 1e6, 1)} millions")
    tab("france-moments", "last")
    check(
        "France, last year",
        text("#france-caption"),
        f"{fr(abs(pct(rad[2019], rad[last])), 1)} %",
        f"{fr(abs(pct(fsum(['MET_TRA'], 2019), fsum(['MET_TRA'], last))), 1)} %",
    )
    p1, p2 = CO[0], CO[1]
    check(
        "distance and CO2",
        text("#dist-text"),
        f"{fr(p1['trafic'], 1)} Mt",
        f"{fr(-p1['intensite'], 1)} Mt",
        f"{fr(p1['c1'] - p1['c0'], 1)} Mt",
        f"{fr(abs(pct(p2['c0'], p2['c1'])), 1)} %",
    )
    check(
        "carriers",
        text("#cie-text"),
        f"{fr(C['lowcost_share'][0] * 100)} %",
        f"{fr(C['lowcost_share'][-1] * 100)} %",
        f"{car[0]['nom']} reste en tête avec {fr(car[0]['pax'][-1] / 1e6, 1)} M",
        f"{fr(abs(pct(rya['pax'][-2], rya['pax'][-1])), 1)} %",
    )

    def traffic(keys, y):
        return fsum(keys, y)

    check(
        "prices",
        text("#prix-text"),
        month_name(PM[L]),
        f"{fr(cur, 1)} %",
        month_name(since),
        f"{fr(pct(pmean('MET_INTER_MET', 2019), pmean('MET_INTER_MET', last)))} %",
        f"{fr(abs(pct(traffic(['MET_RAD', 'MET_TRA'], 2019), traffic(['MET_RAD', 'MET_TRA'], last))))} %",
        f"{fr(pct(pmean('MET_INTAL_TOT', 2019), pmean('MET_INTAL_TOT', last)))} %",
        f"{fr(pct(traffic(['MET_INTL'], 2019), traffic(['MET_INTL'], last)))} %",
    )
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
