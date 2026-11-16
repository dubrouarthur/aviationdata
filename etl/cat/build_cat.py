"""data/raw/cat/<year>.npz (era5_cat.py) -> web/public/data/cat/cat.json, the investigation on clear-air turbulence.

"Propice" = the Ellrod index TI1 above the threshold that the strongest 1 % of situations cross over the
whole globe (78 S - 78 N, area-weighted, all levels' own threshold computed at 250 hPa, 1979-2022); "fort" =
the strongest 0.1 %. Both thresholds are picked among era5_cat.THRESH, the nearest to the percentile, and the
share actually crossed is published (`pct`). A frequency is the share of 6-hourly analyses above it.

    python3 etl/cat/build_cat.py
"""

import base64
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "cat"
OUT = ROOT / "web" / "public" / "data" / "cat" / "cat.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from era5_cat import LAT_MAX, LEVELS, THRESH  # noqa: E402

FIRST, LAST = 1979, 2022
SEASONS = {"DJF": [11, 0, 1], "MAM": [2, 3, 4], "JJA": [5, 6, 7], "SON": [8, 9, 10]}
# boxes: south, north, west, east (degrees, longitudes -180..180)
REGIONS = {
    "atlantique": ("Atlantique Nord", (40, 65, -70, -10)),
    "pacifique": ("Pacifique Nord", (30, 55, 150, -150)),
    "europe": ("Europe", (35, 60, -10, 30)),
    "amerique": ("États-Unis", (30, 50, -125, -70)),
    "asie": ("Asie de l'Est", (25, 45, 100, 145)),
    "nord": ("Hémisphère nord", (25, 78, -180, 180)),
    "sud": ("Hémisphère sud", (-78, -25, -180, 180)),
}
# airports (OurAirports coordinates): route exposure along the great circle
AIRPORTS = {
    "CDG": ("Paris-CDG", 49.0097, 2.5479, "Paris"),
    "JFK": ("New York-JFK", 40.6413, -73.7781, "New York"),
    "NRT": ("Tokyo-Narita", 35.7647, 140.3864, "Tokyo"),
    "LAX": ("Los Angeles", 33.9425, -118.4081, "Los Angeles"),
    "DXB": ("Dubaï", 25.2528, 55.3644, "Dubaï"),
    "YUL": ("Montréal", 45.4706, -73.7408, "Montréal"),
    "GRU": ("São Paulo", -23.4356, -46.4731, "São Paulo"),
    "SIN": ("Singapour", 1.3502, 103.9940, "Singapour"),
    "JNB": ("Johannesburg", -26.1392, 28.2460, "Johannesburg"),
}
ROUTES = [
    ("CDG", "JFK"),
    ("CDG", "YUL"),
    ("CDG", "NRT"),
    ("NRT", "LAX"),
    ("CDG", "DXB"),
    ("CDG", "SIN"),
    ("CDG", "GRU"),
    ("CDG", "JNB"),
]


def load():
    years = list(range(FIRST, LAST + 1))
    missing = [y for y in years if not (RAW / f"{y}.npz").exists()]
    if missing and "--partial" not in sys.argv:
        raise SystemExit(f"années manquantes dans {RAW}: {missing} (python3 etl/cat/era5_cat.py)")
    years = [y for y in years if y not in missing]
    zs = [np.load(RAW / f"{y}.npz") for y in years]
    z0 = zs[0]
    assert list(z0["levels"]) == LEVELS and np.allclose(z0["thresh"], THRESH)
    return (
        years,
        np.stack([z["steps"] for z in zs]),  # [y, m]
        np.stack([z["exc"] for z in zs]).astype(np.float64),  # [y, L, m, thr, lat, lon]
        np.stack([z["ws"] for z in zs]),  # [y, L, m, lat, lon]
        np.stack([z["vws"] for z in zs]),
        np.stack([z["hist"] for z in zs]),  # [y, L, m, bin]
        z0["bins"],
        z0["lat"],
        z0["lon"],
    )


years, steps, exc, ws, vws, hist, bins, lat, lon = load()
NY = len(years)
iL = LEVELS.index(250)
# rows within 78 S - 78 N, longitudes reordered to -180..180
rows = np.where(np.abs(lat) <= LAT_MAX)[0]
cols = np.r_[np.arange(120, 240), np.arange(0, 120)]
LAT = lat[rows]
LON = np.where(lon[cols] >= 180, lon[cols] - 360, lon[cols])
exc = exc[..., rows, :][..., cols]
ws = ws[..., rows, :][..., cols]
vws = vws[..., rows, :][..., cols]
W = np.cos(np.radians(LAT))[:, None] * np.ones(len(LON))[None, :]


# --------------------------------------------------------------------- thresholds from the global histogram
# exact shares over the grid (area-weighted), for every threshold; the published ones are the nearest to 1 % and 0.1 %
f_all = exc[:, iL].sum((0, 1)) / steps.sum()  # [thr, lat, lon]
share = np.array([(f_all[k] * W).sum() / W.sum() for k in range(len(THRESH))])
k_mod = int(np.argmin(np.abs(np.log(share / 0.01))))
k_sev = int(np.argmin(np.abs(np.log(share / 0.001))))
pct = {k: float(share[k]) for k in (k_mod, k_sev)}


def freq(e, s):
    """counts and step totals -> frequency, broadcasting steps over the grid."""
    return e / s


def box_mask(b):
    s, n, w, e = b
    la = (LAT >= s) & (LAT <= n)
    lo = (LON >= w) & (LON <= e) if w <= e else (LON >= w) | (LON <= e)
    return la[:, None] & lo[None, :]


def wmean(a, m):
    """area-weighted mean of a [..., lat, lon] array over mask m."""
    ww = W * m
    return (a * ww).sum((-2, -1)) / ww.sum()


def r(x, d=4):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), d)


def season_years(arr_ym, s, stp=None):
    """[y, m, ...] counts -> per season year: DJF of year y = Dec y-1 + Jan, Feb y (first year without)."""
    ms = SEASONS[s]
    out = []
    for i in range(NY):
        if s == "DJF":
            if i == 0:
                out.append(None)
                continue
            parts = [(i - 1, 11), (i, 0), (i, 1)]
        else:
            parts = [(i, m) for m in ms]
        out.append(parts)
    return out


def region_series(k, b):
    m = box_mask(b)
    e = exc[:, iL, :, k]  # [y, m, lat, lon]
    monthly = wmean(e, m) / steps  # [y, m]
    annual = wmean(e.sum(1), m) / steps.sum(1)
    seas = {}
    for s in SEASONS:
        vals = []
        for parts in season_years(None, s):
            if parts is None:
                vals.append(None)
                continue
            num = sum(wmean(e[i, mm], m) for i, mm in parts)
            den = sum(steps[i, mm] for i, mm in parts)
            vals.append(num / den)
        seas[s] = vals
    return monthly, annual, seas


def trend(y, v):
    """OLS slope and the share of change it gives over the period, against the fitted first year."""
    pts = [(a, b) for a, b in zip(y, v, strict=True) if b is not None]
    x = np.array([p[0] for p in pts], float)
    z = np.array([p[1] for p in pts], float)
    sl, ic = np.polyfit(x, z, 1)
    a, b = ic + sl * x[0], ic + sl * x[-1]
    # two-sided t-test on the slope
    res = z - (ic + sl * x)
    se = math.sqrt((res**2).sum() / (len(x) - 2) / ((x - x.mean()) ** 2).sum())
    return {"slope": r(sl, 8), "from": r(a, 6), "to": r(b, 6), "change": r(b / a - 1, 4), "t": r(sl / se, 2)}


def decades(v):
    a = [x for x in v[:10] if x is not None]
    b = [x for x in v[-10:] if x is not None]
    return {"first": r(np.mean(a), 6), "last": r(np.mean(b), 6), "change": r(np.mean(b) / np.mean(a) - 1, 4)}


def b64(a):
    return base64.b64encode(np.asarray(a, np.uint8).tobytes()).decode()


def great_circle(p, q, n=200):
    (la1, lo1), (la2, lo2) = (np.radians(p), np.radians(q))
    d = 2 * math.asin(
        math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    )
    f = np.linspace(0, 1, n)
    A = np.sin((1 - f) * d) / math.sin(d)
    B = np.sin(f * d) / math.sin(d)
    x = A * math.cos(la1) * math.cos(lo1) + B * math.cos(la2) * math.cos(lo2)
    y = A * math.cos(la1) * math.sin(lo1) + B * math.cos(la2) * math.sin(lo2)
    z = A * math.sin(la1) + B * math.sin(la2)
    return np.degrees(np.arctan2(z, np.hypot(x, y))), np.degrees(np.arctan2(y, x)), d * 6371.0


def along(f, idx):
    return float(np.mean([f[i, j] for i, j in idx]))


def cell(la, lo):
    i = int(np.argmin(np.abs(LAT - la)))
    j = int(np.argmin(np.abs(((LON - lo) + 180) % 360 - 180)))
    return i, j


# --------------------------------------------------------------------- outputs
out = {
    "meta": {
        "years": years,
        "levels": LEVELS,
        "fl": {200: 390, 250: 340, 300: 300},
        "thrMod": float(THRESH[k_mod]),
        "thrSev": float(THRESH[k_sev]),
        "pctMod": r(pct[k_mod], 5),
        "pctSev": r(pct[k_sev], 6),
        "lat0": float(LAT[0]),
        "lon0": float(LON[0]),
        "step": 1.5,
        "nlat": len(LAT),
        "nlon": len(LON),
        "analyses": int(steps.sum()),
        "mapScale": 1000,  # map values = frequency x mapScale, capped at 255
    }
}

# maps at 250 hPa: climatology, each season
fmap = {}
fmap["annual"] = exc[:, iL, :, k_mod].sum((0, 1)) / steps.sum()
for s, ms in SEASONS.items():
    fmap[s] = exc[:, iL, ms, k_mod].sum((0, 1)) / steps[:, ms].sum()
out["maps"] = {s: b64(np.clip(np.round(v * 1000), 0, 255)) for s, v in fmap.items()}
out["meta"]["mapMax"] = r(max(float(v.max()) for v in fmap.values()), 4)


SPAN = min(15, NY // 2)  # 15 years at each end (fewer only in a --partial run)


# change map: last SPAN years against first SPAN, at 3 degrees (2 x 2 cells) to steady it
def blocks(a):
    n, m = a.shape[0] // 2 * 2, a.shape[1]
    return a[:n].reshape(n // 2, 2, m // 2, 2).sum((1, 3))


e15a = blocks(exc[:SPAN, iL, :, k_mod].sum((0, 1)))
e15b = blocks(exc[-SPAN:, iL, :, k_mod].sum((0, 1)))
fa, fb = e15a / (4 * steps[:SPAN].sum()), e15b / (4 * steps[-SPAN:].sum())
chg = np.where(fa > 0.002, fb / np.maximum(fa, 1e-9) - 1, np.nan)  # only where the conditions are not rare
out["change"] = {
    "first": [years[0], years[SPAN - 1]],
    "last": [years[-SPAN], years[-1]],
    "lat0": float(LAT[0] + 0.75),
    "lon0": float(LON[0] + 0.75),
    "step": 3.0,
    "nlat": chg.shape[0],
    "nlon": chg.shape[1],
    "minFreq": 0.002,
    # percent change, offset by 128, capped at -100 / +127 %; 255 = not shown
    "values": b64(np.where(np.isnan(chg), 255, np.clip(np.round(chg * 100), -100, 126) + 128)),
}

# the opening compares two decades side by side: the strongest conditions, 1.5-degree cells, byte = frequency x 30000
D0, D1 = slice(0, min(10, NY)), slice(max(0, NY - 10), NY)
out["decades"] = {
    "first": [years[D0][0], years[D0][-1]],
    "last": [years[D1][0], years[D1][-1]],
    "scale": 30000,
    "sev": {
        "first": b64(np.clip(np.round(exc[D0, iL, :, k_sev].sum((0, 1)) / steps[D0].sum() * 30000), 0, 255)),
        "last": b64(np.clip(np.round(exc[D1, iL, :, k_sev].sum((0, 1)) / steps[D1].sum() * 30000), 0, 255)),
    },
}

# month x latitude, zonal means at 250 hPa, the whole period; and the North Atlantic sector (70-10 W)
zon = exc[:, iL, :, k_mod].sum(0) / steps.sum(0)[:, None, None]  # [m, lat, lon]
atl = (LON >= -70) & (LON <= -10)
out["zonal"] = {
    "all": [[r(x, 4) for x in zon[m].mean(-1)] for m in range(12)],
    "atlantique": [[r(x, 4) for x in zon[m][:, atl].mean(-1)] for m in range(12)],
}

# the vertical section: zonal means at each level, by latitude (78 S at index 0), all longitudes
sect = {}
for name, ms in [("annual", list(range(12))), ("DJF", SEASONS["DJF"]), ("JJA", SEASONS["JJA"])]:
    f = exc[:, :, ms, k_mod].sum((0, 2)) / steps[:, ms].sum()  # [L, lat, lon]
    sect[name] = {str(L): [r(x, 4) for x in f[li].mean(-1)] for li, L in enumerate(LEVELS)}
out["section"] = sect

regions = {}
for key, (label, b) in REGIONS.items():
    monthly, annual, seas = region_series(k_mod, b)
    _, annual_sev, _ = region_series(k_sev, b)
    m = box_mask(b)
    lv = {}
    for li, L in enumerate(LEVELS):
        lv[L] = r(wmean(exc[:, li, :, k_mod].sum((0, 1)), m) / steps.sum(), 5)
    clim_m = [r(wmean(exc[:, iL, mm, k_mod].sum(0), m) / steps[:, mm].sum(), 5) for mm in range(12)]
    v_ann = wmean((vws[:, iL] * steps[:, :, None, None]).sum(1) / steps.sum(1)[:, None, None], m)
    w_ann = wmean((ws[:, iL] * steps[:, :, None, None]).sum(1) / steps.sum(1)[:, None, None], m)
    regions[key] = {
        "label": label,
        "box": list(b),
        "annual": [r(x, 5) for x in annual],
        "annualSev": [r(x, 6) for x in annual_sev],
        "seasons": {s: [r(x, 5) for x in v] for s, v in seas.items()},
        "monthly": [[r(x, 5) for x in row] for row in monthly],
        "clim": clim_m,
        "levels": lv,
        "vws": [r(x * 1000, 4) for x in v_ann],  # m/s per km
        "ws": [r(x, 2) for x in w_ann],
        "trend": trend(years, annual),
        "trendSev": trend(years, annual_sev),
        "trendSeasons": {s: trend(years, v) for s, v in seas.items()},
        "decades": decades(annual),
        "decadesSev": decades(annual_sev),
        "decadesSeasons": {s: decades(v) for s, v in seas.items()},
        "trendVws": trend(years, list(v_ann)),
        "trendWs": trend(years, list(w_ann)),
    }
out["regions"] = regions

routes = []
f_season = {s: fmap[s] for s in SEASONS}
f_first = exc[:SPAN, iL, :, k_mod].sum((0, 1)) / steps[:SPAN].sum()
f_last = exc[-SPAN:, iL, :, k_mod].sum((0, 1)) / steps[-SPAN:].sum()
for a, b in ROUTES:
    A, B = AIRPORTS[a], AIRPORTS[b]
    la, lo, km = great_circle((A[1], A[2]), (B[1], B[2]))
    idx = [cell(x, y) for x, y in zip(la, lo, strict=True)]
    routes.append(
        {
            "key": f"{a}-{b}",
            "label": f"{A[0]} – {B[0]}",
            "km": round(km),
            "annual": r(along(fmap["annual"], idx), 5),
            "seasons": {s: r(along(f, idx), 5) for s, f in f_season.items()},
            "first": r(along(f_first, idx), 5),
            "last": r(along(f_last, idx), 5),
            "path": [[round(float(x), 2), round(float(y), 2)] for x, y in zip(la[::10], lo[::10], strict=True)]
            + [[B[1], B[2]]],
        }
    )
out["routes"] = routes
out["airports"] = {k: {"name": v[0], "lat": v[1], "lon": v[2], "city": v[3]} for k, v in AIRPORTS.items()}

# the global distribution, for the method: percentiles of TI1 at each level
pcts = {}
for li, L in enumerate(LEVELS):
    h = hist[:, li].sum((0, 1))
    c = np.cumsum(h) / h.sum()
    pcts[L] = {q: r(10 ** bins[int(np.searchsorted(c, q / 100))] * 1e7, 3) for q in (50, 90, 99, 99.9)}
out["meta"]["percentiles"] = pcts

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(
    f"{OUT.relative_to(ROOT)} : {OUT.stat().st_size // 1024} ko, {len(years)} années, seuil {THRESH[k_mod]:.1e} "
    f"({pct[k_mod] * 100:.2f} %), fort {THRESH[k_sev]:.1e} ({pct[k_sev] * 100:.3f} %), "
    f"carte max {out['meta']['mapMax']}"
)
for k, v in regions.items():
    print(
        f"  {k:10s} {v['decades']['change']:+.0%} (fort {v['decadesSev']['change']:+.0%}) t={v['trend']['t']} "
        f"cisaillement {v['trendVws']['change']:+.1%} vent {v['trendWs']['change']:+.1%}"
    )
