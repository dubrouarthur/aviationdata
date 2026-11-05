// Airliners seen from above, drawn to scale from their length and wingspan (avions/dims.json: FAA,
// Aircraft Characteristics Database). An original, schematic drawing: the fuselage, swept or straight
// wings, the tailplane, the engines where they hang (under the wings, on the rear fuselage, one in the
// tail) and, on turboprops, the propellers. Only length and span are measured: the width of the
// fuselage, the chords and the nacelles follow the size class (`kind`), and the page says so.
//
// Coordinates in metres: the tail at x = 0, the nose at x = len, the wings along y (span centred on 0).

const rad = (deg) => (deg * Math.PI) / 180;
const f = (v) => +v.toFixed(2);
const poly = (pts) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z`;

/** A rounded rectangle along x: from x0 (rear) to x1 (front), centred on y, d wide. */
function pod(x0, x1, y, d) {
  const r = d / 2;
  return `M${f(x0)},${f(y - r)}L${f(x1 - r)},${f(y - r)}A${f(r)},${f(r)} 0 0 1 ${f(x1 - r)},${f(y + r)}L${f(x0)},${f(y + r)}Z`;
}

/** The parts of one drawing: [{d, cls}] in metres, with the drawing's length and span. */
export function planeParts(dims, kind = "narrow") {
  const { len: L, span: S, eng, prop, mount } = dims;
  const b = S / 2;
  const wide = kind === "wide";
  const regional = kind === "regional";
  // fuselage width by size class (not measured)
  const w = prop ? 2.7 : wide ? (L > 68 && eng === 4 ? 7 : 5.9) : regional ? 2.9 : 3.8;
  const parts = [];
  // fuselage: a tapering tail cone, a cylinder, a rounded nose
  const n0 = L - 1.5 * w;
  parts.push({
    cls: "body",
    d:
      `M0,${f(-0.13 * w)}L${f(0.22 * L)},${f(-w / 2)}L${f(n0)},${f(-w / 2)}` +
      `C${f(L - 0.45 * w)},${f(-w / 2)} ${f(L)},${f(-0.3 * w)} ${f(L)},0` +
      `C${f(L)},${f(0.3 * w)} ${f(L - 0.45 * w)},${f(w / 2)} ${f(n0)},${f(w / 2)}` +
      `L${f(0.22 * L)},${f(w / 2)}L0,${f(0.13 * w)}Z`,
  });
  // wings: root chord, tip chord, sweep of the leading edge
  const sweep = prop ? 3 : mount === "tri" ? 35 : wide ? 32 : regional ? 25 : 27;
  const c0 = prop ? 0.095 * S : 0.17 * S;
  const ct = prop ? 0.055 * S : 0.048 * S;
  const xw = (prop ? 0.6 : mount === "rear" ? 0.55 : 0.6) * L; // root leading edge, from the tail
  const back = (y) => (y - w / 2) * Math.tan(rad(sweep));
  const le = (y) => xw - back(y);
  for (const s of [-1, 1])
    parts.push({
      cls: "body",
      d: poly([
        [xw, (s * w) / 2],
        [le(b), s * b],
        [le(b) - ct, s * b],
        [xw - c0, (s * w) / 2],
      ]),
    });
  // tailplane: a T-tail on rear-engined jets and turboprops sits further aft
  const t = mount === "rear" || prop;
  const ts = (prop ? 0.29 : t ? 0.34 : 0.36) * S;
  const t0 = (t ? 0.075 : 0.09) * L;
  const tt = 0.4 * t0;
  const tsw = prop ? 10 : 33;
  const tx = (t ? 0.11 : 0.19) * L;
  for (const s of [-1, 1])
    parts.push({
      cls: "body",
      d: poly([
        [tx, 0],
        [tx - (ts / 2) * Math.tan(rad(tsw)), (s * ts) / 2],
        [tx - (ts / 2) * Math.tan(rad(tsw)) - tt, (s * ts) / 2],
        [tx - t0 - 0.3 * t0, 0],
      ]),
    });
  // engines
  const dn = prop ? 1.3 : wide ? (eng === 4 ? 3 : 3.5) : regional ? 1.6 : 2.2;
  if (prop) {
    const ln = 0.2 * L;
    const pd = 0.145 * S;
    for (const s of [-1, 1]) {
      const y = s * 0.3 * b;
      const x1 = le(Math.abs(y)) + 0.3 * ln;
      parts.push({ cls: "body", d: pod(x1 - ln, x1, y, dn) });
      parts.push({ cls: "prop", d: pod(x1 + 0.15, x1 + 0.6, y, pd) });
    }
  } else if (mount === "rear") {
    const ln = 2.5 * dn;
    for (const s of [-1, 1])
      parts.push({ cls: "body", d: pod(0.17 * L, 0.17 * L + ln, s * (w / 2 + dn / 2 + 0.35), dn) });
  } else {
    const stations = eng === 4 ? [0.36, 0.64] : [0.33];
    const ln = 2 * dn;
    for (const k of stations)
      for (const s of [-1, 1]) {
        const y = k * b;
        const x1 = le(y) + 0.6 * ln;
        parts.push({ cls: "body", d: pod(x1 - ln, x1, s * y, dn) });
      }
    if (mount === "tri") parts.push({ cls: "body", d: pod(0.01 * L, 0.01 * L + 2 * dn, 0, dn * 0.9) });
  }
  return { parts, len: L, span: S };
}

const NS = "http://www.w3.org/2000/svg";

/**
 * One drawing as an <svg>, `scale` pixels a metre (to scale with every other drawing at the same scale).
 * nose: "right" (default) or "up". The drawing is decorative unless `title` is given.
 */
export function planeSvg(
  dims,
  { kind = "narrow", scale = 2, nose = "right", color = "currentColor", title, cls = "" } = {},
) {
  const { parts, len, span } = planeParts(dims, kind);
  const up = nose === "up";
  const svg = document.createElementNS(NS, "svg");
  const [vw, vh] = up ? [span, len] : [len, span];
  svg.setAttribute("viewBox", up ? `${-span / 2} 0 ${span} ${len}` : `0 ${-span / 2} ${len} ${span}`);
  svg.setAttribute("width", f(vw * scale));
  svg.setAttribute("height", f(vh * scale));
  svg.setAttribute("class", `av-plane ${cls}`.trim());
  svg.style.setProperty("--pc", color);
  if (title) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", title);
  } else svg.setAttribute("aria-hidden", "true");
  const g = document.createElementNS(NS, "g");
  // nose up: rotate so that x (tail → nose) runs bottom → top
  if (up) g.setAttribute("transform", `translate(0 ${len}) rotate(-90)`);
  for (const p of parts) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("class", `av-pl-${p.cls}`);
    g.append(path);
  }
  svg.append(g);
  return svg;
}

/** The same drawing as a group for a d3 chart: centred on (0, 0), nose right, `scale` px a metre. */
export function planeGroup(sel, dims, { kind = "narrow", scale = 1 } = {}) {
  const { parts, len } = planeParts(dims, kind);
  const g = sel.append("g").attr("class", "av-plane-g");
  const inner = g.append("g").attr("transform", `scale(${scale}) translate(${-len / 2} 0)`);
  for (const p of parts) inner.append("path").attr("d", p.d).attr("class", `av-pl-${p.cls}`);
  return g;
}

/** The model that stands for each group in icons (the most flown of the group). */
export const GROUP_ICON = { a320: "A320", b737: "B738", regional: "E75L", wide: "B77W", other: "B752" };

// the sizes of avions/dims.json and the size class of each type, set once the data are loaded
let DIMS = {};
let KIND = {};
export function setFleet(dims, kinds) {
  DIMS = dims?.types ?? {};
  KIND = kinds;
}
export const dimsOf = (code) => DIMS[code];

/** A model's drawing (null when its size is not known), to scale at `scale` px a metre. */
export function plane(code, opts = {}) {
  const d = DIMS[code];
  return d ? planeSvg(d, { kind: KIND[code], ...opts }) : null;
}

/** A model's drawing fitted in a box of `box` px (not to scale: an icon). */
export function planeIcon(code, box, opts = {}) {
  const d = DIMS[code];
  if (!d) return null;
  return planeSvg(d, { kind: KIND[code], scale: box / Math.max(d.len, d.span), ...opts });
}

/** A model's icon as a group inside a chart's <svg>: centred on (0, 0), fitted in `box` px, nose right. */
export function planeInG(parent, code, box, color) {
  const d = DIMS[code];
  if (!d) return null;
  const { parts, len } = planeParts(d, KIND[code]);
  const k = box / Math.max(d.len, d.span);
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "av-plane");
  g.style.setProperty("--pc", color);
  const inner = document.createElementNS(NS, "g");
  inner.setAttribute("transform", `scale(${f(k)}) translate(${f(-len / 2)} 0)`);
  for (const p of parts) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("class", `av-pl-${p.cls}`);
    inner.append(path);
  }
  g.append(inner);
  parent.append(g);
  return g;
}
