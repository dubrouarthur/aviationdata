"""Jet-stream investigation: from the raw open data to web/public/data/jet/.

Inputs, fetched by the scripts next to this one (all in data/raw/, never versioned):
- opensky/<YYYY-MM>.csv: France - North America flights 2019-2022 (OpenSky Network);
- era5_daily/<year>.npz: 6-hourly ERA5 winds at 250 hPa, 1.5 degree (Copernicus / ECMWF, via WeatherBench 2);
- era5/2020-02-09T00.npz: one ERA5 snapshot at 0.5 degree for the opening map;
- reanalysis/{u,v}wnd.mon.250.nc: NCEP/NCAR Reanalysis 1 monthly winds since 1948 (NOAA PSL);
- nao/nao_monthly.txt: North Atlantic Oscillation index (NOAA CPC);
- igra/trappes_250.csv: Météo-France radiosondes at Trappes (IGRA 2, NOAA NCEI);
- nasa/VIIRS_SNPP_CorrectedReflectance_TrueColor-2020-02-08.jpg (NASA GIBS).

    python3 etl/jet/build_jet.py [--skip-stats]
Writes web/public/data/jet/{flights,routing,climate,trappes,hero,winds,sim,sim_stats,meta}.json, the
binary wind fields hero.bin, winds-<year>.bin and sim/<day>.bin, and web/public/img/jet/ciara-viirs.jpg.
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analysis as A  # noqa: E402
import build_cost  # noqa: E402
import build_forecast  # noqa: E402
import build_history  # noqa: E402
import build_sim  # noqa: E402
import nao as NAO  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
REF = ROOT / "data" / "ref"
OUT = ROOT / "web" / "public" / "data" / "jet"
IMG = ROOT / "web" / "public" / "img" / "jet"

PAIR = ("LFPG", "KJFK")  # the route followed through the whole story
EXPLORER = ["KJFK", "CYUL", "KATL", "KORD", "KIAD"]  # destinations offered in the route explorer
WINDOW = (22.5, 72.0, -96.0, 18.0)  # explorer field: south, north, west, east (on the 1.5 degree grid)
TRAPPES = (48.7742, 2.0097)
MIN_FLIGHTS = 300  # per route and direction, for a route to be described

NAMES = {
    "LFPG": "Paris-CDG",
    "LFPO": "Paris-Orly",
    "LFLL": "Lyon",
    "KJFK": "New York-JFK",
    "KEWR": "Newark",
    "CYUL": "Montréal",
    "CYYZ": "Toronto",
    "KATL": "Atlanta",
    "KORD": "Chicago",
    "KIAD": "Washington",
    "KBOS": "Boston",
    "KMIA": "Miami",
    "KDFW": "Dallas",
    "KDTW": "Détroit",
    "KPHL": "Philadelphie",
    "KIND": "Indianapolis",
    "KMSP": "Minneapolis",
    "KIAH": "Houston",
    "KRDU": "Raleigh-Durham",
    "KLAX": "Los Angeles",
    "KSFO": "San Francisco",
    "KSEA": "Seattle",
    "CYVR": "Vancouver",
}


TYPES = {
    "A359": "Airbus A350-900",
    "A388": "Airbus A380",
    "B789": "Boeing 787-9",
    "B788": "Boeing 787-8",
    "B77L": "Boeing 777-200LR",
    "B77W": "Boeing 777-300ER",
    "B772": "Boeing 777-200",
    "B752": "Boeing 757-200",
    "B763": "Boeing 767-300",
    "B764": "Boeing 767-400",
    "A332": "Airbus A330-200",
    "A333": "Airbus A330-300",
    "A339": "Airbus A330-900",
}
AIRLINES = {
    "AFR": "Air France",
    "DAL": "Delta",
    "AAL": "American Airlines",
    "UAL": "United",
    "NAX": "Norwegian",
    "ACA": "Air Canada",
    "XLF": "French bee",
    "FBU": "French bee",
    "EVL": "Evelop",
    "CFG": "Condor",
    "TSC": "Air Transat",
    "LVL": "Level",
    "FDX": "FedEx",
    "ELY": "El Al",
}
MIN_TYPE = 150  # flights per direction for an aircraft type or an airline to be compared


def r1(x, nd: int = 1):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    print(f"  {name}: {(OUT / name).stat().st_size // 1024} KB")


def airports() -> dict:
    out = {}
    for f in ("airports_world.csv", "airports_fr.csv", "airports_world_manual.csv", "airports_manual.csv"):
        p = REF / f
        if p.exists():
            for r in csv.DictReader(open(p, encoding="utf-8")):
                out.setdefault(r["code"], (float(r["lat"]), float(r["lon"])))
    return out


# ---------------------------------------------------------------- winds
def era5_stack():
    """6-hourly ERA5 250 hPa winds 2019-2022: times, lats, lons, U, V [time, lat, lon] in m/s."""
    times, us, vs = [], [], []
    for y in range(2019, 2023):
        d = np.load(RAW / "era5_daily" / f"{y}.npz")
        times.append(d["time"])
        us.append(d["u"].astype(np.float32).transpose(0, 2, 1))  # stored [time, lon, lat]
        vs.append(d["v"].astype(np.float32).transpose(0, 2, 1))
        lats, lons = d["lat"].astype(float), d["lon"].astype(float)
    return np.concatenate(times), lats, lons, np.concatenate(us), np.concatenate(vs)


# ---------------------------------------------------------------- flights
def load_flights(ref: dict) -> tuple[pd.DataFrame, int]:
    files = sorted((RAW / "opensky").glob("*.csv"))
    if len(files) != 48:
        raise SystemExit(f"opensky: {len(files)} monthly files, 48 expected (2019-2022)")
    df = pd.concat([pd.read_csv(f, dtype={"typecode": str, "airline": str}) for f in files], ignore_index=True)
    n_raw = len(df)
    df = df[df.origin.isin(ref) & df.destination.isin(ref)].copy()
    for c in ("firstseen", "lastseen"):
        df[c] = pd.to_datetime(df[c], utc=True)
    df["dur"] = (df.lastseen - df.firstseen).dt.total_seconds() / 60
    o = np.array([ref[c] for c in df.origin])
    d = np.array([ref[c] for c in df.destination])
    # the first and last positions must be at the airports (else the flight was seen only in part)
    near = (A.haversine(df.latitude_1, df.longitude_1, o[:, 0], o[:, 1]) < 50) & (
        A.haversine(df.latitude_2, df.longitude_2, d[:, 0], d[:, 1]) < 50
    )
    df = df[near.to_numpy() & (df.dur > 0)].copy()
    df["east"] = ~df.origin.str.startswith("LF")
    df["fr"] = np.where(df.east, df.destination, df.origin)
    df["na"] = np.where(df.east, df.origin, df.destination)
    # robust band around each route-direction median: drops flights merged with the next leg,
    # diversions and holding patterns that were tracked as one flight
    med = df.groupby(["origin", "destination"]).dur.transform("median")
    cnt = df.groupby(["origin", "destination"]).dur.transform("size")
    df = df[(cnt >= 30) & (df.dur > 0.8 * med) & (df.dur < 1.25 * med)].copy()
    mid = df.firstseen + (df.lastseen - df.firstseen) / 2
    df["step"] = ((mid.dt.tz_convert(None) - pd.Timestamp("2019-01-01")) / pd.Timedelta("6h")).round().astype(int)
    df["day"] = mid.dt.strftime("%Y-%m-%d")
    df["month"] = mid.dt.strftime("%Y-%m")
    return df[(df.day >= "2019-01-01") & (df.day <= "2022-12-31")].copy(), n_raw


def add_route_wind(df, ref, lats, lons, U, V):
    """Mean along-route wind (great circle, 250 hPa, at the mid-flight time) for every flight in the grid."""
    df["w"] = np.nan
    df = df[(df.step >= 0) & (df.step < len(U))].copy()  # mid-flight in 2019-2022
    for (o, d), idx in df.groupby(["origin", "destination"]).groups.items():
        a, b = ref[o], ref[d]
        if not A.in_box(a, b, lats, lons):
            continue
        series = A.route_wind(U, V, lats, lons, a, b)
        df.loc[idx, "w"] = series[df.loc[idx, "step"].to_numpy()]
    return df


def direction_stats(s: pd.DataFrame) -> dict:
    out = {
        "n": int(len(s)),
        "med": r1(s.dur.median()),
        "p10": r1(s.dur.quantile(0.1)),
        "p90": r1(s.dur.quantile(0.9)),
    }
    if s.w.notna().sum() >= MIN_FLIGHTS:
        slope, icpt, ci, r = A.ols(s.w, s.dur)
        out |= {"w": r1(s.w.mean()), "slope": r1(slope * 10, 2), "ci": r1(ci * 10, 2), "r": r1(r, 2)}
    return out


def residuals(df) -> pd.Series:
    """Duration minus what the wind predicts on its own route and direction (minutes): what is left
    once the wind is accounted for. Routes outside the wind grid get NaN."""
    out = pd.Series(np.nan, index=df.index)
    for _, s in df[df.w.notna()].groupby(["origin", "destination"]):
        if len(s) < MIN_FLIGHTS:
            continue
        slope, icpt, _, _ = A.ols(s.w, s.dur)
        out[s.index] = s.dur - (icpt + slope * s.w)
    return out


def effects(df, key, names, min_n=MIN_TYPE):
    """Median residual by aircraft type or airline, in each direction, for those flown often enough."""
    rows = []
    for k, s in df.dropna(subset=["res"]).groupby(key):
        e, w = s[s.east].res, s[~s.east].res
        if k not in names or len(e) < min_n or len(w) < min_n:
            continue
        rows.append({"code": k, "name": names[k], "e": r1(e.median()), "w": r1(w.median()), "ne": len(e), "nw": len(w)})
    return sorted(rows, key=lambda r: (r["e"] + r["w"]) / 2)


def calendar(s):
    """Median duration by calendar month (12 values, None under 20 flights)."""
    g = s.groupby(s.month.str[5:7].astype(int)).dur
    med, n = g.median(), g.size()
    return [r1(med[m]) if n.get(m, 0) >= 20 else None for m in range(1, 13)]


def build_flights(df, ref, n_raw):
    df["res"] = residuals(df)
    routes = []
    for (fr, na), s in df.groupby(["fr", "na"]):
        e, w = s[s.east], s[~s.east]
        if len(e) < MIN_FLIGHTS or len(w) < MIN_FLIGHTS or fr not in NAMES or na not in NAMES:
            continue
        routes.append(
            {
                "fr": fr,
                "na": na,
                "from": NAMES[fr],
                "to": NAMES[na],
                "km": round(float(A.haversine(*ref[fr], *ref[na]))),
                "east": direction_stats(e),
                "west": direction_stats(w),
                "months": {"e": calendar(e), "w": calendar(w)},
            }
        )
    routes.sort(key=lambda r: -(r["east"]["n"] + r["west"]["n"]))

    fr, na = PAIR
    p = df[(df.fr == fr) & (df.na == na)]
    e, w = p[p.east], p[~p.east]
    lo = int(np.floor(p.dur.min() / 10) * 10)
    hi = int(np.ceil(p.dur.max() / 10) * 10)
    edges = np.arange(lo, hi + 5, 5)
    months = sorted(df.month.unique())
    monthly = []
    for m in months:
        me, mw = e[e.month == m], w[w.month == m]
        monthly.append(
            {
                "m": m,
                "e": r1(me.dur.median()) if len(me) >= 20 else None,
                "w": r1(mw.dur.median()) if len(mw) >= 20 else None,
                "ne": int(len(me)),
                "nw": int(len(mw)),
                "te": r1(me.w.mean()) if len(me) >= 20 else None,
                "tw": r1(mw.w.mean()) if len(mw) >= 20 else None,
            }
        )

    def days(s):
        g = s.groupby("day").agg(dur=("dur", "median"), w=("w", "mean"), n=("dur", "size"))
        g = g[g.n >= 2]
        slope, icpt, ci, r = A.ols(g.w, g.dur)
        return [[k, r1(v.dur), r1(v.w), int(v.n)] for k, v in g.iterrows()], {
            "slope": r1(slope * 10, 2),
            "icpt": r1(icpt),
            "ci": r1(ci * 10, 2),
            "r": r1(r, 3),
            "n": int(len(g)),
        }

    de, fe = days(e)
    dw, fw = days(w)

    def record(rows, pick):
        d = pick((r for r in rows if r[3] >= 3), key=lambda r: r[1])
        return {"day": d[0], "dur": d[1], "w": d[2], "n": d[3]}

    records = {
        "fast_e": record(de, min),
        "slow_e": record(de, max),
        "fast_w": record(dw, min),
        "slow_w": record(dw, max),
    }
    within = df[df.airline == "AFR"]
    aircraft = {
        "types": effects(df, "typecode", TYPES),
        "afr": effects(within, "typecode", TYPES),
        "airlines": [
            r | {"fleet": p[p.airline == r["code"]].typecode.value_counts().head(2).index.tolist()}
            for r in effects(p, "airline", AIRLINES)
        ],
    }
    write(
        "flights.json",
        {
            "period": [months[0], months[-1]],
            "n_raw": int(n_raw),
            "n_valid": int(len(df)),
            "n_wind": int(df.w.notna().sum()),
            "months": [{"m": m, "n": int((df.month == m).sum())} for m in months],
            "routes": routes,
            "pair": {
                "fr": fr,
                "na": na,
                "from": NAMES[fr],
                "to": NAMES[na],
                "km": round(float(A.haversine(*ref[fr], *ref[na]))),
                "gap": r1(w.dur.median() - e.dur.median()),
                "hist": {
                    "start": lo,
                    "bin": 5,
                    "east": np.histogram(e.dur, edges)[0].tolist(),
                    "west": np.histogram(w.dur, edges)[0].tolist(),
                },
                "monthly": monthly,
                "days": {"e": de, "w": dw},
                "fit": {"e": fe, "w": fw},
                "records": records,
            },
            "aircraft": aircraft,
        },
    )
    return e, w


# ---------------------------------------------------------------- routing
def build_routing(times, lats, lons, U, V, stack, ref, e, w):
    a, b = ref[PAIR[0]], ref[PAIR[1]]
    nowind = float(A.haversine(*a, *b) / A.TAS * 60)
    # every 6-hourly step at full precision, to compare with the flights
    gc_e, best_e, _ = A.fastest_route(U, V, lats, lons, b, a)
    gc_w, best_w, _ = A.fastest_route(U, V, lats, lons, a, b)
    # one route a day on the explorer's fields, so the page and these numbers agree to the minute
    days, la, lo, Uq, Vq = stack
    Uq, Vq = Uq.astype(float), Vq.astype(float)
    de, be_, _ = A.fastest_route(Uq, Vq, la, lo, b, a)
    dw, bw_, _ = A.fastest_route(Uq, Vq, la, lo, a, b)
    gain_e, gain_w = de - be_, dw - bw_
    rows = [
        [t[:10], r1(ge, 2), r1(bge, 2), r1(gw, 2), r1(bgw, 2)]
        for t, ge, bge, gw, bgw in zip(days, de, be_, dw, bw_, strict=True)
    ]

    def model(s, gc, best):
        st = s.step.to_numpy()
        return {
            "n": int(len(s)),
            "r_opt": r1(np.corrcoef(best[st], s.dur)[0, 1], 3),
            "r_gc": r1(np.corrcoef(gc[st], s.dur)[0, 1], 3),
            "offset": r1(np.median(s.dur.to_numpy() - best[st])),
        }

    iw, ie = int(np.argmax(gain_w)), int(np.argmax(gain_e))
    write(
        "routing.json",
        {
            "tas": A.TAS,
            "level": 250,
            "lattice": {"n": 64, "spacing": 60, "m": 30, "reach": 2},
            "pair": list(PAIR),
            "nowind": r1(nowind),
            "days": rows,
            "summary": {
                "gc_e": r1(de.mean()),
                "gc_w": r1(dw.mean()),
                "opt_e": r1(be_.mean()),
                "opt_w": r1(bw_.mean()),
                "gain_e": r1(gain_e.mean()),
                "gain_w": r1(gain_w.mean()),
                "share_e_10": r1(100 * (gain_e >= 10).mean()),
                "share_w_10": r1(100 * (gain_w >= 10).mean()),
                "max_e": [days[ie][:10], r1(gain_e[ie])],
                "max_w": [days[iw][:10], r1(gain_w[iw])],
                "rt_gc": r1((de + dw).mean() - 2 * nowind),
                "rt_opt": r1((be_ + bw_).mean() - 2 * nowind),
            },
            "model": {"e": model(e, gc_e, best_e), "w": model(w, gc_w, best_w)},
        },
    )


def explorer_stack(times, lats, lons, U, V):
    """The 12 UTC fields exactly as the browser gets them: cropped to WINDOW, rounded to 1 m/s (int8)."""
    s, n, wst, est = WINDOW
    i0, i1 = int(np.argmin(abs(lats - s))), int(np.argmin(abs(lats - n))) + 1
    j0, j1 = int(np.argmin(abs(lons - wst))), int(np.argmin(abs(lons - est))) + 1
    noon = np.array([t.endswith("T12") for t in times])
    q = lambda F: np.clip(np.rint(F[noon, i0:i1, j0:j1]), -127, 127).astype(np.int8)  # noqa: E731
    return times[noon], lats[i0:i1], lons[j0:j1], q(U), q(V)


def build_winds(stack, ref):
    """Daily 12 UTC fields for the explorer, one int8 file per year (1 m/s steps, u then v)."""
    days, la, lo, Uq, Vq = stack
    years = {}
    for y in range(2019, 2023):
        sel = np.array([t.startswith(str(y)) for t in days])
        np.stack([Uq[sel], Vq[sel]], axis=1).tofile(OUT / f"winds-{y}.bin")
        years[str(y)] = int(sel.sum())
    write(
        "winds.json",
        {
            "hour": 12,
            "level": 250,
            "scale": 1,
            "lat0": float(la[0]),
            "lon0": float(lo[0]),
            "d": float(la[1] - la[0]),
            "ny": len(la),
            "nx": len(lo),
            "years": years,
            "airports": {c: [r1(ref[c][0], 4), r1(ref[c][1], 4)] for c in [PAIR[0], *EXPLORER]},
            "names": {c: NAMES[c] for c in [PAIR[0], *EXPLORER]},
        },
    )


def write_fixture(ref) -> None:
    """Routes computed here on one stored explorer field, for the browser port's test (route.test.js)."""
    g = json.loads((OUT / "winds.json").read_text())
    ny, nx = g["ny"], g["nx"]
    day = (date(2020, 2, 8) - date(2020, 1, 1)).days
    raw = np.fromfile(OUT / "winds-2020.bin", dtype=np.int8).reshape(-1, 2, ny, nx)[day].astype(float)
    lats = g["lat0"] + g["d"] * np.arange(ny)
    lons = g["lon0"] + g["d"] * np.arange(nx)
    cases = []
    for a, b in (("LFPG", "KJFK"), ("KJFK", "LFPG"), ("LFPG", "KATL"), ("CYUL", "LFPG")):
        gc, best, path = A.fastest_route(raw[0], raw[1], lats, lons, ref[a], ref[b])
        cases.append({"from": a, "to": b, "gc": gc, "best": best, "path": path.tolist()})
    fixture = {"year": 2020, "day": day, "cases": cases}
    (ROOT / "web" / "src" / "jet" / "route.fixture.json").write_text(json.dumps(fixture, indent=1) + "\n")


def build_hero(ref):
    d = np.load(RAW / "era5" / "2020-02-09T00.npz")
    lat, lon = d["lat"].astype(float), d["lon"].astype(float)
    order = np.argsort(lat)
    lat, u, v = lat[order], d["u"].astype(np.float32)[order], d["v"].astype(np.float32)[order]
    sp = np.hypot(u, v) * 3.6
    i, j = np.unravel_index(int(np.nanargmax(sp)), sp.shape)
    np.stack([np.clip(np.rint(u), -127, 127).astype(np.int8), np.clip(np.rint(v), -127, 127).astype(np.int8)]).tofile(
        OUT / "hero.bin"
    )
    a, b = ref["KJFK"], ref["LFPG"]
    gc, best, path = A.fastest_route(u, v, lat, lon, a, b)
    # the same night the other way: Paris -> New York against the jet (the opening's race)
    gc_w, best_w, path_w = A.fastest_route(u, v, lat, lon, b, a)
    la, lo = A.great_circle(*a, *b, 64)
    write(
        "hero.json",
        {
            "time": "2020-02-09T00",
            "level": 250,
            "scale": 1,
            "lat0": float(lat[0]),
            "lon0": float(lon[0]),
            "d": float(lat[1] - lat[0]),
            "ny": len(lat),
            "nx": len(lon),
            "max": {"kmh": round(float(sp[i, j])), "lat": float(lat[i]), "lon": float(lon[j])},
            "route": {
                "from": "KJFK",
                "to": "LFPG",
                "tail": r1(A.route_wind(u, v, lat, lon, a, b)),
                "gc": [[r1(x, 2), r1(y, 2)] for x, y in zip(la, lo, strict=True)],
                "fast": A.route_coords(a, b, path),
                "t_gc": r1(gc),
                "t_fast": r1(best),
                "nowind": r1(A.haversine(*a, *b) / A.TAS * 60),
            },
            "west": {
                "from": "LFPG",
                "to": "KJFK",
                "head": r1(-A.route_wind(u, v, lat, lon, b, a)),
                "fast": A.route_coords(b, a, path_w),
                "t_gc": r1(gc_w),
                "t_fast": r1(best_w),
            },
            "image": {"src": "img/jet/ciara-viirs.jpg", "date": "2020-02-08", "bbox": [20, -90, 70, 20]},
        },
    )
    from PIL import Image

    IMG.mkdir(parents=True, exist_ok=True)
    im = Image.open(RAW / "nasa" / "VIIRS_SNPP_CorrectedReflectance_TrueColor-2020-02-08.jpg").convert("RGB")
    im.resize((1760, 800), Image.LANCZOS).save(IMG / "ciara-viirs.jpg", quality=78, optimize=True, progressive=True)


# ---------------------------------------------------------------- climate (NCEP/NCAR R1, NOAA CPC)
def build_climate(ref):
    import xarray as xr

    u = xr.open_dataset(RAW / "reanalysis" / "uwnd.mon.250.nc").uwnd.isel(level=0).sortby("lat")
    v = xr.open_dataset(RAW / "reanalysis" / "vwnd.mon.250.nc").vwnd.isel(level=0).sortby("lat")
    lats, lons = u.lat.values.astype(float), u.lon.values.astype(float) - 360
    a, b = ref["KJFK"], ref["LFPG"]
    tail = pd.Series(A.route_wind(u.values, v.values, lats, lons, a, b), index=pd.to_datetime(u.time.values))
    nao = NAO.parse((RAW / "nao" / "nao_monthly.txt").read_text())
    nao = pd.Series(nao.values(), index=pd.to_datetime([f"{y}-{m:02d}-01" for y, m in nao]))

    def djf(s):
        s = s[s.index.month.isin([12, 1, 2])]
        k = s.index.year + (s.index.month == 12)  # December counts in the next year's winter
        g = s.groupby(k)
        return g.mean()[g.size() == 3]

    tw, nw = djf(tail), djf(nao)
    winters = [{"y": int(y), "w": r1(tw[y]), "nao": r1(nw.get(y), 2)} for y in tw.index]

    def trend(y0):
        s = tw.loc[y0:]
        slope, _, ci, r = A.ols(s.index, s.values)
        return {"from": int(s.index[0]), "to": int(s.index[-1]), "slope": r1(slope * 10, 2), "ci": r1(ci * 10, 2)}

    both = pd.concat([tw, nw], axis=1, keys=["w", "nao"]).dropna()
    slope, _, ci, r = A.ols(both.nao, both.w)
    ranked = tw.sort_values()

    # 1991-2020 seasonal mean speed (of the monthly mean winds) over the box
    def season(months):
        sel = u.time.dt.month.isin(months) & (u.time.dt.year >= 1991) & (u.time.dt.year <= 2020)
        sp = np.hypot(u.sel(time=sel).mean("time"), v.sel(time=sel).mean("time")) * 3.6
        return [round(float(x)) for x in sp.values.ravel()]

    write(
        "climate.json",
        {
            "route": ["KJFK", "LFPG"],
            "level": 250,
            "last_month": str(u.time.values[-1])[:7],
            "winters": winters,
            "mean": r1(tw.loc[1991:2020].mean()),
            "trend79": trend(1979),
            "trend49": trend(1949),
            "nao": {"r": r1(r, 2), "slope": r1(slope, 1), "ci": r1(ci, 1), "n": int(len(both))},
            "top": [[int(y), r1(tw[y])] for y in ranked.index[::-1][:3]],
            "bottom": [[int(y), r1(tw[y])] for y in ranked.index[:3]],
            "clim": {
                "period": "1991-2020",
                "lat0": float(lats[0]),
                "lon0": float(lons[0]),
                "d": float(lats[1] - lats[0]),
                "ny": len(lats),
                "nx": len(lons),
                "djf": season([12, 1, 2]),
                "jja": season([6, 7, 8]),
            },
        },
    )


# ---------------------------------------------------------------- Trappes radiosondes (Météo-France, IGRA 2)
def trappes_profile():
    """Median wind by standard level above Trappes, winter and summer 1991-2020 (00 and 12 UTC soundings),
    with the median height of each level: where the jet sits in altitude."""
    df = pd.read_csv(RAW / "igra" / "trappes_profile.csv")
    df = df[df.hour.isin([23, 0, 1, 11, 12, 13])]
    year, month = df.date.str[:4].astype(int), df.date.str[5:7].astype(int)
    df = df[(year >= 1991) & (year <= 2020)]
    month = month[df.index]
    out = {}
    for key, months in (("djf", [12, 1, 2]), ("jja", [6, 7, 8])):
        g = df[month.isin(months)].groupby("level_hpa")
        out[key] = [
            {
                "hpa": int(lv),
                "km": r1(s.height_m.median() / 1000, 2),
                "p50": r1(s.wspd_kmh.median(), 0),
                "p90": r1(s.wspd_kmh.quantile(0.9), 0),
                "n": int(len(s)),
            }
            for lv, s in sorted(g, key=lambda x: -x[0])
        ]
    return out


def build_trappes(times, lats, lons, U, V):
    df = pd.read_csv(RAW / "igra" / "trappes_250.csv")
    # main synoptic hours only (00 and 12 UTC, launches up to an hour off); a launch at 23 UTC is
    # the 00 UTC sounding of the next day
    df["syn"] = df.hour.map({23: 0, 0: 0, 1: 0, 11: 12, 12: 12, 13: 12})
    df = df[df.syn.notna()].copy()
    late = df.hour == 23
    df.loc[late, "date"] = (pd.to_datetime(df.loc[late, "date"]) + pd.Timedelta("1D")).dt.strftime("%Y-%m-%d")
    df = df.drop_duplicates(["date", "syn"])
    df["year"] = df.date.str[:4].astype(int)
    df["month"] = df.date.str[5:7].astype(int)
    df = df[df.year >= 1973].copy()  # four soundings a day from 1973
    # an isolated spike at 250 hPa, far above both neighbouring levels, is treated as an error
    neigh = df[["wspd300_kmh", "wspd200_kmh"]].max(axis=1)
    spike = df.wspd300_kmh.notna() & df.wspd200_kmh.notna() & (df.wspd_kmh > neigh + 60)
    rejected = int(spike.sum())
    df = df[~spike]
    last_full = int(df.year.max()) - (1 if df[df.year == df.year.max()].month.max() < 12 else 0)
    full = df[df.year <= last_full]

    norm = full[(full.year >= 1991) & (full.year <= 2020)]
    months = [
        {"m": int(m), **{f"p{q}": r1(s.wspd_kmh.quantile(q / 100), 0) for q in (10, 25, 50, 75, 90)}}
        for m, s in norm.groupby("month")
    ]
    years = []
    for y, s in full.groupby("year"):
        if len(s) < 300:
            continue
        years.append({"y": int(y), "n": int(len(s)), "strong": int((s.wspd_kmh >= 200).sum())})
    ranked = full.sort_values("wspd_kmh", ascending=False).reset_index(drop=True)
    top = ranked.head(10)
    ciara = ranked[(ranked.date == "2020-02-10") & (ranked.syn == 12)]
    before = ranked.loc[: ciara.index[0] - 1] if len(ciara) else ranked.iloc[0:0]
    stronger = before[before.date < "2020-02-10"].date.max() if len(before) else None

    # ERA5 (1.5 degree) at Trappes against the balloons, 00 and 12 UTC 2019-2022
    t = pd.Series(range(len(times)), index=[s[:10] + ("T00" if s.endswith("T00") else s[10:]) for s in times])
    chk = df[(df.year >= 2019) & (df.year <= 2022)].copy()
    chk["key"] = chk.date + "T" + chk.syn.astype(int).map("{:02d}".format)
    chk = chk[chk.key.isin(t.index)]
    k = t[chk.key].to_numpy()
    ue = A.interp(U[k], lats, lons, TRAPPES[0], TRAPPES[1])
    ve = A.interp(V[k], lats, lons, TRAPPES[0], TRAPPES[1])
    era = np.hypot(ue, ve) * 3.6
    obs = chk.wspd_kmh.to_numpy()
    write(
        "trappes.json",
        {
            "station": "Trappes",
            "wmo": "07145",
            "level": 250,
            "from": int(full.year.min()),
            "to": last_full,
            "n": int(len(full)),
            "rejected": rejected,
            "months": months,
            "years": years,
            "top": [[r.date, int(r.syn), r1(r.wspd_kmh, 0), int(r.wdir)] for r in top.itertuples()],
            "ciara": {
                "date": "2020-02-10",
                "kmh": r1(ciara.wspd_kmh.iloc[0], 0) if len(ciara) else None,
                "rank": int(ciara.index[0]) + 1 if len(ciara) else None,
                "stronger_before": stronger,  # last date with a stronger wind before Ciara
            },
            "profile": trappes_profile(),
            "check": {
                "n": int(len(obs)),
                "r": r1(np.corrcoef(era, obs)[0, 1], 3),
                "bias": r1(np.mean(era - obs)),
                "mae": r1(np.mean(np.abs(era - obs))),
            },
        },
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ref = airports()
    print("ERA5 6-hourly 2019-2022...")
    times, lats, lons, U, V = era5_stack()
    print("flights...")
    df, n_raw = load_flights(ref)
    df = add_route_wind(df, ref, lats, lons, U, V)
    e, w = build_flights(df, ref, n_raw)
    print("routing...")
    stack = explorer_stack(times, lats, lons, U, V)
    build_routing(times, lats, lons, U, V, stack, ref, e, w)
    build_winds(stack, ref)
    write_fixture(ref)
    print("history...")
    hist = build_history.build(build_sim.STORMS)
    titles = [
        "Le plus fort vent arrière de 1959 à 2022",
        "Le 2e plus fort vent arrière de 1959 à 2022",
        "Le 3e plus fort vent arrière de 1959 à 2022",
        "Le vent le plus contraire de 1959 à 2022",
    ]
    extra = [{"day": d, "group": "history", "title": t} for d, t in zip(hist["sim_days"], titles, strict=True)]
    print("simulator...")
    build_sim.build(
        json.loads((OUT / "flights.json").read_text()),
        json.loads((OUT / "routing.json").read_text()),
        (times, lats, lons, U, V),
        extra,
    )
    if "--skip-stats" not in sys.argv:  # ten minutes; sim_stats.json is kept when skipped
        build_sim.stats()
    print("fuel prices and loads...")
    build_cost.build()
    print("forecasts...")
    build_forecast.build()
    print("opening map...")
    build_hero(ref)
    print("climate...")
    build_climate(ref)
    print("Trappes...")
    build_trappes(times, lats, lons, U, V)
    write(
        "meta.json",
        {
            "generated": datetime.now(UTC).strftime("%Y-%m-%d"),
            "built_from": {
                "opensky": "Zenodo 7923702, 2019-01 to 2022-12",
                "era5": "WeatherBench 2 ERA5 1.5 degree 6-hourly, 2019-2022; ARCO-ERA5 0.25 degree for 2020-02-09T00",
                "r1": "NCEP/NCAR Reanalysis 1 monthly means, 1948 onwards",
                "nao": "NOAA CPC monthly NAO index",
                "igra": "IGRA 2 station FRM00007145 (Trappes)",
                "nasa": "GIBS VIIRS_SNPP_CorrectedReflectance_TrueColor 2020-02-08",
                "prices": "EIA EER_EPJK_PF4_RGC_DPG monthly, ECB EXR.M.USD.EUR.SP00.A",
                "dgac_pap": "DGAC traffic per airport pair, Paris-CDG <-> New York-JFK",
                "forecasts": "WeatherBench 2: ECMWF HRES and Pangu-Weather, 2020, leads 12 h and 108 h",
            },
        },
    )


if __name__ == "__main__":
    main()
