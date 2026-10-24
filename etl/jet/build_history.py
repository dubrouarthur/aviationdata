"""Seventy-five years of wind along New York-Paris, day by day, from the NCEP/NCAR Reanalysis 1.

Input: data/raw/reanalysis/{u,v}wnd.250.<year>.nc, 6-hourly at 250 hPa, 1948 onwards (reanalysis.py).
Called by build_jet.py; writes web/public/data/jet/history.json:
- daily: the mean wind component along the great circle New York -> Paris for each day (km/h,
  positive = tailwind towards Paris), from 1948-01-01;
- years: per year, the mean and the days above 200 km/h or with the wind reversed;
- top / reversed: the strongest days each way, one per event (days at least a week apart);
- sim_days: the strongest days covered by the ERA5 archive of the simulator (1959-2022).
"""

from __future__ import annotations

import json
from pathlib import Path

import analysis as A
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "reanalysis"
OUT = ROOT / "web" / "public" / "data" / "jet"
JFK = (40.6413, -73.7781)
CDG = (49.0097, 2.5479)
STRONG = 200  # km/h


def daily_series() -> pd.Series:
    import xarray as xr

    parts = []
    for p in sorted(RAW.glob("uwnd.250.*.nc")):
        y = p.name.split(".")[2]
        q = RAW / f"vwnd.250.{y}.nc"
        if not q.exists():
            continue
        u = xr.open_dataset(p).uwnd.isel(level=0).sortby("lat")
        v = xr.open_dataset(q).vwnd.isel(level=0).sortby("lat")
        lats, lons = u.lat.values.astype(float), u.lon.values.astype(float) - 360
        w = A.route_wind(u.values, v.values, lats, lons, JFK, CDG)
        parts.append(pd.Series(w, index=pd.to_datetime(u.time.values)))
    s = pd.concat(parts).sort_index()
    s = s[~s.index.duplicated()]
    return s.resample("D").mean().dropna()


def value(v):
    return None if v is None or np.isnan(v) else int(round(float(v)))


def events(s: pd.Series, n: int, largest=True, gap_days=7):
    """The n most extreme days, one per event (at least gap_days apart)."""
    picked = []
    for t, v in (s.sort_values(ascending=not largest)).items():
        if all(abs((t - p).days) >= gap_days for p, _ in picked):
            picked.append((t, v))
        if len(picked) == n:
            break
    return [[t.strftime("%Y-%m-%d"), round(float(v))] for t, v in picked]


def build(storms):
    d = daily_series()
    first, last = d.index[0], d.index[-1]
    full = d.reindex(pd.date_range(first, last, freq="D"))
    years = []
    for y, s in d.groupby(d.index.year):
        if len(s) < 300:
            continue
        years.append(
            {
                "y": int(y),
                "mean": round(float(s.mean()), 1),
                "strong": int((s >= STRONG).sum()),
                "reversed": int((s < 0).sum()),
            }
        )
    yr = pd.DataFrame(years).set_index("y")
    sat = yr.loc[1979:]
    slope, _, ci, _ = A.ols(sat.index, sat.strong)
    top = events(d, 10)
    rev = events(d, 5, largest=False)
    era5 = d.loc["1959-01-01":"2022-12-31"]
    sim_days = [t for t, _ in events(era5, 3)] + [t for t, _ in events(era5, 1, largest=False)]
    out = {
        "start": first.strftime("%Y-%m-%d"),
        "end": last.strftime("%Y-%m-%d"),
        "daily": [None if np.isnan(v) else int(round(v)) for v in full.values],
        "years": years,
        "strong": STRONG,
        "strong_trend79": {"slope": round(float(slope) * 10, 2), "ci": round(float(ci) * 10, 2)},
        "top": top,
        "reversed": rev,
        "storms": [[day, title, value(d.get(pd.Timestamp(day), np.nan))] for day, title, _ in storms],
        "sim_days": sim_days,
        "share_strong": round(float(100 * (d >= STRONG).mean()), 2),
        "share_reversed": round(float(100 * (d < 0).mean()), 2),
    }
    (OUT / "history.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"  history.json: {(OUT / 'history.json').stat().st_size // 1024} KB, {len(d)} days")
    return out
