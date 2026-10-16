"""Screenshot the story at given anchors / scroll steps (light, desktop + mobile).

    python3 web/scripts/story_shots.py OUT_DIR "selector[,selector...]" [--mobile] [--url URL]
Each selector is scrolled to the middle of the viewport before the shot. Prints console errors.
"""

import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

out = Path(sys.argv[1])
sels = sys.argv[2].split(",")
mobile = "--mobile" in sys.argv
url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    vp = {"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900}
    page = b.new_page(viewport=vp, device_scale_factor=1)
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    for k, sel in enumerate(sels):
        page.evaluate(
            "s => { const el = document.querySelector(s); if (el) { const r = el.getBoundingClientRect(); "
            "window.scrollTo(0, window.scrollY + r.top - window.innerHeight / 2 + Math.min(r.height, 200) / 2); } }",
            sel,
        )
        page.wait_for_timeout(1900)
        slug = re.sub(r"[^A-Za-z0-9_-]+", "_", sel.strip("#."))[:28]
        name = f"{'m' if mobile else 'd'}{k:02d}-{slug}.png"
        page.screenshot(path=str(out / name))
        print("shot", name)
    print("errors:", errors or "none")
    b.close()
