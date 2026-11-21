"""LinkedIn covers of the videos (1080 x 1350) from cover.html: python3 promo/cover.py [retards oiseaux]

Writes promo/out/<name>-miniature-4x5.jpg (not versioned). The footage stills come from reel_footage.py --config
promo/<name>.json (promo/out/<name>/bg/).
"""

import functools
import http.server
import sys
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
names = sys.argv[1:] or ["retards", "oiseaux"]
# serve the repository root: cover.html reads the fonts from web/node_modules and the data from web/public
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT.parent))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    for name in names:
        page = b.new_page(viewport={"width": 1080, "height": 1350})
        page.goto(f"http://127.0.0.1:{server.server_address[1]}/promo/cover.html?v={name}", wait_until="networkidle")
        page.wait_for_function("window.done === true")
        png = ROOT / "out" / f"{name}-miniature-4x5.png"
        page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": 1080, "height": 1350})
        Image.open(png).convert("RGB").save(png.with_suffix(".jpg"), quality=92)
        png.unlink()
        print("written", png.with_suffix(".jpg"))
    b.close()
server.shutdown()
