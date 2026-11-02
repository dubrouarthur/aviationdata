# ruff: noqa: E501  (the expected sentences are long)
"""The European story, end to end: every number of its text recomputed in Python from
web/public/data/eu/eu.json and compared with the page, the dashboard for a few countries, the maps, the
sources and the phone layout. Serve web/dist on 127.0.0.1:4173 first.

    python3 web/scripts/check_eu.py [--base http://127.0.0.1:4173]

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
D = json.loads((ROOT / "public" / "data" / "eu" / "eu.json").read_text())
Y, AY, LAST = D["years"], D["airportYears"], D["meta"]["last"]
Z = {z["code"]: z for z in D["zones"]}
EU = Z["EU27_2020"]
C = [z for z in D["zones"] if z["code"] != "EU27_2020"]
failures = []


def check(where, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + where + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(where)


def has(where, text, *needles):
    missing = [n for n in needles if norm(n) not in text]
    check(where, not missing, f"missing {missing}" if missing else "")


def fr(v, d=0):
    q = Decimal(str(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    return f"{abs(q):,.{d}f}".replace(",", " ").replace(".", ",")


norm = lambda s: re.sub(r"[\s  ]+", " ", s)  # noqa: E731
up = lambda v, d=0: f"{fr(v, d)} %"  # noqa: E731
sign = lambda v, d=0: f"{'+' if v > 0 else '−' if v < 0 else ''}{fr(v, d)} %"  # noqa: E731
mio = lambda v, d=1: f"{fr(v / 1e6, d)} M" if v >= 1e6 else fr(round(v / 1000) * 1000)  # noqa: E731
big = lambda v: f"{fr(v / 1e9, 2)} milliard" if v >= 1e9 else f"{fr(v / 1e6, 1)} millions"  # noqa: E731
MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
month = lambda ym: f"{MONTHS[int(ym[5:7]) - 1]} {ym[:4]}"  # noqa: E731
v = lambda z, y, k="total": z[k][Y.index(y)]  # noqa: E731


def months(z):
    out, (y, m) = [], map(int, z["monthStart"].split("-"))
    while f"{y}-{m:02d}" <= z["monthLast"]:
        out.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def km(a, b):
    r = math.pi / 180
    la1, lo1, la2, lo2 = a["lat"] * r, a["lon"] * r, b["lat"] * r, b["lon"] * r
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


# ---------------------------------------------------------------- the facts, again
now, y19, y20, y08 = v(EU, LAST), v(EU, 2019), v(EU, 2020), v(EU, 2008)
back = next(y for y in Y if y > 2020 and v(EU, y) > y19)
ms = months(EU)
ser = dict(zip(ms, EU["monthly"]["total"], strict=True))
low = min((m for m in ms if ser[m] is not None), key=lambda m: ser[m])
rec = max((m for m in ms if ser[m] is not None), key=lambda m: ser[m])
low_drop = 100 * (1 - ser[low] / ser[f"2019-{low[5:]}"])
last_m = EU["monthLast"]
part_now = sum(ser[m] for m in ms if m[:4] == last_m[:4])
part_before = sum(ser[f"{int(m[:4]) - 1}{m[4:]}"] for m in ms if m[:4] == last_m[:4])
vs = sorted(
    ({"code": z["code"], "name": z["name"], "ch": 100 * (v(z, LAST) / v(z, 2019) - 1)} for z in C),
    key=lambda r: -r["ch"],
)
above = [r for r in vs if r["ch"] > 0]
below = [r for r in vs if r["ch"] < 0]
get = lambda code: next(r for r in vs if r["code"] == code)  # noqa: E731
nat = sorted(
    (
        {
            "code": z["code"],
            "y19": v(z, 2019, "nat"),
            "now": v(z, LAST, "nat"),
            "ch": 100 * (v(z, LAST, "nat") / v(z, 2019, "nat") - 1),
        }
        for z in C
        if v(z, 2019, "nat") >= 500_000
    ),
    key=lambda r: r["ch"],
)
ngot = lambda code: next(r for r in nat if r["code"] == code)  # noqa: E731
nat_down = [r for r in nat if r["ch"] < 0]
nat_share = lambda y: 100 * v(EU, y, "nat") / v(EU, y)  # noqa: E731
parts_ch = {k: 100 * (v(EU, LAST, k) / v(EU, 2019, k) - 1) for k in ("nat", "ieu", "xeu")}


def ranking(y):
    i = AY.index(y)
    return [
        a["code"] for a in sorted((a for a in D["airports"] if a["pax"][i] is not None), key=lambda a: -a["pax"][i])
    ]


apt = {a["code"]: a for a in D["airports"]}
pax = lambda code, y: apt[code]["pax"][AY.index(y)]  # noqa: E731
rank = lambda code, y: ranking(y).index(code) + 1  # noqa: E731
last_second = max(y for y in AY if rank("EDDF", y) == 2)
mad_ahead = min(y for y in AY if y > 2008 and rank("LEMD", y) < rank("EDDF", y))
B = {b["y"]: b for b in D["barycentre"]}
north = max(D["barycentre"], key=lambda b: b["lat"])
since19 = km(B[2019], B[LAST])


def south_share(y):
    return B[y]["south45"]


# the barycentre from the airports the map draws (above 250 000 passengers once): close to the ETL's,
# which counts every airport (tests/test_eu.py recomputes that one from Eurostat's files)
def bary(y):
    i = AY.index(y)
    x = yy = zz = 0.0
    for a in D["airports"]:
        if not a["box"] or not a["pax"][i]:
            continue
        la, lo = math.radians(a["lat"]), math.radians(a["lon"])
        x += a["pax"][i] * math.cos(la) * math.cos(lo)
        yy += a["pax"][i] * math.cos(la) * math.sin(lo)
        zz += a["pax"][i] * math.sin(la)
    return {"lat": math.degrees(math.atan2(zz, math.hypot(x, yy))), "lon": math.degrees(math.atan2(yy, x))}


# north (+) or south (-) of the 2019 position, km along the meridian
KM_DEG = 6371.0088 * math.pi / 180
off = {y: (B[y]["lat"] - B[2019]["lat"]) * KM_DEG for y in B}
south19 = -off[LAST]
lowest = min(D["barycentre"], key=lambda b: b["lat"])["y"]
plateau = [-off[y] for y in B if y > lowest]
climb = (north["lat"] - B[min(B)]["lat"]) * KM_DEG

# gains and losses since 2019 (the ETL's totals, every airport of the box; the drawn airports one by one,
# Berlin's two together)
S = D["shift"]
s_ch = S["south"]["after"] - S["south"]["before"]
n_ch = S["north"]["after"] - S["north"]["before"]
per = {}
for a in D["airports"]:
    if not a["box"]:
        continue
    c = S["merged"].get(a["code"], a["code"])
    r = per.setdefault(c, {"code": c, "before": 0, "after": 0})
    r["before"] += a["pax"][AY.index(S["from"])] or 0
    r["after"] += a["pax"][AY.index(S["to"])] or 0
    if a["code"] == c:
        r.update(name=S["names"].get(c, a["name"]), lat=a["lat"])
sh_rows = [{**r, "ch": r["after"] - r["before"]} for r in per.values() if r["before"] or r["after"]]
winners = sorted(sh_rows, key=lambda r: -r["ch"])
losers = winners[::-1]
shr = {r["code"]: r for r in sh_rows}
south_rows = [r for r in sh_rows if r["lat"] < S["split"]]
north_rows = [r for r in sh_rows if r["lat"] >= S["split"]]
gain_share = lambda rows: 100 * sum(r["ch"] > 0 for r in rows) / len(rows)  # noqa: E731
signed_m = lambda v: f"{'+' if v > 0 else '−'}{mio(abs(v))}"  # noqa: E731


for y in (2008, 2019, LAST):
    check(
        f"barycentre {y}: the drawn airports land within 10 km", km(bary(y), B[y]) < 10.0, f"{km(bary(y), B[y]):.2f} km"
    )
# the parts make the total
for z in [EU, *C]:
    for y in Y:
        t, parts = v(z, y), [v(z, y, k) for k in ("nat", "ieu", "xeu")]
        if t is not None and None not in parts and abs(sum(parts) - t) > 0.002 * t:
            check(f"{z['code']} {y}: national + intra-EU + extra-EU = total", False, f"{sum(parts)} vs {t}")
check("the parts add up (every zone, every year)", True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(base + "/ciel-europeen", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    text = lambda sel: norm(pg.inner_text(sel))  # noqa: E731

    has(
        "standfirst",
        text("#open-dek"),
        f"En {LAST}, les avions ont transporté {big(now)} de passagers dans l'Union européenne, un record",
        "la plupart des pays du Sud et de l'Est dépassent nettement 2019, l'Allemagne, la Finlande et la Suède restent en dessous",
    )
    check("Germany, Finland and Sweden are below 2019", all(get(c)["ch"] < 0 for c in ("DE", "FI", "SE")))
    has(
        "year readout",
        text("#ey-read"),
        f"Union européenne, {LAST} : {big(now)} de passagers, {sign(100 * (now / y19 - 1), 1)} par rapport à 2019",
    )
    has(
        "essentials",
        text("#essentiel"),
        f"{fr(now / 1e9, 2)} Md",
        f"En {LAST}, l'Union compte {big(now)} de passagers aériens (un aller-retour compte deux fois), {up(100 * (now / y19 - 1), 1)} de plus qu'en 2019",
        f"Elle avait retrouvé son niveau d'avant-Covid dès {back}",
        f"{len(above)} sur {len(vs)}",
        f"Non : {len(below)} pays restent sous 2019, dont la Finlande ({sign(get('FI')['ch'])}) et l'Allemagne ({sign(get('DE')['ch'])})",
        sign(ngot("DE")["ch"]),
        f"Ils reculent dans {len(nat_down)} pays sur {len(nat)}",
        f"la Suède {up(ngot('SE')['ch'])}",
        f"Oui, vers le sud. Les aéroports au sud du 45e parallèle ont gagné {big(s_ch)} de passagers depuis 2019, ceux du nord en ont perdu. Le centre de gravité a glissé de {fr(south19)} km",
    )
    check("the north lost passengers", n_ch < 0)
    check("Malta and Poland: more than a third above 2019", get("MT")["ch"] > 100 / 3 and get("PL")["ch"] > 100 / 3)
    check("Germany lost nearly half its national passengers", 45 <= -ngot("DE")["ch"] < 50, f"{ngot('DE')['ch']:.1f}")
    check(
        "national flights grow exactly in Spain, Italy, Greece and Portugal",
        sorted(r["code"] for r in nat if r["ch"] > 0) == ["EL", "ES", "IT", "PT"],
        str([r["code"] for r in nat if r["ch"] > 0]),
    )
    # the dashboard, for the Union then for a few countries and kinds of flight
    has(
        "dashboard readout (Union)",
        text("#board-readout"),
        f"Union européenne, tous vols, {LAST} : {mio(now)} de passagers, {sign(100 * (now / y19 - 1), 1)} par rapport à 2019. Record mensuel : {month(rec)} ({mio(ser[rec])})",
    )
    for code, key, label in (
        ("FR", "total", "Tous les vols"),
        ("DE", "nat", "Vols intérieurs"),
        ("PL", "intl", "Vols internationaux"),
    ):
        pg.select_option("#board-zone", code)
        pg.click(f"#board-key button:has-text('{label}')")
        pg.wait_for_timeout(300)
        z = Z[code]
        zs = dict(zip(months(z), z["monthly"][key], strict=True))
        zr = max((m for m in zs if zs[m] is not None), key=lambda m: zs[m])
        words = {"total": "tous vols", "nat": "vols intérieurs", "intl": "vols internationaux"}[key]
        has(
            f"dashboard readout ({code}, {key})",
            text("#board-readout"),
            f"{z['name']}, {words}, {LAST} : {mio(v(z, LAST, key))} de passagers, {sign(100 * (v(z, LAST, key) / v(z, 2019, key) - 1), 1)} par rapport à 2019. Record mensuel : {month(zr)} ({mio(zs[zr])})",
        )
        summer = (zs[f"{LAST}-07"] + zs[f"{LAST}-08"]) / 2
        winter = (zs[f"{LAST}-01"] + zs[f"{LAST}-02"]) / 2
        has(
            f"seasons ({code}, {key})",
            text("#h-board-heat"),
            f"En {LAST}, un mois d'été vaut {fr(summer / winter, 1)} mois d'hiver",
        )
        has(
            f"national share ({code})",
            text("#h-board-parts"),
            f"{z['name']} : {fr(100 * v(z, LAST, 'nat') / v(z, LAST))} % de passagers intérieurs en {LAST}",
        )
        rows = pg.locator("#board-apt tbody tr").count()
        n_apt = sum(1 for a in D["airports"] if a["country"] == code and a["pax"][AY.index(LAST)] is not None)
        check(f"airports listed ({code})", rows == min(10, n_apt), f"{rows} rows")
        check(
            f"airport table not clipped ({code})",
            pg.evaluate(
                "() => { const t = document.querySelector('#board-apt .table-scroll'); return t.scrollHeight <= t.clientHeight + 1; }"
            ),
        )
    pg.select_option("#board-zone", "EU27_2020")
    pg.click("#board-key button:has-text('Tous les vols')")

    has(
        "the record",
        text("#record"),
        f"En 2020, l'Union a perdu {up(100 * (1 - y20 / y19))} de ses passagers aériens",
        f"En {month(low)}, le pire mois, elle comptait {up(low_drop)} de passagers en moins qu'un an plus tôt",
        f"Le trafic repasse au-dessus de 2019 en {back}, avec {big(v(EU, back))} de passagers",
        f"Il bat un nouveau record en {LAST} : {big(now)}",
        f"les passagers des vols entre pays de l'Union ont augmenté de {up(parts_ch['ieu'])}, ceux des vols vers le reste du monde de {up(parts_ch['xeu'])}",
        f"Ceux des vols intérieurs ont reculé de {up(parts_ch['nat'])}",
        f"de janvier à {MONTHS[int(last_m[5:]) - 1]}, {sign(100 * (part_now / part_before - 1), 1)} par rapport aux mêmes mois",
    )
    check("intra-EU flights grow most", parts_ch["ieu"] > max(parts_ch["xeu"], parts_ch["nat"]))
    got = [norm(t) for t in pg.eval_on_selector_all("#chart-union .rc-ch", "es => es.map(e => e.textContent)")]
    want = [norm(sign(parts_ch[k])) for k in ("ieu", "xeu", "nat")]
    check("recovery chart: change since 2019 by type of flight", got == want, f"{got} vs {want}")
    has(
        "the south",
        text("#sud"),
        f"{len(above)} pays au-dessus de 2019, l'Allemagne et le Nord en dessous",
        f"{len(above)} pays sur {len(vs)} dépassent leur niveau de 2019 en {LAST}",
        f"Malte ({sign(get('MT')['ch'])}) et en Pologne ({sign(get('PL')['ch'])})",
        f"{len(below)} pays sous leur niveau de 2019",
        f"la Finlande ({sign(get('FI')['ch'])}) et la Suède ({sign(get('SE')['ch'])}) ont perdu près d'un passager sur cinq",
        f"l'Allemagne ({sign(get('DE')['ch'])}) et les Pays-Bas ({sign(get('NL')['ch'])})",
        "la Lettonie, la Slovénie et la Norvège",
        f"la Pologne a multiplié ses passagers par {fr(v(Z['PL'], LAST) / v(Z['PL'], 2008), 1)} depuis 2008, la Roumanie par {fr(v(Z['RO'], LAST) / v(Z['RO'], 2008), 1)}",
    )
    check(
        "Malta and Poland lead, Finland and Sweden trail",
        [r["code"] for r in vs[:2]] == ["MT", "PL"] and [r["code"] for r in vs[-2:]] == ["SE", "FI"],
    )
    check("Finland and Sweden lost about one in five", all(17 <= -get(c)["ch"] <= 22 for c in ("FI", "SE")))
    check(
        "the seven below 2019 are named",
        sorted(r["code"] for r in below) == sorted(["FI", "SE", "DE", "NL", "LV", "SI", "NO"]),
        str([r["code"] for r in below]),
    )
    coloured = pg.evaluate(
        "() => [...document.querySelectorAll('#chart-choro path.cty.in')].filter(p => getComputedStyle(p).fill !== 'rgb(228, 234, 231)').length"
    )
    check("choropleth colours every country", coloured >= len(C) - 2, f"{coloured}")
    has(
        "national flights",
        text("#interieur"),
        f"En Allemagne, les passagers des vols intérieurs sont passés de {mio(ngot('DE')['y19'])} en 2019 à {mio(ngot('DE')['now'])} en {LAST}",
        f"Seule l'Autriche, aux vols intérieurs bien plus rares ({mio(ngot('AT')['y19'])} passagers en 2019), recule davantage",
        f"Moins de passagers intérieurs qu'en 2019 dans {len(nat_down)} pays sur {len(nat)}",
        f"La Suède ({sign(ngot('SE')['ch'])}) et la Finlande ({sign(ngot('FI')['ch'])}) suivent",
        f"La France perd {up(ngot('FR')['ch'])} de ses passagers intérieurs",
        f"ne font plus que {fr(nat_share(LAST), 1)} % des passagers, contre {fr(nat_share(2008), 1)} % en 2008",
    )
    check(
        "only Austria falls further than Germany",
        [r["code"] for r in nat[:4]] == ["AT", "DE", "SE", "FI"],
        str([r["code"] for r in nat[:4]]),
    )
    has(
        "airports",
        text("#aeroports"),
        f"Francfort était le 2e aéroport de l'Union et de l'AELE jusqu'en {last_second}. Il est {rank('EDDF', LAST)}e depuis {mad_ahead}, derrière Madrid-Barajas",
        f"En {LAST}, Madrid compte {mio(pax('LEMD', LAST))} de passagers, Francfort {mio(pax('EDDF', LAST))}",
        f"Paris-Charles-de-Gaulle reste premier, avec {mio(pax('LFPG', LAST))}, mais sous son niveau de 2019 ({mio(pax('LFPG', 2019))})",
        f"Francfort a perdu {up(100 * (1 - pax('EDDF', LAST) / pax('EDDF', 2019)))} de ses passagers depuis 2019, Rome-Fiumicino en a gagné {up(100 * (pax('LIRF', LAST) / pax('LIRF', 2019) - 1))}",
        f"Athènes passe de la {rank('LGAV', 2019)}e place en 2019 à la {rank('LGAV', LAST)}e en {LAST}, avec {sign(100 * (pax('LGAV', LAST) / pax('LGAV', 2019) - 1))} de passagers",
    )
    check(
        "Frankfurt is 4th every year since Madrid passed it",
        all(rank("EDDF", y) == rank("EDDF", LAST) for y in AY if y >= mad_ahead),
    )
    check("Paris-CDG first every year", all(rank("LFPG", y) == 1 for y in AY))
    has(
        "spikes",
        text("#pics"),
        f"Au sud du 45e parallèle, {big(s_ch)} de passagers de plus",
        f"Entre 2019 et {LAST}, les aéroports situés au sud du 45e parallèle, qui passe près de Bordeaux et de Turin, ont gagné {big(s_ch)} de passagers. Ceux du nord en ont perdu {big(-n_ch)}",
        "Madrid, Athènes et Rome gagnent le plus, Berlin et Francfort perdent le plus",
        f"les {len(sh_rows)} aéroports de l'Union et de l'AELE qui ont dépassé 250 000 passagers au moins une année depuis 2008",
        "Au sud du 45e parallèle, chaque tranche de latitude gagne des passagers",
        f"Au sud du parallèle, {fr(gain_share(south_rows))} % des aéroports ont gagné des passagers depuis 2019, contre {fr(gain_share(north_rows))} % au nord",
        f"Madrid-Barajas ({signed_m(shr['LEMD']['ch'])}) et Athènes ({signed_m(shr['LGAV']['ch'])}) gagnent le plus, devant Rome-Fiumicino et Malaga",
        f"Au nord, Berlin perd le plus, ses deux aéroports réunis ({signed_m(shr['EDDB']['ch'])}), devant Francfort ({signed_m(shr['EDDF']['ch'])})",
        f"Au nord, Varsovie-Chopin ({signed_m(shr['EPWA']['ch'])}) et Cracovie ({signed_m(shr['EPKK']['ch'])}) comptent parmi les dix plus fortes hausses ; au sud, Toulouse-Blagnac et Bordeaux-Mérignac reculent",
        f"Les parts d'aéroports portent sur les {len(sh_rows)} aéroports de la carte",
    )
    check("winners: Madrid, Athens, Rome, Malaga", [r["code"] for r in winners[:4]] == ["LEMD", "LGAV", "LIRF", "LEMG"])
    check("losers: Berlin, Frankfurt", [r["code"] for r in losers[:2]] == ["EDDB", "EDDF"])
    check("Berlin counts Tegel", S["merged"] == {"EDDT": "EDDB"} and "EDDT" not in shr)
    check(
        "Warsaw and Krakow: north, in the top ten",
        all(shr[c]["lat"] >= 45 and shr[c] in winners[:10] for c in ("EPWA", "EPKK")),
    )
    check(
        "Toulouse and Bordeaux: south, falling", all(shr[c]["lat"] < 45 and shr[c]["ch"] < 0 for c in ("LFBO", "LFBD"))
    )
    check("every band south of 45° gains", all(b["change"] > 0 for b in S["bands"] if b["lat"] + 2 <= S["split"]))
    n_spk = pg.locator("#chart-spikes .spikes path").count()
    check("the spike map draws its airports", n_spk == sum(abs(r["ch"]) >= 50_000 for r in sh_rows), f"{n_spk}")
    has(
        "barycentre",
        text("#gravite"),
        f"Le centre de gravité a glissé de {fr(south19)} km vers le sud",
        f"En {LAST}, il se trouve {fr(south19)} km au sud de sa position de 2019",
        f"Un plongeon en {lowest}, puis un palier",
        f"Au nord-est jusqu'en {north['y']}, puis cap au sud",
        f"De {min(B)} à {north['y']}, il était remonté de {fr(climb)} km vers le nord. Il est ensuite redescendu, puis a plongé en {lowest}, à {fr(-off[lowest])} km au sud de sa position de 2019 : cette année-là, les aéroports du Sud ont perdu moins de passagers que ceux du Nord",
        f"Depuis {lowest + 1}, il ne bouge presque plus, entre {fr(min(plateau))} km et {fr(max(plateau))} km au sud de 2019 : la reprise ne l'a pas ramené",
        f"accueillent {fr(south_share(LAST), 1)} % des passagers en {LAST}, contre {fr(south_share(2019), 1)} % en 2019",
    )
    b08, bN = B[min(B)], north
    check("north-east until the northernmost year", bN["lat"] > b08["lat"] and bN["lon"] > b08["lon"])
    check("then south every year until 2019", all(B[y]["lat"] < B[y - 1]["lat"] for y in range(north["y"] + 1, 2020)))
    check("lowest point in 2021", lowest == 2021)
    check("a plateau: within 15 km, far south of 2019", max(plateau) - min(plateau) < 15 and min(plateau) > 50)
    check("the move since 2019 is mostly southward", south19 > 0.95 * since19)
    check("2021: southern airports lost less", south_share(2021) > south_share(2019))
    check("one bar per year", pg.locator("#chart-offset rect").count() == len(B))
    has(
        "the answer",
        text("#reponse-prose"),
        f"{big(now)} de passagers dans l'Union en {LAST}, un record",
        f"{len(below)} pays restent en dessous",
        f"Au sud du 45e parallèle, les aéroports ont gagné {big(s_ch)} de passagers depuis 2019, et le centre de gravité des passagers a glissé de {fr(south19)} km vers le sud",
        "Les données disent où les passagers volent, pas pourquoi",
    )
    # every figure has its source and a number, every chapter lists its data
    srcs = pg.evaluate(
        "() => [...document.querySelectorAll('main .panel')].filter(p => !p.querySelector('.source-line a[href^=\"http\"]')).length"
    )
    check("every figure names its source", srcs == 0, f"{srcs} without")
    has(
        "method",
        text("#sources"),
        "Eurostat autorise la réutilisation de ses données, source citée",
        "un passager en correspondance compte deux fois",
        "Règlement (CE) n° 437/2003",
    )
    check("no page error", not errors, str(errors))
    # the phone
    m = b.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    m.goto(base + "/ciel-europeen", wait_until="networkidle")
    m.wait_for_timeout(2000)
    wide = m.evaluate("() => document.documentElement.scrollWidth - innerWidth")
    check("phone: no horizontal scroll", wide <= 1, f"{wide}px")
    b.close()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
