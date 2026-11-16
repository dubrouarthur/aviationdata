# ruff: noqa: E501  (the HTML of the shot is long)
"""Social preview of « D'où vient le kérosène des avions européens ? » (og-kero.jpg, 1200 x 630): its title, the two
flow maps of its opening (before and after Hormuz) and the Gulf's share, read from the page itself.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_kero.py [--base http://127.0.0.1:4173]
Writes web/public/og-kero.jpg (rebuild afterwards so dist gets it). PW_CHROMIUM points at an installed browser.
"""

import base64
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
out = Path(__file__).resolve().parents[1] / "public" / "og-kero.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    page.goto(f"{base}/kerosene", wait_until="networkidle")
    page.wait_for_selector("#kr-map1 svg")
    page.wait_for_timeout(800)
    maps = [base64.b64encode(page.locator(s).screenshot()).decode() for s in ("#kr-map0", "#kr-map1")]
    heads = page.evaluate("['#kr-h0', '#kr-h1'].map(s => [...document.querySelector(s).children].map(e => e.textContent))")
    title = page.inner_text("h1")
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.goto(f"{base}/", wait_until="networkidle")  # the site's fonts

    def cell(img, head, hi):
        return f"""<div style="width:552px">
          <div style="margin-bottom:8px"><b style="font:800 40px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:#e8eef4">{head[0]}</b>
          <div style="font:650 20px/1.3 'Archivo Variable',Archivo,sans-serif;margin-top:6px;color:{'#f59ac8' if hi else '#a6b6c6'}">{head[1]}</div></div>
          <img src="data:image/png;base64,{img}" style="display:block;width:552px;border-radius:8px"></div>"""

    page.evaluate(
        "h => { document.body.innerHTML = h; document.body.className = ''; document.body.style.margin = 0; }",
        f"""<div style="width:1200px;height:630px;box-sizing:border-box;padding:40px;background:#0e1b2c;
             background-image:linear-gradient(rgba(166,182,198,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(166,182,198,.13) 1px,transparent 1px);
             background-size:100% 88px,88px 100%">
          <div style="font:800 60px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:#e8eef4;margin-bottom:26px">{title}</div>
          <div style="display:flex;gap:16px">{cell(maps[0], heads[0], False)}{cell(maps[1], heads[1], True)}</div>
        </div>""",
    )
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
