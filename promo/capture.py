"""Pass 1: film the real charts, scene by scene, frame by frame, as transparent PNGs.

Time inside the page is faked (Playwright clock), so every animation (globe, d3 transitions,
the carrier race) advances exactly 1/FPS per frame, whatever the capture speed. Only the chart
itself is kept (page chrome, controls and backgrounds are hidden), so the film can lay it out freely.

    python3 promo/capture.py [--url http://127.0.0.1:4173/] [--only race,prix]
Writes promo/out/raw/<scene>/0000.png ... and meta.json (size, values read per frame).
"""

import json
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from scenes import FPS, SCENES

ROOT = Path(__file__).parent
RAW = ROOT / "out" / "raw"
url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None

# keep the charts, drop everything that makes it look like a web page
FILM_CSS = """
html, body, main, .chapter, .panel, .graphic, .chart, .sticky, .story-graphic, .hero-globe {
  background: transparent !important; box-shadow: none !important; }
.panel { border-color: transparent !important; }
.overlay-year, .overlay-legend, #tooltip, .masthead { visibility: hidden !important; }
"""


def center(page, sel):
    page.evaluate(
        """s => { const r = document.querySelector(s).getBoundingClientRect();
           window.scrollTo(0, window.scrollY + r.top - (innerHeight - r.height) / 2); }""",
        sel,
    )


def clip_of(page, sel):
    r = page.evaluate(
        "s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }",
        sel,
    )
    return {"x": r[0], "y": r[1], "width": r[2], "height": r[3]}


def set_slider(page, slider, i):
    page.evaluate(
        """([s, i]) => { const r = document.querySelector(s); if (+r.value === i) return;
           r.value = i; r.dispatchEvent(new Event('input')); }""",
        [slider, i],
    )


def ease(t):
    return t * t * (3 - 2 * t)


def tick(page, sc, t, ctx):
    """Called before each frame with the scene time t (seconds)."""
    name, dur = sc["id"], sc["dur"]
    if name == "france":
        lo, hi = ctx["fr_lo"], ctx["fr_hi"]
        k = ease(min(1, max(0, (t - 0.3) / (dur - 1.2))))
        set_slider(page, "#france-slider", round(lo + (hi - lo) * k))


def context(page):
    """Slider indices the choreography needs, read from the live page."""
    return page.evaluate(
        """() => { const find = (s, o, pred) => { const r = document.querySelector(s), out = document.querySelector(o);
             const keep = +r.value; let hit = null;
             for (let i = 0; i <= +r.max; i++) { r.value = i; r.dispatchEvent(new Event('input'));
               if (hit === null && pred(out.textContent.trim())) hit = i; }
             r.value = keep; r.dispatchEvent(new Event('input')); return [hit, +r.max]; };
           const fr = find('#france-slider', '#france-out', (v) => v === '2000');
           return { fr_lo: fr[0], fr_hi: fr[1] }; }"""
    )


def prepare(page, sc):
    """Per-scene state before the first frame: CSS overrides, view switches, scroll."""
    page.evaluate(
        """css => { let s = document.getElementById('scene-css');
           if (!s) { s = document.createElement('style'); s.id = 'scene-css'; document.head.append(s); }
           s.textContent = css; }""",
        sc.get("css", ""),
    )
    page.clock.run_for(400)  # ResizeObservers redraw the chart at its film width
    for js in sc.get("before", []):  # view switches happen off screen, before the chart is revealed
        page.evaluate(js)
        page.clock.run_for(200)
    center(page, sc["target"])


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"])
    page = b.new_page(viewport={"width": 1400, "height": 1200}, device_scale_factor=2)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.clock.install()
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.clock.pause_at(page.evaluate("Date.now()") + 500)
    page.add_style_tag(content=FILM_CSS)
    page.clock.run_for(1500)
    ctx = context(page)
    page.evaluate("window.scrollTo(0, 0)")
    page.clock.run_for(6000)  # the globe starts turning on its own after 5 s without interaction
    # film in page order, so that a chart never plays its entrance animation before its own scene
    for sc in sorted((s for s in SCENES if s.get("target")), key=lambda s: s["order"]):
        name, dur, speed = sc["id"], sc["dur"], sc.get("speed", 1)
        if only and name not in only:
            continue
        out = RAW / name
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir(parents=True)
        prepare(page, sc)
        page.clock.run_for(sc.get("settle", 120))
        # charts above may still resize after the scene CSS changed: centre again until the target sits in view
        for _ in range(4):
            center(page, sc["target"])
            page.clock.run_for(150)
            clip = clip_of(page, sc["target"])
            if clip["y"] >= 0 and clip["y"] + clip["height"] <= page.viewport_size["height"]:
                break
        n = round(dur * FPS)
        live = []
        for f in range(n):
            tick(page, sc, f / FPS, ctx)
            page.clock.run_for(round(1000 / FPS * speed))
            page.screenshot(path=str(out / f"{f:04d}.png"), clip=clip, omit_background=True)
            if sc.get("live"):
                live.append(page.evaluate(sc["live"]))
        meta = {"w": clip["width"], "h": clip["height"]}
        if live:
            meta["live"] = live
        (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False))
        print(f"{name}: {n} frames, {clip['width']:.0f}x{clip['height']:.0f}")
    print("errors:", errors or "none")
    b.close()
