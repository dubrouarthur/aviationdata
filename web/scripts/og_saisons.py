"""Social preview of the seasons story (og-saisons.jpg, 1200 x 630): its title and the calendar.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_saisons.py [--url http://127.0.0.1:4173/calendrier-du-ciel]
Writes web/public/og-saisons.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/calendrier-du-ciel"
out = Path(__file__).resolve().parents[1] / "public" / "og-saisons.jpg"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(url, wait_until="networkidle")
    # no masthead, no controls, no captions: the title and the calendar fill the card
    page.add_style_tag(
        content=".masthead, .sea-controls, .sea-readout, .sea-cal .note, .sea-cal .source-line, .sea-cal .fig-no,"
        " .sea-cal .data, .cal-key { display: none !important; }"
        " .sea-open { height: 630px; padding-block: 30px 0 !important; box-sizing: border-box;"
        " overflow: hidden; border: 0; }"
        " .sea-open-grid { grid-template-columns: 4fr 7fr !important; align-items: center !important; }"
        " .sea-open-text { position: static !important; }"
        " .sea-cal { zoom: 0.84; border-top: 0 !important; }"
    )
    page.wait_for_timeout(1500)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=86)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
