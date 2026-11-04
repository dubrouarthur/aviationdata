"""The world's airliners in the OpenSky Network's flight lists, by model: web/public/data/avions/monde.json.

Source: OpenSky Network, « Crowdsourced air traffic data » (Zenodo record 7923702), one gzip a month
(data/raw/opensky/flightlist/, etl/avions/fetch.py): every flight its receivers followed, with the
aircraft's ICAO type code, the airports of departure and arrival when the network saw them, and the
times it was first and last seen. Coordinates and countries of airports: OurAirports.

What a flight list is not: a census. The network sees what its volunteers' receivers hear, densely over
Europe and North America, little over Africa, Asia and the oceans. Shares by country therefore measure
the flights the network followed, and the page says so; a flight whose airports were not both seen has
no country and no distance (`complete`).

Only aggregates leave data/raw/, never an aircraft's identifier (OpenSky's terms): counts of aircraft
by model are counts of distinct transponder addresses.

Duration = last seen - first seen, kept between 20 minutes and 20 hours and at an average ground
speed under 1 000 km/h between the two airports (else the track is broken).
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from types_table import ALIAS, KIND_FR, TYPES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
FL = RAW / "opensky" / "flightlist"
OUT = ROOT / "web" / "public" / "data" / "avions" / "monde.json"
YEARS = [2019, 2022]
DUR_MAX = 20 * 60  # minutes
KM_MAX = 20000
TOP_COUNTRIES = 40


def airports() -> pd.DataFrame:
    rows = []
    with (RAW / "eurostat" / "ourairports.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                (r["ident"], float(r["latitude_deg"]), float(r["longitude_deg"]), r["iso_country"], r["continent"])
            )
    return pd.DataFrame(rows, columns=["ident", "lat", "lon", "cc", "cont"]).drop_duplicates("ident").set_index("ident")


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dl = np.radians(lon2 - lon1)
    h = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(h))


def hist_median(h: np.ndarray, width: float) -> float | None:
    n = h.sum()
    if not n:
        return None
    i = int(np.searchsorted(np.cumsum(h), n / 2))
    return (i + 0.5) * width


def year_stats(year: int, ap: pd.DataFrame, db: pd.Series) -> dict:
    files = sorted(FL.glob(f"flightlist_{year}*.csv.gz"))
    if len(files) != 12 and not os.environ.get("AVIONS_PARTIAL"):
        raise SystemExit(f"{year}: {len(files)} monthly files, 12 expected (python3 etl/avions/fetch.py)")
    total = typed = 0
    by = defaultdict(
        lambda: {
            "flights": 0,
            "complete": 0,
            "dur": np.zeros(DUR_MAX + 1, np.int64),
            "km": np.zeros(KM_MAX // 50 + 1, np.int64),
            "kmsum": 0.0,
            "dursum": 0.0,
            "n": 0,
        }
    )
    country = defaultdict(Counter)  # type -> origin country -> flights
    cont = defaultdict(Counter)
    usage = defaultdict(lambda: [0, 0])  # (icao24, type) -> [flights, days]
    for path in files:
        df = pd.read_csv(
            path, usecols=["icao24", "typecode", "origin", "destination", "firstseen", "lastseen", "day"], dtype=str
        )
        total += len(df)
        # a fifth of the flights carry no type code: the aircraft database gives it by transponder address
        df["typecode"] = df["typecode"].fillna(df["icao24"].map(db)).str.upper().str.strip().replace(ALIAS)
        df = df[df["typecode"].isin(TYPES)].copy()
        typed += len(df)
        for t, n in df["typecode"].value_counts().items():
            by[t]["flights"] += int(n)
        # how often each aircraft flies: flights and distinct days, month by month (days do not cross months)
        df["d"] = df["day"].str.slice(0, 10)
        g = df.groupby(["icao24", "typecode"]).agg(flights=("d", "size"), days=("d", "nunique"))
        for (i, t), (f, d) in zip(g.index, g.to_numpy(), strict=True):
            u = usage[(i, t)]
            u[0] += int(f)
            u[1] += int(d)
        # flights whose two airports were seen: country, distance, duration
        c = df.dropna(subset=["origin", "destination"])
        c = c[(c["origin"] != c["destination"]) & c["origin"].isin(ap.index) & c["destination"].isin(ap.index)]
        o = ap.loc[c["origin"]]
        d = ap.loc[c["destination"]]
        km = haversine(o["lat"].to_numpy(), o["lon"].to_numpy(), d["lat"].to_numpy(), d["lon"].to_numpy())
        t0 = pd.to_datetime(c["firstseen"], utc=True, errors="coerce")
        t1 = pd.to_datetime(c["lastseen"], utc=True, errors="coerce")
        dur = ((t1 - t0).dt.total_seconds() / 60).to_numpy()
        ok = np.isfinite(dur) & (dur >= 20) & (dur <= DUR_MAX) & (km >= 50) & (km / np.maximum(dur, 1) * 60 < 1000)
        c = c[ok]
        km, dur = km[ok], dur[ok]
        cc = o["cc"].to_numpy()[ok]
        cn = o["cont"].to_numpy()[ok]
        for t, idx in c.groupby("typecode").indices.items():
            b = by[t]
            b["complete"] += len(idx)
            b["dur"] += np.bincount(np.minimum(dur[idx].astype(int), DUR_MAX), minlength=DUR_MAX + 1)
            b["km"] += np.bincount(np.minimum((km[idx] // 50).astype(int), KM_MAX // 50), minlength=KM_MAX // 50 + 1)
            b["kmsum"] += float(km[idx].sum())
            b["dursum"] += float(dur[idx].sum())
            country[t].update(Counter(cc[idx]))
            cont[t].update(Counter(cn[idx]))
        print(f"{path.name}: {len(df)} airliner flights, {int(ok.sum())} complete", flush=True)

    per_type = defaultdict(list)
    for (_, t), (f, d) in usage.items():
        if d >= 10:  # an aircraft followed on ten days at least
            per_type[t].append(f / d)
    models = {}
    for t, b in by.items():
        if b["complete"] < 2000:
            continue
        name, family, maker, kind = TYPES[t]
        n_ac = sum(1 for (_, tt) in usage if tt == t)
        models[t] = {
            "flights": b["flights"],
            "complete": b["complete"],
            "aircraft": n_ac,
            "durMedian": hist_median(b["dur"], 1.0),
            "durMean": round(b["dursum"] / b["complete"], 1),
            "kmMedian": round(hist_median(b["km"], 50.0)),
            "kmMean": round(b["kmsum"] / b["complete"]),
            "flightsPerDay": round(float(np.median(per_type[t])), 2) if per_type[t] else None,
            # flight length distribution: share of complete flights in each band of kilometres
            "kmBands": [
                round(float(b["km"][lo // 50 : hi // 50].sum() / b["complete"]), 4)
                for lo, hi in ((0, 1000), (1000, 2500), (2500, 5000), (5000, 9000), (9000, KM_MAX + 50))
            ],
            "countries": [[k, int(v)] for k, v in country[t].most_common(TOP_COUNTRIES)],
            "continents": {k: int(v) for k, v in cont[t].items()},
        }
    return {"year": year, "rows": total, "airliner": typed, "models": models}


def main() -> int:
    ap = airports()
    db = pd.read_csv(RAW / "aircraft" / "aircraftDatabase-2024-04.csv", dtype=str, usecols=["icao24", "typecode"])
    db = db.dropna().drop_duplicates("icao24").set_index("icao24")["typecode"]
    years = [year_stats(y, ap, db) for y in YEARS]
    codes = sorted(
        {t for y in years for t in y["models"]},
        key=lambda t: -max(y["models"].get(t, {}).get("flights", 0) for y in years),
    )
    countries = {}
    with (ROOT / "data" / "ref" / "countries_fr.csv").open(encoding="utf-8") as f:
        countries = {r["iso2"]: r["label"] for r in csv.DictReader(f)}
    countries.setdefault("FR", "France")
    out = {
        "source": "OpenSky Network, Crowdsourced air traffic data (Zenodo 7923702) ; OurAirports",
        "record": json.loads((FL / "record.json").read_text()),
        "years": [{k: y[k] for k in ("year", "rows", "airliner")} for y in years],
        "types": {
            t: dict(zip(("name", "family", "maker", "kind"), TYPES[t], strict=True)) | {"kindFr": KIND_FR[TYPES[t][3]]}
            for t in codes
        },
        "models": {str(y["year"]): y["models"] for y in years},
        "countryNames": countries,
        "km": [0, 1000, 2500, 5000, 9000],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {len(codes)} models, {OUT.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
