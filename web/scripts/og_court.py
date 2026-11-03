"""Social preview of a short article (« En 5 minutes »), 1200 x 630: the question, its short answer and
one figure of the page, all read from the page itself (no number typed here).

Serve web/dist on 127.0.0.1:4173 first, then:
    python3 web/scripts/og_court.py            # every short article below
    python3 web/scripts/og_court.py --base http://127.0.0.1:4173
Writes web/public/og-<name>.jpg (rebuild afterwards so dist gets them).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
PUBLIC = Path(__file__).resolve().parents[1] / "public"
# slug, image, the figure that tells the story at a glance
ARTICLES = [
    ("prix-des-billets", "og-billet.jpg", "#chart-prix"),
    ("co2-par-passager", "og-co2.jpg", "#chart-trajet"),
]

CARD = """
(sel) => {
  const q = (s) => document.querySelector(s);
  const card = document.createElement('div');
  card.id = 'og-card';
  const left = document.createElement('div');
  left.className = 'og-left';
  const mark = document.createElement('p');
  mark.className = 'og-mark';
  mark.innerHTML = 'aviation<b>data</b> <span>En 5 minutes</span>';
  const h1 = q('#title').cloneNode(true);
  h1.removeAttribute('id');
  const ans = q('#court-answer').cloneNode(true);
  ans.removeAttribute('id');
  [...ans.querySelectorAll('p')].slice(2).forEach((p) => p.remove());
  left.append(mark, h1, ans);
  const right = document.createElement('div');
  right.className = 'og-right';
  const fig = q(sel).closest('figure');
  const title = fig.querySelector('h3').cloneNode(true);
  const chart = q(sel).cloneNode(true);
  chart.removeAttribute('id');
  right.append(title, chart);
  card.append(left, right);
  document.body.append(card);
}
"""

STYLE = """
#og-card { position: fixed; inset: 0 auto auto 0; width: 1200px; height: 630px; z-index: 9999;
  display: grid; grid-template-columns: 500px 1fr; gap: 44px; padding: 44px 48px; box-sizing: border-box;
  background-color: var(--paper);
  background-image: linear-gradient(rgba(20,32,46,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(20,32,46,.055) 1px, transparent 1px);
  background-size: 100% 88px, 88px 100%; border-top: 10px solid var(--magenta); }
#og-card .og-mark { margin: 0 0 18px; font: 600 22px var(--f-ui); color: var(--ink); }
#og-card .og-mark span { margin-left: 12px; padding-left: 12px; border-left: 2px solid var(--rule-strong); color: var(--magenta-text); font-weight: 700; }
#og-card h1 { margin: 0 0 22px; font-size: 62px; line-height: .98; max-width: none; }
#og-card .court-answer { padding: 6px 0 0 18px; }
#og-card .court-answer p { font-size: 21px; margin-bottom: 8px; }
#og-card .court-answer .ca-yes { font-size: 46px; }
#og-card .og-right { align-self: center; }
#og-card .og-right h3 { margin: 0 0 14px; font: 700 26px/1.1 var(--f-display); font-stretch: var(--stretch-display); color: var(--ink); }
#og-card .og-right .chart { width: 560px; }
#og-card .c-hbars { gap: 7px; }
#og-card .c-hbars li { grid-template-columns: 170px 1fr 70px; gap: 2px 12px; }
#og-card .c-hb-label { font-size: 14px; }
#og-card .c-hb-label small { display: none; }
#og-card .c-hb-track { height: 14px; }
#og-card details { display: none; }
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, reduced_motion="reduce")
    for slug, name, sel in ARTICLES:
        page.goto(f"{base}/{slug}", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.add_style_tag(content=STYLE)
        # the chart redraws at the card's width (its labels keep their size), then is copied onto the card
        page.evaluate("(sel) => { document.querySelector(sel).style.width = '560px'; }", sel)
        page.wait_for_timeout(400)
        page.evaluate(CARD, sel)
        page.wait_for_timeout(300)
        out = PUBLIC / name
        page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": 1200, "height": 630}, type="jpeg", quality=88)
        print(f"{name}: {out.stat().st_size // 1024} KB")
    browser.close()
