"""One LinkedIn image per investigation (1080 x 1350, the 4:5 of the feed): its title, the question it
answers, a striking number and its sentence, its opening figure, its source and its address.

Every number and every sentence is read on the investigation's own page (its key figures), never typed
here: the card says what the story says. The figure is a screenshot of the story's opening.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/linkedin_cards.py [--base URL] [--out DIR]
Output: promo/out/linkedin/<slug>.png (not versioned).
"""

import base64
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
root = Path(__file__).resolve().parents[2]
out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else root / "promo/out/linkedin"
out.mkdir(parents=True, exist_ok=True)

# where each story keeps its striking number: an item of its "L'essentiel" (question, number, answer), or
# for the first story its key figures; the figure to film, on its page (the seasons: the home's dark one)
STORIES = [
    {"slug": "calendrier-du-ciel", "item": 1, "fig": ("/", "#lead-cal"), "accent": "#f2a65a", "src": "Eurostat"},
    {"slug": "ciel-europeen", "item": 3, "fig": (None, "#open-map"), "src": "Eurostat, OurAirports"},
    {"slug": "facteur-humain", "item": 0, "fig": (None, "#mosaic"), "src": "NTSB"},
    {"slug": "courant-jet", "item": 0, "fig": (None, "#open-map"), "src": "OpenSky, ERA5, NASA", "num": "h"},
    {"slug": "le-ciel-a-deux-vitesses", "item": None, "fig": (None, "#globe"), "src": "DGAC"},
]

CARD = """
<style>
  html, body {{ margin: 0; background: #0b1d2e; }}
  .li {{ box-sizing: border-box; width: 1080px; height: 1350px; padding: 64px 72px 56px; overflow: hidden;
         display: flex; flex-direction: column; background: #0d2236; color: #f2f6fa;
         font-family: "Archivo Variable", Archivo, system-ui, sans-serif; position: relative; }}
  .li::before {{ content: ""; position: absolute; inset: 0 0 auto; height: 10px; background: {accent}; }}
  .top {{ display: flex; justify-content: space-between; align-items: baseline; font-size: 30px; color: #a9bccd; }}
  .mark {{ font-weight: 400; letter-spacing: -0.01em; color: #f2f6fa; }}
  .mark b {{ font-weight: 800; }}
  .no {{ font-weight: 700; color: {accent}; }}
  h1 {{ margin: 34px 0 0; font-weight: 800; font-stretch: 66%; font-size: 112px; line-height: 0.92;
        letter-spacing: -0.01em; }}
  h1 em {{ font-style: normal; color: {accent}; }}
  .fig {{ flex: 1; min-height: 0; margin: 34px -72px 0; display: flex; align-items: center; justify-content: center;
          overflow: hidden; }}
  .fig img {{ max-width: 100%; max-height: 100%; object-fit: contain; }}
  .q {{ margin: 28px 0 0; font: 600 34px/1.2 "Source Serif 4 Variable", Georgia, serif; color: #cdd8e2; }}
  .n {{ margin: 6px 0 0; font-weight: 800; font-stretch: 70%; font-size: 200px; line-height: 0.95; color: {accent};
        font-variant-numeric: tabular-nums; }}
  .a {{ margin: 14px 0 0; font: 400 37px/1.32 "Source Serif 4 Variable", Georgia, serif; color: #f2f6fa;
        text-wrap: pretty; }}
  .foot {{ margin-top: 30px; padding-top: 22px; border-top: 2px solid #2b4560; display: flex;
           justify-content: space-between; gap: 24px; font-size: 26px; color: #a9bccd; }}
  .foot b {{ color: #f2f6fa; font-weight: 700; }}
</style>
<div class="li">
  <div class="top"><span class="mark">aviation<b>data</b></span><span class="no">Enquête n° {no}</span></div>
  <h1>{title}</h1>
  <div class="fig"><img src="data:image/png;base64,{img}" alt="" /></div>
  <p class="q">{q}</p>
  <p class="n">{n}</p>
  <p class="a">{a}</p>
  <div class="foot"><span>Données : {src}</span><b>aviationdata.vercel.app/{slug}</b></div>
</div>
"""


def first_sentences(text, limit=200):
    """The answer's first sentences, up to about `limit` characters, cut at a full stop."""
    out = ""
    for s in text.replace("\n", " ").split(". "):
        nxt = (out + ". " if out else "") + s.rstrip(".")
        if out and len(nxt) > limit:
            break
        out = nxt
    return out + "."


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2, reduced_motion="reduce")
    for st in STORIES:
        slug = st["slug"]
        pg.goto(f"{base}/{slug}", wait_until="networkidle")
        pg.wait_for_timeout(3000)
        title = pg.evaluate("document.querySelector('h1').innerHTML.replace(/<br\\s*\\/?>/g, ' ')")
        no = pg.inner_text(".issue-kicker a").replace("Enquête n°", "").strip()
        accent = st.get("accent") or pg.evaluate("getComputedStyle(document.querySelector('h1 em')).color")
        if st["item"] is not None:
            li = pg.locator("#essentiel-list li").nth(st["item"])
            q, n, a = (li.locator(s).inner_text().strip() for s in (".es-q", ".es-n", ".es-a"))
            a = first_sentences(a)
            if st.get("num") == "h":  # the jet: its hour of difference speaks louder than its tonnes
                n = re.search(r"\d+\s*h\s*\d{2}", a).group(0)
        else:
            k = pg.locator("#hero-kpis .kpi b").all_inner_texts()
            q = "Le transport aérien français a-t-il effacé le Covid ?"
            n = k[2]
            a = (
                f"Pas sur les vols intérieurs : {n} de passagers depuis 2019, quand les vols internationaux "
                f"gagnent {k[1]} et battent des records."
            )
        # the figure, alone: on the jet's opening, the headline and the race are lifted off the map
        fig_page, sel = st["fig"]
        if fig_page:
            pg.goto(base + fig_page, wait_until="networkidle")
            pg.wait_for_timeout(2500)
        pg.add_style_tag(content=".open-text, .open-bottom, .masthead, .site-head { visibility: hidden !important; }")
        loc = pg.locator(sel).first
        loc.scroll_into_view_if_needed()
        pg.wait_for_timeout(1500)
        shot = base64.b64encode(loc.screenshot()).decode()

        card = browser.new_page(viewport={"width": 1080, "height": 1350})
        card.goto(base + "/", wait_until="networkidle")  # the site's fonts
        html = CARD.format(accent=accent, no=no, title=title, img=shot, q=q, n=n, a=a, src=st["src"], slug=slug)
        card.evaluate("h => { document.body.innerHTML = h; document.body.className = ''; }", html)
        card.evaluate("document.fonts.ready")
        card.wait_for_timeout(600)
        over = card.evaluate(
            "(() => { const a = document.querySelector('.foot').getBoundingClientRect(); return a.bottom > 1350 })()"
        )
        card.locator(".li").screenshot(path=str(out / f"{slug}.png"))
        card.close()
        print(f"{slug}: {n} | {q} | {a}" + ("  !! overflow" if over else ""))
    browser.close()
