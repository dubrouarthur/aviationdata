"""Render the LinkedIn thumbnail (1920x1080) from thumb.html: python3 promo/thumb.py"""

import functools
import http.server
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
# serve the repository root: thumb.html reads the dashboard fonts from web/node_modules
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT.parent))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1920, "height": 1080})
    page.goto(f"http://127.0.0.1:{server.server_address[1]}/promo/thumb.html", wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    png = ROOT / "out" / "miniature-linkedin.png"
    page.screenshot(path=str(png))
    b.close()
server.shutdown()
Image.open(png).convert("RGB").save(ROOT / "out" / "miniature-linkedin.jpg", quality=92)
print("written", png.with_suffix(".jpg"))
