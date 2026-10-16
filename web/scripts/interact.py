"""Drive every interaction of the built site and assert visible effects. Exit 1 on any failure.

python3 web/scripts/interact.py [--url http://127.0.0.1:4173/] [--shots DIR]
"""

import sys

from playwright.sync_api import sync_playwright

url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "http://127.0.0.1:4173/"
shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
failures = []


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not cond:
        failures.append(name)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    tip = page.locator("#tooltip")

    # --- map: hover a dot shows the tooltip
    dot = page.locator("#map circle.airport-dot").first
    dot.hover(force=True)
    page.wait_for_timeout(200)
    check("map hover shows tooltip", "passagers" in tip.inner_text() and "on" in (tip.get_attribute("class") or ""))

    # --- map: year slider + play
    page.locator("#year").fill("2000")
    page.locator("#year").dispatch_event("input")
    page.wait_for_timeout(300)
    check("slider sets year", page.locator("#map-year").inner_text() == "2000")
    page.locator("#play").click()
    page.wait_for_timeout(1300)
    y = int(page.locator("#map-year").inner_text())
    check("play advances years", y > 2000, f"year={y}")
    page.locator("#play").click()

    # --- map: delta mode recolours dots
    before = page.locator("#map circle.airport-dot").nth(3).evaluate("e => e.style.fill")
    page.locator('#map-mode button[data-mode="delta"]').click()
    page.wait_for_timeout(300)
    after = page.locator("#map circle.airport-dot").nth(3).evaluate("e => e.style.fill")
    check("delta mode recolours", before != after, f"{before} -> {after}")
    check("delta legend shown", "Recul" in page.locator("#map-legend").inner_text())

    # --- rank list click selects the airport card
    page.locator("#year").fill("2025")
    page.locator("#year").dispatch_event("input")
    page.locator("#rank-list li").nth(2).click()
    page.wait_for_timeout(600)
    check("rank click selects airport", "Nice" in page.locator("#airport-card h3").first.inner_text())
    check("hash follows selection", "aeroport=LFMN" in page.evaluate("location.hash"))

    # --- search
    page.locator("#apt-input").fill("Bergerac-Dordogne-Périgord (LFBE)")
    page.locator("#apt-input").press("Enter")
    page.wait_for_timeout(500)
    check("search selects Bergerac", "Bergerac" in page.locator("#airport-card h3").first.inner_text())
    page.locator("#apt-input").fill("lfst")
    page.locator("#apt-input").press("Enter")
    page.wait_for_timeout(500)
    check("search by ICAO code", "Strasbourg" in page.locator("#airport-card h3").first.inner_text())

    # --- seasonality year change redraws
    sel = page.locator("#airport-card select").first
    sel.select_option("2010")
    page.wait_for_timeout(300)
    check("seasonality legend updates", "2010" in page.locator("#airport-card .map-legend").last.inner_text())

    # --- share image
    page.get_by_role("button", name="Créer l'image à partager").click()
    page.wait_for_timeout(800)
    src = page.locator("#airport-card img").first.get_attribute("src") or ""
    check("share image generated", src.startswith("data:image/png"), f"{len(src)} chars")

    # --- trajectories: chips, mode, keyboard
    page.locator("#chips-traj .chip").nth(1).click()
    n_lines = page.locator("#chart-traj path.series-line").count()
    check("chip toggles a series", n_lines == 3, f"lines={n_lines}")
    page.locator('#traj-mode button[data-v="pax"]').click()
    page.locator('#traj-range button[data-v="2018"]').click()
    page.locator("#chart-traj").focus()
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(200)
    check("keyboard crosshair shows tooltip", "on" in (tip.get_attribute("class") or "") and "M" in tip.inner_text())
    page.locator("#chart-traj").hover(position={"x": 600, "y": 200})
    page.wait_for_timeout(200)
    rows = page.locator("#tooltip .t-row").count()
    check("one tooltip lists every visible series", rows == 3, f"rows={rows}")

    # --- prices
    page.locator('#prix-mode button[data-v="index"]').click()
    page.locator("#chart-prix").hover(position={"x": 700, "y": 200})
    page.wait_for_timeout(200)
    check("prices tooltip", "indice 2023" in tip.inner_text())
    check("prices lede computed", "%" in page.locator("#lede-prix").inner_text())

    # --- carriers: hover highlight + mode switch
    page.locator("#chart-bump svg").hover(position={"x": 700, "y": 60})
    page.wait_for_timeout(200)
    faded = page.locator("#chart-bump path.is-faded").count()
    check("bump hover fades other carriers", faded > 3, f"faded={faded}")
    page.locator('#cie-mode button[data-v="pax"]').click()
    page.wait_for_timeout(200)
    check("carriers passenger mode draws axis", page.locator("#chart-bump .axis").count() >= 2)

    # --- CO2 slider
    page.locator("#co2-year").fill("2020")
    page.locator("#co2-year").dispatch_event("input")
    page.wait_for_timeout(200)
    check("CO2 readout follows slider", page.locator("#co2-readout").inner_text().startswith("2020"))

    # --- theme toggle
    page.locator('#theme-toggle button[data-theme="light"]').click()
    page.wait_for_timeout(300)
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check("theme toggle switches to day", bg == "rgb(246, 248, 246)", bg)
    if shots:
        page.screenshot(path=f"{shots}/after-interactions.png", full_page=False)

    # --- deep link
    page2 = ctx.new_page()
    page2.on("pageerror", lambda e: errors.append(str(e)))
    page2.goto(url + "#aeroport=LFLC", wait_until="networkidle")
    page2.wait_for_timeout(1200)
    check("deep link opens Clermont-Ferrand", "Clermont" in page2.locator("#airport-card h3").first.inner_text())

    check("no console errors", not errors, "; ".join(errors[:3]))
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
