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
    page.wait_for_selector("#tc-open-map canvas")
    page.evaluate("window.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(800)
    # the winter map of the opening, drawn by the page, then the title over it on a page of its own
    url = page.evaluate("document.querySelector('#tc-open-map canvas').toDataURL('image/png')")
    title = page.inner_text("h1")
    page.goto(f"{base}/", wait_until="networkidle")  # the site's fonts
    page.evaluate(
        "h => { document.body.innerHTML = h; document.body.className = ''; document.body.style.margin = 0; }",
        f"""<div style="position:relative;width:1200px;height:630px;overflow:hidden;background:#f3f5f2">
        <img src="{url}" style="position:absolute;left:-200px;top:-60px;width:1620px">
        <div style="position:absolute;left:44px;bottom:48px;background:rgba(14,27,44,.94);color:#e8eef4;padding:20px 30px 24px;
             font:800 76px/1 'Archivo Variable', Archivo, system-ui, sans-serif;font-stretch:72%;max-width:760px;letter-spacing:-.005em">{title}
          <div style="font:600 26px/1.3 'Archivo Variable', Archivo, system-ui, sans-serif;color:#f59ac8;margin-top:14px">Turbulences en air clair, 1979-2022</div></div>
        </div>""",
    )
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
