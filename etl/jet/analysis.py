"""Geometry, winds and routing for the jet-stream investigation. Pure functions, unit-tested.

Conventions: latitudes and longitudes in degrees (longitudes -180..180), wind components u
(towards the east) and v (towards the north) in m/s on a regular grid, speeds in km/h,
durations in minutes.
"""

from __future__ import annotations

import math

import numpy as np

R_EARTH = 6371.0  # km
TAS = 900.0  # true airspeed of a long-haul jet in cruise, km/h (Mach 0.85 at 35,000 ft is about 905 km/h)


# ---------------------------------------------------------------- great circles
def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in km (broadcasts over numpy arrays)."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * R_EARTH * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def bearing(lat1, lon1, lat2, lon2):
    """Initial bearing from point 1 to point 2, degrees clockwise from north."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(np.asarray(lon2) - np.asarray(lon1))
    y = np.sin(dl) * np.cos(p2)
    x = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)
    return (np.degrees(np.arctan2(y, x)) + 360) % 360


def great_circle(lat1, lon1, lat2, lon2, n: int):
    """n points from 1 to 2 on the great circle (both ends included): arrays lat, lon."""
    p1, l1, p2, l2 = map(math.radians, (lat1, lon1, lat2, lon2))
    d = 2 * math.asin(
        math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin((l2 - l1) / 2) ** 2)
    )
    f = np.linspace(0, 1, n)
    a = np.sin((1 - f) * d) / math.sin(d)
    b = np.sin(f * d) / math.sin(d)
    x = a * math.cos(p1) * math.cos(l1) + b * math.cos(p2) * math.cos(l2)
    y = a * math.cos(p1) * math.sin(l1) + b * math.cos(p2) * math.sin(l2)
    z = a * math.sin(p1) + b * math.sin(p2)
    return np.degrees(np.arctan2(z, np.hypot(x, y))), np.degrees(np.arctan2(y, x))


def destination(lat, lon, brg, dist_km):
    """Point reached from (lat, lon) going dist_km on bearing brg (broadcasts)."""
    p, lam, t = np.radians(lat), np.radians(lon), np.radians(brg)
    dd = np.asarray(dist_km) / R_EARTH
    p2 = np.arcsin(np.sin(p) * np.cos(dd) + np.cos(p) * np.sin(dd) * np.cos(t))
    l2 = lam + np.arctan2(np.sin(t) * np.sin(dd) * np.cos(p), np.cos(dd) - np.sin(p) * np.sin(p2))
    return np.degrees(p2), (np.degrees(l2) + 540) % 360 - 180


# ---------------------------------------------------------------- winds
def interp(field, lats, lons, lat, lon):
    """Bilinear interpolation of field[lat, lon] (regular ascending axes) at the given points."""
    lats, lons = np.asarray(lats), np.asarray(lons)
    fi = np.clip((np.asarray(lat) - lats[0]) / (lats[1] - lats[0]), 0, len(lats) - 1.000001)
    fj = np.clip((np.asarray(lon) - lons[0]) / (lons[1] - lons[0]), 0, len(lons) - 1.000001)
    i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int)
    di, dj = fi - i0, fj - j0
    f = np.asarray(field, dtype=float)  # [..., lat, lon]: a stack of fields gives [..., points]
    return (
        f[..., i0, j0] * (1 - di) * (1 - dj)
        + f[..., i0 + 1, j0] * di * (1 - dj)
        + f[..., i0, j0 + 1] * (1 - di) * dj
        + f[..., i0 + 1, j0 + 1] * di * dj
    )


def ground_speed(u, v, track_deg, tas=TAS):
    """Ground speed (km/h) on a given track, the heading corrected for the crosswind. u, v in m/s."""
    t = np.radians(track_deg)
    uk, vk = np.asarray(u) * 3.6, np.asarray(v) * 3.6
    along = uk * np.sin(t) + vk * np.cos(t)
    cross = uk * np.cos(t) - vk * np.sin(t)
    return along + np.sqrt(np.maximum(tas**2 - cross**2, 1.0))


def route_wind(u, v, lats, lons, a, b, n: int = 60):
    """Mean wind component along the great circle from a to b (km/h, positive = tailwind).

    u and v may be stacks [time, lat, lon]: the result is then one value per time step."""
    # odd points are the exact midpoints of the segments: there the track towards the next node
    # is the reverse of the track towards the previous one, so a->b and b->a are symmetric
    la, lo = great_circle(a[0], a[1], b[0], b[1], 2 * n + 1)
    mla, mlo = la[1::2], lo[1::2]
    trk = bearing(mla, mlo, la[2::2], lo[2::2])
    seg = haversine(la[:-2:2], lo[:-2:2], la[2::2], lo[2::2])
    uu, vv = interp(u, lats, lons, mla, mlo) * 3.6, interp(v, lats, lons, mla, mlo) * 3.6
    t = np.radians(trk)
    along = uu * np.sin(t) + vv * np.cos(t)
    w = np.sum(along * seg, axis=-1) / np.sum(seg)
    return float(w) if np.ndim(w) == 0 else w


def in_box(a, b, lats, lons, n: int = 60):
    """True when the great circle a->b stays inside the wind grid."""
    la, lo = great_circle(a[0], a[1], b[0], b[1], n)
    return bool(la.min() >= lats[0] and la.max() <= lats[-1] and lo.min() >= lons[0] and lo.max() <= lons[-1])


# ---------------------------------------------------------------- minimum-time route (Zermelo, discretised)
def lattice(a, b, n: int = 64, spacing: float = 60.0, m: int = 30):
    """Candidate positions: n stations along the great circle a->b, 2m+1 lateral offsets each."""
    la, lo = great_circle(a[0], a[1], b[0], b[1], n)
    brg = bearing(la[:-1], lo[:-1], la[1:], lo[1:])
    brg = np.append(brg, brg[-1])
    offs = np.arange(-m, m + 1) * spacing
    lat = np.empty((n, 2 * m + 1))
    lon = np.empty((n, 2 * m + 1))
    for i in range(n):
        lat[i], lon[i] = destination(la[i], lo[i], brg[i] + 90, offs)
    return lat, lon


def fastest_route(u, v, lats, lons, a, b, n: int = 64, spacing: float = 60.0, m: int = 30, tas=TAS, reach: int = 2):
    """Minimum flight time from a to b through a static wind field, and the great-circle time.

    Dynamic programming over a lattice: n stations along the great circle, 2m+1 lateral offsets
    `spacing` km apart at each (1,800 km either side by default), at most `reach` offsets
    sideways from one station to the next (about 52 degrees off the great circle), no offset at
    either airport. u and v may be stacks [..., lat, lon]: every field is solved at once.
    Returns (great-circle minutes, fastest minutes, lattice index of the path at each station),
    with the batch shape of the fields; route_coords() turns the indices into points. Ties go
    to the leftmost move, as in the browser port (web/src/jet/route.js).
    """
    lat, lon = lattice(a, b, n, spacing, m)
    k = 2 * m + 1
    u, v = np.asarray(u, dtype=float), np.asarray(v, dtype=float)
    batch = u.shape[:-2]
    idx = np.arange(k)
    moves = np.arange(-reach, reach + 1)
    cost = np.full(batch + (k,), np.inf)
    cost[..., m] = 0.0
    back = np.zeros(batch + (n, k), dtype=np.int16)
    back[..., 0, :] = m
    for i in range(n - 1):
        cand = np.full(batch + (len(moves), k), np.inf)
        for c, dj in enumerate(moves):
            src = idx - dj  # arriving on offset d from offset d - dj
            ok = (src >= 0) & (src < k)
            d, s = idx[ok], src[ok]
            la1, lo1, la2, lo2 = lat[i, s], lon[i, s], lat[i + 1, d], lon[i + 1, d]
            seg = haversine(la1, lo1, la2, lo2)
            trk = bearing(la1, lo1, la2, lo2)
            mla, mlo = (la1 + la2) / 2, (lo1 + lo2) / 2
            gs = ground_speed(interp(u, lats, lons, mla, mlo), interp(v, lats, lons, mla, mlo), trk, tas)
            cand[..., c, d] = cost[..., s] + seg / gs * 60
        pick = np.argmin(cand, axis=-2)
        cost = np.take_along_axis(cand, pick[..., None, :], axis=-2)[..., 0, :]
        # the route must end on the airport: offsets farther than the stations left are forbidden
        cost[..., np.abs(idx - m) > reach * (n - 2 - i)] = np.inf
        back[..., i + 1, :] = idx - moves[pick]
    path = np.empty(batch + (n,), dtype=np.int16)
    j = np.full(batch, m, dtype=np.int16)
    path[..., n - 1] = j
    for i in range(n - 1, 0, -1):
        j = np.take_along_axis(back[..., i, :], j[..., None].astype(np.intp), axis=-1)[..., 0]
        path[..., i - 1] = j
    # great circle: the centre line of the lattice
    la, lo = lat[:, m], lon[:, m]
    seg = haversine(la[:-1], lo[:-1], la[1:], lo[1:])
    trk = bearing(la[:-1], lo[:-1], la[1:], lo[1:])
    mla, mlo = (la[:-1] + la[1:]) / 2, (lo[:-1] + lo[1:]) / 2
    gs = ground_speed(interp(u, lats, lons, mla, mlo), interp(v, lats, lons, mla, mlo), trk, tas)
    gc = np.sum(seg / gs, axis=-1) * 60
    best = cost[..., m]
    if not batch:
        return float(gc), float(best), path
    return gc, best, path


def route_coords(a, b, path, n: int = 64, spacing: float = 60.0, m: int = 30):
    """[[lat, lon], ...] of a path returned by fastest_route (one field)."""
    lat, lon = lattice(a, b, n, spacing, m)
    return [[round(float(lat[i, p]), 2), round(float(lon[i, p]), 2)] for i, p in enumerate(path)]


# ---------------------------------------------------------------- statistics
def ols(x, y):
    """Least-squares slope, intercept, slope 95 % half-width and r."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    n = len(x)
    xm, ym = x.mean(), y.mean()
    sxx = np.sum((x - xm) ** 2)
    slope = np.sum((x - xm) * (y - ym)) / sxx
    icpt = ym - slope * xm
    res = y - (icpt + slope * x)
    se = math.sqrt(np.sum(res**2) / (n - 2) / sxx) if n > 2 else float("nan")
    r = float(np.corrcoef(x, y)[0, 1]) if n > 2 else float("nan")
    return float(slope), float(icpt), 1.96 * se, r
