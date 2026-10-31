"""Check every number written in the story against an independent recomputation from the JSON data.

The page computes its sentences in JavaScript; this script recomputes the same figures in Python, straight
from web/public/data/*.json, and checks that the rendered text says the same thing. Exit 1 on any mismatch.

    python3 web/scripts/audit_numbers.py [--url http://127.0.0.1:4173/le-ciel-a-deux-vitesses/]
"""

import json
import re
import statistics as st
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/le-ciel-a-deux-vitesses/"
D = {k: json.loads((ROOT / "public" / "data" / f"{k}.json").read_text()) for k in
     ("fracture", "aeroports", "compagnies", "prix", "co2", "monde", "routes", "fret")}  # fmt: skip
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

# CO2 by segment, grams per passenger-km
CM, CG = D["co2"]["mt"], D["co2"]["g_peqkm"]
co2_last = D["co2"]["years"][-1]

# average distance (LSN passenger-km / passengers)
PF = F["par_faisceau"]


def avg_km(keys, i):
    pkt = sum(PF[k]["pkt"][i] or 0 for k in keys if k in PF)
    pax = sum(PF[k]["pax"][i] or 0 for k in keys if k in PF)
    return pkt / pax


# freight (LSN) and airports' freight (APT, national total keeps the airports below the threshold)
FR = D["fret"]
FY, FT, FC = FR["years"], FR["total"], FR["continents"]
f19, f20 = FY.index(2019), FY.index(2020)
dom_peak = max(range(len(FY)), key=lambda i: FC["Intérieur"][i])
cdg = next(a for a in A["airports"] if a["code"] == "LFPG")
cdg_share = cdg["fret"][-1] / asum(N["fret"], AY[-1]) * 100
cdg_pax_share = asum(cdg["pax"], AY[-1]) / asum(N["pax"], AY[-1]) * 100

# French vs foreign carriers
PV, CY = C["pavillon"], C["years"]
pays = {p["nom"]: p["pax"] for p in C["pays"]}
k17 = CY.index(2017)


def fshare(i):
    return PV["F"][i] / (PV["F"][i] + PV["E"][i]) * 100


gF, gE = pct(PV["F"][0], PV["F"][-1]), pct(PV["E"][0], PV["E"][-1])
WORDS = {2: "deux", 3: "trois", 4: "quatre", 5: "cinq", 6: "six", 7: "sept", 8: "huit"}
# airports: recovery since 2019 (airports above 200 000 passengers in 2019) and the default card (Toulouse)
AP = A["airports"]
big = [a for a in AP if asum(a["pax"], 2019) >= 200000]
recov = [a for a in big if asum(a["pax"], last) >= asum(a["pax"], 2019)]
apt_mv = sorted((pct(asum(a["pax"], 2019), asum(a["pax"], last)) for a in big), reverse=True)


def fpax(v):
    if v >= 1e6:
        return f"{fr(v / 1e6, 1 if v >= 1e7 else 2)} M"
    return f"{fr(v / 1e3)} k" if v >= 1e5 else fr(v)


tls = next(a for a in AP if a["code"] == "LFBO")
tls_p, tls_19 = asum(tls["pax"], last), asum(tls["pax"], 2019)
tls_rank = 1 + sum(1 for a in AP if asum(a["pax"], last) > tls_p)
tls_years = {y: asum(tls["pax"], y) for y in AY}
tls_rec = max(tls_years, key=tls_years.get)
tls_m = [tls["pax"][j] or 0 for j, m in enumerate(AM) if m.startswith(str(last))]
tls_peak = max(range(12), key=lambda k: tls_m[k])
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
        "hero key figures",
        text("#hero-kpis"),
        f"{fr(fa['TOTAL'][iL] / 1e6, 1)} M",
        f"+{fr(pct(fa['INTL'][i19], fa['INTL'][iL]), 1)} %",
        f"−{fr(abs(pct(fa['NAT'][i19], fa['NAT'][iL])), 1)} %",
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
        *[f"{fr(fsum(nat_keys, y) / fsum(list(FS), y) * 100)} %" for y in (1990, last)],
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
        text("#covid"),
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
    allk = list(PF)
    km = [avg_km(allk, i) for i in range(len(Y))]
    check(
        "distance",
        text("#distance"),
        f"{fr(km[iL])} km",
        f"par rapport à {fr(km[0])} km en {Y[0]}",
        f"+{fr(pct(km[0], km[iL]))} %",
        f"{fr(avg_km(['MET_INTL', 'OM_INTL'], iL))} km",
        f"{fr(avg_km(['MET_RAD'], iL))} km",
    )
    p1, p2 = CO[0], CO[1]
    T, G = CM["FRANCE_TOT"], CG["FRANCE_TOT"]
    check(
        "CO2",
        text("#co2-text") + text("#co2-after"),
        f"{fr(T[-1], 1)} millions de tonnes",
        f"{fr(CM['INTL_LC'][-1] / T[-1] * 100)} %",
        f"{fr(CM['MET_INTERIEUR'][-1], 1)} Mt",
        f"{fr(abs(pct(CM['MET_INTERIEUR'][0], CM['MET_INTERIEUR'][-1])))} % de moins",
        f"{fr(G[-1])} g de CO2, contre {fr(G[0])} g",
        f"−{fr(abs(pct(G[0], G[-1])))} %",
        f"{fr(CG['MET_INTERIEUR'][-1])} g, contre {fr(CG['INTL_LC'][-1])} g",
        f"{fr(p1['trafic'], 1)} Mt",
        f"{fr(-p1['intensite'], 1)} Mt",
        f"{fr(p1['c1'] - p1['c0'], 1)} Mt de plus",
        f"{fr(abs(pct(p2['c0'], p2['c1'])), 1)} %",
        f"{fr(p2['trafic_pct'], 1)} %".replace("-", "−"),
        f"{fr(p2['intensite_pct'], 1)} %".replace("-", "−"),
    )
    # CO2 overview, index 100 in the first year: traffic, passengers per flight, emissions, CO2 per passenger-km
    cy = D["co2"]["years"]
    pv = [asum(N["pax"], y) / asum(N["vols"], y) for y in (cy[0], cy[-1])]

    def sidx(v):
        return f"+{fr(v - 100)} %" if v >= 100 else f"−{fr(100 - v)} %"

    check(
        "CO2 overview",
        text("#chart-co2-index"),
        f"Passagers-km {sidx((T[-1] / G[-1]) / (T[0] / G[0]) * 100)}",
        f"Passagers par vol {sidx(pv[1] / pv[0] * 100)}",
        f"Émissions {sidx(T[-1] / T[0] * 100)}",
        f"CO2 par passager-km {sidx(G[-1] / G[0] * 100)}",
    )
    page.locator('#co2-period button[data-v="steps"]').click()
    page.wait_for_timeout(300)
    # the waterfall's net changes per period
    check(
        "CO2 waterfall",
        text("#chart-waterfall"),
        f"{fr(p1['c0'], 1)} Mt",
        f"+{fr(p1['trafic'], 1)} Mt",
        f"−{fr(-p1['intensite'], 1)} Mt",
        f"{p1['from']} → {p1['to']} : +{fr(p1['c1'] - p1['c0'], 1)} Mt",
        f"{p2['from']} → {p2['to']} : −{fr(p2['c0'] - p2['c1'], 1)} Mt",
    )
    dom = FC["Intérieur"]
    paxc = pct(fa["TOTAL"][Y.index(2019)], fa["TOTAL"][Y.index(2020)])
    check(
        "freight",
        text("#fret-text") + text("#fret-after"),
        f"{fr(FT[-1] / 1e6, 2)} millions de tonnes",
        f"{fr(abs(pct(FT[f19], FT[-1])))} % de moins",
        f"({fr(FT[f19] / 1e6, 2)} Mt)",
        f"reculé que de {fr(abs(pct(FT[f19], FT[f20])))} %, quand les passagers",
        f"chutaient de {fr(abs(paxc))} %",
        f"{fr(FC['Asie'][-1] / FT[-1] * 100)} % et {fr(FC['Europe'][-1] / FT[-1] * 100)} %",
        f"Amérique ({fr(FC['Amérique'][-1] / FT[-1] * 100)} %)",
        f"{fr(abs(pct(dom[dom_peak], dom[-1])))} % depuis son sommet de {FY[dom_peak]}",
        f"{fr(cdg_share)} % à lui seul, contre {fr(cdg_pax_share)} %",
    )
    times = round(gE / gF)
    check(
        "flag carriers",
        text("#pav-text") + text("#pav-after"),
        f"({fr(fshare(0), 1)} %)",
        f"plus que {fr(fshare(-1), 1)} %",
        f"(+{fr(gF)} %)",
        f"{WORDS[times]} fois plus vite",
        f"(+{fr(gE)} %)",
        f"{fr(PV['E'][-1] / 1e6, 1)} M de passagers, contre {fr(PV['F'][-1] / 1e6, 1)} M pour les françaises",
        f"de {fr(pays['Autriche'][k17] / 1e6, 1)} M de passagers en 2017 à {fr(pays['Autriche'][-1] / 1e6, 1)} M",
        f"de {fr(pays['Royaume-Uni'][k17] / 1e6, 1)} M à {fr(pays['Royaume-Uni'][-1] / 1e6, 1)} M",
        f"Irlande ({fr(pays['Irlande'][-1] / 1e6, 1)} M)",
        f"Espagne ({fr(pays['Espagne'][-1] / 1e6, 1)} M)",
    )
    assert C["pays"][0]["nom"] == "Autriche", "story says Austria is the first foreign country"
    check(
        "airports, recovery",
        text("#apt-intro"),
        f"Sur les {len(big)} aéroports",
        f"{len(recov)} ont retrouvé",
        f"+{fr(apt_mv[0])} %",
        f"+{fr(apt_mv[1])} %",
        f"−{fr(abs(apt_mv[-1]))} %",
        f"−{fr(abs(apt_mv[-2]))} %",
    )
    d_tls = pct(tls_19, tls_p)
    check(
        "airport card (Toulouse)",
        text(".apt-sentence"),
        f"{fpax(tls_p)} passagers en {last}",
        f"{fr(abs(d_tls))} % {'de plus' if d_tls >= 0 else 'de moins'} qu'en 2019",
        f"le {tls_rank}e aéroport français",
        f"Son record : {fpax(tls_years[tls_rec])} passagers en {tls_rec}",
        f"{MONTHS[tls_peak]} ({fr(tls_m[tls_peak] / sum(tls_m) * 100)} %",
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
        text("#prix-text") + text("#prix-after"),
        month_name(PM[L]),
        f"{fr(cur, 1)} %",
        month_name(since),
        f"{fr(pct(pmean('MET_INTER_MET', 2019), pmean('MET_INTER_MET', last)))} %",
        f"{fr(abs(pct(traffic(['MET_RAD', 'MET_TRA'], 2019), traffic(['MET_RAD', 'MET_TRA'], last))))} %",
        f"{fr(pct(pmean('MET_INTAL_TOT', 2019), pmean('MET_INTAL_TOT', last)))} %",
        f"{fr(pct(traffic(['MET_INTL'], 2019), traffic(['MET_INTL'], last)))} %",
    )
    check(
        "France since 2019",
        text("#france-after"),
        f"{fr(abs(pct(rad[2019], rad[last])))} % de leurs passagers",
        f"{fr(abs(pct(fsum(['MET_TRA'], 2019), fsum(['MET_TRA'], last))))} %",
    )
    check(
        "summary cards",
        text("#resume-grid"),
        f"−{fr(abs(pct(rad[2019], rad[last])))} %",
        f"{fr(C['lowcost_share'][-1] * 100)} %",
        f"+{fr(pct(pmean('MET_INTER_MET', 2019), pmean('MET_INTER_MET', last)))} %",
        f"{fr(T[-1], 1)} Mt",
        f"{fr(FT[-1] / 1e6, 2)} Mt",
    )
    nkf = page.locator(".keyfig").count()
    print(("PASS " if not nkf else "FAIL ") + f"no key-figure box is left  {nkf}")
    if nkf:
        failures.append("key-figure boxes remain")
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
