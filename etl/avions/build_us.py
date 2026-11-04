"""US domestic flights of 2025, by aircraft model: web/public/data/avions/us.json.

Source: BTS Reporting Carrier On-Time Performance (data/raw/bts/ot_<year>_<month>.zip, etl/avions/fetch.py),
every domestic flight of the large US airlines with its tail number, times, delay causes, cancellation
and diversion. The tail number gives the model through the OpenSky Network's aircraft database
(registration -> ICAO type code); only the types of etl/avions/types.py are kept.

Only aggregates leave data/raw/: no tail number, no flight number. Definitions are the BTS's own:
- a flight is on time when it arrives less than 15 minutes after its scheduled time (ArrDel15 = 0);
- delay causes (carrier, weather, national air system, security, late-arriving aircraft) are given in
  minutes for flights 15 minutes late or more;
- cancellation codes: A carrier, B weather, C national air system, D security.
A cancelled flight carries a tail number only if an aircraft had been assigned: about one cancellation
in six has none and cannot be given a model; the page says so (`untailedCancelShare`).

"Like for like" (`adj`): each model's on-time share against the share it would have if each of its
flights had its airline's average on-time share (direct standardisation by airline).
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from types_table import ALIAS, KIND_FR, TYPES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data" / "avions" / "us.json"
YEAR = 2025
MIN_FLIGHTS = 5000
CANCEL_TAILED = 0.9
KM_PER_MILE = 1.609344
COLS = {
    "FlightDate": str,
    "Reporting_Airline": str,
    "Tail_Number": str,
    "Cancelled": "float32",
    "CancellationCode": str,
    "Diverted": "float32",
    "ArrDelay": "float32",
    "ArrDel15": "float32",
    "ActualElapsedTime": "float32",
    "AirTime": "float32",
    "Distance": "float32",
    "CarrierDelay": "float32",
    "WeatherDelay": "float32",
    "NASDelay": "float32",
    "SecurityDelay": "float32",
    "LateAircraftDelay": "float32",
}
AIRLINES = {
    "WN": "Southwest",
    "DL": "Delta",
    "AA": "American",
    "OO": "SkyWest",
    "UA": "United",
    "YX": "Republic",
    "MQ": "Envoy",
    "OH": "PSA",
    "AS": "Alaska",
    "B6": "JetBlue",
    "NK": "Spirit",
    "F9": "Frontier",
    "G4": "Allegiant",
    "HA": "Hawaiian",
    "9E": "Endeavor",
    "QX": "Horizon",
    "ZW": "Air Wisconsin",
    "C5": "CommuteAir",
    "G7": "GoJet",
    "PT": "Piedmont",
    "EV": "ExpressJet",
    "VX": "Virgin America",
}


def read_year(year: int) -> pd.DataFrame:
    frames = []
    for m in range(1, 13):
        path = RAW / "bts" / f"ot_{year}_{m}.zip"
        if not path.exists():
            raise SystemExit(f"missing {path}: run python3 etl/avions/fetch.py")
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.endswith(".csv"))
            frames.append(pd.read_csv(z.open(name), usecols=list(COLS), dtype=COLS))
        print(f"{path.name}: {len(frames[-1])} flights", flush=True)
    return pd.concat(frames, ignore_index=True)


def type_of_tail() -> pd.Series:
    db = pd.read_csv(RAW / "aircraft" / "aircraftDatabase-2024-04.csv", dtype=str, usecols=["registration", "typecode"])
    db = db.dropna().drop_duplicates("registration")
    return db.set_index("registration")["typecode"].str.upper().str.strip().replace(ALIAS)


def median(s: pd.Series) -> float | None:
    s = s.dropna()
    return None if s.empty else float(s.median())


def r1(v):
    return None if v is None or (isinstance(v, float) and not np.isfinite(v)) else round(float(v), 1)


def main() -> int:
    df = read_year(YEAR)
    n_all = len(df)
    cancelled_all = int(df["Cancelled"].sum())
    untailed_cancel = int(((df["Cancelled"] == 1) & df["Tail_Number"].isna()).sum())
    # every airline's on-time share and cancellation share, over all its flights
    all_op = df[(df["Cancelled"] == 0) & (df["Diverted"] == 0)]
    air_ontime = 1 - all_op.groupby("Reporting_Airline")["ArrDel15"].mean()
    air_cancel = df.groupby("Reporting_Airline")["Cancelled"].mean()
    air_flights = df["Reporting_Airline"].value_counts()
    # an airline whose cancelled flights mostly carry no tail number cannot give its cancellations a model:
    # its flights are left out of the cancellation rates by model (CANCEL_TAILED)
    tailed = df[df["Cancelled"] == 1].groupby("Reporting_Airline")["Tail_Number"].apply(lambda s: s.notna().mean())
    cancel_ok = sorted(a for a, v in tailed.items() if v >= CANCEL_TAILED)
    tmap = type_of_tail()
    df["type"] = df["Tail_Number"].map(tmap)
    matched = df["type"].notna() & df["Tail_Number"].notna()
    df = df[matched & df["type"].isin(TYPES)].copy()
    df["op"] = (df["Cancelled"] == 0) & (df["Diverted"] == 0)
    days = pd.to_datetime(df["FlightDate"]).dt.dayofyear
    df["day"] = days.astype("int16")

    models = []
    for code, g in df.groupby("type"):
        if len(g) < MIN_FLIGHTS:
            continue
        name, family, maker, kind = TYPES[code]
        o = g[g["op"]]
        late = o[o["ArrDel15"] == 1]
        ontime = 1 - o["ArrDel15"].mean()
        # like for like: the on-time share the model would have with its airlines' averages
        mix = o["Reporting_Airline"].value_counts()
        expected = float((mix * air_ontime.reindex(mix.index)).sum() / mix.sum())
        gc = g[g["Reporting_Airline"].isin(cancel_ok)]
        cmix = gc["Reporting_Airline"].value_counts()
        expected_cancel = float((cmix * air_cancel.reindex(cmix.index)).sum() / cmix.sum()) if len(gc) else None
        # how each aircraft is used: per tail, days with at least one flight, flights and hours those days
        per_tail = o.groupby("Tail_Number").agg(
            days=("day", "nunique"), flights=("day", "size"), block=("ActualElapsedTime", "sum")
        )
        per_tail = per_tail[per_tail["days"] >= 30]  # an aircraft seen a month at least
        codes = gc.loc[gc["Cancelled"] == 1, "CancellationCode"].value_counts()
        airlines = g["Reporting_Airline"].value_counts()
        models.append(
            {
                "code": code,
                "name": name,
                "family": family,
                "maker": maker,
                "kind": kind,
                "kindFr": KIND_FR[kind],
                "flights": int(len(g)),
                "operated": int(len(o)),
                "aircraft": int(g["Tail_Number"].nunique()),
                "cancelBase": int(len(gc)),
                "cancelled": int(gc["Cancelled"].sum()),
                "cancelByCause": {k: int(codes.get(k, 0)) for k in "ABCD"},
                "diverted": int(g["Diverted"].sum()),
                "ontime": round(float(ontime), 4),
                "ontimeExpected": round(expected, 4),
                "cancelRate": round(float(gc["Cancelled"].mean()), 5) if len(gc) >= 2000 else None,
                "cancelExpected": round(expected_cancel, 5) if len(gc) >= 2000 else None,
                "late60": round(float((o["ArrDelay"] >= 60).mean()), 4),
                "delayMean": r1(o["ArrDelay"].mean()),
                "delayMedian": r1(median(o["ArrDelay"])),
                # minutes of delay per operated flight, by cause (the BTS counts causes on late flights only)
                "causes": {
                    k: r1(late[c].sum() / len(o))
                    for k, c in (
                        ("carrier", "CarrierDelay"),
                        ("weather", "WeatherDelay"),
                        ("nas", "NASDelay"),
                        ("security", "SecurityDelay"),
                        ("lateAircraft", "LateAircraftDelay"),
                    )
                },
                "airMedian": r1(median(o["AirTime"])),
                "airMean": r1(o["AirTime"].mean()),
                "blockMedian": r1(median(o["ActualElapsedTime"])),
                "kmMedian": round(float(o["Distance"].median() * KM_PER_MILE)),
                "kmMean": round(float(o["Distance"].mean() * KM_PER_MILE)),
                "flightsPerDay": r1(per_tail.eval("flights / days").median()),
                "hoursPerDay": r1((per_tail["block"] / per_tail["days"] / 60).median()),
                "daysFlown": round(float(per_tail["days"].median())),
                "airlines": [[a, AIRLINES.get(a, a), int(n)] for a, n in airlines.head(6).items()],
            }
        )
    models.sort(key=lambda m: -m["flights"])
    kept = sum(m["flights"] for m in models)

    # model by airline, where both are large enough to compare models within one airline
    cells = []
    for (a, code), g in df[df["type"].isin([m["code"] for m in models])].groupby(["Reporting_Airline", "type"]):
        o = g[g["op"]]
        if len(o) >= 3000:
            cells.append(
                [
                    a,
                    code,
                    int(len(g)),
                    round(float(1 - o["ArrDel15"].mean()), 4),
                ]
            )
    out = {
        "source": "BTS, Reporting Carrier On-Time Performance ; OpenSky Network, aircraft database (2024-04)",
        "year": YEAR,
        "flightsAll": n_all,
        "cancelledAll": cancelled_all,
        "untailedCancelShare": round(untailed_cancel / cancelled_all, 4),
        "flightsModelled": int(kept),
        "modelledShare": round(kept / n_all, 4),
        "minFlights": MIN_FLIGHTS,
        "cancelAirlines": cancel_ok,
        "airlines": {
            a: {
                "name": AIRLINES.get(a, a),
                "ontime": round(float(air_ontime[a]), 4),
                "cancelRate": round(float(air_cancel[a]), 5),
                "flights": int(air_flights[a]),
                "cancelTailed": round(float(tailed.get(a, 1.0)), 3),
            }
            for a in air_ontime.index
        },
        "models": models,
        "cells": cells,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {len(models)} models, {kept} of {n_all} flights ({kept / n_all:.1%})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
