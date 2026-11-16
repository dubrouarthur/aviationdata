# ruff: noqa: E501  (the page CSS of the shot is long)
"""Social preview of « Le ciel des jets privés » (og-jets.jpg, 1200 x 630): its title and the hundred flights
of its opening (before, during and after the Covid), read from the page itself.

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_jets.py [--base http://127.0.0.1:4173]
Writes web/public/og-jets.jpg (rebuild afterwards so dist gets it).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
out = Path(__file__).resolve().parents[1] / "public" / "og-jets.jpg"
chrome = "/usr/bin/google-chrome"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome) if Path(chrome).exists() else p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(f"{base}/jets-prives", wait_until="networkidle")
    page.wait_for_selector("#jp-open-big .jp-dots")
    page.add_style_tag(
        content=".masthead, .jp-open .issue-kicker, .jp-open .open-q, .jp-open-cap { display: none !important; }"
        " .jp-open { height: 630px; box-sizing: border-box; padding-block: 0 !important; overflow: hidden; display: flex; align-items: center; }"
        " .jp-open-grid { width: 100%; grid-template-columns: 4fr 7fr !important; align-items: center !important; }"
        " .jp-open .display { font-size: 84px; }"
        " .jp-open-big { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; max-width: 660px !important; }"
        " .jp-dots-h b { white-space: nowrap; }"
        " .jp-dots-g { max-width: 260px; }"
    )
    page.wait_for_timeout(800)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
    browser.close()
print(f"{out.name}: {out.stat().st_size // 1024} KB")
