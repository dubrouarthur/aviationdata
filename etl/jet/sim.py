"""Flight simulator: a jet at a given Mach number through winds that change with time and altitude.

Mirrors web/src/jet/sim.js line for line (sim.test.js compares both on a fixture written by
build_jet.py). Fields are 6-hourly, at three cruise levels: u, v (m/s) and t (K), shape
[step, level, lat, lon], step k at k * 6 hours after 00 UTC of the day.

- True airspeed = Mach x speed of sound at the local temperature.
- Wind and temperature: bilinear in space, linear in time between steps, held at the ends.
- A leg is flown at the level of its arrival point, with the wind found halfway along it at the
  time the aircraft would reach that point at its nominal speed (Mach x 300 m/s).
- Fastest (or least-fuel) route: dynamic programming over the same lattice as analysis.fastest_route
  (64 stations, 61 lateral offsets 60 km apart, 2 offsets sideways per station), plus the level,
  which may change by one step between stations when it is free.
"""

from __future__ import annotations

import math

import analysis as A
import numpy as np

STEP_H = 6.0
LATTICE = {"n": 64, "spacing": 60.0, "m": 30, "reach": 2}


def sound_kmh(t):
    return np.sqrt(1.4 * 287.05 * np.asarray(t, dtype=float)) * 3.6


class Field:
    """Winds and temperature of one day on a regular grid."""

    def __init__(self, u, v, t, lat0, lon0, d):
        self.u, self.v, self.t = (np.asarray(a, dtype=float) for a in (u, v, t))
        self.lat0, self.lon0, self.d = float(lat0), float(lon0), float(d)
        self.steps, self.levels, self.ny, self.nx = self.u.shape

    def sample(self, lat, lon, hours, level):
        """u, v, t at points (arrays) for a time in hours after 00 UTC and a level index (arrays)."""
        lat, lon = np.asarray(lat, dtype=float), np.asarray(lon, dtype=float)
        fi = np.clip((lat - self.lat0) / self.d, 0, self.ny - 1.000001)
        fj = np.clip((lon - self.lon0) / self.d, 0, self.nx - 1.000001)
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int)
        di, dj = fi - i0, fj - j0
        fk = np.clip(np.asarray(hours, dtype=float) / STEP_H, 0, self.steps - 1.000001)
        k0 = np.floor(fk).astype(int)
        dk = fk - k0
        lev = np.broadcast_to(np.asarray(level, dtype=int), i0.shape)
        out = []
        for a in (self.u, self.v, self.t):

            def at(k, a=a):
                return (
                    a[k, lev, i0, j0] * (1 - di) * (1 - dj)
                    + a[k, lev, i0 + 1, j0] * di * (1 - dj)
                    + a[k, lev, i0, j0 + 1] * (1 - di) * dj
                    + a[k, lev, i0 + 1, j0 + 1] * di * dj
                )

            out.append(at(k0) * (1 - dk) + at(k0 + 1) * dk)
        return out


def leg(field, la1, lo1, la2, lo2, t0, level, mach):
    """Minutes to fly from point 1 to point 2 leaving at t0 (hours), and the wind along the track (km/h)."""
    seg = A.haversine(la1, lo1, la2, lo2)
    trk = A.bearing(la1, lo1, la2, lo2)
    nominal = mach * 300 * 3.6
    mid_t = np.asarray(t0, dtype=float) + seg / nominal / 2
    u, v, t = field.sample((la1 + la2) / 2, (lo1 + lo2) / 2, mid_t, level)
    tas = mach * sound_kmh(t)
    gs = A.ground_speed(u, v, trk, tas)
    r = np.radians(trk)
    along = (u * np.sin(r) + v * np.cos(r)) * 3.6
    return seg / gs * 60, along


def path_time(field, pts, t0, level, mach, fuel=None):
    """Fly a polyline [[lat, lon], ...] at one level: total minutes, fuel-minutes, times at each point,
    and the wind along the track on each segment."""
    pts = np.asarray(pts, dtype=float)
    t = float(t0)
    times, winds = [t], []
    burn = 0.0
    f = 1.0 if fuel is None else fuel[level]
    for i in range(len(pts) - 1):
        m, w = leg(field, pts[i, 0], pts[i, 1], pts[i + 1, 0], pts[i + 1, 1], t, level, mach)
        t += float(m) / 60
        burn += float(m) * f
        times.append(t)
        winds.append(float(w))
    return (t - t0) * 60, burn, times, winds


def best_route(field, a, b, t0, mach, level=None, fuel=None):
    """Fastest route (least fuel-minutes when fuel factors are given) from a to b leaving at t0 hours.

    level: index of a fixed level, or None to let the route change level by one step per station.
    Returns dict(minutes, burn, path=[[lat, lon, level]...], times=[hours at each station]).
    Ties go to the first move in the order (lateral -2..+2, then vertical -1..+1), as in sim.js.
    """
    n, spacing, m, reach = LATTICE["n"], LATTICE["spacing"], LATTICE["m"], LATTICE["reach"]
    lat, lon = A.lattice(a, b, n, spacing, m)
    k = 2 * m + 1
    L = field.levels
    levels = list(range(L)) if level is None else [level]
    fac = np.ones(L) if fuel is None else np.asarray(fuel, dtype=float)
    cost = np.full((k, L), np.inf)
    clock = np.full((k, L), np.nan)
    for lv in levels:
        cost[m, lv] = 0.0
        clock[m, lv] = t0
    back = np.zeros((n, k, L, 2), dtype=np.int16)
    vmoves = [-1, 0, 1] if level is None else [0]
    moves = [(dj, dl) for dj in range(-reach, reach + 1) for dl in vmoves]
    idx = np.arange(k)
    for i in range(n - 1):
        cand = np.full((len(moves), k, L), np.inf)
        cand_t = np.zeros((len(moves), k, L))
        src = np.zeros((len(moves), k, L, 2), dtype=np.int16)
        for c, (dj, dl) in enumerate(moves):
            s = idx - dj
            ok = (s >= 0) & (s < k)
            d, s = idx[ok], s[ok]
            for l2 in levels:
                l1 = l2 - dl
                if l1 not in levels:
                    continue
                c0 = cost[s, l1]
                live = np.isfinite(c0)
                if not live.any():
                    continue
                dd, ss = d[live], s[live]
                mins, _ = leg(field, lat[i, ss], lon[i, ss], lat[i + 1, dd], lon[i + 1, dd], clock[ss, l1], l2, mach)
                cand[c, dd, l2] = cost[ss, l1] + mins * fac[l2]
                cand_t[c, dd, l2] = clock[ss, l1] + mins / 60
                src[c, dd, l2] = np.stack([ss, np.full(len(ss), l1)], axis=1)
        pick = np.argmin(cand, axis=0)
        cost = np.take_along_axis(cand, pick[None], axis=0)[0]
        clock = np.take_along_axis(cand_t, pick[None], axis=0)[0]
        cost[np.abs(idx - m) > reach * (n - 2 - i), :] = np.inf
        back[i + 1] = np.take_along_axis(src, pick[None, ..., None], axis=0)[0]
    lv = int(np.argmin(cost[m]))
    j = m
    path, times = [], []
    for i in range(n - 1, -1, -1):
        path.append([float(lat[i, j]), float(lon[i, j]), lv])
        times.append(None)
        if i:
            j, lv = (int(x) for x in back[i, j, lv])
    path.reverse()
    # clock along the chosen path
    t = float(t0)
    times = [t]
    burn = 0.0
    for p, q in zip(path[:-1], path[1:], strict=True):
        mins, _ = leg(field, p[0], p[1], q[0], q[1], t, q[2], mach)
        t += float(mins) / 60
        burn += float(mins) * fac[q[2]]
        times.append(t)
    return {"minutes": (t - t0) * 60, "burn": burn, "path": path, "times": times}


def great_circle_points(a, b, n: int = 64):
    la, lo = A.great_circle(a[0], a[1], b[0], b[1], n)
    return np.stack([la, lo], axis=1)


def mach_tas(mach, t_kelvin):
    return float(mach * math.sqrt(1.4 * 287.05 * t_kelvin) * 3.6)


# ---------------------------------------------------------------- many days at once (statistics)
class StackField:
    """Several days of fields: u, v, t of shape [day, step, level, lat, lon]."""

    def __init__(self, u, v, t, lat0, lon0, d):
        self.u, self.v, self.t = (np.asarray(a, dtype=np.float32) for a in (u, v, t))
        self.lat0, self.lon0, self.d = float(lat0), float(lon0), float(d)
        self.days, self.steps, self.levels, self.ny, self.nx = self.u.shape

    def sample(self, lat, lon, hours, level):
        """Points lat, lon of shape [P]; hours of shape [day, P]; one level index. Returns [day, P] arrays."""
        fi = np.clip((np.asarray(lat, dtype=float) - self.lat0) / self.d, 0, self.ny - 1.000001)
        fj = np.clip((np.asarray(lon, dtype=float) - self.lon0) / self.d, 0, self.nx - 1.000001)
        i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int)
        di, dj = (fi - i0)[None], (fj - j0)[None]
        fk = np.clip(np.nan_to_num(np.asarray(hours, dtype=float)) / STEP_H, 0, self.steps - 1.000001)
        k0 = np.floor(fk).astype(int)
        dk = fk - k0
        day = np.arange(self.days)[:, None]
        out = []
        for a in (self.u, self.v, self.t):

            def at(k, a=a):
                return (
                    a[day, k, level, i0, j0] * (1 - di) * (1 - dj)
                    + a[day, k, level, i0 + 1, j0] * di * (1 - dj)
                    + a[day, k, level, i0, j0 + 1] * (1 - di) * dj
                    + a[day, k, level, i0 + 1, j0 + 1] * di * dj
                )

            out.append(at(k0) * (1 - dk) + at(k0 + 1) * dk)
        return out


def best_route_stack(field, a, b, t0, mach, level=None, fuel=None):
    """best_route for every day of a StackField at once: minutes [day] and the share of the route
    flown at each level [day, level]."""
    n, spacing, m, reach = LATTICE["n"], LATTICE["spacing"], LATTICE["m"], LATTICE["reach"]
    lat, lon = A.lattice(a, b, n, spacing, m)
    k, L, D = 2 * m + 1, field.levels, field.days
    levels = list(range(L)) if level is None else [level]
    fac = np.ones(L) if fuel is None else np.asarray(fuel, dtype=float)
    cost = np.full((D, k, L), np.inf)
    clock = np.full((D, k, L), float(t0))
    for lv in levels:
        cost[:, m, lv] = 0.0
    back = np.zeros((n, D, k, L, 2), dtype=np.int16)
    vmoves = [-1, 0, 1] if level is None else [0]
    moves = [(dj, dl) for dj in range(-reach, reach + 1) for dl in vmoves]
    idx = np.arange(k)
    nominal = mach * 300 * 3.6
    for i in range(n - 1):
        cand = np.full((len(moves), D, k, L), np.inf)
        cand_t = np.zeros((len(moves), D, k, L))
        src = np.zeros((len(moves), D, k, L, 2), dtype=np.int16)
        for c, (dj, dl) in enumerate(moves):
            s = idx - dj
            ok = (s >= 0) & (s < k)
            d, s = idx[ok], s[ok]
            la1, lo1, la2, lo2 = lat[i, s], lon[i, s], lat[i + 1, d], lon[i + 1, d]
            seg = A.haversine(la1, lo1, la2, lo2)
            trk = A.bearing(la1, lo1, la2, lo2)
            r = np.radians(trk)
            for l2 in levels:
                l1 = l2 - dl
                if l1 not in levels:
                    continue
                t1 = clock[:, s, l1]
                u, v, t = field.sample((la1 + la2) / 2, (lo1 + lo2) / 2, t1 + seg / nominal / 2, l2)
                uk, vk = u * 3.6, v * 3.6
                along = uk * np.sin(r) + vk * np.cos(r)
                cross = uk * np.cos(r) - vk * np.sin(r)
                tas = mach * sound_kmh(t)
                gs = along + np.sqrt(np.maximum(tas**2 - cross**2, 1.0))
                mins = seg / gs * 60
                cand[c][:, d, l2] = cost[:, s, l1] + mins * fac[l2]
                cand_t[c][:, d, l2] = t1 + mins / 60
                src[c][:, d, l2, 0] = s
                src[c][:, d, l2, 1] = l1
        pick = np.argmin(cand, axis=0)
        cost = np.take_along_axis(cand, pick[None], axis=0)[0]
        clock = np.take_along_axis(cand_t, pick[None], axis=0)[0]
        cost[:, np.abs(idx - m) > reach * (n - 2 - i), :] = np.inf
        back[i + 1] = np.take_along_axis(src, pick[None, ..., None], axis=0)[0]
    lv = np.argmin(cost[:, m, :], axis=1)
    best = np.take_along_axis(cost[:, m, :], lv[:, None], axis=1)[:, 0]
    minutes = np.take_along_axis(clock[:, m, :], lv[:, None], axis=1)[:, 0] * 60 - t0 * 60
    share = np.zeros((D, L))
    j = np.full(D, m)
    cur = lv.copy()
    days = np.arange(D)
    for i in range(n - 1, 0, -1):
        share[days, cur] += 1
        j, cur = back[i, days, j, cur, 0].astype(int), back[i, days, j, cur, 1].astype(int)
    return {"minutes": minutes, "burn": best, "share": share / (n - 1)}
