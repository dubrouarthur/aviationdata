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
    page.add_style_tag(
        content=".masthead, .tc-open .issue-kicker, .tc-open .open-q, .tc-open-cap { display: none !important; }"
        " .tc-open { height: 630px; box-sizing: border-box; padding-block: 0 !important; overflow: hidden; position: relative; }"
        " .tc-open-fig { position: absolute; inset: 0; margin: 0 !important; padding: 0 !important; max-width: none !important; }"
        " .tc-open-map { border-radius: 0 !important; height: 630px; }"
        " .tc-open-map canvas { height: 630px !important; width: auto !important; margin-left: -250px; }"
        " .tc-open > .wrap { position: relative; z-index: 2; padding-top: 52px; }"
        " .tc-open .display { font-size: 92px; max-width: 9ch; color: #14202e; background: rgba(243,245,242,.9); padding: 14px 22px; display: inline-block; }"
    )
    page.wait_for_timeout(1200)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
