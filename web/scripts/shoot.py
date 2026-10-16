"""Screenshot the built site (dist/) in several themes/viewports and report console errors.

    python3 web/scripts/shoot.py OUT_DIR [--url http://127.0.0.1:4173/]
Serve web/dist first (e.g. python3 -m http.server 4173 -d web/dist).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

out = Path(sys.argv[1])
url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
out.mkdir(parents=True, exist_ok=True)
CASES = [
    ("desktop-dark", 1440, 900, "dark"),
    ("desktop-light", 1440, 900, "light"),
    ("mobile-dark", 390, 844, "dark"),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h, scheme in CASES:
        ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, device_scale_factor=1)
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m, e=errors: m.type == "error" and e.append(m.text))
        page.on("pageerror", lambda exc, e=errors: e.append(str(exc)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1800)
        page.screenshot(path=str(out / f"{name}-top.png"))
        page.screenshot(path=str(out / f"{name}-full.png"), full_page=True)
        print(name, "errors:", errors or "none", "height:", page.evaluate("document.body.scrollHeight"))
        ctx.close()
    b.close()
