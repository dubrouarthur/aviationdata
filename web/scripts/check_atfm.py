# ruff: noqa: E501  (the sentences checked are long)
"""Check « Qui retarde les avions en Europe ? » (web/retards/): every number of the text recomputed in Python from
web/public/data/atfm/atfm.json, without reading web/src/atfm/facts.js; atfm.json itself checked against the raw
EUROCONTROL files (data/raw/atfm/, fetch_atfm.py) when they are there; then the page: figures, sources, « Lecture »
lines, the words (declared reasons, no blame), the phone.

Serve web/dist on 127.0.0.1:4173, then: python3 web/scripts/check_atfm.py [--base URL]
"""

import bz2
import csv
import json
import os
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
A = json.loads((ROOT / "web/public/data/atfm/atfm.json").read_text())
FAIL = []
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
DAYS = "lundi mardi mercredi jeudi vendredi samedi dimanche".split()
WORDS = "zéro un deux trois quatre cinq six sept huit neuf dix onze douze".split()


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))
    if not ok:
        FAIL.append(name)


def fr(v, d=0):
    # half up on the decimal as written, as the page does (2.05 -> 2,1)
    q = Decimal(str(abs(v))).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{q:,.{d}f}".replace(",", " ").replace(".", ",")


def pc(v, d=0):
    return f"{fr(v * 100, d)} %"


def mins(v):
    s = round(v * 60 / 10) * 10
    if s < 60:
        return f"{s} secondes"
    return f"{s // 60} min {s % 60:02d}" if s % 60 else f"{s // 60} min"


def times(r):
    n = round(r)
    if 2 <= n <= 10 and abs(r - n) < 0.12:
        return ("près de " if r < n - 0.03 else "plus de " if r > n + 0.03 else "") + f"{WORDS[n]} fois"
    return f"{fr(r, 1)} fois"


def day(d):
    return f"{'1er' if int(d[8:]) == 1 else int(d[8:])} {MONTHS[int(d[5:7]) - 1]} {d[:4]}"


# ------------------------------------------------------------------ recompute
y = str(A["meta"]["lastFull"])
Y = A["years"][y]
base = sum(A["years"][k]["delay"] for k in ("2014", "2015", "2016", "2017")) / sum(
    A["years"][k]["flights"] for k in ("2014", "2015", "2016", "2017")
)
per = Y["delay"] / Y["flights"]
ratio = Y["perFlight"] / base
delayed, delayed15 = Y["delayed"] / Y["flights"], Y["delayed15"] / Y["flights"]
per_delayed = Y["delay"] / Y["delayed"]
share = {g: v / Y["delay"] for g, v in Y["groups"].items()}
first = min(A["years"])
share0 = {g: v / A["years"][first]["delay"] for g, v in A["years"][first]["groups"].items()}
sm = [A["months"][f"{y}-{m}"] for m in ("06", "07", "08")]
summer_d, summer_f = sum(m["delay"] for m in sm) / Y["delay"], sum(m["flights"] for m in sm) / Y["flights"]
prov = {c: p["years"][y] | {"country": p["country"]} for c, p in A["providers"].items() if p["years"].get(y, {}).get("flights")}
tot = sum(p["delay"] for p in prov.values())
rank = sorted(prov, key=lambda c: -prov[c]["delay"])
fr_share = prov["FR"]["delay"] / tot
top3 = sum(prov[c]["delay"] for c in rank[:3]) / tot
calm = sum(1 for p in prov.values() if p["delay"] / p["flights"] < 0.1)
w = A["worst"][0]
wk = A["week"]
hi, lo = wk.index(max(wk)), wk.index(min(wk))
full_years = [k for k in A["years"] if int(k) <= int(y)]
peak = max(full_years, key=lambda k: A["years"][k]["perFlight"])
check("perFlight of atfm.json", abs(per - Y["perFlight"]) < 1e-3, f"{per} {Y['perFlight']}")
check("the groups add up to the delay", abs(sum(Y["groups"].values()) - Y["delay"]) <= 8, f"{sum(Y['groups'].values())} {Y['delay']}")
check("the days add up to the year", abs(sum(m["delay"] for k, m in A["months"].items() if k.startswith(y)) - Y["delay"]) <= 400)
check("Thursday to Sunday above three minutes", all(v > 3 for v in wk[3:]), str(wk))

raw = ROOT / f"data/raw/atfm/ert_dly_ansp_{y}.csv.bz2"
if raw.exists():
    with bz2.open(raw, "rt", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    f = lambda x: float(x) if x else 0.0  # noqa: E731
    area = [r for r in rows if r["ENTITY_NAME"] == "EUROCONTROL Area (MS)"]
    check(f"raw: delay of {y}", abs(sum(f(r["DLY_ERT_1"]) for r in area) - Y["delay"]) < 400, "")
    check(f"raw: flights of {y}", abs(sum(f(r["FLT_ERT_1"]) for r in area) - Y["flights"]) < 400, "")
    dsna = sum(f(r["DLY_ERT_1"]) for r in rows if r["ENTITY_NAME"] == "DSNA")
    check(f"raw: DSNA's delay of {y}", abs(dsna - prov["FR"]["delay"]) < 400, f"{dsna} {prov['FR']['delay']}")
else:
    print("skip raw: data/raw/atfm is empty (python3 etl/atfm/fetch_atfm.py)")

# ------------------------------------------------------------------ the page
from playwright.sync_api import sync_playwright  # noqa: E402


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " ")).strip()


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(f"{BASE}/retards", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    T = norm(pg.inner_text("main"))
    t = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    def has(name, text, where=None):
        src = t(where) if where else T
        check(name, norm(text) in src, text)

    check("no error in the console", not errors, "; ".join(errors[:3]))
    has("dek: one flight in N", f"En {y}, un vol sur {round(1 / delayed)} a attendu", "#open-dek")
    has("dek: minutes of the delayed", f"{fr(per_delayed)} minutes en moyenne", "#open-dek")
    has("dek: ratio", f"C'est {times(ratio)} plus de retard par vol", "#open-dek")
    has("dek: France", f"le contrôle français en porte {pc(fr_share)}", "#open-dek")
    has("opening: stats", f"1 sur {round(1 / delayed)}", "#rt-open-stats")
    E = t("#essentiel-list")
    for name, s in [
        ("essentiel: ratio", f"{times(ratio)} plus de retard par vol en {y}"),
        ("essentiel: per flight", f"{mins(per)} par vol, tous vols confondus, contre {mins(base)}"),
        ("essentiel: record", f"Le record : {peak}"),
        ("essentiel: summer", f"{pc(summer_d)} des minutes de retard de {y} tombent en juin"),
        ("essentiel: summer flights", f"que {pc(summer_f)} des vols"),
        ("essentiel: control reasons", f"{pc(share['capacite'] + share['effectifs'])} des minutes sont déclarées"),
        ("essentiel: weather", f"La météo, {pc(share['meteo'])}, contre {pc(share0['meteo'])} en {first}"),
        ("essentiel: France", f"{pc(fr_share)} des minutes de retard d'Europe"),
        ("essentiel: top three", f"Avec l'Allemagne et l'Espagne, {pc(top3)}"),
        ("essentiel: calm countries", f"{calm} pays sur {len(prov)}"),
        ("essentiel: the day", f"le {DAYS[hi]} d'été : {times(wk[hi] / wk[lo])} plus de retard par vol que le {DAYS[lo]}"),
    ]:
        check(name, norm(s) in E, s)
    check("the top three are France, Germany, Spain", rank[:3] == ["FR", "DE", "ES"], str(rank[:3]))
    has("ch1: per flight", f"elles font {mins(per)} par vol", "#niveau-prose")
    has("ch1: not delayed", f"{pc(1 - delayed)} des vols n'ont eu aucun retard", "#niveau-after")
    has("ch1: over 15 minutes", f"Un vol sur {round(1 / delayed15)} a attendu plus d'un quart d'heure", "#niveau-after")
    has("ch1: years of waiting", f"font {fr(Y['delay'] / 525600)} ans d'attente", "#niveau-after")
    cur = max(A["years"])
    if int(cur) > int(y):
        has("ch1: this year so far", f"est de {mins(A['ytd'][cur]['perFlight'])}, contre {mins(A['ytd'][y]['perFlight'])}", "#niveau-after")
    has("ch3: capacity and staffing", f"la capacité représente {pc(share['capacite'])} des minutes de retard, les effectifs {pc(share['effectifs'])}", "#motifs-prose")
    has("ch3: strikes", f"en font {pc(share['greves'])} en {y}, contre {pc(share0['greves'])} en {first}", "#motifs-after")
    has("ch4: the worst day", f"Le {day(w['date'])}, chaque vol d'Europe a attendu {fr(w['perFlight'])} minutes", "#pires-prose")
    n_year = sum(1 for x in A["worst"] if x["date"][:4] == w["date"][:4])
    has("ch4: title", f"{WORDS[n_year].capitalize()} des {len(A['worst'])} pires journées datent de {w['date'][:4]}", "#h-pires")
    has("ch5: the three countries", f"{pc(fr_share)} des minutes sont attribuées à la France, {pc(prov['DE']['delay'] / tot)} à l'Allemagne et {pc(prov['ES']['delay'] / tot)} à l'Espagne", "#pays-prose")
    has("ch5: per flight handled", f"{mins(prov['FR']['delay'] / prov['FR']['flights'])}, contre {mins(prov['DE']['delay'] / prov['DE']['flights'])} en Allemagne", "#pays-after")
    has("ch7: the week", f"{fr(wk[hi], 1)} minutes un créneau du contrôle en route. Un vol du {DAYS[lo]}, {fr(wk[lo], 1)} minutes", "#semaine-prose")
    has("answer", f"{pc(summer_d)} en trois mois d'été, {pc(top3)} dans trois pays", "#reponse-prose")
    check("no blame, no cause asserted", not re.search(r"à cause d|par la faute|responsable d|coupable", T), "")
    check("the reasons are « déclarés »", "motif déclaré" in T and "pas des responsabilités établies" in T)
    figs = pg.locator("main figure.panel")
    check("seven figures", figs.count() == 7, str(figs.count()))
    for i in range(figs.count()):
        f = figs.nth(i)
        h = norm(f.locator("h3").inner_text())
        check(f"figure « {h} »: source line", f.locator(".source-line a").count() > 0)
        check(f"figure « {h} »: Lecture line", f.locator(".lecture").count() == 1)
        check(f"figure « {h} »: drawn", f.locator("svg").count() > 0)
        check(f"figure « {h} »: its numbers as a table", f.locator("details.data").count() >= 1)
    check("the calendar has a cell a day", pg.locator("#chart-cal svg rect").count() >= len(A["daily"]["delay"]))
    check("every chapter lists its data", pg.locator(".story-chapter:not(#en-bref) .chapter-sources").count() == 7)
    ph = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    ph.goto(f"{BASE}/retards", wait_until="networkidle")
    ph.wait_for_timeout(2000)
    sw = ph.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scroll", sw <= 391, str(sw))
    b.close()

print(f"\n{len(FAIL)} échec(s)" if FAIL else "\ntout est bon")
sys.exit(1 if FAIL else 0)
