# ruff: noqa: E501  (the HTML of the shot is long)
"""Social preview of « Qui retarde les avions en Europe ? » (og-atfm.jpg, 1200 x 630): its title, its three opening
numbers and the calendar of every day since 2014, read from the page itself.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_atfm.py [--base http://127.0.0.1:4173]
Writes web/public/og-atfm.jpg (rebuild afterwards so dist gets it). PW_CHROMIUM points at an installed browser.
"""

import base64
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
out = Path(__file__).resolve().parents[1] / "public" / "og-atfm.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    page = browser.new_page(viewport={"width": 1180, "height": 900}, device_scale_factor=2)
    page.goto(f"{base}/retards", wait_until="networkidle")
    page.wait_for_selector("#rt-open-cal svg rect")
    page.wait_for_timeout(800)
    cal = base64.b64encode(page.locator("#rt-open-cal").screenshot()).decode()
    stats = page.evaluate("[...document.querySelectorAll('#rt-open-stats .ck-stat')].map(e => [e.querySelector('b').textContent, e.querySelector('span').textContent])")
    title = page.inner_text("h1")
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.goto(f"{base}/", wait_until="networkidle")  # the site's fonts
    cells = "".join(
        f"""<div><b style="display:block;font:800 54px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:{'#f59ac8' if i == 2 else '#e8eef4'}">{v}</b>
        <span style="font:500 19px/1.25 'Archivo Variable',Archivo,sans-serif;color:#a6b6c6">{lab}</span></div>"""
        for i, (v, lab) in enumerate(stats)
    )
    page.evaluate(
        "h => { document.body.innerHTML = h; document.body.className = ''; document.body.style.margin = 0; }",
        f"""<div style="width:1200px;height:630px;box-sizing:border-box;padding:38px 40px;background:#0e1b2c;overflow:hidden;
             background-image:linear-gradient(rgba(166,182,198,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(166,182,198,.13) 1px,transparent 1px);
             background-size:100% 88px,88px 100%">
          <div style="font:800 66px/1 'Archivo Variable',Archivo,sans-serif;font-stretch:72%;color:#e8eef4">{title}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:24px 0 20px">{cells}</div>
          <img src="data:image/png;base64,{cal}" style="display:block;width:1120px">
        </div>""",
    )
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
