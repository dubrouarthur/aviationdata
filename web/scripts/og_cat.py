# ruff: noqa: E501  (the page CSS of the shot is long)
"""Social preview of « Le ciel clair est-il plus agité ? » (og-cat.jpg, 1200 x 630): its title over the winter map
of its opening, read from the page itself.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_cat.py [--base http://127.0.0.1:4173]
Writes web/public/og-cat.jpg (rebuild afterwards so dist gets it). PW_CHROMIUM points at an installed browser.
"""

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
out = Path(__file__).resolve().parents[1] / "public" / "og-cat.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    page = browser.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(f"{base}/turbulences", wait_until="networkidle")
    page.wait_for_selector("#tc-map1 canvas")
    page.evaluate("window.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(800)
    # the two decades of the opening, side by side, read from the page's own canvases and labels
    maps = page.evaluate("['#tc-map0', '#tc-map1'].map(s => document.querySelector(s + ' canvas').toDataURL('image/png'))")
    heads = page.evaluate("['#tc-h0', '#tc-h1'].map(s => [...document.querySelector(s).children].map(e => e.textContent))")
    title = page.inner_text("h1")
    import re

    strong = re.search(r"Les plus fortes, (\+\d+\s%)", page.inner_text("#essentiel-list")).group(1)
    page.goto(f"{base}/", wait_until="networkidle")  # the site's fonts
    cell = lambda url, head, hi: f"""<div style="width:552px">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:10px">
        <b style="font:800 44px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:#e8eef4">{head[0]}</b>
        <span style="font:650 21px/1.2 'Archivo Variable',Archivo,sans-serif;color:{'#f59ac8' if hi else '#a6b6c6'}">{head[1]}</span></div>
      <img src="{url}" style="display:block;width:552px;border-radius:8px"></div>"""  # noqa: E731
    page.evaluate(
        "h => { document.body.innerHTML = h; document.body.className = ''; document.body.style.margin = 0; }",
        f"""<div style="width:1200px;height:630px;box-sizing:border-box;padding:44px 40px;background:#0e1b2c;
             background-image:linear-gradient(rgba(166,182,198,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(166,182,198,.13) 1px,transparent 1px);
             background-size:100% 88px,88px 100%">
          <div style="font:800 64px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:#e8eef4">{title}</div>
          <div style="font:600 24px/1.3 'Archivo Variable',Archivo,sans-serif;color:#f59ac8;margin:12px 0 30px">
            Turbulences en air clair au-dessus de l'Atlantique, deux décennies comparées</div>
          <div style="display:flex;gap:16px">{cell(maps[0], heads[0], False)}{cell(maps[1], heads[1], True)}</div>
          <div style="display:flex;align-items:baseline;gap:18px;margin-top:22px">
            <b style="font:800 76px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:70%;color:#f59ac8">{strong}</b>
            <span style="font:650 26px/1.25 'Archivo Variable',Archivo,sans-serif;color:#e8eef4">de conditions propices aux fortes turbulences, d'une décennie à l'autre</span></div>
        </div>""",
    )
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
