"""Accessibility of every page: axe-core (web/node_modules/axe-core, a dev dependency) run on each page
built in web/dist, in the light theme and in the dark one, then on a phone. A page counts once its
scripts have written it and it has been scrolled to the end (charts drawn when they come into view).
Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_a11y.py [--base http://127.0.0.1:4173] [--only /jets-prives]

Exit 1 on any violation.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
AXE = (ROOT / "node_modules" / "axe-core" / "axe.min.js").read_text()

# every page of the build, at its clean address; the 404 page at an address that does not exist
pages = sorted(
    "/" + p.parent.relative_to(ROOT / "dist").as_posix() if p.parent != ROOT / "dist" else "/"
    for p in (ROOT / "dist").rglob("index.html")
    if "assets" not in p.parts
)
pages.append("/adresse-inexistante")
if only:
    pages = [p for p in pages if p == only]

RUN = """async () => {
  const r = await axe.run(document, { resultTypes: ["violations"] });
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(" ") + " | " + (n.failureSummary || "").split("\\n").slice(1, 2).join("")),
    count: v.nodes.length,
  }));
}"""

failures = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for label, options in (
        ("light", {"viewport": {"width": 1280, "height": 900}, "color_scheme": "light"}),
        ("dark", {"viewport": {"width": 1280, "height": 900}, "color_scheme": "dark"}),
        (
            "phone",
            {"viewport": {"width": 390, "height": 844}, "color_scheme": "light", "is_mobile": True, "has_touch": True},
        ),
    ):
        ctx = browser.new_context(**options)
        for path in pages:
            pg = ctx.new_page()
            pg.goto(base + path, wait_until="networkidle")
            pg.wait_for_timeout(1200)
            pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            pg.wait_for_timeout(800)
            pg.add_script_tag(content=AXE)
            found = pg.evaluate(RUN)
            where = f"{label} {path}"
            print(("PASS " if not found else "FAIL ") + where)
            for v in found:
                print(f"     {v['id']} ({v['impact']}, {v['count']} element(s))")
                for n in v["nodes"]:
                    print(f"       {n}")
            if found:
                failures.append(where)
            pg.close()
        ctx.close()
    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
