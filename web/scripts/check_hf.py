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
     ("accidents", "people", "events", "history", "cases", "meta")}  # fmt: skip
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
KD = {k[0]: {"n": k[2], "person": 100 * k[3] / k[2], "org": 100 * k[4] / k[2]} for k in D["cases"]["kinds"]}

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
        f"De {first} à {last}, une personne y est citée dans {fr(NP)} accidents sur {fr(N)}",
    )
    has(
        "essentials",
        text("#essentiel"),
        f"Une personne est citée dans {pct(S['person'])} des accidents, l'environnement dans {pct(S['env'])}, une panne de l'appareil dans {pct(S['machine'])}",
        f"citée dans {pct(100 * NF and 100 * n_of(fat, lambda m: m & PERSON) / NF)} des accidents mortels, qui comptent {pct(100 * deaths_p / deaths)} des morts",
        f"n'est citée que dans {pct(seg['airline']['person'])} des accidents, l'environnement dans {pct(seg['airline']['env'])}",
        f"une organisation n'est citée que dans {pct(S['org'])} des accidents, mais dans {pct(KD['M']['org'])} des enquêtes majeures",
    )
    check("three accidents in four", 70 <= S["person"] < 80, pct(S["person"], 1))
    has(
        "the verdict",
        text("#verdict"),
        f"Une personne est citée dans la cause probable de {pct(S['person'], 1)} des accidents. L'environnement l'est dans {pct(S['env'])}, une panne de l'appareil dans {pct(S['machine'])}",
        f"En les comptant, le facteur humain monte à {pct(broad)}",
        "Un accident peut avoir plusieurs causes : les parts ne s'additionnent pas",
    )
    bars = [norm(t) for t in pg.eval_on_selector_all("#chart-layers .hb-val", "es => es.map(e => e.textContent)")]
    check("layers chart", bars[:4] == [pct(S[k]) for k in ("person", "env", "handling", "machine")], str(bars))

    fn = sev[0][1]
    others = [s[2] for s in sev[1:]]
    has(
        "severity",
        text("#gravite"),
        f"Une personne est citée dans {pct(sev[0][2])} des accidents mortels, contre {fr(min(others))} à {pct(max(others))} pour les autres",
        f"Les accidents mortels qui citent une personne comptent {pct(100 * deaths_p / deaths)} des morts",
        f"pour 10 accidents mortels, {round(10 * sev[3][1] / fn)} sans blessé",
    )

    old = [(y, 100 * pp / n, 100 * mm / n) for y, n, pp, mm in H["old"]]
    new = [(y, 100 * pp / n, 100 * mm / n) for y, n, pp, mm in H["new"]]
    rng = lambda xs: f"{fr(min(xs))} à {pct(max(xs))}"  # noqa: E731
    min_times = min(r[2] / r[3] for r in H["old"] + H["new"])
    has(
        "forty years",
        text("#quarante-ans"),
        f"Depuis {old[0][0]}, une personne est citée au moins {TIMES[min(10, math.floor(min_times))]} fois plus souvent qu'une panne",
        f"de {old[0][0]} à {old[-1][0]}, une personne est citée dans {rng([r[1] for r in old])} des accidents",
        f"La panne de l'appareil recule, de {pct(old[0][2])} à {pct(old[-1][2])}",
        f"une personne est citée dans {rng([r[1] for r in new[1:]])} des accidents, une panne dans {rng([r[2] for r in new])}",
        f"Seule {new[0][0]}, année de transition, descend à {pct(new[0][1])}",
    )

    has(
        "who",
        text("#qui"),
        f"le pilote, l'instructeur ou l'élève, dans {pct(100 * g['controls'] / g['person'])} des cas",
        f"Un mécanicien ou un constructeur amateur est nommé dans {fr(R['maintenance'])} accidents, un contrôleur aérien dans {fr(R['atc'])}",
        f"elle fait {pct(100 * seg['ga']['n'] / N)} des accidents",
    )
    errs = sorted(((k, v) for k, v in g["errors"].items()), key=lambda t: -t[1])
    has(
        "errors",
        text("#erreurs"),
        f"par la personne aux commandes : {fr(errs[0][1])} accidents, {pct(100 * errs[0][1] / N)} du total",
        f"La désorientation spatiale est citée dans {fr(g['errors']['2-20-25'])} accidents, dont {fr(gf['errors']['2-20-25'])} mortels",
    )
    L = g["levels"]
    hb = n_of(allc, lambda m: m & (PERSON | ORG))
    fhb = n_of(fat, lambda m: m & (PERSON | ORG))
    has(
        "HFACS",
        text("#hfacs"),
        f"ils retiennent un acte dangereux dans {pct(100 * L['1'] / hb)} des cas, et l'organisation dans {pct(100 * L['4'] / hb, 1)}",
        f"une condition préalable y figure dans {pct(100 * gf['levels']['2'] / fhb)} des cas, contre {pct(100 * L['2'] / hb)} en moyenne",
        "Le rapprochement des constats du NTSB avec les familles de HFACS est celui de l'auteur",
    )

    threat = ENV | MACHINE
    st = n_of(allc, lambda m: m & STATE)
    has(
        "TEM",
        text("#tem"),
        f"une erreur d'une personne est presque toujours citée : dans {pct(100 * n_of(allc, lambda m: m & STATE and m & PERSON) / st)} des cas",
        f"Il en cite un dans {pct(100 * st / N)} des accidents",
        f"une menace est citée sans aucune personne dans {pct(100 * n_of(allc, lambda m: m & threat and not m & PERSON) / N)} des accidents seulement",
    )

    four = PERSON | MACHINE | ENV | ORG
    combo = lambda mask: 100 * n_of(allc, lambda m: (m & four) == mask) / N  # noqa: E731
    three = n_of(allc, lambda m: bin(m & four).count("1") >= 3)
    has(
        "Swiss cheese",
        text("#fromage"),
        f"La moitié des accidents ({pct(combo(PERSON))}) ne citent qu'une couche, la personne",
        f"Une personne et l'environnement ensemble : {pct(combo(PERSON | ENV))} des accidents",
        f"Trois couches ou plus : {pct(100 * three / N, 1)}",
    )
    check("half the accidents cite a person alone", 45 <= combo(PERSON) < 58, pct(combo(PERSON)))

    ev = {k: (n, pp, f) for k, n, pp, f in E["by"]["all|all"]}
    es = lambda k: pct(100 * ev[k][1] / ev[k][0])  # noqa: E731
    least = min(
        100 * ev[k][1] / ev[k][0]
        for k in ("Aerodynamic stall/spin", "Controlled flight into terr/obj (CFIT)", "VFR encounter with IMC")
    )
    has(
        "defining events",
        text("#evenements"),
        f"une personne est citée dans {es('Loss of control in flight')} des pertes de contrôle en vol, mais dans {es('Loss of engine power (total)')} des pertes totales de puissance",
        "citent une personne plus de neuf fois sur dix" if least >= 90 else f"dans au moins {pct(least)} des cas",
        f"font à elles seules {pct(100 * ev['Loss of control in flight'][2] / NF)} des accidents mortels",
    )

    air = seg["airline"]
    aev = {k: (n, pp) for k, n, pp, _ in E["by"]["airline|all"]}
    turb = [v for k, v in aev.items() if "urbulence" in k]
    tn, tp = sum(v[0] for v in turb), sum(v[1] for v in turb)
    has(
        "airlines",
        text("#compagnies"),
        f"une personne est citée dans {pct(air['person'])} des accidents, l'environnement dans {pct(air['env'])}",
        f"ne comptent que {fr(air['n'])} accidents en {last - first + 1} ans, dont {fr(n_of(cells('airline', 'FATL')))} mortels",
        f"Elle est l'événement déterminant de {pct(100 * tn / air['n'])} de leurs accidents",
        f"une personne n'est citée que dans {fr(tp)} d'entre eux",
        f"{pct(air['org'], 1)} des accidents, contre {pct(seg['ga']['org'], 1)} en aviation générale",
    )
    has(
        "the answer",
        text("#reponse-prose"),
        f"une personne est citée dans {pct(S['person'])} des accidents, {TIMES[math.floor(S['person'] / S['machine'])]} fois plus souvent qu'une panne",
        f"La hiérarchie tient depuis {old[0][0]}",
        f"l'organisation n'est citée que dans {pct(S['org'], 1)} des accidents, mais dans {pct(KD['M']['org'])} des enquêtes majeures",
    )
    check("no key-figure box is left", pg.locator(".keyfig").count() == 0)

    # six accidents under the loupe: investigation types, then each case, finding by finding
    order = pg.eval_on_selector_all("main section.story-chapter", "ss => ss.map(s => s.id)")
    check("loupe comes right after HFACS", order.index("loupe") == order.index("hfacs") + 1, str(order))
    es = pg.eval_on_selector_all("#essentiel-list a", "as => as.map(a => a.getAttribute('href'))")
    check("essentials follow the page", es == ["#verdict", "#gravite", "#loupe", "#compagnies"], str(es))
    has(
        "loupe: the deeper the investigation",
        text("#loupe"),
        f"Le NTSB ne mène qu'une poignée d'enquêtes majeures : {fr(KD['M']['n'])} accidents de {first} à {last}",
        f"Il y cite une organisation dans {pct(KD['M']['org'])} des cas, contre {pct(KD['L']['org'], 1)} quand l'enquête est limitée",
        f"elle reste citée dans {pct(KD['M']['person'])} des enquêtes majeures",
        f"Les {pct(S['org'], 1)} d'accidents qui citent une organisation",
    )
    kv = [norm(t) for t in pg.eval_on_selector_all("#chart-kinds .hb-val", "es => es.map(e => e.textContent)")]
    check("loupe: investigation types chart", kv[0] == pct(KD["M"]["org"]) and kv[2] == pct(KD["L"]["org"], 1), str(kv))
    cols = [k for k, _ in D["cases"]["columns"]]
    pg.locator("#lp").scroll_into_view_if_needed()
    for c in D["cases"]["cases"]:
        pg.click(f"#lp-pick tr[data-key='{c['key']}']")
        pg.wait_for_timeout(150)
        fs = c["findings"]
        want_cols = []
        for k in cols:
            inc = [f for f in fs if f[2] == k]
            want_cols.append("cited" if any(f[0] for f in inc) else "other" if inc else "none")
        got_cols = pg.eval_on_selector_all(
            f"#lp-pick tr[data-key='{c['key']}'] .lp-dot", "ds => ds.map(d => d.classList[1])"
        )
        n_pc = sum(1 for f in fs if f[0])
        pierced = want_cols.count("cited")
        couche = "couches" if pierced > 1 else "couche"
        check(f"loupe {c['key']}: layers in the table", got_cols == want_cols, f"{got_cols} vs {want_cols}")
        has(
            f"loupe {c['key']}: count",
            text("#lp-count"),
            f"Le NTSB a codé {fr(len(fs))} constats, dont {fr(n_pc)} retenus dans la cause probable. Ils touchent {fr(pierced)} {couche} sur cinq",
        )
        drawn = pg.locator("#lp-diagram .lp-chip").count()
        shown = sum(1 for f in fs if f[2])
        check(f"loupe {c['key']}: every finding drawn", drawn == shown, f"{drawn} vs {shown}")
        n_links = pg.locator("#lp-ntsb a[href^='https://']").count()
        check(f"loupe {c['key']}: report and what followed are sourced", n_links >= 2, f"{n_links} links")
    # a finding opens its reading; the toggle keeps only the probable cause
    pg.click("#lp-pick tr[data-key='colgan']")
    first_pc = next(f for f in D["cases"]["cases"][0]["findings"] if f[0] and f[2] == "org")
    pg.click("#lp-diagram .lp-col-org .lp-chip.cited")
    has("loupe: a finding opens its reading", text("#lp-detail"), first_pc[6], "Retenu dans la cause probable")
    pg.click("#lp-others")
    n_pc0 = sum(1 for f in D["cases"]["cases"][0]["findings"] if f[0] and f[2])
    check("loupe: the toggle keeps the probable cause", pg.locator("#lp-diagram .lp-chip").count() == n_pc0)
    pg.click("#lp-others")
    check("loupe: links tie findings to the accident", pg.locator("#lp-diagram .lp-link").count() > 5)

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
