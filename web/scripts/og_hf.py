"""Social preview of the human-factor story (og-hf.jpg, 1200 x 630): its opening, title and mosaic.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_hf.py [--url http://127.0.0.1:4173/facteur-humain]
Writes web/public/og-hf.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/facteur-humain"
out = Path(__file__).resolve().parents[1] / "public" / "og-hf.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900})
    page.goto(url, wait_until="networkidle")
    # no masthead, no question, no caption: the title, the count and the squares fill the card
    page.add_style_tag(
        content=".masthead, .hf-open .open-q, .hf-mosaic-cap { display: none !important; }"
        " .hf-open { min-height: 630px; padding-block: 104px 40px !important; box-sizing: border-box; }"
        " .hf-open-grid { align-items: center !important; }"
    )
    page.wait_for_timeout(5000)  # the squares light up
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=86)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
