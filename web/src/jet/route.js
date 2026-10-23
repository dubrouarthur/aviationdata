// Great circles, winds and the minimum-time route, ported line for line from etl/jet/analysis.py
// so the explorer can solve any day in the browser. route.test.js checks both give the same
// numbers on a stored field (route.fixture.json is written by etl/jet/build_jet.py).

export const R_EARTH = 6371.0; // km
export const TAS = 900.0; // true airspeed in cruise, km/h
export const LATTICE = { n: 64, spacing: 60, m: 30, reach: 2 };

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversine(lat1, lon1, lat2, lon2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dp = p2 - p1;
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function bearing(lat1, lon1, lat2, lon2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (((deg(Math.atan2(y, x)) + 360) % 360) + 360) % 360;
}

/** n points from a to b on the great circle, both ends included: [[lat, lon], ...]. */
export function greatCircle([lat1, lon1], [lat2, lon2], n) {
  const [p1, l1, p2, l2] = [lat1, lon1, lat2, lon2].map(rad);
  const d =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2),
    );
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1);
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    out.push([deg(Math.atan2(z, Math.hypot(x, y))), deg(Math.atan2(y, x))]);
  }
  return out;
}

export function destination(lat, lon, brg, dist) {
  const p = rad(lat);
  const lam = rad(lon);
  const t = rad(brg);
  const dd = dist / R_EARTH;
  const p2 = Math.asin(Math.sin(p) * Math.cos(dd) + Math.cos(p) * Math.sin(dd) * Math.cos(t));
  const l2 =
    lam + Math.atan2(Math.sin(t) * Math.sin(dd) * Math.cos(p), Math.cos(dd) - Math.sin(p) * Math.sin(p2));
  return [deg(p2), ((((deg(l2) + 540) % 360) + 360) % 360) - 180];
}

/** Bilinear wind at (lat, lon) on a field {lat0, lon0, d, nx, ny, u, v}, clamped to the grid (m/s). */
export function windAt(f, lat, lon) {
  const fi = Math.min(Math.max((lat - f.lat0) / f.d, 0), f.ny - 1.000001);
  const fj = Math.min(Math.max((lon - f.lon0) / f.d, 0), f.nx - 1.000001);
  const i0 = Math.floor(fi);
  const j0 = Math.floor(fj);
  const di = fi - i0;
  const dj = fj - j0;
  const k = i0 * f.nx + j0;
  const mix = (a) =>
    a[k] * (1 - di) * (1 - dj) +
    a[k + f.nx] * di * (1 - dj) +
    a[k + 1] * (1 - di) * dj +
    a[k + f.nx + 1] * di * dj;
  return [mix(f.u), mix(f.v)];
}

/** Ground speed (km/h) on a track, the heading corrected for the crosswind; u, v in m/s. */
export function groundSpeed(u, v, track, tas = TAS) {
  const t = rad(track);
  const uk = u * 3.6;
  const vk = v * 3.6;
  const along = uk * Math.sin(t) + vk * Math.cos(t);
  const cross = uk * Math.cos(t) - vk * Math.sin(t);
  return along + Math.sqrt(Math.max(tas * tas - cross * cross, 1.0));
}

function legMinutes(f, la1, lo1, la2, lo2, tas) {
  const seg = haversine(la1, lo1, la2, lo2);
  const trk = bearing(la1, lo1, la2, lo2);
  const [u, v] = windAt(f, (la1 + la2) / 2, (lo1 + lo2) / 2);
  return (seg / groundSpeed(u, v, trk, tas)) * 60;
}

export function lattice(a, b, { n, spacing, m } = LATTICE) {
  const gc = greatCircle(a, b, n);
  const k = 2 * m + 1;
  const lat = new Float64Array(n * k);
  const lon = new Float64Array(n * k);
  for (let i = 0; i < n; i++) {
    const j = Math.min(i, n - 2);
    const brg = bearing(gc[j][0], gc[j][1], gc[j + 1][0], gc[j + 1][1]);
    for (let o = 0; o < k; o++) {
      const [la, lo] = destination(gc[i][0], gc[i][1], brg + 90, (o - m) * spacing);
      lat[i * k + o] = la;
      lon[i * k + o] = lo;
    }
  }
  return { lat, lon, k };
}

/**
 * Minimum-time route from a to b through a static wind field f, and the great-circle time.
 * Returns { gc, best (minutes), path: [[lat, lon], ...] }.
 */
export function fastestRoute(f, a, b, opts = {}) {
  const { n, spacing, m, reach } = { ...LATTICE, ...opts };
  const tas = opts.tas ?? TAS;
  const { lat, lon, k } = lattice(a, b, { n, spacing, m });
  let cost = new Float64Array(k).fill(Infinity);
  cost[m] = 0;
  const back = new Int16Array(n * k).fill(m);
  for (let i = 0; i < n - 1; i++) {
    const next = new Float64Array(k).fill(Infinity);
    const limit = reach * (n - 2 - i);
    for (let d = 0; d < k; d++) {
      let best = Infinity;
      let from = d;
      for (let dj = -reach; dj <= reach; dj++) {
        const s = d - dj;
        if (s < 0 || s >= k) continue;
        const c =
          cost[s] +
          legMinutes(f, lat[i * k + s], lon[i * k + s], lat[(i + 1) * k + d], lon[(i + 1) * k + d], tas);
        if (c < best) {
          best = c;
          from = s;
        }
      }
      next[d] = Math.abs(d - m) > limit ? Infinity : best;
      back[(i + 1) * k + d] = from;
    }
    cost = next;
  }
  const idx = new Array(n);
  let j = m;
  idx[n - 1] = j;
  for (let i = n - 1; i > 0; i--) {
    j = back[i * k + j];
    idx[i - 1] = j;
  }
  let gc = 0;
  for (let i = 0; i < n - 1; i++)
    gc += legMinutes(f, lat[i * k + m], lon[i * k + m], lat[(i + 1) * k + m], lon[(i + 1) * k + m], tas);
  return {
    gc,
    best: cost[m],
    index: idx,
    path: idx.map((o, i) => [lat[i * k + o], lon[i * k + o]]),
    line: Array.from({ length: n }, (_, i) => [lat[i * k + m], lon[i * k + m]]),
  };
}

/** Mean wind along the great circle a -> b, km/h, positive = tailwind (as route_wind in Python). */
export function routeWind(f, a, b, n = 60) {
  const pts = greatCircle(a, b, 2 * n + 1);
  let sum = 0;
  let len = 0;
  for (let s = 0; s < n; s++) {
    const [la0, lo0] = pts[2 * s];
    const [lam, lom] = pts[2 * s + 1];
    const [la1, lo1] = pts[2 * s + 2];
    const seg = haversine(la0, lo0, la1, lo1);
    const t = rad(bearing(lam, lom, la1, lo1));
    const [u, v] = windAt(f, lam, lom);
    sum += (u * 3.6 * Math.sin(t) + v * 3.6 * Math.cos(t)) * seg;
    len += seg;
  }
  return sum / len;
}
