"""Social preview of « Le ciel, modèle par modèle » (og-avions.jpg, 1200 x 630): its title and the hundred
flights of its opening, read from the page itself.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_avions.py [--base http://127.0.0.1:4173]
Writes web/public/og-avions.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
out = Path(__file__).resolve().parents[1] / "public" / "og-avions.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(f"{base}/modeles-d-avions", wait_until="networkidle")
    page.add_style_tag(
        content=".masthead, .av-open .issue-kicker { display: none !important; }"
        " .av-open { height: 630px; box-sizing: border-box; padding-block: 0 !important; overflow: hidden; display: flex; align-items: center; }"
        " .av-open-grid { width: 100%; }"
        " .av-open-grid { grid-template-columns: 5fr 6fr !important; align-items: center !important; }"
        " .av-open .display { font-size: 78px; }"
    )
    page.wait_for_timeout(1200)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
