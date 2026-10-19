"""Pass 2: compose the film (film.html + frames from capture.py) and encode it with ffmpeg.

    python3 promo/render.py [--out promo/out/le-ciel-a-deux-vitesses.mp4] [--stills 1.0,5.2,...]
    python3 promo/render.py --page reel.html --size 1080x1350 --out promo/out/reel-4x5.mp4
--stills writes PNG previews at the given times instead of encoding the video.
--page/--size render another composition, such as the 4:5 reel (reel.html, frames from
capture.py --theme dark and reel_footage.py).
"""

import functools
import http.server
import subprocess
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
out = (
    Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "out" / "le-ciel-a-deux-vitesses.mp4"
)
stills = [float(x) for x in sys.argv[sys.argv.index("--stills") + 1].split(",")] if "--stills" in sys.argv else None
page_name = sys.argv[sys.argv.index("--page") + 1] if "--page" in sys.argv else "film.html"
vw, vh = map(int, (sys.argv[sys.argv.index("--size") + 1] if "--size" in sys.argv else "1920x1080").split("x"))

# serve the repository root: film.html reads the dashboard fonts from web/node_modules
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT.parent))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}/promo/{page_name}"

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": vw, "height": vh})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base, wait_until="networkidle")
    info = page.evaluate("window.ready")
    total, fps = info["total"], info["fps"]
    if stills:
        for t in stills:
            page.evaluate("t => window.render(t)", t)
            page.screenshot(path=str(ROOT / "out" / f"{Path(page_name).stem}-still-{t:05.2f}.png"))
        print("stills written", errors or "")
    else:
        n = round(total * fps)
        ff = subprocess.Popen(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
                "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", str(out),
            ],
            stdin=subprocess.PIPE,
        )  # fmt: skip
        for f in range(n):
            page.evaluate("t => window.render(t)", f / fps)
            ff.stdin.write(page.screenshot(type="png"))
            if f % 150 == 0:
                print(f"frame {f}/{n}", flush=True)
        ff.stdin.close()
        ff.wait()
        print(f"{out} ({n} frames, {total:.1f} s)", errors or "")
    b.close()
server.shutdown()
