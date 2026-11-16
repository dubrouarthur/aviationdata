"""Business jets in Europe in the OpenSky Network's flight lists, 2019-2022: web/public/data/jets/jets.json.

Source: OpenSky Network, « Crowdsourced air traffic data » (Zenodo record 7923702), one gzip a month
(data/raw/opensky/flightlist/, etl/jets/fetch.py): every flight its receivers followed, with the
aircraft's ICAO type code, the airports of departure and arrival when the network saw them, the times
and positions where it was first and last seen. A flight without a type code takes the one the OpenSky
aircraft database gives its transponder address. Airports: OurAirports (coordinates, country).

Who counts:
- business jets = the closed list of etl/jets/jets_table.py; airliners, the comparison = the closed list of
  etl/avions/types_table.py (investigation n° 8);
- Europe = a flight whose airport of departure or arrival is in EUROPE (the Union, the United Kingdom,
  Switzerland, Norway, Iceland and the micro-states); France = an airport whose ICAO code starts with LF
  (metropolitan France and Corsica).

What a flight list is not: a census. The network sees what its volunteers' receivers hear; it names an
airport only when it saw the aircraft low enough near it. A flight whose airports were not seen has no
place, so every count here is a count of flights placed by the network (`coverage` says how many it
placed over Europe), and the network grew between 2019 and 2022: the page compares business jets with
airliners in the same data, month by month, rather than counting on the levels.

Only aggregates leave data/raw/ (OpenSky's terms): no callsign, transponder address or registration. The
callsign is only compared, in memory, with the aircraft's registration: flown under its registration, or
under an operator's three-letter code (charter, fractional ownership, air taxi, airline).

    python3 etl/jets/build_jets.py          # JETS_PARTIAL=1 accepts missing months (prototype only)
"""

from __future__ import annotations

import csv
import json
import os
import pickle
import sys
from collections import Counter, defaultdict
from datetime import date
from functools import partial
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "avions"))
from jets_table import JETS  # noqa: E402
from places_fr import PLACES_FR  # noqa: E402
from types_table import ALIAS, TYPES  # noqa: E402

ROOT = HERE.parents[1]
RAW = ROOT / "data" / "raw"
FL = RAW / "opensky" / "flightlist"
OUT = ROOT / "web" / "public" / "data" / "jets" / "jets.json"
YEARS = [2019, 2020, 2021, 2022]
COMPARE = [2019, 2022]  # the two whole years before and after Covid, as in investigation n° 8

EU27 = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split()
EUROPE = set(EU27) | {"GB", "CH", "NO", "IS", "LI", "MC", "SM", "AD", "VA"}
# a box around Europe, for the coverage only: flights first and last seen inside it
BOX = (34.0, 72.0, -25.0, 45.0)
KM_BIN = 50
KM_MAX = 8000
SHORT_KM = 500
TOP_ROUTES = 40
FLEET_MIN = 12  # flights over Europe in 2019 for an aircraft to enter the fleet panel
SEASON_MIN = 300  # business-jet movements in 2019 and in 2022 for an airport's seasons
CACHE = RAW / "opensky" / "jets_tally.pkl"  # the month by month tallies, so that the output can be redone


def airports() -> pd.DataFrame:
    rows = []
    with (RAW / "eurostat" / "ourairports.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                lat, lon = float(r["latitude_deg"]), float(r["longitude_deg"])
            except ValueError:
                continue
            rows.append((r["ident"], lat, lon, r["iso_country"], r["name"], r["municipality"]))
    df = pd.DataFrame(rows, columns=["ident", "lat", "lon", "cc", "name", "city"])
    return df.drop_duplicates("ident").set_index("ident")


def wake_categories() -> dict[str, str]:
    out = {}
    with (RAW / "aircraft" / "doc8643AircraftTypes.csv").open(encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            if r["Designator"] in JETS:
                # one designator can list several variants: the heaviest category wins
                out[r["Designator"]] = max(out.get(r["Designator"], "L"), r["WTC"] or "L")
    return out


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    h = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(h))


def in_box(lat, lon) -> np.ndarray:
    lat = pd.to_numeric(lat, errors="coerce").to_numpy()
    lon = pd.to_numeric(lon, errors="coerce").to_numpy()
    return (lat >= BOX[0]) & (lat <= BOX[1]) & (lon >= BOX[2]) & (lon <= BOX[3])


class Tally:
    """Every aggregate of one category of aircraft (business jets or airliners)."""

    def __init__(self, months: list[str]):
        self.months = months
        self.eu = np.zeros(len(months), np.int64)  # flights placed in Europe, by month
        self.fr = np.zeros(len(months), np.int64)  # ... in France
        self.box = Counter()  # coverage over Europe: flights seen in the box, with origin, with both
        self.km = {k: defaultdict(partial(np.zeros, KM_MAX // KM_BIN + 1, np.int64)) for k in ("eu", "fr")}
        self.dur = defaultdict(list)  # minutes of the flights placed in Europe with both airports, by year
        self.weekday = defaultdict(partial(np.zeros, 7, np.int64))
        self.models = defaultdict(Counter)
        self.callsign = defaultdict(Counter)
        self.airport_month = defaultdict(partial(np.zeros, len(months), np.int64))
        self.routes = defaultdict(Counter)
        # year -> aircraft -> days seen flying, flights, flights placed, flights placed in Europe (in memory only)
        self.days = defaultdict(Counter)
        self.flights_ac = defaultdict(Counter)
        self.placed_ac = defaultdict(Counter)
        self.eu_ac = defaultdict(Counter)
        # month -> aircraft -> flights seen over Europe (first or last position in the box), placed or not
        self.box_ac = defaultdict(Counter)
        self.callsign_wtc = defaultdict(Counter)  # (year, wtc, kind) counts

    def add(self, df: pd.DataFrame, mi: int, year: int, ap: pd.DataFrame, regs: pd.Series, wtc=None):
        cc_o = df["origin"].map(ap["cc"])
        cc_d = df["destination"].map(ap["cc"])
        eu = cc_o.isin(EUROPE) | cc_d.isin(EUROPE)
        fr = df["origin"].fillna("").str.startswith("LF") | df["destination"].fillna("").str.startswith("LF")
        self.eu[mi] += int(eu.sum())
        self.fr[mi] += int(fr.sum())

        b1 = in_box(df["latitude_1"], df["longitude_1"])
        b2 = in_box(df["latitude_2"], df["longitude_2"])
        boxed = b1 & b2
        b = df[boxed]
        self.box[(year, "seen")] += len(b)
        self.box[(year, "origin")] += int(b["origin"].isin(ap.index).sum())
        self.box[(year, "both")] += int((b["origin"].isin(ap.index) & b["destination"].isin(ap.index)).sum())

        # how often each aircraft flies: every flight it was seen on, wherever (days do not cross months)
        placed = df["origin"].isin(ap.index) | df["destination"].isin(ap.index)
        g = (
            pd.DataFrame({"a": df["icao24"], "d": df["day"].str.slice(0, 10), "eu": eu, "placed": placed})
            .groupby("a")
            .agg(days=("d", "nunique"), flights=("d", "size"), eu=("eu", "sum"), placed=("placed", "sum"))
        )
        self.days[year].update(g["days"].to_dict())
        self.flights_ac[year].update(g["flights"].to_dict())
        self.placed_ac[year].update(g["placed"].to_dict())
        self.eu_ac[year].update(g["eu"].to_dict())

        over = b1 | b2
        self.box_ac[mi].update(df.loc[over, "icao24"].value_counts().to_dict())

        e = df[eu].copy()
        if e.empty:
            return
        e["d"] = e["day"].str.slice(0, 10)
        wd = pd.to_datetime(e["d"], format="%Y-%m-%d", errors="coerce").dt.dayofweek.dropna().astype(int)
        self.weekday[year] += np.bincount(wd, minlength=7)
        self.models[year].update(e["typecode"].value_counts().to_dict())

        reg = e["registration"].fillna(e["icao24"].map(regs)).fillna("").str.replace("-", "").str.upper()
        cs = e["callsign"].fillna("").str.strip().str.upper()
        own = (cs != "") & (cs == reg)
        op = cs.str.match(r"^[A-Z]{3}\d") & ~own
        self.callsign[year].update(
            {"registration": int(own.sum()), "operator": int(op.sum()), "other": int((~own & ~op).sum())}
        )
        if wtc is not None:
            w = e["typecode"].map(wtc).fillna("M")
            for cls in ("L", "M"):
                m = (w == cls).to_numpy()
                rest = (~own & ~op)[m]
                self.callsign_wtc[(year, cls)].update(
                    {"registration": int(own[m].sum()), "operator": int(op[m].sum()), "other": int(rest.sum())}
                )

        for col in ("origin", "destination"):
            for ident, n in e.loc[e[col].map(ap["cc"]).isin(EUROPE), col].value_counts().items():
                self.airport_month[ident][mi] += int(n)

        c = e[e["origin"].isin(ap.index) & e["destination"].isin(ap.index) & (e["origin"] != e["destination"])]
        o, d = ap.loc[c["origin"]], ap.loc[c["destination"]]
        km = haversine(o["lat"].to_numpy(), o["lon"].to_numpy(), d["lat"].to_numpy(), d["lon"].to_numpy())
        t0 = pd.to_datetime(c["firstseen"], format="%Y-%m-%d %H:%M:%S%z", utc=True, errors="coerce")
        t1 = pd.to_datetime(c["lastseen"], format="%Y-%m-%d %H:%M:%S%z", utc=True, errors="coerce")
        dur = ((t1 - t0).dt.total_seconds() / 60).to_numpy()
        ok = np.isfinite(dur) & (dur >= 10) & (dur <= 20 * 60) & (km >= 30) & (km / np.maximum(dur, 1) * 60 < 1000)
        c, km, dur = c[ok], km[ok], dur[ok]
        bins = np.minimum((km // KM_BIN).astype(int), KM_MAX // KM_BIN)
        self.km["eu"][year] += np.bincount(bins, minlength=KM_MAX // KM_BIN + 1)
        cfr = (c["origin"].str.startswith("LF") | c["destination"].str.startswith("LF")).to_numpy()
        self.km["fr"][year] += np.bincount(bins[cfr], minlength=KM_MAX // KM_BIN + 1)
        self.dur[year].append(dur.astype(np.float32))
        pair = np.where(
            c["origin"] < c["destination"], c["origin"] + " " + c["destination"], c["destination"] + " " + c["origin"]
        )
        self.routes[year].update(Counter(pair))


def median_hist(h: np.ndarray, width: float) -> float | None:
    n = int(h.sum())
    if not n:
        return None
    return (int(np.searchsorted(np.cumsum(h), n / 2)) + 0.5) * width


def main() -> int:
    ap = airports()
    if "--from-cache" in sys.argv and CACHE.exists():
        months, jets, liners, total = pickle.loads(CACHE.read_bytes())
        return write(months, jets, liners, total, ap)
    files = {int(p.name[11:15]) * 100 + int(p.name[15:17]): p for p in FL.glob("flightlist_*.csv.gz")}
    months = [f"{y}-{m:02d}" for y in YEARS for m in range(1, 13)]
    have = [y * 100 + m for y in YEARS for m in range(1, 13) if y * 100 + m in files]
    if len(have) != len(months) and not os.environ.get("JETS_PARTIAL"):
        raise SystemExit(f"{len(have)} monthly files of {len(months)} (python3 etl/jets/fetch.py)")
    db = pd.read_csv(
        RAW / "aircraft" / "aircraftDatabase-2024-04.csv", dtype=str, usecols=["icao24", "typecode", "registration"]
    )
    db = db.dropna(subset=["icao24"]).drop_duplicates("icao24").set_index("icao24")
    jets, liners = Tally(months), Tally(months)
    wtc_map = wake_categories()
    total = Counter()
    cols = [
        "callsign",
        "icao24",
        "registration",
        "typecode",
        "origin",
        "destination",
        "firstseen",
        "lastseen",
        "day",
        "latitude_1",
        "longitude_1",
        "latitude_2",
        "longitude_2",
    ]
    for key in have:
        y, m = divmod(key, 100)
        mi = months.index(f"{y}-{m:02d}")
        df = pd.read_csv(files[key], usecols=cols, dtype=str)
        total[y] += len(df)
        df["typecode"] = df["typecode"].fillna(df["icao24"].map(db["typecode"])).str.upper().str.strip().replace(ALIAS)
        jets.add(df[df["typecode"].isin(JETS)], mi, y, ap, db["registration"], wtc_map)
        liners.add(df[df["typecode"].isin(TYPES)], mi, y, ap, db["registration"])
        print(f"{files[key].name}: {jets.eu[mi]} business jets, {liners.eu[mi]} airliners placed in Europe", flush=True)
    CACHE.write_bytes(pickle.dumps((months, jets, liners, total)))
    return write(months, jets, liners, total, ap)


def write(months: list[str], jets: Tally, liners: Tally, total: Counter, ap: pd.DataFrame) -> int:
    wtc = wake_categories()

    def per_year(t: Tally, y: int) -> dict:
        h_eu, h_fr = t.km["eu"][y], t.km["fr"][y]
        dur = np.concatenate(t.dur[y]) if t.dur[y] else np.array([])
        # the European fleet: aircraft seen flying on ten days at least, half of their placed flights or more
        # in Europe; their days seen flying (anywhere) and flights per day of flight
        fleet = [
            a
            for a, n in t.days[y].items()
            if n >= 10 and t.placed_ac[y][a] and t.eu_ac[y][a] / t.placed_ac[y][a] >= 0.5
        ]
        days = np.array([t.days[y][a] for a in fleet])
        flights = np.array([t.flights_ac[y][a] for a in fleet])
        return {
            "eu": int(t.eu[[i for i, mo in enumerate(months) if mo.startswith(str(y))]].sum()),
            "fr": int(t.fr[[i for i, mo in enumerate(months) if mo.startswith(str(y))]].sum()),
            "placed": int(h_eu.sum()),
            "placedFr": int(h_fr.sum()),
            "kmEu": h_eu.tolist(),
            "kmFr": h_fr.tolist(),
            "medianKm": median_hist(h_eu, KM_BIN),
            "medianKmFr": median_hist(h_fr, KM_BIN),
            "shortEu": int(h_eu[: SHORT_KM // KM_BIN].sum()),
            "shortFr": int(h_fr[: SHORT_KM // KM_BIN].sum()),
            "medianMin": float(np.median(dur)) if dur.size else None,
            "weekday": t.weekday[y].tolist(),
            "callsign": dict(t.callsign[y]),
            "coverage": {k: t.box[(y, k)] for k in ("seen", "origin", "both")},
            "aircraft": sum(1 for a in t.eu_ac[y] if t.eu_ac[y][a]),
            "fleet": len(fleet),
            "medianDays": float(np.median(days)) if len(fleet) else None,
            "daysQ": [float(q) for q in np.percentile(days, [25, 75])] if len(fleet) else None,
            "flightsPerDay": float(np.median(flights / days)) if len(fleet) else None,
        }

    def place(ident: str) -> dict:
        a = ap.loc[ident]
        return {
            "label": PLACES_FR.get(ident) or a["city"] or a["name"],
            "name": a["name"],
            "city": a["city"],
            "cc": a["cc"],
            "lat": round(float(a["lat"]), 3),
            "lon": round(float(a["lon"]), 3),
        }

    # the fleet panel: aircraft the network already followed over Europe in 2019 (FLEET_MIN flights or
    # more that year); their flights over Europe each month do not depend on aircraft fitted with a
    # position transmitter after 2019, nor on airports seen better later
    def fleet_panel(t: Tally) -> tuple[set, np.ndarray]:
        y19 = Counter()
        for i in range(12):
            y19.update(t.box_ac[i])
        ac = {a for a, n in y19.items() if n >= FLEET_MIN}
        return ac, np.array([sum(n for a, n in t.box_ac[i].items() if a in ac) for i in range(len(months))])

    fj, fleet_jets = fleet_panel(jets)
    fl, fleet_liners = fleet_panel(liners)

    # the airports busy enough in both years for their seasons (src/jets/facts.js picks among them),
    # in the order of their codes: the network sees airports unequally, so nothing here ranks them
    yidx = {y: [i for i, mo in enumerate(months) if mo.startswith(str(y))] for y in YEARS}
    both = sorted(
        a
        for a, v in jets.airport_month.items()
        if ap.loc[a, "cc"] in EUROPE and v[yidx[2019]].sum() >= SEASON_MIN and v[yidx[2022]].sum() >= SEASON_MIN
    )
    apts = {a: {**place(a), "jets": jets.airport_month[a].tolist()} for a in both}

    def routes(t: Tally, y: int, france: bool) -> list:
        out = []
        for pair, n in t.routes[y].most_common():
            a, b = pair.split(" ")
            if france and not (a.startswith("LF") or b.startswith("LF")):
                continue
            pa, pb = ap.loc[a], ap.loc[b]
            km = float(haversine(pa["lat"], pa["lon"], pb["lat"], pb["lon"]))
            out.append([a, b, int(n), round(km)])
            if len(out) == TOP_ROUTES:
                break
        return out

    route_eu = {y: routes(jets, y, False) for y in COMPARE}
    route_fr = {y: routes(jets, y, True) for y in COMPARE}
    for rs in [*route_eu.values(), *route_fr.values()]:
        for a, b, *_ in rs:
            for x in (a, b):
                if x not in apts:
                    apts[x] = {**place(x)}
    apts = dict(sorted(apts.items()))

    models = {y: [[c, int(k)] for c, k in jets.models[y].most_common(25)] for y in COMPARE}

    out = {
        "source": "OpenSky Network, Crowdsourced air traffic data (Zenodo 7923702) ; OurAirports ; OACI Doc 8643",
        "built": date.today().isoformat(),
        "months": months,
        "years": YEARS,
        "compare": COMPARE,
        "kmBin": KM_BIN,
        "shortKm": SHORT_KM,
        "europe": sorted(EUROPE),
        "flightsSeen": {y: total[y] for y in YEARS},
        "jets": {
            "eu": jets.eu.tolist(),
            "fr": jets.fr.tolist(),
            "year": {y: per_year(jets, y) for y in YEARS},
            "models": models,
        },
        "liners": {
            "eu": liners.eu.tolist(),
            "fr": liners.fr.tolist(),
            "year": {y: per_year(liners, y) for y in YEARS},
        },
        "types": {c: {"name": n, "maker": mk, "wtc": wtc.get(c, "M")} for c, (n, mk) in JETS.items()},
        # flights seen over Europe, month by month, of the aircraft followed there in 2019
        "fleet": {
            "min": FLEET_MIN,
            "jetsAircraft": len(fj),
            "linersAircraft": len(fl),
            "jets": fleet_jets.tolist(),
            "liners": fleet_liners.tolist(),
        },
        "callsignWtc": {y: {cls: dict(jets.callsign_wtc[(y, cls)]) for cls in ("L", "M")} for y in COMPARE},
        "airports": apts,
        "routesEu": route_eu,
        "routesFr": route_fr,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size // 1000} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
