// Flight simulator: a jet at a given Mach number through winds that change with time and altitude.
// Port of etl/jet/sim.py, line for line; sim.test.js compares both on a fixture written by
// build_jet.py. A day holds 6-hourly fields at three cruise levels: u, v (m/s), t (K).
import { bearing, destination, greatCircle, groundSpeed, haversine, LATTICE } from "./route.js";

const STEP_H = 6;
const rad = (d) => (d * Math.PI) / 180;
export const soundKmh = (t) => Math.sqrt(1.4 * 287.05 * t) * 3.6;

/**
 * One day of a sim/<day>.bin file: int8 [step][level][u, v, t - tOffset][lat][lon].
 * Returns { steps, levels, nx, ny, lat0, lon0, d, u, v, t } with Float64Array data.
 */
export function decodeSimDay(bytes, grid) {
  const { nx, ny, steps, levels, tOffset } = grid;
  const size = nx * ny;
  const n = steps * levels * size;
  const u = new Float64Array(n);
  const v = new Float64Array(n);
  const t = new Float64Array(n);
  for (let s = 0; s < steps; s++)
    for (let l = 0; l < levels; l++) {
      const src = (s * levels + l) * 3 * size;
      const dst = (s * levels + l) * size;
      for (let i = 0; i < size; i++) {
        u[dst + i] = bytes[src + i];
        v[dst + i] = bytes[src + size + i];
        t[dst + i] = bytes[src + 2 * size + i] + tOffset;
      }
    }
  return { ...grid, u, v, t };
}

/** u, v, t at one point, hours after 00 UTC, level index. */
export function sample(f, lat, lon, hours, level) {
  const fi = Math.min(Math.max((lat - f.lat0) / f.d, 0), f.ny - 1.000001);
  const fj = Math.min(Math.max((lon - f.lon0) / f.d, 0), f.nx - 1.000001);
  const i0 = Math.floor(fi);
  const j0 = Math.floor(fj);
  const di = fi - i0;
  const dj = fj - j0;
  const fk = Math.min(Math.max(hours / STEP_H, 0), f.steps - 1.000001);
  const k0 = Math.floor(fk);
  const dk = fk - k0;
  const size = f.nx * f.ny;
  const at = (a, k) => {
    const o = (k * f.levels + level) * size + i0 * f.nx + j0;
    return (
      a[o] * (1 - di) * (1 - dj) +
      a[o + f.nx] * di * (1 - dj) +
      a[o + 1] * (1 - di) * dj +
      a[o + f.nx + 1] * di * dj
    );
  };
  return [f.u, f.v, f.t].map((a) => at(a, k0) * (1 - dk) + at(a, k0 + 1) * dk);
}

/** Minutes from point 1 to point 2 leaving at t0 hours, at a level, and the wind along the track (km/h). */
export function leg(f, la1, lo1, la2, lo2, t0, level, mach) {
  const seg = haversine(la1, lo1, la2, lo2);
  const trk = bearing(la1, lo1, la2, lo2);
  const nominal = mach * 300 * 3.6;
  const [u, v, t] = sample(f, (la1 + la2) / 2, (lo1 + lo2) / 2, t0 + seg / nominal / 2, level);
  const gs = groundSpeed(u, v, trk, mach * soundKmh(t));
  const r = rad(trk);
  return [(seg / gs) * 60, (u * Math.sin(r) + v * Math.cos(r)) * 3.6];
}

/** Fly a polyline [[lat, lon], ...] at one level: minutes, fuel-minutes, hours at each point, wind on each segment. */
export function pathTime(f, pts, t0, level, mach, fuel = null) {
  let t = t0;
  const times = [t];
  const winds = [];
  let burn = 0;
  const fac = fuel ? fuel[level] : 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [m, w] = leg(f, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t, level, mach);
    t += m / 60;
    burn += m * fac;
    times.push(t);
    winds.push(w);
  }
  return { minutes: (t - t0) * 60, burn, times, winds };
}

const lattices = new Map();
function latticeOf(a, b) {
  const key = `${a}|${b}`;
  if (lattices.has(key)) return lattices.get(key);
  const { n, spacing, m } = LATTICE;
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
  const out = { lat, lon, k };
  lattices.set(key, out);
  return out;
}

/**
 * Fastest route (least fuel-minutes when fuel factors are given) from a to b leaving at t0 hours.
 * level: fixed level index, or null to let the route change level by one step per station.
 * Returns { minutes, burn, path: [[lat, lon, level]...], times: [hours at each station] }.
 */
export function bestRoute(f, a, b, t0, mach, level = null, fuel = null) {
  const { n, m, reach } = LATTICE;
  const { lat, lon, k } = latticeOf(a, b);
  const L = f.levels;
  const levels = level === null ? [...Array(L).keys()] : [level];
  const fac = fuel ?? new Array(L).fill(1);
  let cost = new Float64Array(k * L).fill(Infinity);
  let clock = new Float64Array(k * L).fill(NaN);
  for (const lv of levels) {
    cost[m * L + lv] = 0;
    clock[m * L + lv] = t0;
  }
  const back = new Int16Array(n * k * L * 2);
  const vmoves = level === null ? [-1, 0, 1] : [0];
  for (let i = 0; i < n - 1; i++) {
    const next = new Float64Array(k * L).fill(Infinity);
    const nclock = new Float64Array(k * L).fill(NaN);
    const limit = reach * (n - 2 - i);
    for (let d = 0; d < k; d++) {
      for (const l2 of levels) {
        let best = Infinity;
        let bt = NaN;
        let bs = 0;
        let bl = l2;
        for (let dj = -reach; dj <= reach; dj++) {
          const s = d - dj;
          if (s < 0 || s >= k) continue;
          for (const dl of vmoves) {
            const l1 = l2 - dl;
            if (!levels.includes(l1)) continue;
            const c0 = cost[s * L + l1];
            if (!Number.isFinite(c0)) continue;
            const t1 = clock[s * L + l1];
            const [mins] = leg(
              f,
              lat[i * k + s],
              lon[i * k + s],
              lat[(i + 1) * k + d],
              lon[(i + 1) * k + d],
              t1,
              l2,
              mach,
            );
            const c = c0 + mins * fac[l2];
            if (c < best) {
              best = c;
              bt = t1 + mins / 60;
              bs = s;
              bl = l1;
            }
          }
        }
        const o = d * L + l2;
        next[o] = Math.abs(d - m) > limit ? Infinity : best;
        nclock[o] = bt;
        back[((i + 1) * k * L + o) * 2] = bs;
        back[((i + 1) * k * L + o) * 2 + 1] = bl;
      }
    }
    cost = next;
    clock = nclock;
  }
  let lv = levels[0];
  for (const l of levels) if (cost[m * L + l] < cost[m * L + lv]) lv = l;
  let j = m;
  const path = [];
  for (let i = n - 1; i >= 0; i--) {
    path.push([lat[i * k + j], lon[i * k + j], lv]);
    if (i) {
      const o = (i * k * L + j * L + lv) * 2;
      [j, lv] = [back[o], back[o + 1]];
    }
  }
  path.reverse();
  let t = t0;
  const times = [t];
  let burn = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [p, q] = [path[i], path[i + 1]];
    const [mins] = leg(f, p[0], p[1], q[0], q[1], t, q[2], mach);
    t += mins / 60;
    burn += mins * fac[q[2]];
    times.push(t);
  }
  return { minutes: (t - t0) * 60, burn, path, times };
}
