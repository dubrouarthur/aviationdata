"""The home page and the jet-stream story, end to end: links, old links, interactions, and every number
of the story recomputed in Python from web/public/data/jet/*.json and compared with the page text.

Serve web/dist on 127.0.0.1:4173 first (npx vite preview --host 127.0.0.1 --port 4173).

    python3 web/scripts/check_site.py [--base http://127.0.0.1:4173]
Exit 1 on any failure.
"""

import json
import math
import statistics as st
import sys
import xml.etree.ElementTree as ET
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
J = {k: json.loads((ROOT / "public" / "data" / "jet" / f"{k}.json").read_text()) for k in
     ("flights", "routing", "hero", "climate", "trappes", "winds", "sim")}  # fmt: skip
for k in ("sim_stats", "history", "cost"):  # optional: the page hides their sections when missing
    f = ROOT / "public" / "data" / "jet" / f"{k}.json"
    J[k] = json.loads(f.read_text()) if f.exists() else None
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
failures = []


def check(where, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + where + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(where)


def has(where, text, *needles):
    missing = [n for n in needles if n not in text]
    check(where, not missing, f"missing {missing}" if missing else "")


# ---------------------------------------------------------------- French formats (as Intl fr-FR, half up)
def fr(v, d=0):
    q = Decimal(str(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    s = f"{abs(q):,.{d}f}".replace(",", " ").replace(".", ",")
    return ("−" if q < 0 else "") + s


def hm(m):
    m = int(Decimal(str(abs(m))).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return f"{m // 60} h {m % 60:02d}" if m >= 60 else f"{m} min"


kmh = lambda v, d=0: f"{fr(v, d)} km/h"  # noqa: E731
mins = lambda v, d=0: f"{fr(v, d)} min"  # noqa: E731
pct = lambda v: f"{fr(v)} %"  # noqa: E731


def tonnes(v, d=1):
    return f"{fr(v, d)} t"


def euros(v):
    a = abs(v)
    if a >= 1e6:
        return f"{fr(v / 1e6, 0 if a >= 1e7 else 1)} million{'s' if a >= 2e6 else ''} d'euros"
    step = 100 if a >= 10000 else 10
    return f"{fr(round(v / step) * step)} €"


def per_tonne(v):
    return f"{fr(v)} € la tonne"


def month_year(m):
    return f"{MONTHS[int(m[5:7]) - 1]} {m[:4]}"


def haversine(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(min(1, max(0, h))))


def long_date(iso):
    y, m, d = map(int, iso.split("-"))
    return f"{'1er' if d == 1 else d} {MONTHS[m - 1]} {y}"


def norm(s):
    return s.replace(" ", " ").replace(" ", " ")


# ---------------------------------------------------------------- expected values, from the JSON
fl, rt, hero, cl, tr = J["flights"], J["routing"], J["hero"], J["climate"], J["trappes"]
p = fl["pair"]
pair = next(r for r in fl["routes"] if r["fr"] == p["fr"] and r["na"] == p["na"])
coast_codes = {"KLAX", "KSFO", "KSEA", "CYVR"}
others = [r for r in fl["routes"] if r["na"] not in coast_codes]
gap = lambda r: r["west"]["med"] - r["east"]["med"]  # noqa: E731
lo_r, hi_r = min(others, key=gap), max(others, key=gap)
coast = sorted((r for r in fl["routes"] if r["na"] in coast_codes and r["fr"] == "LFPG"), key=gap)


def season(ms):
    rows = [d for d in p["monthly"] if d["e"] is not None and d["w"] is not None and int(d["m"][5:]) in ms]
    return st.mean(d["w"] - d["e"] for d in rows)


tail = {d["m"]: d["te"] for d in p["monthly"]}
naive = p["km"] / rt["tas"] ** 2 * 60 * 10
s = rt["summary"]
ciara = next(d for d in rt["days"] if d[0] == "2020-02-08")
m = rt["model"]
hiY, hiV = cl["top"][0]
loY, loV = cl["bottom"][0]
t79 = cl["trend79"]
jan = tr["months"][0]
low = min(tr["months"], key=lambda d: d["p50"])
c = cl["clim"]


def core(key, lon=-60):
    j = round((lon - c["lon0"]) / c["d"])
    col = [c[key][i * c["nx"] + j] for i in range(c["ny"])]
    i = max(range(c["ny"]), key=lambda k: col[k])
    return c["lat0"] + i * c["d"], col[i]


toward = lambda r: f"vers {r['to']}" if r["fr"] == "LFPG" else f"entre {r['from'].replace('Paris-', '')} et {r['to']}"  # noqa: E731

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    errors = []

    def page_(**kw):
        pg = browser.new_page(**kw)
        pg.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        return pg

    # ------------------------------------------------------------ home
    pg = page_(viewport={"width": 1440, "height": 900})
    pg.goto(base + "/", wait_until="networkidle")
    links = pg.eval_on_selector_all(".strip-link", "as => as.map(a => a.getAttribute('href'))")
    check("home lists both investigations", links == ["courant-jet", "le-ciel-a-deux-vitesses"], str(links))
    pg.wait_for_timeout(800)
    painted = pg.evaluate(
        "() => { const c = document.getElementById('lead-wind');"
        " const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;"
        " let n = 0; for (let i = 3; i < d.length; i += 64) n += d[i] > 0; return n; }"
    )
    check("home wind is drawn", painted > 200, f"{painted} painted samples")
    pg.click(".strip-link[href='courant-jet']")
    pg.wait_for_load_state("networkidle")
    check("home strip opens the story", pg.title().startswith("Le vent dans le dos"), pg.url)
    for old, want in (
        ("#co2", "/le-ciel-a-deux-vitesses#co2"),
        ("#aeroport-LFLL", "/le-ciel-a-deux-vitesses#aeroport-LFLL"),
    ):
        pg.goto(base + "/" + old, wait_until="networkidle")
        check(f"old link {old} follows the first story", pg.url.endswith(want), pg.url)
    pg.goto(base + "/le-ciel-a-deux-vitesses", wait_until="networkidle")
    pg.click(".site-mark")
    pg.wait_for_load_state("networkidle")
    check("first story links back home", pg.title().startswith("aviationdata"), pg.url)

    # ------------------------------------------------------------ the magazine: menu, footer, about, feed
    for path in ("/", "/courant-jet", "/le-ciel-a-deux-vitesses", "/a-propos"):
        pg.goto(base + path, wait_until="networkidle")
        foot = pg.eval_on_selector_all(".site-foot a", "as => as.map(a => a.getAttribute('href'))")
        n_issues = sum("courant-jet" in h or "le-ciel" in h for h in foot)
        check(f"{path}: site footer lists every investigation", n_issues == 2, str(foot))
        pg.click("[data-menu-open]")
        pg.wait_for_timeout(300)
        check(f"{path}: the menu opens", pg.evaluate("document.getElementById('site-menu').open"))
        home = pg.eval_on_selector_all("#site-menu .wordmark", "as => as.map(a => a.getAttribute('href'))")
        check(f"{path}: the menu leads home", home in (["./"], ["../"]), str(home))
        if path in ("/courant-jet", "/le-ciel-a-deux-vitesses"):
            n = pg.locator("#menu-chapters a").count()
            check(f"{path}: the menu lists the chapters", n == pg.locator(".topnav a").count() and n > 8, f"{n}")
        pg.keyboard.press("Escape")
        check(f"{path}: Escape closes the menu", not pg.evaluate("document.getElementById('site-menu').open"))
    pg.goto(base + "/courant-jet", wait_until="networkidle")
    has("byline", norm(pg.inner_text(".article-meta")), "Par Arthur Dubrou", "Publiée le 24 octobre 2026")
    pg.goto(base + "/a-propos", wait_until="networkidle")
    has("about page", norm(pg.inner_text("main")), "La charte", "Corrections", "Les sources", "Citer et réutiliser")
    feed = pg.request.get(base + "/feed.xml")
    entries = ET.fromstring(feed.text()).findall("{http://www.w3.org/2005/Atom}entry") if feed.ok else []
    check("Atom feed lists both investigations", len(entries) == 2, f"{feed.status} {len(entries)}")
    check("sitemap", pg.request.get(base + "/sitemap.xml").ok)

    # ------------------------------------------------------------ the jet-stream story
    pg.goto(base + "/courant-jet", wait_until="networkidle")
    pg.wait_for_timeout(1200)
    text = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    has(
        "standfirst",
        text("#open-dek"),
        f"dure en médiane {hm(p['gap'])} de plus",
        f"Enquête sur {fr(round(fl['n_valid'] / 1000) * 1000)} vols",
    )
    has(
        "the night of Ciara",
        text("#nuit-prose"),
        kmh(hero["max"]["kmh"]),
        f"par {fr(hero['max']['lat'])}° nord",
        kmh(hero["route"]["tail"]),
        f"en {hm(hero['route']['t_fast'])} par la route la plus rapide, contre {hm(hero['route']['nowind'])} sans vent",
    )
    has(
        "key figures",
        text("#kf-nuit"),
        kmh(hero["max"]["kmh"]),
        hm(hero["route"]["t_fast"]),
        hm(hero["route"]["nowind"]),
    )
    has(
        "one hour more",
        text("#ecart-prose"),
        f"suivi {fr(round(fl['n_valid'] / 1000) * 1000)} vols",
        f"({fr(pair['east']['n'] + pair['west']['n'])} vols)",
        f"dure en médiane {hm(pair['west']['med'])}, le retour {hm(pair['east']['med'])} : {hm(p['gap'])} d'écart",
        f"de {hm(gap(lo_r))} {toward(lo_r)} à {hm(gap(hi_r))} {toward(hi_r)}",
        ", ".join(f"{hm(gap(r))} vers {r['to']}" for r in coast),
    )
    has(
        "histogram labels",
        text("#chart-hist"),
        f"Vers Paris {hm(pair['east']['med'])}",
        f"Vers New York {hm(pair['west']['med'])}",
    )
    has(
        "seasons",
        text("#saisons-prose"),
        f"en moyenne {hm(season([12, 1, 2]))} de décembre à février, contre {hm(season([6, 7, 8]))}",
        f"{kmh(tail['2019-01'])} de vent arrière",
        f", {kmh(tail['2019-07'])} en juillet",
    )
    fe, fw = p["fit"]["e"], p["fit"]["w"]
    has(
        "ten km/h",
        text("#vent-prose"),
        f"retire {mins(-fe['slope'], 1)} au vol",
        f"en ajoute {mins(-fw['slope'], 1)}",
        f"à lui seul {pct(100 * fe['r'] ** 2)}",
        f"et {pct(100 * fw['r'] ** 2)} vers New York",
        f"ligne droite, {mins(naive, 1)} par tranche",
    )
    has(
        "the fastest route",
        text("#route-prose"),
        f"que {mins(s['gain_e'], 1)} en moyenne",
        f"fait gagner {mins(s['gain_w'], 1)}",
        f"plus de 10 minutes {pct(s['share_w_10'])} des jours",
        f"demandé {hm(ciara[3])} contre le vent",
        f"très au nord, {hm(ciara[4])}",
    )
    has(
        "model against flights",
        text("#model-prose"),
        f"corrélation de {fr(m['w']['r_opt'], 2)} vers New York, contre {fr(m['w']['r_gc'], 2)}",
        f"vers Paris, {fr(m['e']['r_opt'], 2)} contre {fr(m['e']['r_gc'], 2)}",
        f"{fr(min(m['w']['offset'], m['e']['offset']))} à {mins(max(m['w']['offset'], m['e']['offset']))}",
    )
    has(
        "round trip",
        text("#ar-prose"),
        f"en moyenne {mins(s['rt_gc'])} de plus que sans vent ({hm(2 * rt['nowind'])})",
        f"tombe à {mins(s['rt_opt'])}",
    )
    R = p["records"]
    has(
        "record days",
        text("#vent-prose"),
        f"Le {long_date(R['fast_e']['day'])}, les vols New York–Paris ont mis {hm(R['fast_e']['dur'])}",
        f"poussés par {kmh(R['fast_e']['w'])}",
        f"Le {long_date(R['slow_w']['day'])}, il a fallu {hm(R['slow_w']['dur'])}",
        f"contre {kmh(-R['slow_w']['w'])} de vent de face",
    )
    types = fl["aircraft"]["types"]
    mean = lambda t: (t["e"] + t["w"]) / 2  # noqa: E731
    has("aircraft", text("#avion-prose"), f"il y a {mins(mean(types[-1]) - mean(types[0]))}")
    prof = tr["profile"]
    peak = max(prof["djf"], key=lambda d: d["p50"])
    peak_s = max(prof["jja"], key=lambda d: d["p50"])
    has(
        "the jet above Paris",
        text("#jet-prose"),
        f"de {kmh(prof['djf'][0]['p50'])} vers {fr(prof['djf'][0]['km'], 1)} km d'altitude",
        f"à {kmh(peak['p50'])} vers {fr(peak['km'], 1)} km, au niveau de {peak['hpa']} hPa",
        f"le maximum, {kmh(peak_s['p50'])}, se tient à {fr(peak_s['km'], 1)} km",
        f"a mesuré {kmh(tr['ciara']['kmh'])}",
        f"remonter au {long_date(tr['ciara']['stronger_before'])}",
        f"corrélation de {fr(tr['check']['r'], 3)}",
        f"écart moyen de {kmh(tr['check']['mae'])}",
        f"{fr(tr['check']['n'])} sondages",
    )
    sim = J["sim"]
    cells = [(row["hour"], lv, v) for row in sim["ciara"]["west"] for lv, v in enumerate(row["best"][:3])]
    fl_ = lambda lv: f"FL{sim['levels'][lv]['fl']}"  # noqa: E731
    fast = min(cells, key=lambda c: c[2])
    slow = max(cells, key=lambda c: c[2])
    has(
        "placing the aircraft",
        text("#placer-prose"),
        f"aurait mis {hm(fast[2])} par la meilleure route en partant à {fast[0]:02d} h UTC à {fl_(fast[1])}",
        f"et {hm(slow[2])} en partant à {slow[0]:02d} h UTC à {fl_(slow[1])}",
        f"{mins(slow[2] - fast[2])} d'écart",
    )
    st, co = J["sim_stats"], J["cost"]
    if st and co and "ladder" in st["west"]:
        # the costs chapter, recomputed: fuel from the DGAC factor and the Paris-New York load, euros from EIA/ECB
        w, e = st["west"], st["east"]
        pr = co["pair"][-1]
        peq = pr["peq"] / pr["mvt"]
        fuel_t = lambda kg: kg * peq / co["factors"]["co2_per_fuel"] / 1000  # noqa: E731

        def steps(d):
            L = d["ladder"]
            f = [fuel_t(k) for k in L["co2"]]
            gains = [L["time"][i - 1] - L["time"][i] for i in (1, 2, 3)]
            return gains, [f[i - 1] - f[i] for i in (1, 2, 3)], f[0] - f[3]

        (Wm, Wt, Wtot), (Em, Et, Etot) = steps(w), steps(e)
        yt = pr["mvt"] / 2 * (Wtot + Etot)
        y, last = co["year"], co["last"]
        kg10 = lambda t: f"{fr(round(t * 1000 / 10) * 10)} kg"  # noqa: E731
        lev = lambda i: f"FL{sim['levels'][i]['fl']}"  # noqa: E731
        lo, hi = w["ladder"]["static_time"][0], w["ladder"]["static_fuel"][0]
        km = haversine((49.0097, 2.5479), (40.6413, -73.7781))
        tref = km / (st["mach"] * math.sqrt(1.4 * 287.05 * 220.8) * 3.6) * 60
        per_min = st["g_pkm"] * km / 1000 / tref
        ac = next(a for a in sim["aircraft"] if a["name"] == st["aircraft"])
        st_mean = lambda xs: sum(xs) / len(xs)  # noqa: E731
        mean_col = lambda i: st_mean([r[i + 1] for r in w["daily"]])  # noqa: E731
        more = mean_col(2) - mean_col(0)
        less = fuel_t(st_mean([r[1] * ac["fuel"][0] for r in w["daily"]]) * per_min) - fuel_t(
            st_mean([r[3] * ac["fuel"][2] for r in w["daily"]]) * per_min
        )
        has(
            "what the data is worth: minutes",
            text("#bilan-prose"),
            f"chacun des {fr(len(st['days']))} jours",
            f"fait gagner {mins(Wm[0], 1)} en moyenne vers New York et {mins(Em[0], 1)} vers Paris",
            f"rien ({mins(Wm[1], 1)} et {mins(Em[1], 1)})",
            f"{lev(lo)}, le plus rapide {pct(w['share'][lo])} des jours",
            f"rapporte encore {mins(Wm[2], 1)} et {mins(Em[2], 1)}",
        )
        has(
            "what the data is worth: fuel",
            text("#bilan-prose"),
            f"{lev(hi)}, l'emporte {pct(w['ladder']['day_fuel_share'][hi])} des jours",
            f"Paris–New York en {pr['y']} ({fr(peq)} passagers-équivalents par vol, DGAC)",
            f"économise {kg10(Wt[0])} de kérosène par vol vers New York et {kg10(Et[0])} vers Paris",
        )
        has(
            "what the data is worth: euros",
            text("#cout-prose"),
            f"Sur les {fr(pr['mvt'])} vols entre Paris-CDG et New York-JFK en {pr['y']}",
            f"vaut {tonnes(round(yt / 10) * 10, 0)} de kérosène par an",
            f"et {tonnes(round(yt * 3.16 / 10) * 10, 0)} de CO2",
            f"Au prix moyen de {y['y']} ({per_tonne(y['eur_t'])}), cela fait {euros(yt * y['eur_t'])}",
            f"au prix de {month_year(last['m'])} ({per_tonne(last['eur_t'])}), {euros(yt * last['eur_t'])}",
            f"rallonge le vol de {mins(more, 1)} en moyenne mais économise {tonnes(less)}",
            f"plus de {euros(less * y['eur_t'] / more)}",
            f"ce seuil passe à {euros(less * last['eur_t'] / more)}",
        )
        pg.locator("#chart-ladder").scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        has("ladder in euros", text("#chart-ladder"), euros(Wt[0] * last["eur_t"]))
        pg.click("#ladder-unit button:has-text('Minutes')")
        pg.wait_for_timeout(300)
        has("ladder in minutes", text("#chart-ladder"), mins(Wm[0], 1), mins(Em[2], 1))
        check("fuel price chart", pg.locator("#chart-value path").count() >= 2)
    H = J["history"]
    if H:
        has(
            "seventy-five years",
            text("#histoire-prose"),
            f"{fr(H['share_strong'], 1)} %",
            f"{fr(H['share_reversed'], 1)} %",
            f"date du {long_date(H['top'][0][0])}, avec {kmh(H['top'][0][1])}",
            f"du {long_date(H['reversed'][0][0])} : {kmh(abs(H['reversed'][0][1]))}",
            f"de {kmh(loV)} en {loY - 1}-{loY} à {kmh(hiV)} en {hiY - 1}-{hiY}",
            f"moyenne de {kmh(cl['mean'])} sur 1991-2020",
            f"corrélation de {fr(cl['nao']['r'], 2)} sur {cl['nao']['n']} hivers",
            f"{'+' if t79['slope'] >= 0 else '−'}{kmh(abs(t79['slope']), 1)} par décennie",
            f"plus ou moins {kmh(t79['ci'], 1)}",
        )
    (wl, wk), (sl, sk) = core("djf"), core("jja")
    pg.locator("#clim-map").scroll_into_view_if_needed()
    pg.wait_for_timeout(600)
    has(
        "jet core note",
        text("#clim-note"),
        f"vers {round(wl)}° nord à {kmh(wk)}",
        f"remonte vers {round(sl)}° nord et faiblit à {kmh(sk)}",
    )

    # ------------------------------------------------------------ simulator: the browser flies as Python did
    pg.locator("#sim-stage").scroll_into_view_if_needed()
    pg.wait_for_function("document.querySelector('#sim-matrix-note')?.textContent.length > 0", timeout=60000)
    got = [norm(t) for t in pg.eval_on_selector_all(".sim-cell", "cs => cs.map(c => c.textContent)")]
    want = [hm(v) for row in sim["ciara"]["west"] for v in row["best"]]
    check("simulator grid matches the Python routes (Ciara, Paris → New York)", got == want, f"{got} vs {want}")
    noon = next(r for r in sim["ciara"]["west"] if r["hour"] == 12)
    has("simulator key figures", text("#sim-kpis"), hm(noon["gc"]), hm(noon["best"][1]))
    if co:
        has("simulator fuel and cost", text("#sim-kpis"), "de kérosène", "€")
        has("simulator cost note", text("#sim-kpi-note"), per_tonne(co["last"]["eur_t"]), month_year(co["last"]["m"]))
    pg.click("#sim-level button:has-text('Libre')")
    pg.wait_for_timeout(1500)
    has("simulator free altitude", text("#sim-kpis"), hm(noon["best"][3]))
    pg.click("#sim-level button:has-text('FL340')")
    h = pg.locator(".sim-handle").nth(1).bounding_box()
    before = text("#sim-kpis")
    pg.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
    pg.mouse.down()
    pg.mouse.move(h["x"] + h["width"] / 2, h["y"] - 80, steps=6)
    pg.mouse.up()
    pg.wait_for_timeout(800)
    check("your route follows the dragged point", text("#sim-kpis") != before)
    pg.click("#sim-play")
    pg.wait_for_timeout(1500)
    planes = pg.locator(".sim-plane").count()
    check("the three planes fly", planes == 3, f"{planes} planes")
    pg.click("#sim-play")
    pg.select_option("#sim-day", sim["days"][0]["day"])
    pg.wait_for_timeout(1500)
    check("another day loads", sim["days"][0]["day"][:4] in text("#sim-clock"), text("#sim-clock"))

    # ------------------------------------------------------------ explorer: the browser solves as Python did
    pg.locator("#exp-stage").scroll_into_view_if_needed()
    pg.wait_for_function("document.querySelector('#exp-read .er-row') !== null", timeout=20000)
    for iso in ("2019-07-14", "2021-04-04", "2022-12-31"):
        pg.fill("#exp-day", iso)
        pg.dispatch_event("#exp-day", "change")
        pg.wait_for_function(
            f"document.querySelector('#exp-read .er-day')?.textContent.includes('{long_date(iso)}')", timeout=20000
        )
        row = next(d for d in rt["days"] if d[0] == iso)
        t = text("#exp-read")
        # a value stored at 2 decimals right on a half minute may round either way in the browser
        ok = all(hm(v) in t or hm(v + 0.01) in t or hm(v - 0.01) in t for v in row[1:])
        check(f"explorer {iso} matches the Python routes", ok, str([hm(v) for v in row[1:]]))
    pg.click("#exp-dest button:has-text('Montréal')")
    pg.wait_for_timeout(300)
    has("explorer switches destination", text("#exp-read"), "Paris → Montréal", "Montréal → Paris")
    pg.locator("#chart-strip svg").scroll_into_view_if_needed()
    box = pg.locator("#chart-strip svg").bounding_box()
    pg.mouse.click(box["x"] + 38 + (box["width"] - 40) * 40 / 366, box["y"] + 2 + 24 + 9)  # 2020, about 10 February
    pg.wait_for_timeout(1200)
    check("day strip picks a day", "2020" in text("#exp-read .er-day"), text("#exp-read .er-day"))
    pg.click("#exp-play")
    before = text("#exp-read .er-day")
    pg.wait_for_timeout(2000)
    after = text("#exp-read .er-day")
    pg.click("#exp-play")
    check("play steps through the days", before != after, f"{before} -> {after}")
    pg.click("#clim-season button:has-text('Été')")
    check("season switch", pg.get_attribute("#clim-season button:has-text('Été')", "aria-pressed") == "true")
    lines = pg.locator(".source-line").count()
    check("every figure names its sources", lines >= 11, f"{lines} source lines")
    check("method and sources", "OpenSky" in text("#sources-body") and "Copernicus" in text("#sources-body"))
    check(
        "today's data date",
        str(date.today().year) in text("#sources-body") or "Données traitées" in text("#sources-body"),
    )

    # ------------------------------------------------------------ phone
    mp = page_(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    for path in ("/", "/courant-jet", "/le-ciel-a-deux-vitesses", "/a-propos"):
        mp.goto(base + path, wait_until="networkidle")
        mp.wait_for_timeout(800)
        wide = mp.evaluate(
            "() => document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('body *')]"
            ".filter(e => e.getBoundingClientRect().right > innerWidth + 1)"
            ".map(e => e.tagName + '.' + e.className).slice(0, 5) : []"
        )
        check(f"mobile {path}: no horizontal overflow", not wide, str(wide))
        home = mp.locator(".site-mark, .site-head .wordmark").first
        check(f"mobile {path}: the way home is visible", home.is_visible())
    check("no console errors", not errors, str(errors[:5]))
    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
