"""The home page and the jet-stream story, end to end: links, old links, interactions, and every number
of the story recomputed in Python from web/public/data/jet/*.json and compared with the page text.

Serve web/dist on 127.0.0.1:4173 first (npx vite preview --host 127.0.0.1 --port 4173).

    python3 web/scripts/check_site.py [--base http://127.0.0.1:4173]
Exit 1 on any failure.
"""

import json
import statistics as st
import sys
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
J = {k: json.loads((ROOT / "public" / "data" / "jet" / f"{k}.json").read_text()) for k in
     ("flights", "routing", "hero", "climate", "trappes", "winds")}  # fmt: skip
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
    has(
        "climate",
        text("#climat-prose"),
        f"de {kmh(loV)} en {loY - 1}-{loY} à {kmh(hiV)} en {hiY - 1}-{hiY}",
        f"moyenne de {kmh(cl['mean'])} sur 1991-2020",
        f"corrélation de {fr(cl['nao']['r'], 2)} sur {cl['nao']['n']} hivers",
        f"environ {kmh(cl['nao']['slope'])} de vent",
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
    has(
        "Trappes",
        text("#trappes-prose"),
        f"{fr(tr['n'])} sondages",
        f"la moitié dépassent {kmh(jan['p50'])} et un sur dix {kmh(jan['p90'])}",
        f"en {MONTHS[low['m'] - 1]}, le vent médian retombe à {kmh(low['p50'])}",
        f"a mesuré {kmh(tr['ciara']['kmh'])}",
        f"remonter au {long_date(tr['ciara']['stronger_before'])}",
        f"maximum de la série, {kmh(tr['top'][0][2])}, date du {long_date(tr['top'][0][0])}",
        f"corrélation de {fr(tr['check']['r'], 3)}",
        f"écart moyen de {kmh(tr['check']['mae'])}",
        f"{fr(tr['check']['n'])} sondages",
    )

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
    for path in ("/", "/courant-jet"):
        mp.goto(base + path, wait_until="networkidle")
        mp.wait_for_timeout(800)
        wide = mp.evaluate(
            "() => document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('body *')]"
            ".filter(e => e.getBoundingClientRect().right > innerWidth + 1)"
            ".map(e => e.tagName + '.' + e.className).slice(0, 5) : []"
        )
        check(f"mobile {path}: no horizontal overflow", not wide, str(wide))
    check("no console errors", not errors, str(errors[:5]))
    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
