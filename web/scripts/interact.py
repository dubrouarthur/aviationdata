"""Drive every interaction of the built story and assert visible effects. Exit 1 on any failure.

python3 web/scripts/interact.py [--url http://127.0.0.1:4173/]
"""

import sys

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
failures = []
LAUNCH = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not cond:
        failures.append(name)


def scroll_to(page, sel, wait=900):
    page.evaluate(
        "s => { const r = document.querySelector(s).getBoundingClientRect();"
        " window.scrollTo(0, window.scrollY + r.top - window.innerHeight / 2 + 40); }",
        sel,
    )
    page.wait_for_timeout(wait)


def seek(page, slider, output, target):
    """Move an index-based range input until its <output> reads `target`."""
    return page.evaluate(
        """([s, o, t]) => { const r = document.querySelector(s), out = document.querySelector(o);
           for (let i = 0; i <= +r.max; i++) { r.value = i; r.dispatchEvent(new Event('input'));
             if (out.textContent.trim() === t) return true; } return false; }""",
        [slider, output, target],
    )


def fills(page, sel):
    return page.locator(f"{sel} path").evaluate_all("ps => ps.slice(0, 400).map(p => p.style.fill).join('|')")


with sync_playwright() as p:
    b = p.chromium.launch(args=LAUNCH)
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    tip = page.locator("#tooltip")

    def tip_on():
        return "on" in (tip.get_attribute("class") or "")

    check("light theme only", page.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(246, 248, 246)")
    check("demo banner hidden on real data", page.locator("#demo-banner").is_hidden())
    check(
        "hero key figures",
        page.locator("#hero-kpis .kpi").count() == 3 and " M" in page.locator("#hero-kpis").inner_text(),
    )
    check(
        "sticky nav marks the first chapter",
        page.locator('.topnav a[aria-current="true"]').get_attribute("href") == "#monde",
    )

    # --- globe: canvas painted, slider, scroll steps, explorer
    painted = page.evaluate(
        """() => { const c = document.querySelector('#globe canvas'); const g = c.getContext('2d');
           const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
           for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n; }"""
    )
    check("globe canvas is painted", painted > 200, f"samples={painted}")
    check("globe slider reaches 2000", seek(page, "#globe-slider", "#globe-out", "2000"))
    page.wait_for_timeout(300)
    check("globe overlay follows slider", page.locator("#globe-year").inner_text().startswith("2000"))
    page.locator("#globe-play").click()
    page.wait_for_timeout(1600)
    played = page.locator("#globe-out").inner_text()
    check("globe play advances years", played.isdigit() and int(played) > 2000, played)
    page.locator("#globe-play").click()
    for key, title in (("2020-04", "Avril 2020"), ("1990", "1990"), ("delta", "Depuis 2019")):
        page.click(f'#globe-moments [data-k="{key}"]')
        page.wait_for_timeout(300)
        check(
            f"globe moment {key} updates the caption", page.locator("#globe-caption h3").inner_text().startswith(title)
        )
        if key == "2020-04":
            check("April 2020 moment switches to month mode", "2020" in page.locator("#globe-out").inner_text())
    check(
        "only one moment selected",
        page.locator('#globe-moments [aria-selected="true"]').count() == 1
        and page.locator('#globe-moments [data-k="delta"]').get_attribute("aria-selected") == "true",
    )
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(200)
    check(
        "arrow keys move between moments",
        page.locator('#globe-moments [data-k="2025"]').get_attribute("aria-selected") == "true",
    )
    seek(page, "#globe-slider", "#globe-out", "2010")
    page.wait_for_timeout(200)
    check(
        "slider to a free year clears the moments and writes a caption",
        page.locator('#globe-moments [aria-selected="true"]').count() == 0
        and page.locator("#globe-caption h3").inner_text() == "2010",
    )
    scroll_to(page, "#explorer-title", 600)
    n_all = page.locator("#country-list li").count()
    page.locator("#globe-cont button", has_text="Afrique").click()
    page.wait_for_timeout(300)
    first_africa = page.locator("#country-list li .n").first.inner_text()
    check(
        "continent filter changes the list",
        n_all > 20 and first_africa in {"Maroc", "Algérie", "Tunisie"},
        first_africa,
    )
    page.locator("#country-list li").first.click()
    page.wait_for_timeout(300)
    check("clicking a country selects it", page.locator('#country-list li[aria-selected="true"]').count() == 1)

    # --- spiral: mode switch recolours, hover shows month
    scroll_to(page, "#chart-spirale", 2500)
    before = fills(page, "#chart-spirale")
    page.locator('#spirale-mode button[data-v="nat"]').click()
    page.wait_for_timeout(300)
    check("spiral mode recolours", fills(page, "#chart-spirale") != before)
    page.locator("#chart-spirale path").nth(300).hover(force=True)
    page.wait_for_timeout(150)
    check("spiral hover tooltip", tip_on() and "passagers" in tip.inner_text())

    # --- fuller planes
    scroll_to(page, "#chart-rempl")
    check("passengers-per-flight figure", page.locator("#rempl-figure").inner_text().strip().isdigit())
    check("dumbbell drawn", page.locator("#chart-rempl-apt circle").count() >= 20)

    # --- covid: chip toggles a line
    scroll_to(page, "#chart-covid")
    n0 = page.locator("#chart-covid path.series-line").count()
    page.locator("#chips-covid .chip").nth(2).click()
    page.wait_for_timeout(300)
    n1 = page.locator("#chart-covid path.series-line").count()
    check("covid chip removes a series", n1 == n0 - 1, f"{n0} -> {n1}")
    check("covid text computed", "avril 2020" in page.locator("#covid-text").inner_text())

    # --- France: moments and timeline
    scroll_to(page, "#france-map", 900)
    check("France opens on the peak year", page.locator("#france-out").inner_text() == "2000")
    page.click('#france-moments [data-k="delta"]')
    page.wait_for_timeout(700)
    check("France delta legend", "recul" in page.locator("#france-legend").inner_text())
    check("France focus labels", "Bergerac" in page.locator("#france-map").inner_text())
    check("France delta caption", "Ryanair" in page.locator("#france-caption").inner_text())
    check("France slider reaches 2010", seek(page, "#france-slider", "#france-out", "2010"))
    page.wait_for_timeout(700)
    check("France routes drawn", page.locator("#france-map path").count() > 20)
    check("France free year caption", page.locator("#france-caption h3").inner_text() == "2010")
    scroll_to(page, "#chart-tsba")
    page.locator("#chart-tsba rect").nth(5).hover(force=True)
    page.wait_for_timeout(150)
    check("TSBA bars tooltip", tip_on() and "sur un an" in tip.inner_text())

    # --- distance and CO2
    scroll_to(page, "#chart-dist")
    n0 = page.locator("#chart-dist path.series-line").count()
    page.locator("#chips-dist .chip").nth(4).click()
    page.wait_for_timeout(300)
    check("distance chip adds Outre-mer", page.locator("#chart-dist path.series-line").count() == n0 + 1)
    scroll_to(page, "#chart-co2-seg")
    check("CO2 stacked by segment", page.locator("#chart-co2-seg svg path").count() >= 4)
    check("CO2 stacked legend", page.locator("#chart-co2-seg .legend-row .lg").count() == 4)
    box = page.locator("#chart-co2-seg svg").bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.6)
    page.wait_for_timeout(150)
    check("CO2 stacked tooltip lists segments", tip_on() and "Long-courrier" in tip.inner_text())
    check("CO2 per passenger-km lines", page.locator("#chart-co2-g path.series-line").count() == 5)
    scroll_to(page, "#chart-waterfall")
    check("waterfall has 7 bars", page.locator("#chart-waterfall g.step rect").count() == 7)
    wt = page.locator("#chart-waterfall").inner_text()
    check("waterfall period brackets", "2000 → 2019" in wt and "2019 → 2024" in wt, wt[:200])
    check("waterfall legend", "Fait baisser" in page.locator("#co2-legend").inner_text())
    page.locator("#chart-waterfall g.step rect").nth(1).hover(force=True)
    page.wait_for_timeout(150)
    check("waterfall tooltip", tip_on() and "passagers-km" in tip.inner_text())
    page.locator('#co2-period button[data-v="seg"]').click()
    page.wait_for_timeout(300)
    check("CO2 per-segment view", "International" in page.locator("#chart-waterfall").inner_text())
    check("CO2 per-segment table", page.locator("#chart-waterfall + details.data tbody tr").count() == 4)
    page.locator('#co2-period button[data-v="steps"]').click()
    page.wait_for_timeout(300)

    # --- airport explorer
    scroll_to(page, "#apt-input")
    page.locator("#apt-input").fill("lfst")
    page.locator("#apt-input").press("Enter")
    page.wait_for_timeout(500)
    check("search by ICAO code", "Strasbourg" in page.locator("#apt-head h3").inner_text())
    check("hash follows selection", "aeroport-LFST" in page.evaluate("location.hash"))
    page.locator("#apt-input").fill("Paris-Charles de Gaulle")
    page.locator("#apt-input").press("Enter")
    page.wait_for_timeout(500)
    head = page.locator("#apt-head h3").inner_text()
    check("search by name", "Gaulle" in head or "Roissy" in head, head)
    n_routes = page.locator("#apt-routes svg g path").count()
    check("spider map draws routes", n_routes > 50, f"routes={n_routes}")
    page.locator("#apt-picks button", has_text="Nice").click()
    page.wait_for_timeout(400)
    check("airport quick pick", "Nice" in page.locator("#apt-head h3").inner_text())
    check("quick pick marked", page.locator('#apt-picks [aria-pressed="true"]').inner_text() == "Nice")
    check(
        "sticky nav follows the scroll",
        page.locator('.topnav a[aria-current="true"]').get_attribute("href") == "#aeroport",
    )
    page.locator("#apt-input").fill("Paris-Charles de Gaulle")
    page.locator("#apt-input").press("Enter")
    page.wait_for_timeout(400)
    page.locator("#apt-year").select_option("2019")
    page.wait_for_timeout(400)
    check("route year select", "2019" in page.locator("#apt-routes-title").inner_text())
    page.locator("#apt-routes svg g path").last.hover(force=True)
    page.wait_for_timeout(150)
    check("route hover tooltip", tip_on() and "distance" in tip.inner_text())

    # --- freight
    scroll_to(page, "#chart-fret")
    check("freight stacked by continent", page.locator("#chart-fret .legend-row .lg").count() == 5)
    check("freight airports: 8 bars", page.locator("#chart-fret-apt svg rect").count() == 8)
    page.locator("#chart-fret-apt svg rect").first.hover(force=True)
    page.wait_for_timeout(150)
    check("freight airport tooltip", tip_on() and "part des aéroports" in tip.inner_text())

    # --- carriers race
    scroll_to(page, "#chart-race", 1200)
    page.locator("#race-play").click()  # pause the autoplay if it started, or start it
    page.wait_for_timeout(200)
    check("race slider reaches 2015", seek(page, "#race-slider", "#race-out", "2015"))
    page.wait_for_timeout(800)
    check("race shows 2015", "2015" in page.locator("#chart-race .race-year").text_content())
    check("race bars", page.locator("#chart-race .race-bar").count() >= 10)

    # --- flag carriers
    scroll_to(page, "#chart-pav", 1200)
    check("French vs foreign lines", page.locator("#chart-pav path.series-line").count() == 2)
    check("foreign carriers by country", page.locator("#chart-pav-pays path.series-line").count() == 4)
    check("flag text computed", "Autriche" in page.locator("#pav-text").inner_text())

    # --- prices
    scroll_to(page, "#chart-heat")
    before = page.locator("#chart-heat rect").evaluate_all("rs => rs.slice(0, 60).map(r => r.style.fill).join('|')")
    page.locator('#heat-series button[data-v="MET_INTER_MET"]').click()
    page.wait_for_timeout(300)
    after = page.locator("#chart-heat rect").evaluate_all("rs => rs.slice(0, 60).map(r => r.style.fill).join('|')")
    check("heatmap series switch", before != after)
    scroll_to(page, "#chart-scissors", 2200)
    check("prices vs traffic: three panels", page.locator("#chart-scissors .sm svg").count() == 3)
    ends = page.locator("#chart-scissors .sm").first.locator("text.end-label").all_text_contents()
    check(
        "prices vs traffic end labels",
        any(t.startswith("prix +") for t in ends) and any(t.startswith("trafic") for t in ends),
        str(ends),
    )
    page.locator("#chart-scissors .sm svg rect").first.hover(position={"x": 200, "y": 120})
    page.wait_for_timeout(150)
    check("prices vs traffic tooltip", tip_on() and "2019 = 100" in tip.inner_text())
    check("prices text computed", "%" in page.locator("#prix-text").inner_text())
    check("sources listed", page.locator("#sources-body a").count() >= 4)
    # every chart, map and globe carries a link to its DGAC dataset
    unsourced = page.evaluate(
        """() => [...document.querySelectorAll('.chart, .graphic')].filter((n) => {
             const box = n.closest('[data-source]');
             const link = box && box.querySelector(':scope > .source-line a[href*="data.gouv.fr"]');
             return !link;
           }).map((n) => n.id)"""
    )
    check("every chart links to its data source", not unsourced, unsourced)
    check("source links open the dataset", page.locator(".source-line a").count() >= 22)
    check("table views", page.locator("details.data").count() >= 6)
    page.locator("#chart-waterfall + details.data summary").click()
    check("waterfall table opens", page.locator("#chart-waterfall + details.data tbody tr").count() == 7)

    # --- deep link
    page2 = ctx.new_page()
    page2.on("pageerror", lambda e: errors.append(str(e)))
    page2.goto(url + "#aeroport-LFLC", wait_until="networkidle")
    page2.wait_for_timeout(1500)
    check("deep link opens Clermont-Ferrand", "Clermont" in page2.locator("#apt-head h3").inner_text())

    # --- mobile: no horizontal scroll anywhere
    m = b.new_page(viewport={"width": 390, "height": 844})
    m.on("pageerror", lambda e: errors.append(str(e)))
    m.goto(url, wait_until="networkidle")
    m.wait_for_timeout(1200)
    widest = m.evaluate(
        """() => { let w = 0, who = ''; for (const e of document.querySelectorAll('body *')) {
             const r = e.getBoundingClientRect();
             if (r.width && r.right > w && !e.closest('.seg, .scroll-list, .moments, .table-scroll, .topnav')) {
               w = r.right; who = e.tagName + '#' + e.id + '.' + e.className; } }
           return [w, who]; }"""
    )
    check(
        "mobile: no horizontal overflow",
        m.evaluate("document.documentElement.scrollWidth") <= 390 and widest[0] <= 391,
        f"widest={widest}",
    )

    check("no console errors", not errors, "; ".join(errors[:3]))
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
