"""Social preview of the European story (og-eu.jpg, 1200 x 630): its title and the map of the airports.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_eu.py [--url http://127.0.0.1:4173/ciel-europeen]
Writes web/public/og-eu.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/ciel-europeen"
out = Path(__file__).resolve().parents[1] / "public" / "og-eu.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(url, wait_until="networkidle")
    # no masthead, no slider, no caption: the title and the map fill the card
    page.add_style_tag(
        content=".masthead, .eu-years, .eu-open-map .note, .eu-open-map .source-line { display: none !important; }"
        " .eu-open { height: 630px; padding-block: 24px 0 !important; box-sizing: border-box; }"
        " .eu-open-grid { grid-template-columns: 4fr 6fr !important; align-items: center !important; }"
    )
    page.wait_for_timeout(2500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=86)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
