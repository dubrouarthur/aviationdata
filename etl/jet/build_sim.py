"""Data of the flight simulator: chosen days at three cruise levels, aircraft, CO2, and what choosing the
altitude and the departure time would have changed every day of 2019-2022.

Inputs: data/raw/era5_levels/<day>.npz and year-<year>.npz (etl/jet/era5_levels.py), the aircraft of
OpenAP (Sun, Hoekstra & Ellerbroek, 2020, Aerospace 7(8):104, open source) and the DGAC emission
factor of long-haul flights (web/public/data/co2.json, from the DGAC open data of the first story).
Called by build_jet.py; writes web/public/data/jet/sim.json, sim/<day>.bin, sim_stats.json and
web/src/jet/sim.fixture.json.
"""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

import analysis as A
import numpy as np
import sim as S

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "era5_levels"
OUT = ROOT / "web" / "public" / "data" / "jet"
T_OFFSET = 215  # K: temperatures are stored as int8 around this value
LEVELS = [
    {"hpa": 300, "fl": 300, "m": 9164},  # ICAO standard atmosphere heights
    {"hpa": 250, "fl": 340, "m": 10363},
    {"hpa": 200, "fl": 390, "m": 11784},
]
ISA_T = [228.6, 220.8, 216.65]  # K at those heights, standard atmosphere
AIRCRAFT = [
    ("A333", "Airbus A330-300"),
    ("B77W", "Boeing 777-300ER"),
    ("B789", "Boeing 787-9"),
    ("A359", "Airbus A350-900"),
]
STORMS = [
    ("1999-12-26", "Tempête Lothar", "lothar"),
    ("1999-12-27", "Tempête Martin", "lothar"),
    ("2009-01-23", "Tempête Klaus", "klaus"),
    ("2010-02-27", "Tempête Xynthia", "xynthia"),
    ("2020-02-08", "Tempête Ciara", "ba112"),
]
CDG = (49.0097, 2.5479)
JFK = (40.6413, -73.7781)


def r1(x, nd=1):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def write(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    print(f"  {name}: {(OUT / name).stat().st_size // 1024} KB")


def aircraft():
    """Cruise Mach from OpenAP, and its cruise fuel flow at each level relative to flight level 340
    (80 % of the maximum take-off mass, standard atmosphere)."""
    from openap import FuelFlow, prop

    out = []
    for code, name in AIRCRAFT:
        p = prop.aircraft(code.lower())
        mach = p["cruise"]["mach"]
        ff = FuelFlow(code.lower())
        flows = []
        for lv, t in zip(LEVELS, ISA_T, strict=True):
            tas_kt = mach * math.sqrt(1.4 * 287.05 * t) * 1.943844
            flows.append(float(ff.enroute(mass=0.8 * p["mtow"], tas=tas_kt, alt=lv["fl"] * 100, vs=0)))
        out.append({"code": code, "name": name, "mach": mach, "fuel": [round(f / flows[1], 3) for f in flows]})
    return out


def quantize(d):
    """The stored fields, exactly as the browser decodes them."""
    u = np.clip(np.rint(d["u"].astype(float)), -127, 127)
    v = np.clip(np.rint(d["v"].astype(float)), -127, 127)
    t = np.clip(np.rint(d["t"].astype(float)) - T_OFFSET, -127, 127)
    return u, v, t


def wanted(flights, routing, extra):
    """The days of the simulator: storms, the records of 2019-2022, ordinary days, then history."""
    R = flights["pair"]["records"]
    s = routing["summary"]
    summer = [d for d in routing["days"] if d[0][5:7] in ("06", "07", "08")]
    calm = min(summer, key=lambda d: abs(d[3] - d[1]))[0]
    days = [{"day": d, "group": "storm", "title": t, "fact": f} for d, t, f in STORMS]
    days += [
        {"day": R["fast_e"]["day"], "group": "record", "title": "Le jour le plus rapide vers Paris"},
        {"day": R["slow_w"]["day"], "group": "record", "title": "Le jour le plus lent vers New York"},
        {"day": R["fast_w"]["day"], "group": "record", "title": "Le vent tourne à l'est"},
        {"day": calm, "group": "typical", "title": "Un jour d'été presque sans vent"},
    ]
    days += extra
    seen, out = set(), []
    for d in days:
        if d["day"] not in seen:
            seen.add(d["day"])
            out.append(d)
    if s["max_w"][0] not in seen:
        out.append({"day": s["max_w"][0], "group": "record", "title": "Le plus grand détour vers New York"})
    return out


def typical_days(times, U, V, lats, lons):
    """The 2019-2022 winter and summer days whose wind along New York-Paris at noon is the seasonal median."""
    noon = np.array([t.endswith("T12") for t in times])
    w = A.route_wind(U[noon], V[noon], lats, lons, JFK, CDG)
    days = np.array([t[:10] for t in times[noon]])
    out = []
    for months, title in (
        ({"12", "01", "02"}, "Un jour d'hiver ordinaire"),
        ({"06", "07", "08"}, "Un jour d'été ordinaire"),
    ):
        sel = np.array([d[5:7] in months for d in days])
        med = np.median(w[sel])
        i = np.flatnonzero(sel)[np.argmin(np.abs(w[sel] - med))]
        out.append({"day": str(days[i]), "group": "typical", "title": title})
    return out


def build(flights, routing, era5, extra_days=()):
    times, lats, lons, U, V = era5
    (OUT / "sim").mkdir(parents=True, exist_ok=True)
    planes = aircraft()
    co2 = json.loads((ROOT / "web" / "public" / "data" / "co2.json").read_text())
    days = wanted(flights, routing, typical_days(times, U, V, lats, lons) + list(extra_days))
    entries, missing, grid = [], [], None
    for d in days:
        p = RAW / f"{d['day']}.npz"
        if not p.exists():
            missing.append(d["day"])
            continue
        z = np.load(p)
        u, v, t = quantize(z)
        np.stack([u, v, t], axis=2).astype(np.int8).tofile(OUT / "sim" / f"{d['day']}.bin")
        grid = grid or {
            "lat0": float(z["lat"][0]),
            "lon0": float(z["lon"][0]),
            "d": float(z["lat"][1] - z["lat"][0]),
            "ny": int(len(z["lat"])),
            "nx": int(len(z["lon"])),
            "steps": int(u.shape[0]),
            "levels": int(u.shape[1]),
            "tOffset": T_OFFSET,
            "hours": [0, 6, 12, 18, 24, 30],
        }
        sp = np.hypot(u, v) * 3.6
        k, lv, i, j = np.unravel_index(int(np.argmax(sp)), sp.shape)
        F = S.Field(u, v, t + T_OFFSET, grid["lat0"], grid["lon0"], grid["d"])
        tail = A.route_wind(u[2, 1], v[2, 1], z["lat"].astype(float), z["lon"].astype(float), JFK, CDG)
        entries.append(
            d
            | {
                "max": {
                    "kmh": round(float(sp[k, lv, i, j])),
                    "hour": grid["hours"][k],
                    "level": int(lv),
                    "lat": float(z["lat"][i]),
                    "lon": float(z["lon"][j]),
                },
                "tail": r1(tail),
            }
        )
        if d["day"] == "2020-02-08":
            ciara = F
    if missing:
        print(
            f"  sim: {len(missing)} days missing, fetch them with: python3 etl/jet/era5_levels.py {' '.join(missing)}"
        )
    order = {"storm": 0, "record": 1, "typical": 2, "history": 3}
    entries.sort(key=lambda e: (order[e["group"]], e["day"]))
    ref_year = co2["years"][-1]
    g_pkm = co2["g_peqkm"]["INTL_LC"][-1]

    # what the hour and the level change on the night of Ciara, for a Boeing 777-300ER
    b77w = next(p for p in planes if p["code"] == "B77W")
    story = {}
    for key, a, b in (("west", CDG, JFK), ("east", JFK, CDG)):
        rows = []
        for h in (0, 6, 12, 18):
            row = [r1(S.best_route(ciara, a, b, h, b77w["mach"], level=lv)["minutes"]) for lv in range(3)]
            row.append(r1(S.best_route(ciara, a, b, h, b77w["mach"])["minutes"]))
            gc = S.path_time(ciara, S.great_circle_points(a, b), h, 1, b77w["mach"])[0]
            rows.append({"hour": h, "best": row, "gc": r1(gc)})
        story[key] = rows
    write(
        "sim.json",
        {
            "grid": grid,
            "levels": LEVELS,
            "aircraft": planes,
            "co2": {"g_pkm": g_pkm, "year": ref_year, "source": "DGAC, vols internationaux long-courriers"},
            "days": entries,
            "ciara": {"aircraft": "B77W", **story},
        },
    )
    write_fixture(ciara, planes)


def write_fixture(F, planes):
    """Routes solved here on the stored Ciara fields, for the browser port's test (sim.test.js)."""
    b77w = next(p for p in planes if p["code"] == "B77W")
    cases = []
    for name, a, b, h, level, fuel in (
        ("west FL340 12 UTC", CDG, JFK, 12, 1, None),
        ("west free 6 UTC", CDG, JFK, 6, None, None),
        ("east free fuel 0 UTC", JFK, CDG, 0, None, b77w["fuel"]),
        ("east FL390 18 UTC", JFK, CDG, 18, 2, b77w["fuel"]),
    ):
        r = S.best_route(F, a, b, h, b77w["mach"], level=level, fuel=fuel)
        cases.append(
            {
                "name": name,
                "from": list(a),
                "to": list(b),
                "hour": h,
                "level": level,
                "fuel": fuel,
                "minutes": r["minutes"],
                "burn": r["burn"],
                "levels": [p[2] for p in r["path"]],
            }
        )
    gc = S.path_time(F, S.great_circle_points(CDG, JFK), 12, 1, b77w["mach"])
    fixture = {"day": "2020-02-08", "mach": b77w["mach"], "cases": cases, "gc": {"minutes": gc[0], "winds": gc[3][:5]}}
    (ROOT / "web" / "src" / "jet" / "sim.fixture.json").write_text(json.dumps(fixture, indent=1) + "\n")


# ---------------------------------------------------------------- every day of 2019-2022
def stats(plane="B77W"):
    """For every day of 2019-2022, for one aircraft: the fastest Paris-New York route at 12 UTC and
    New York-Paris at 00 UTC, at each level and with a free level, against the great circle at flight
    level 340; and the same choices made to burn the least fuel, in kg of CO2 per passenger."""
    years = [RAW / f"year-{y}.npz" for y in range(2019, 2023)]
    if not all(p.exists() for p in years):
        print("  sim_stats: year files missing, run python3 etl/jet/era5_levels.py --years 2019,2020,2021,2022")
        return None
    zs = [np.load(p) for p in years]
    times = np.concatenate([z["times"] for z in zs])
    u = np.concatenate([np.clip(np.rint(z["u"].astype(np.float32)), -127, 127) for z in zs])
    v = np.concatenate([np.clip(np.rint(z["v"].astype(np.float32)), -127, 127) for z in zs])
    t = np.concatenate([np.rint(z["t"].astype(np.float32)) for z in zs])
    days = sorted({s[:10] for s in times})
    index = {s: i for i, s in enumerate(times)}
    # each day: 00, 06, 12, 18 UTC and 00, 06 UTC the next day (the last day keeps its own 18 UTC)
    sel = []
    for d in days:
        nxt = (date.fromisoformat(d).toordinal() + 1, d)
        nd = date.fromordinal(nxt[0]).isoformat()
        st = [f"{d}T{h:02d}" for h in (0, 6, 12, 18)] + [f"{nd}T00", f"{nd}T06"]
        sel.append([index.get(s, index[f"{d}T18"]) for s in st])
    sel = np.array(sel)
    g = json.loads((OUT / "winds.json").read_text())
    ac = next(a for a in aircraft() if a["code"] == plane)
    planes_mach, fuel = ac["mach"], np.array(ac["fuel"])
    co2 = json.loads((ROOT / "web" / "public" / "data" / "co2.json").read_text())
    g_pkm = co2["g_peqkm"]["INTL_LC"][-1]
    out = {"days": days, "mach": planes_mach, "aircraft": ac["name"], "g_pkm": g_pkm}
    for key, a, b, h in (("west", CDG, JFK, 12), ("east", JFK, CDG, 0)):
        F = S.StackField(u[sel], v[sel], t[sel], g["lat0"], g["lon0"], g["d"])
        res = {}
        for lv in range(3):
            res[f"l{lv}"] = S.best_route_stack(F, a, b, h, planes_mach, level=lv)["minutes"]
        free = S.best_route_stack(F, a, b, h, planes_mach)
        res["free"] = free["minutes"]
        free_fuel = S.best_route_stack(F, a, b, h, planes_mach, fuel=fuel)
        pts = S.great_circle_points(a, b)
        gc = np.zeros(len(days))
        tt = np.full(len(days), float(h))
        for i in range(len(pts) - 1):
            la1, lo1, la2, lo2 = pts[i, 0], pts[i, 1], pts[i + 1, 0], pts[i + 1, 1]
            seg = A.haversine(la1, lo1, la2, lo2)
            trk = A.bearing(la1, lo1, la2, lo2)
            uu, vv, te = F.sample(
                np.array([(la1 + la2) / 2]),
                np.array([(lo1 + lo2) / 2]),
                (tt + seg / (planes_mach * 1080) / 2)[:, None],
                1,
            )
            gs = A.ground_speed(uu[:, 0], vv[:, 0], trk, planes_mach * S.sound_kmh(te[:, 0]))
            mins = seg / gs * 60
            gc += mins
            tt += mins / 60
        res["gc"] = gc
        levels = np.stack([res["l0"], res["l1"], res["l2"]])
        best_fixed = levels.min(axis=0)
        which = np.argmin(levels, axis=0)
        # the same choices for the least fuel: fuel-minutes, then kg of CO2 per passenger
        km = float(A.haversine(*a, *b))
        kg = g_pkm * km / 1000 / (km / (planes_mach * S.sound_kmh(220.8)) * 60)  # per fuel-minute
        burn = levels * fuel[:, None]
        which_f = np.argmin(burn, axis=0)
        co2_kg = {
            "gc": float((gc * fuel[1]).mean() * kg),
            "l1": float((res["l1"] * fuel[1]).mean() * kg),
            "best_level": float(burn.min(axis=0).mean() * kg),
            "free": float(free_fuel["burn"].mean() * kg),
        }
        out[key] = {
            "hour": h,
            "gc": r1(gc.mean()),
            "l1": r1(res["l1"].mean()),
            "best_level": r1(best_fixed.mean()),
            "free": r1(res["free"].mean()),
            "share": [r1(100 * (which == k).mean()) for k in range(3)],
            "gain_gc_l1": r1((gc - res["l1"]).mean()),
            "gain_level": r1((res["l1"] - best_fixed).mean()),
            "gain_free": r1((best_fixed - res["free"]).mean()),
            "free_share": [r1(100 * x) for x in free["share"].mean(axis=0)],
            "co2": {k: r1(v) for k, v in co2_kg.items()},
            "fuel_share": [r1(100 * (which_f == k).mean()) for k in range(3)],
            "fuel_free_share": [r1(100 * x) for x in free_fuel["share"].mean(axis=0)],
            "daily": [
                [r1(x) for x in row] for row in zip(gc, res["l0"], res["l1"], res["l2"], res["free"], strict=True)
            ],
        }
        o = out[key]
        print(f"  sim_stats {key}: {o['gain_gc_l1']} + {o['gain_level']} + {o['gain_free']} min, CO2 {o['co2']}")
    write("sim_stats.json", out)
    return out
