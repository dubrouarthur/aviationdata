"""Social preview of the jet-stream story (og-jet.jpg, 1200 x 630): its opening map, filmed live.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_jet.py [--url http://127.0.0.1:4173/courant-jet]
Writes web/public/og-jet.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/courant-jet"
out = Path(__file__).resolve().parents[1] / "public" / "og-jet.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900})
    page.goto(url, wait_until="networkidle")
    # no masthead, no legend: the map and the title fill the card
    page.add_style_tag(
        content=".masthead, .open-legend { display: none !important; }"
        " .jet-open { height: 630px !important; min-height: 0 !important; }"
        " .open-text { padding-top: 150px !important; }"
    )
    page.wait_for_timeout(4500)  # let the particles draw their trails
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=86)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
