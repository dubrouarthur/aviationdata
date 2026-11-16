"""One LinkedIn image per investigation (1080 x 1350, the 4:5 of the feed), readable by someone who has
never heard of it: what it is about (where, when), the finding as a plain sentence, one simple labelled
chart, why it matters, the question the investigation answers, and where to read it.

Every number is read on the investigation's own page (its key figures, opening, chapter text) with a
pattern that must match: the card says what the story says, and fails loudly when the page changes.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/linkedin_cards.py [--base URL] [--out DIR] [--only SLUG]
Output: promo/out/linkedin/<slug>.png (not versioned).

Micro cards (`"tpl": "micro"`): one number, one sentence, a hundred dots, the address; nothing to read twice.
PW_CHROMIUM=/path/to/chrome points Playwright at an installed browser when its own is missing.
"""

import math
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
root = Path(__file__).resolve().parents[2]
out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else root / "promo/out/linkedin"
out.mkdir(parents=True, exist_ok=True)

NIGHT, INK, MUTED, RULE, GREY = "#0d2236", "#f2f6fa", "#a9bccd", "#2b4560", "#3a5571"


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " ")).strip()


def find(text, pattern, where):
    m = re.search(pattern, text)
    if not m:
        raise SystemExit(f"{where}: « {pattern} » introuvable sur la page")
    return m.group(1)


def num(s):
    return float(s.replace("−", "-").replace(" ", "").replace(",", "."))


# ---------------------------------------------------------------- simple charts, labelled in words
def waffle(share, color, legend):
    """100 squares, `share` of them coloured: the reader counts without a scale."""
    k = round(share)
    cells = "".join(
        f'<rect x="{(i % 10) * 40}" y="{(i // 10) * 40}" width="34" height="34" rx="3" '
        f'fill="{color if i < k else GREY}"/>'
        for i in range(100)
    )
    return f"""<div class="waffle"><svg viewBox="0 0 394 394" width="360" height="360">{cells}</svg>
      <p class="wl">{legend}</p></div>"""


def dots(k, color, size=34, gap=8):
    """A 10 x 10 grid of round dots, the first `k` coloured."""
    step = size + gap
    cells = "".join(
        f'<circle cx="{(i % 10) * step + size / 2}" cy="{(i // 10) * step + size / 2}" r="{size / 2}" '
        f'fill="{color if i < k else GREY}"/>'
        for i in range(100)
    )
    side = 10 * step - gap
    return f'<svg viewBox="0 0 {side} {side}" width="{side}" height="{side}">{cells}</svg>'


def bars(rows, unit_note=""):
    """Horizontal bars [label, value, text, colour], longest = full width; negative values to the left of
    a zero line when the rows mix signs."""
    lo = min(0, min(r[1] for r in rows))
    hi = max(0, max(r[1] for r in rows))
    span = hi - lo or 1
    zero = (0 - lo) / span * 100
    html = ""
    zl = f'<b class="z" style="left:{zero:.2f}%"></b>' if lo < 0 else ""
    for label, v, text, color in rows:
        w = abs(v) / span * 100
        left = zero if v >= 0 else zero - w
        html += f"""<div class="bar"><p class="bl">{label}</p>
          <div class="bt"><i style="left:{left:.2f}%;width:{max(w, 0.8):.2f}%;background:{color}"></i>{zl}</div>
          <p class="bv" style="color:{color}">{text}</p></div>"""
    note = f'<p class="bn">{unit_note}</p>' if unit_note else ""
    return f'<div class="bars{" many" if len(rows) > 2 else ""}">{html}{note}</div>'


CARD = """
<style>
  html, body {{ margin: 0; background: {night}; }}
  .li {{ box-sizing: border-box; width: 1080px; height: 1350px; padding: 60px 72px 52px; overflow: hidden;
         display: flex; flex-direction: column; background: {night}; color: {ink};
         font-family: "Archivo Variable", Archivo, system-ui, sans-serif; position: relative; }}
  .li::before {{ content: ""; position: absolute; inset: 0 0 auto; height: 12px; background: {accent}; }}
  .top {{ display: flex; justify-content: space-between; align-items: baseline; font-size: 28px; color: {muted}; }}
  .mark {{ color: {ink}; }} .mark b {{ font-weight: 800; }}
  .ctx {{ margin: 46px 0 0; font-size: 32px; font-weight: 650; color: {accent}; }}
  h1 {{ margin: 14px 0 0; font-weight: 800; font-stretch: 68%; font-size: 86px; line-height: 0.98;
        letter-spacing: -0.005em; text-wrap: balance; }}
  .chart {{ flex: 1; min-height: 0; display: flex; align-items: center; margin-top: 30px; }}
  .waffle {{ display: flex; align-items: center; gap: 40px; }}
  .wl {{ margin: 0; font: 400 36px/1.3 "Source Serif 4 Variable", Georgia, serif; color: {ink}; }}
  .wl b {{ display: block; font: 800 150px/0.9 "Archivo Variable", sans-serif; font-stretch: 70%;
           color: {accent}; margin-bottom: 14px; }}
  .bars {{ width: 100%; display: grid; gap: 30px; }}
  .bar {{ display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; align-items: end; }}
  .bl {{ margin: 0; font-size: 34px; font-weight: 650; color: {ink}; }}
  .bt {{ grid-column: 1; grid-row: 2; position: relative; height: 54px; background: #132d47; border-radius: 4px; }}
  .bt i {{ position: absolute; top: 0; bottom: 0; border-radius: 4px; }}
  .bv {{ grid-column: 2; grid-row: 1 / span 2; margin: 0; align-self: end; font-weight: 800; font-stretch: 70%;
         font-size: 88px; line-height: 0.9; min-width: 3.4em; text-align: right; }}
  .bt .z {{ position: absolute; top: -10px; bottom: -10px; width: 3px; margin-left: -1px; background: {ink}; }}
  .many {{ gap: 18px; }} .many .bt {{ height: 40px; }} .many .bv {{ font-size: 68px; }} .many .bl {{ font-size: 30px; }}
  .bn {{ margin: 0; font-size: 26px; color: {muted}; }}
  .duo {{ width: 100%; margin-bottom: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; align-items: start; }}
  .duo > div {{ display: grid; grid-template-rows: 220px auto auto; justify-items: center; text-align: center; gap: 8px; }}
  .duo .pl {{ height: 220px; display: flex; align-items: center; justify-content: center; }}
  .duo .pl svg {{ transform: rotate(-90deg); overflow: visible; }}
  .duo b {{ font-weight: 800; font-stretch: 70%; font-size: 92px; line-height: 0.9; }}
  .duo span {{ font-size: 27px; font-weight: 600; line-height: 1.25; color: {ink}; }}
  .duo .others b {{ color: {muted}; }}
  .duo .others span {{ color: {muted}; }}
  .duo.two {{ grid-template-columns: 1fr 1fr; }}
  .duo.two > div {{ grid-template-rows: 250px auto auto auto; gap: 4px; }}
  .duo.two .pl {{ height: 250px; }}
  .duo.two span {{ font-size: 32px; font-weight: 700; margin-top: 18px; }}
  .duo.two b {{ font-size: 150px; }}
  .duo.two small {{ font-size: 28px; color: {muted}; }}
  .duo.two + .x, .chart:has(.duo.two) {{ margin-bottom: 26px; }}
  .av-pl-body {{ fill: var(--pc); }} .av-pl-prop {{ fill: var(--pc); opacity: .45; }}
  .note {{ margin: 30px 0 0; font: 400 36px/1.32 "Source Serif 4 Variable", Georgia, serif; color: {ink};
           text-wrap: pretty; }}
  .note b {{ color: {accent}; font-weight: 700; }}
  .ask {{ margin: 30px 0 0; padding: 22px 26px; border-left: 6px solid {accent}; background: #132d47;
          font: 600 31px/1.3 "Source Serif 4 Variable", Georgia, serif; color: {ink}; }}
  .ask span {{ display: block; margin-bottom: 6px; font: 700 24px/1.2 "Archivo Variable", sans-serif;
               color: {muted}; }}
  .foot {{ margin-top: 30px; padding-top: 20px; border-top: 2px solid {rule}; display: flex;
           justify-content: space-between; gap: 24px; font-size: 25px; color: {muted}; }}
  .foot b {{ color: {ink}; font-weight: 700; white-space: nowrap; }}
</style>
<div class="li">
  <div class="top"><span class="mark">aviation<b>data</b></span><span>Enquête n° {no}, « {title} »</span></div>
  <p class="ctx">{ctx}</p>
  <h1>{headline}</h1>
  <div class="chart">{chart}</div>
  <p class="note">{note}</p>
  <p class="ask"><span>L'enquête</span>{ask}</p>
  <div class="foot"><span>Données : {src}</span><b>aviationdata.vercel.app/{slug}</b></div>
</div>
"""


MICRO = """
<style>
  html, body {{ margin: 0; background: {night}; }}
  .li {{ box-sizing: border-box; width: 1080px; height: 1350px; padding: 60px 72px 52px; overflow: hidden;
         display: flex; flex-direction: column; background: {night}; color: {ink};
         font-family: "Archivo Variable", Archivo, system-ui, sans-serif; position: relative;
         background-image: radial-gradient(circle at 85% 30%, #ff4fa833, transparent 45%),
                           linear-gradient(#ffffff08 1px, transparent 1px),
                           linear-gradient(90deg, #ffffff08 1px, transparent 1px);
         background-size: auto, 54px 54px, 54px 54px; }}
  .top {{ display: flex; justify-content: space-between; align-items: center; font-size: 28px; color: {muted}; }}
  .tag {{ padding: 10px 20px; border-radius: 999px; background: {accent}; color: {night}; font-weight: 800;
          font-size: 26px; letter-spacing: 0.08em; text-transform: uppercase; }}
  .mark {{ color: {ink}; }} .mark b {{ font-weight: 800; }}
  h1 {{ margin: 46px 0 0; font-weight: 800; font-stretch: 70%; font-size: 96px; line-height: 0.98;
        text-wrap: balance; letter-spacing: -0.005em; }}
  h1 em {{ font-style: normal; color: {accent}; }}
  .big {{ margin: 34px 0 0; display: flex; align-items: baseline; gap: 26px; }}
  .big b {{ font-weight: 800; font-stretch: 66%; font-size: 220px; line-height: 0.78; color: {accent};
            letter-spacing: -0.02em; }}
  .big span {{ font-size: 42px; font-weight: 700; line-height: 1.1; max-width: 11em; }}
  .viz {{ flex: 1; min-height: 0; display: flex; align-items: center; justify-content: space-between; gap: 40px;
          margin: 26px 0; }}
  .viz figure {{ margin: 0; display: grid; gap: 14px; justify-items: start; }}
  .viz figcaption {{ font-size: 30px; font-weight: 700; color: {muted}; }}
  .viz figcaption b {{ color: {accent}; }}
  .kick {{ margin: 0; font: 600 38px/1.28 "Source Serif 4 Variable", Georgia, serif; text-wrap: pretty; }}
  .kick b {{ color: {accent}; }}
  .foot {{ margin-top: 30px; padding: 22px 28px; border-radius: 14px; background: {ink}; color: {night};
           display: flex; justify-content: space-between; align-items: center; gap: 24px; font-size: 30px;
           font-weight: 700; }}
  .foot b {{ font-weight: 800; white-space: nowrap; }}
  .src {{ margin: 14px 0 0; font-size: 22px; color: {muted}; }}
</style>
<div class="li">
  <div class="top"><span class="tag">{tag}</span><span class="mark">aviation<b>data</b></span></div>
  <h1>{headline}</h1>
  <p class="big"><b>{big}</b><span>{bigsub}</span></p>
  <div class="viz{vizcls}">{chart}</div>
  <p class="kick">{kick}</p>
  <div class="foot"><span>{cta}</span><b>aviationdata.vercel.app/{slug} →</b></div>
  <p class="src">{src}</p>
</div>
"""


# two pictures stacked, no big number: the comparison is the picture
MICRO_DUO = MICRO.replace("""  <p class="big"><b>{big}</b><span>{bigsub}</span></p>\n""", "").replace(
    "</style>",
    """  .viz.duo2 {{ flex: none; display: grid; gap: 16px; margin: 26px 0 22px; }}
  .duo2 .d {{ display: grid; gap: 8px; }}
  .duo2 .dh {{ display: flex; align-items: baseline; justify-content: space-between; gap: 18px; }}
  .duo2 .dh b {{ font: 800 52px/1 "Archivo Variable", sans-serif; font-stretch: 70%; color: {ink}; }}
  .duo2 .dh span {{ font: 700 30px/1.1 "Archivo Variable", sans-serif; color: {muted}; }}
  .duo2 .dh span.hi {{ color: {accent}; }}
  .duo2 .dh span i {{ font-style: normal; font-size: 46px; font-weight: 800; font-stretch: 70%; }}
  .duo2 img {{ display: block; width: 936px; height: 296px; object-fit: cover; object-position: 50% 58%; border-radius: 10px; }}
  .li:has(.duo2) h1 {{ font-size: 80px; margin-top: 34px; }}
  .li:has(.duo2) .src {{ display: none; }}
  .li:has(.duo2) .foot {{ margin-top: 24px; }}
</style>""",
)
assert "{big}" not in MICRO_DUO

JET_PINK = "#ff4fa8"  # magenta OACI on the night (--magenta-hi)
PLANE = "M0 -14 L3 -5 L14 2 L14 5 L3 2 L2 10 L6 13 L6 15 L0 13 L-6 15 L-6 13 L-2 10 L-3 2 L-14 5 L-14 2 L-3 -5 Z"


def shuttle(k):
    """Paris and Geneva, one arc between them, `k` small jets along it: a picture of the daily shuttle."""
    w, h = 936, 290
    x0, x1, y, lift = 90, w - 90, 220, 150
    planes = ""
    for i in range(k):
        t = (i + 0.5) / k
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * (w / 2) + t * t * x1
        yy = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y - 2 * lift) + t * t * y
        dx = 2 * (1 - t) * (w / 2 - x0) + 2 * t * (x1 - w / 2)
        dy = 2 * (1 - t) * (-2 * lift) + 2 * t * (2 * lift)
        ang = math.degrees(math.atan2(dy, dx)) + 90
        planes += (
            f'<path d="{PLANE}" fill="{JET_PINK}" '
            f'transform="translate({x:.1f} {yy:.1f}) rotate({ang:.1f}) scale(1.9)"/>'
        )
    return f"""<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}">
      <path d="M{x0} {y} Q{w / 2} {y - 2 * lift} {x1} {y}" fill="none" stroke="{MUTED}" stroke-width="3"
            stroke-dasharray="4 12" stroke-linecap="round"/>
      <circle cx="{x0}" cy="{y}" r="14" fill="{INK}"/><circle cx="{x1}" cy="{y}" r="14" fill="{INK}"/>
      <text x="{x0}" y="{y + 58}" fill="{INK}" font-size="36" font-weight="800" text-anchor="middle">Paris</text>
      <text x="{x1}" y="{y + 58}" fill="{INK}" font-size="36" font-weight="800" text-anchor="middle">Genève</text>
      {planes}</svg>"""


def card_jets_geneve(t):
    """The first business-jet route from France (chapter 4), and the short-hop share (chapter 3)."""
    n = find(t, r"(\d+ \d{3}) vols en 2022 entre Paris-Le Bourget et Genève", "jets")
    p = find(t, r"Volent-ils loin \? (\d+) % de leurs vols font moins de 500 km", "jets")
    assert 35 <= num(p) < 40, p  # "4 sur 10"
    per_day = int(num(n) / 365)
    return {
        "file": "jets-prives-micro-geneve",
        "tpl": "micro",
        "accent": JET_PINK,
        "tag": "Jets privés",
        "headline": "Paris – Genève en jet privé&nbsp;: <em>combien par jour&nbsp;?</em>",
        "big": str(per_day),
        "bigsub": f"par jour, toute l'année.<br>{n} vols en 2022.",
        "chart": shuttle(per_day),
        "kick": "Et <b>4 vols de jet privé sur 10</b> font moins de 500 km.",
        "cta": "Lire l'enquête",
        "src": "Vols suivis par le réseau OpenSky, Paris-Le Bourget – Genève, 2022. Calculs aviationdata.",
    }


def card_jets_court(t):
    """Short hops: the share of business-jet flights under 500 km (chapter 3, figure 3)."""
    p = find(t, r"Volent-ils loin \? (\d+) % de leurs vols font moins de 500 km", "jets")
    air = find(t, r"Près de deux fois la part des avions de ligne, (\d+) %", "jets")
    assert 35 <= num(p) < 40, p
    return {
        "file": "jets-prives-micro-court",
        "tpl": "micro",
        "accent": JET_PINK,
        "tag": "Jets privés",
        "headline": "Moins de 500 km&nbsp;? <em>On prend le jet.</em>",
        "big": f"{p}&nbsp;%",
        "bigsub": "des vols en jet privé font moins de 500&nbsp;km.",
        "chart": f"""<figure>{dots(round(num(p)), JET_PINK, 26, 7)}
          <figcaption><b>Jets privés</b> : {p} vols sur 100</figcaption></figure>
          <figure>{dots(round(num(air)), MUTED, 26, 7)}
          <figcaption>Avions de ligne : {air} sur 100</figcaption></figure>""",
        "kick": "Près de <b>deux fois plus</b> qu'en avion de ligne.",
        "cta": "Lire l'enquête",
        "src": "Vols suivis par le réseau OpenSky au-dessus de l'Europe, 2022. Calculs aviationdata.",
    }


def card_jets_covid(t):
    """The investigation's opening: business jets per hundred flights, 2019 against June 2020."""
    a = find(t, r"(\d+) sur 100 en 2019", "jets")
    b = find(t, r"(\d+) sur 100 en juin 2020", "jets")
    k = find(t, r"En juin 2020, quand les avions de ligne restaient au sol, un sur (\d+)\.", "jets")
    return {
        "file": "jets-prives-micro-covid",
        "tpl": "micro",
        "accent": JET_PINK,
        "tag": "Covid",
        "headline": "Le monde est confiné.<br><em>Les jets privés volent.</em>",
        "big": f"1/{k}",
        "bigsub": "des vols au-dessus de l'Europe, en juin 2020.",
        "chart": f"""<figure>{dots(int(a), MUTED, 26, 7)}<figcaption>2019 : {a} sur 100</figcaption></figure>
          <figure>{dots(int(b), JET_PINK, 26, 7)}<figcaption><b>Juin 2020 : {b} sur 100</b></figcaption></figure>""",
        "kick": "Ils volent moins qu'en 2019. Mais les avions de ligne, eux, sont <b>cloués au sol</b>.",
        "cta": "Lire l'enquête",
        "src": "Mêmes avions suivis par le réseau OpenSky en 2019 et 2020. Calculs aviationdata.",
    }


def card_cat(t, pg):
    """Clear-air turbulence: the opening of the page, two decades stacked (its own canvases and labels), under the
    paradox of the title; numbers read on the page."""
    strong = find(t, r"Les plus fortes, (\+\d+ %)", "turbulences")
    pg.wait_for_selector("#tc-map1 canvas")
    maps = pg.evaluate("['#tc-map0', '#tc-map1'].map(s => document.querySelector(s + ' canvas').toDataURL('image/png'))")
    heads = pg.evaluate("['#tc-h0', '#tc-h1'].map(s => [...document.querySelector(s).children].map(e => e.textContent))")
    h = [find(norm(x[1]), r"(\d+) heures de ciel très agité par an", "turbulences") for x in heads]
    chart = f"""<div class="d"><div class="dh"><b>{norm(heads[0][0])}</b><span><i>{h[0]}</i> h de ciel très agité par an</span></div>
        <img src="{maps[0]}"></div>
      <div class="d"><div class="dh"><b>{norm(heads[1][0])}</b><span class="hi"><i>{h[1]}</i> h par an, {strong}</span></div>
        <img src="{maps[1]}"></div>"""
    return {
        "file": "turbulences-micro",
        "tpl": "duo",
        "accent": JET_PINK,
        "tag": "Turbulences",
        "headline": "Pas un nuage. <em>Et pourtant, ça secoue de plus en plus.</em>",
        "chart": chart,
        "kick": "Heures où le vent réunit, en un point de l'Atlantique Nord, les conditions des plus fortes turbulences. <b>Invisibles aux radars.</b>",
        "cta": "Lire l'enquête",
        "src": "ERA5 (Copernicus), indice d'Ellrod. Calculs aviationdata.",
    }


def card_hf(t):
    y0, y1 = find(t, r"De (\d{4}) à (?:\d{4}), une personne", "hf"), find(t, r"De \d{4} à (\d{4}), une personne", "hf")
    p = find(t, r"Une personne est citée dans (\d+) % des accidents", "hf")
    air = find(t, r"compagnies aériennes, une personne n'est citée que dans (\d+) %", "hf")
    env = find(t, r"l'environnement dans (\d+) % : \d+ % de leurs accidents sont des turbulences", "hf")
    assert 70 <= num(p) <= 80, p  # "3 sur 4"
    return {
        "accent": "#ff8a3d",
        "ctx": f"Accidents d'avion aux États-Unis, {y0}-{y1}",
        "headline": "Dans 3 accidents d'avion sur 4, les enquêteurs mettent en cause un humain",
        "chart": waffle(
            num(p),
            "#ff8a3d",
            f"<b>{p} %</b>Sur 100 accidents, {p} citent une personne (pilote, mécanicien, contrôleur…) "
            "dans leur cause officielle.",
        ),
        "note": f"Mais dans les compagnies aériennes, c'est <b>{air} %</b> : la météo et les turbulences "
        f"y pèsent autant ({env} %).",
        "ask": "Le facteur humain est-il vraiment la première cause des accidents ?",
        "src": "NTSB, 21 400 accidents",
    }


def card_jet(t):
    w = find(t, r"le vol vers New York dure en médiane (\d+ h \d{2})", "jet")
    e = find(t, r"le retour (\d+ h \d{2})\. Soit", "jet")
    gap = find(t, r"Soit (\d+ h \d{2}) d'écart pour la même distance", "jet")
    kmh = find(t, r"estime le vent à (\d+) km/h au cœur du courant-jet", "jet")
    n = find(t, r"ont suivi (\d+ \d{3}) vols entre la France et l'Amérique du Nord", "jet")

    w, e, gap = (x.replace(" h ", "\u00a0h\u00a0") for x in (w, e, gap))

    def mins(s):
        h, m = s.split("\u00a0h\u00a0")
        return int(h) * 60 + int(m)

    return {
        "accent": "#ffcf7a",
        "ctx": "Vols Paris – New York, 2019-2022",
        "headline": f"Même distance, mais {gap} de plus pour aller à New York que pour en revenir",
        "chart": bars(
            [
                ["Paris → New York", mins(w), w, "#ff6fb6"],
                ["New York → Paris", mins(e), e, "#5aa2ff"],
            ],
            f"Durée médiane du vol, Paris-CDG – New York-JFK ({n} vols suivis entre la France et l'Amérique du Nord).",
        ),
        "note": "En cause : le <b>courant-jet</b>, un vent d'ouest qui souffle à l'altitude des avions de "
        f"ligne. La nuit du 8 février 2020, il atteignait {kmh} km/h.",
        "ask": "Les données météo peuvent-elles aider les compagnies à brûler moins de kérosène ?",
        "src": "OpenSky, ERA5 (Copernicus)",
    }


def card_sea(t):
    hr = find(t, r"en Croatie, un jour d'août compte (\d+,\d) fois plus", "sea")
    fi = find(t, r"En Finlande, à peine (\d+,\d) fois plus", "sea")
    eu = find(t, r"Dans l'Union, (\d+,\d) fois\.", "sea")
    return {
        "accent": "#f2a65a",
        "ctx": "Passagers aériens en Europe, 2025",
        "headline": f"En Croatie, l'été multiplie les passagers aériens par {hr.split(',')[0]}",
        "chart": bars(
            [
                ["Croatie", num(hr), f"×{hr}", "#f2a65a"],
                ["Union européenne", num(eu), f"×{eu}", "#8fb3d0"],
                ["Finlande", num(fi), f"×{fi}", "#5b86a5"],
            ],
            "Passagers d'un jour du mois le plus chargé (août), comparés à un jour du plus creux (janvier).",
        ),
        "note": "Partout en Europe, l'été remplit les avions et janvier les vide. <b>Mais pas au même "
        "rythme</b> : chaque pays a son calendrier.",
        "ask": "Quand l'Europe prend-elle l'avion ? Le calendrier des passagers de 30 pays, depuis 2010.",
        "src": "Eurostat",
    }


def card_eu(t):
    s = find(t, r"ont gagné (\d+,\d) millions de passagers\. Ceux du nord", "eu")
    n = find(t, r"Ceux du nord en ont perdu (\d+,\d) millions", "eu")
    km = find(t, r"Le centre de gravité a glissé de (\d+) km", "eu")
    return {
        "accent": "#ffb547",
        "ctx": "Passagers aériens en Europe, 2019 → 2025",
        "headline": "Après le Covid, le ciel européen a glissé vers le sud",
        "chart": bars(
            [
                ["Aéroports au sud du 45e parallèle", num(s), f"+{s} M", "#ffb547"],
                ["Aéroports au nord", -num(n), f"−{n} M", "#5aa2ff"],
            ],
            "Passagers gagnés ou perdus entre 2019 et 2025. Le 45e parallèle passe près de Bordeaux et de Turin.",
        ),
        "note": f"Le centre de gravité des passagers européens est descendu de <b>{km} km</b> vers le sud en six ans.",
        "ask": "Le transport aérien européen a-t-il effacé le Covid ? Oui, il bat des records. Mais pas partout.",
        "src": "Eurostat",
    }


def card_ciel(t):
    k = find(t, r"([+−]\d+,\d) % vols internationaux depuis 2019", "ciel")
    d = find(t, r"([+−]\d+,\d) % vols intérieurs depuis 2019", "ciel")
    pp = find(t, r"Il en reste (\d+,\d) millions en 2025", "ciel")
    p0 = find(t, r"(\d+,\d) millions de passagers en 2000, leur record", "ciel")
    return {
        "accent": "#8cc4ff",
        "ctx": "Passagers aériens en France, 2019 → 2025",
        "headline": "Le Covid est effacé à l'international, pas sur les vols intérieurs",
        "chart": bars(
            [
                ["Vols internationaux", num(k), f"{k} %", "#5aa2ff"],
                ["Vols intérieurs", num(d), f"{d} %", "#ff6fb6"],
            ],
            "Évolution du nombre de passagers entre 2019 et 2025.",
        ),
        "note": f"Entre Paris et la province, il reste <b>{pp} millions</b> de passagers en 2025, contre "
        f"{p0} millions en 2000.",
        "ask": "Le ciel à deux vitesses : 35 ans de transport aérien français, destinations, prix, CO2.",
        "src": "DGAC",
    }


def card_avions(t, pg):
    a = find(t, r"Airbus A320 \d+,\d % en \d{4} (\d+,\d) %", "avions")
    b = find(t, r"Boeing 737 \d+,\d % en \d{4} (\d+,\d) %", "avions")
    year = find(t, r"Part des vols d'avions de ligne suivis par OpenSky en (\d{4})", "avions")
    both = num(a) + num(b)
    assert 60 <= both < 66.7, both  # "près de deux sur trois"
    rest = f"{100 - both:.1f}".replace(".", ",")
    # the two drawings of figure 1, the same scale for both (FAA lengths and spans)
    svgs = pg.evaluate(
        "[...document.querySelectorAll('#chart-fam .av-bar-pl svg')].slice(0, 2).map(s => s.outerHTML)"
    )
    big = []
    for svg, color in zip(svgs, ("#5aa2ff", "#ff6fb6"), strict=True):
        w = float(re.search(r'width="([\d.]+)"', svg).group(1))
        h = float(re.search(r'height="([\d.]+)"', svg).group(1))
        k = 5.4  # px per metre: both at the same scale
        m = 0.72
        svg = re.sub(r'width="[\d.]+"', f'width="{w / m * k:.0f}"', svg, count=1)
        svg = re.sub(r'height="[\d.]+"', f'height="{h / m * k:.0f}"', svg, count=1)
        big.append(re.sub(r"--pc:[^;\"]+", f"--pc:{color}", svg))
    chart = f"""<div class="duo">
      <div><div class="pl">{big[0]}</div><b style="color:#5aa2ff">{a} %</b><span>des vols en Airbus A320</span></div>
      <div><div class="pl">{big[1]}</div><b style="color:#ff6fb6">{b} %</b><span>des vols en Boeing 737</span></div>
      <div class="others"><div class="pl"></div><b>{rest} %</b><span>pour tous les autres avions réunis</span></div>
    </div>"""
    return {
        "accent": "#ff6fb6",
        "ctx": f"Les vols de ligne dans le monde, en {year}",
        "headline": "Presque deux vols sur trois se font en Airbus A320 ou en Boeing 737",
        "chart": chart,
        "note": "Toutes versions comprises. Les dizaines d'autres modèles, du petit <b>ATR 72</b> "
        "au géant <b>A380</b>, se partagent le reste.",
        "ask": "Quels avions volent le plus, le plus loin, et lesquels arrivent à l'heure ? "
        "Tous les avions de ligne comparés.",
        "src": "OpenSky, BTS, FAA",
    }


def card_avions_retard(t, pg):
    """Same aircraft, two airlines: the A321's on-time share at its best and worst airline (figure 7's table)."""
    rows = pg.evaluate(
        "[...document.querySelector('#chart-sp').parentElement.querySelectorAll('details.data tbody tr')]"
        ".map(tr => [...tr.cells].map(td => td.innerText))"
    )
    model = "Airbus A321"
    vals = []
    for airline, _, models in rows:
        m = re.search(model + r" (\d+) %(?:,|$)", norm(models))
        if m:
            vals.append((int(m.group(1)), norm(airline)))
    vals.sort()
    (lo, a_lo), (hi, a_hi) = vals[0], vals[-1]
    assert hi - lo >= 8, vals
    year = find(t, r"États-Unis, vols intérieurs, (\d{4})", "avions")
    svg = pg.evaluate("document.querySelector('#chart-fam .av-bar-pl svg').outerHTML")  # an A320-family drawing
    w = float(re.search(r'width="([\d.]+)"', svg).group(1))
    h = float(re.search(r'height="([\d.]+)"', svg).group(1))
    k = 5.2 / 0.72  # 5.2 px a metre once drawn
    svg = re.sub(r'width="[\d.]+"', f'width="{w * k:.0f}"', svg, count=1)
    svg = re.sub(r'height="[\d.]+"', f'height="{h * k:.0f}"', svg, count=1)
    one = lambda c: re.sub(r"--pc:[^;\"]+", f"--pc:{c}", svg)  # noqa: E731
    chart = f"""<div class="duo two">
      <div><div class="pl">{one("#5aa2ff")}</div><span>{model} chez {a_hi}</span><b style="color:#5aa2ff">{hi} %</b><small>des vols à l'heure</small></div>
      <div><div class="pl">{one("#ff6fb6")}</div><span>{model} chez {a_lo}</span><b style="color:#ff6fb6">{lo} %</b><small>des vols à l'heure</small></div>
    </div>"""
    return {
        "file": "modeles-d-avions-retard",
        "accent": "#ff6fb6",
        "ctx": "Votre vol a du retard ?",
        "headline": "Même avion. Pas la même ponctualité.",
        "chart": chart,
        "note": f"Vols intérieurs américains, {year}. Pour arriver à l'heure, <b>la compagnie compte plus que l'avion</b>.",
        "ask": "Quels avions volent le plus, le plus loin, et lesquels arrivent à l'heure ? Tous les avions de ligne comparés.",
        "src": "BTS (vols intérieurs américains), OpenSky",
    }


STORIES = [
    ("calendrier-du-ciel", card_sea),
    ("ciel-europeen", card_eu),
    ("facteur-humain", card_hf),
    ("courant-jet", card_jet),
    ("le-ciel-a-deux-vitesses", card_ciel),
    ("modeles-d-avions", card_avions),
    ("modeles-d-avions", card_avions_retard),
    ("turbulences", card_cat),
    ("jets-prives", card_jets_geneve),
    ("jets-prives", card_jets_court),
    ("jets-prives", card_jets_covid),
]

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    pg = browser.new_page(viewport={"width": 1440, "height": 900})
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    for slug, make in STORIES:
        if only and slug != only:
            continue
        pg.goto(f"{base}/{slug}", wait_until="networkidle")
        pg.wait_for_timeout(2500)
        pg.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
        text = norm(pg.inner_text("main"))
        title = norm(pg.inner_text("h1"))
        no = find(norm(pg.inner_text(".issue-kicker")), r"Enquête n° (\d+)", slug)
        c = make(text, pg) if make.__code__.co_argcount == 2 else make(text)
        kind = c.pop("tpl", None)
        c.setdefault("vizcls", " duo2" if kind == "duo" else "")
        script = c.pop("script", None)
        tpl = {"micro": MICRO, "duo": MICRO_DUO}.get(kind, CARD)
        html = tpl.format(night=NIGHT, ink=INK, muted=MUTED, rule=RULE, no=no, title=title, slug=slug, **c)
        card = browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
        card.goto(base + "/", wait_until="networkidle")  # the site's fonts
        card.evaluate("h => { document.body.innerHTML = h; document.body.className = ''; }", html)
        card.evaluate("document.fonts.ready")
        if script:
            card.evaluate(script)
        card.wait_for_timeout(500)
        foot = card.evaluate("document.querySelector('.foot').getBoundingClientRect().bottom")
        card.locator(".li").screenshot(path=str(out / f"{c.get('file', slug)}.png"))
        card.close()
        print(f"{slug}: {c['headline']}" + ("  !! déborde" if foot > 1350 else ""))
    browser.close()
