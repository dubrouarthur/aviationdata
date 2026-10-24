# ruff: noqa: E501  (the expected sentences are long)
"""The human-factor story, end to end: every number of its text recomputed in Python from
web/public/data/hf/*.json and compared with the page, the opening figure, the tool and the phone layout.
Serve web/dist on 127.0.0.1:4173 first (npx vite preview --host 127.0.0.1 --port 4173).

    python3 web/scripts/check_hf.py [--base http://127.0.0.1:4173]

Exit 1 on any failure.
"""

import json
import math
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://127.0.0.1:4173"
D = {k: json.loads((ROOT / "public" / "data" / "hf" / f"{k}.json").read_text()) for k in
     ("accidents", "people", "events", "history", "meta")}  # fmt: skip
A, P, E, H = D["accidents"], D["people"], D["events"], D["history"]
B = A["bits"]
PERSON, MACHINE, ENV, ORG, STATE, HANDLING = (B[k] for k in ("person", "machine", "env", "org", "state", "handling"))
failures = []


def check(where, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + where + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(where)


def has(where, text, *needles):
    missing = [n for n in needles if n not in text]
    check(where, not missing, f"missing {missing}" if missing else "")


def fr(v, d=0):
    q = Decimal(str(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{abs(q):,.{d}f}".replace(",", " ").replace(".", ",")


pct = lambda v, d=0: f"{fr(v, d)} %"  # noqa: E731
norm = lambda s: re.sub(r"[\s\u202f\u00a0]+", " ", s)  # noqa: E731
TIMES = ["", "", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"]


# ---------------------------------------------------------------- the cells, read again
def cells(seg=None, sev=None):
    si = None if seg is None else [k for k, _ in A["segments"]].index(seg)
    vi = None if sev is None else [k for k, _ in A["severities"]].index(sev)
    return [c for c in A["cells"] if (si is None or c[1] == si) and (vi is None or c[2] == vi)]


def n_of(cs, test=lambda m: True):
    return sum(c[4] for c in cs if test(c[3]))


def share(cs, bit):
    return 100 * n_of(cs, lambda m: m & bit) / n_of(cs)


allc = cells()
N = n_of(allc)
NP = n_of(allc, lambda m: m & PERSON)
S = {k: share(allc, b) for k, b in B.items()}
broad = share(allc, PERSON | HANDLING | ORG)
fat = cells(sev="FATL")
NF = n_of(fat)
deaths = sum(c[5] for c in allc)
deaths_p = sum(c[5] for c in allc if c[3] & PERSON)
sev = [(k, n_of(cells(sev=k)), share(cells(sev=k), PERSON)) for k, _ in A["severities"]]
seg = {k: {b: share(cells(seg=k), bit) for b, bit in B.items()} | {"n": n_of(cells(seg=k))} for k, _ in A["segments"]}
g = P["by"]["all|all"]
gf = P["by"]["all|FATL"]
R = g["roles"]
first, last = A["period"]

# ---------------------------------------------------------------- browser
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    errors = []
    pg = browser.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(base + "/facteur-humain", wait_until="networkidle")
    pg.wait_for_function(
        f"() => document.getElementById('hf-count')?.textContent.replace(/\\s/g, '').startsWith('{NP}')",
        timeout=15000,
    )
    text = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    painted = pg.evaluate(
        "() => { const c = document.getElementById('mosaic');"
        " const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;"
        " let n = 0; for (let i = 3; i < d.length; i += 64) n += d[i] > 0; return n; }"
    )
    check("opening mosaic is drawn", painted > 500, f"{painted} painted samples")
    has("opening count", text("#hf-count"), f"{fr(NP)} accidents sur {fr(N)} citent une personne")
    has(
        "standfirst",
        text("#open-dek"),
        f"De {first} à {last}, sur {fr(N)} accidents, une personne y est citée {fr(NP)} fois",
    )
    has(
        "essentials",
        text("#essentiel"),
        f"Une personne est citée dans {pct(S['person'])} des accidents, l'environnement dans {pct(S['env'])}, une panne de l'appareil dans {pct(S['machine'])}",
        f"citée dans {pct(100 * NF and 100 * n_of(fat, lambda m: m & PERSON) / NF)} des accidents mortels, qui comptent {pct(100 * deaths_p / deaths)} des morts",
        f"n'est citée que dans {pct(seg['airline']['person'])} des accidents, l'environnement dans {pct(seg['airline']['env'])}",
        f"une organisation n'est citée que dans {pct(S['org'])} des accidents, un acte dangereux dans {pct(100 * g['levels']['1'] / N)}",
    )
    check("three accidents in four", 70 <= S["person"] < 80, pct(S["person"], 1))
    has(
        "the verdict",
        text("#verdict-prose"),
        f"Sur les {fr(N)} accidents de {first} à {last}, une personne est citée dans {fr(NP)}, soit {pct(S['person'], 1)}",
        f"nuit : {pct(S['env'])}",
        f"(vent, relief, oiseaux, nuit : {pct(S['env'])}) et une panne ou un défaut de l'appareil ({pct(S['machine'])})",
        f"cités dans {pct(S['handling'])} des accidents : en les comptant, le facteur humain monte à {pct(broad)}",
    )
    bars = [norm(t) for t in pg.eval_on_selector_all("#chart-layers .hb-val", "es => es.map(e => e.textContent)")]
    check("layers chart", bars[:4] == [pct(S[k]) for k in ("person", "env", "handling", "machine")], str(bars))

    fn = sev[0][1]
    others = [s[2] for s in sev[1:]]
    has(
        "severity",
        text("#gravite-prose"),
        f"pour 10 accidents mortels, {round(10 * sev[1][1] / fn)} avec des blessés graves, {round(10 * sev[2][1] / fn)} avec des blessés légers et {round(10 * sev[3][1] / fn)} sans blessé",
        f"citée dans {fr(min(others))} à {pct(max(others))} des accidents sans mort, et dans {pct(sev[0][2])} des accidents mortels",
        f"Ces {fr(NF)} accidents mortels ont fait {fr(deaths)} morts",
        f"en comptent {fr(deaths_p)}, soit {pct(100 * deaths_p / deaths)}",
    )

    old = [(y, 100 * pp / n, 100 * mm / n) for y, n, pp, mm in H["old"]]
    new = [(y, 100 * pp / n, 100 * mm / n) for y, n, pp, mm in H["new"]]
    rng = lambda xs: f"{fr(min(xs))} à {pct(max(xs))}"  # noqa: E731
    min_times = min(r[2] / r[3] for r in H["old"] + H["new"])
    has(
        "forty years",
        text("#histoire-prose"),
        f"De {old[0][0]} à {old[-1][0]}, une personne est citée dans {rng([r[1] for r in old])}",
        f"une panne de l'appareil dans {rng([r[2] for r in old])}",
        f"{pct(old[0][2])} en {old[0][0]}, {pct(old[-1][2])} en {old[-1][0]}",
        f"une personne est citée dans {rng([r[1] for r in new[1:]])} des accidents ({pct(new[0][1])} en {new[0][0]}",
        f"une panne dans {rng([r[2] for r in new])}",
        f"au moins {TIMES[min(10, math.floor(min_times))]} fois",
    )

    has(
        "who",
        text("#qui-prose"),
        f"Le pilote est nommé dans {fr(R['pilot'])} accidents, un instructeur ou un élève pilote dans {fr(R['training'])}",
        f"figure dans {pct(100 * g['controls'] / g['person'])} des accidents où une personne est citée",
        f"amateur dans {fr(R['maintenance'])} accidents ({pct(100 * R['maintenance'] / N, 1)})",
        f"information de vol dans {fr(R['atc'])}",
        f"{pct(100 * seg['ga']['n'] / N)} des accidents y surviennent",
    )
    errs = sorted(((k, v) for k, v in g["errors"].items()), key=lambda t: -t[1])
    has(
        "errors",
        text("#erreurs-prose"),
        f"Il figure dans {fr(errs[0][1])} accidents, {pct(100 * errs[0][1] / N)} du total",
        f"la désorientation spatiale est citée dans {fr(g['errors']['2-20-25'])} accidents, dont {fr(gf['errors']['2-20-25'])} mortels",
    )
    L = g["levels"]
    hb = n_of(allc, lambda m: m & (PERSON | ORG))
    fhb = n_of(fat, lambda m: m & (PERSON | ORG))
    has(
        "HFACS",
        text("#hfacs-prose"),
        f"Sur les {fr(hb)} accidents qui citent une personne ou une organisation, un acte dangereux figure dans {pct(100 * L['1'] / hb)}",
        f"une condition préalable dans {pct(100 * L['2'] / hb)}, la supervision dans {pct(100 * L['3'] / hb, 1)}, l'organisation dans {pct(100 * L['4'] / hb, 1)}",
        f"une condition préalable y figure dans {pct(100 * gf['levels']['2'] / fhb)} des cas",
    )

    threat = ENV | MACHINE
    st = n_of(allc, lambda m: m & STATE)
    has(
        "TEM",
        text("#tem-prose"),
        f"Il en cite un dans {fr(st)} accidents, {pct(100 * st / N)} du total",
        f"Dans {pct(100 * n_of(allc, lambda m: m & STATE and m & PERSON) / st)} de ces cas",
        f"une menace, dans {pct(100 * n_of(allc, lambda m: m & STATE and m & threat) / st)}",
        f"sans aucune personne dans {fr(n_of(allc, lambda m: m & threat and not m & PERSON))} accidents",
    )

    four = PERSON | MACHINE | ENV | ORG
    combo = lambda mask: 100 * n_of(allc, lambda m: (m & four) == mask) / N  # noqa: E731
    three = n_of(allc, lambda m: bin(m & four).count("1") >= 3)
    has(
        "Swiss cheese",
        text("#fromage-prose"),
        f"{pct(combo(PERSON))} des accidents ne citent qu'une personne",
        f"Une personne et l'environnement ensemble : {pct(combo(PERSON | ENV))}",
        f"Une panne seule : {pct(combo(MACHINE))}",
        f"Trois couches ou plus : {pct(100 * three / N, 1)}",
    )

    ev = {k: (n, pp, f) for k, n, pp, f in E["by"]["all|all"]}
    es = lambda k: pct(100 * ev[k][1] / ev[k][0])  # noqa: E731
    has(
        "defining events",
        text("#evenements-prose"),
        f"citée dans {es('Loss of control in flight')} des pertes de contrôle en vol, {es('Aerodynamic stall/spin')} des décrochages",
        f"{es('Controlled flight into terr/obj (CFIT)')} des impacts sans perte de contrôle et {es('VFR encounter with IMC')} des vols à vue",
        f"que dans {es('Loss of engine power (total)')} des pertes totales de puissance et {es('Sys/Comp malf/fail (non-power)')} des pannes",
        f"comptent à elles seules {fr(ev['Loss of control in flight'][2])} accidents mortels, {pct(100 * ev['Loss of control in flight'][2] / NF)} du total",
    )

    air = seg["airline"]
    aev = {k: (n, pp) for k, n, pp, _ in E["by"]["airline|all"]}
    turb = [v for k, v in aev.items() if "urbulence" in k]
    tn, tp = sum(v[0] for v in turb), sum(v[1] for v in turb)
    has(
        "airlines",
        text("#compagnies-prose"),
        f"ne comptent que {fr(air['n'])} accidents en {last - first + 1} ans, {pct(100 * air['n'] / N, 1)} du total, dont {fr(n_of(cells('airline', 'FATL')))} mortels",
        f"une personne n'est citée que dans {pct(air['person'])} des accidents, l'environnement dans {pct(air['env'])}",
        f"{fr(tn)} accidents de compagnie, {pct(100 * tn / air['n'])}, sont des rencontres avec la turbulence",
        f"n'est citée que dans {fr(tp)} d'entre elles",
        f"{pct(air['org'], 1)} des accidents, contre {pct(seg['ga']['org'], 1)} en aviation générale",
        f"dominés par l'humain ({pct(seg['taxi']['person'])}), mais citent l'environnement ({pct(seg['taxi']['env'])}) et une organisation ({pct(seg['taxi']['org'], 1)})",
    )
    has(
        "the answer",
        text("#reponse-prose"),
        f"citée dans {pct(S['person'])} des accidents aériens de {first} à {last}, {TIMES[math.floor(S['person'] / S['machine'])]} fois plus souvent qu'une panne ({pct(S['machine'])}) et {TIMES[math.floor(S['person'] / S['env'])]} fois plus que l'environnement ({pct(S['env'])})",
        f"(une organisation dans {pct(S['org'], 1)} des accidents)",
    )

    # the tool: airlines, then fatal accidents of general aviation
    pg.locator("#explorer").scroll_into_view_if_needed()
    has(
        "tool, everything",
        text("#tool-read"),
        f"{fr(N)} accidents (tous types de vol). Une personne est citée dans {pct(S['person'])}",
    )
    pg.click("#tool-seg button[data-v='airline']")
    has(
        "tool, airlines",
        text("#tool-read"),
        f"{fr(air['n'])} accidents (compagnies aériennes). Une personne est citée dans {pct(air['person'])}",
    )
    pg.click("#tool-seg button[data-v='ga']")
    pg.click("#tool-sev button[data-v='FATL']")
    gaf = cells("ga", "FATL")
    has(
        "tool, fatal general aviation",
        text("#tool-read"),
        f"{fr(n_of(gaf))} accidents (aviation générale, mortel). Une personne est citée dans {pct(share(gaf, PERSON))}",
    )
    check(
        "tool lists errors and events",
        pg.locator("#tool-errors .hb-row").count() == 8 and pg.locator("#tool-events .hb-row").count() >= 8,
    )
    n_sources = pg.locator("[data-hsource] .source-line").count()
    check("every figure names its source", n_sources == pg.locator("[data-hsource]").count(), str(n_sources))
    check("sources section", "Les modèles et les faits extérieurs aux données" in text("#sources-body"))
    pg.close()

    mp = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mp.goto(base + "/facteur-humain", wait_until="networkidle")
    mp.wait_for_timeout(1000)
    wide = mp.evaluate("() => document.documentElement.scrollWidth > innerWidth")
    check("phone: no horizontal overflow", not wide)
    check("no console errors", not errors, str(errors[:5]))
    browser.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
