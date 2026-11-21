// @ts-check
// Figures of « Le ciel clair est-il plus agité ? »: maps of the frequency of conditions favourable to clear-air
// turbulence (a raster of 1.5° cells over the land outlines), heatmaps of months against latitudes and of
// years against months, and a diverging map of the change. The scales go from the paper of the chart (rare)
// through the map blue to the ICAO magenta (frequent): the series the story is about. Each figure offers its
// values as a table (dataTable) for those who do not read charts.
import * as d3 from "d3";
import { feature } from "topojson-client";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { asset } from "../lib/site.js";
import { MONTHS_SHORT, MONTHS_FR, bytes, flightMinutes, routeMinutes } from "./facts.js";

/** sequential: paper -> pale blue -> map blue -> night blue -> magenta */
export const SEQ = d3.interpolateRgbBasis(["#f3f5f2", "#c9dbea", "#5e93c6", "#1f5fa8", "#3b2a74", "#b5246e"]);
/** diverging: blue (fewer) -> paper -> magenta (more) */
export const DIV = d3.interpolateRgbBasis(["#1f5fa8", "#8fb3d9", "#f3f5f2", "#e39ac0", "#b5246e"]);

const pc = (v, d = 1) => `${fmtNum(v * 100, d)} %`;

let landP = null;
/** @returns {Promise<any>} */
export const loadLand = () =>
  (landP ||= fetch(asset("geo/world-110m.json"))
    .then((r) => r.json())
    .then((t) => feature(t, t.objects.land ?? t.objects.countries)));

/** A legend bar under a map: the colour ramp, a few ticks. */
function legend(node, { interp, domain, ticks, fmt, title }) {
  const W = 300;
  const s = d3
    .select(node)
    .append("svg")
    .attr("class", "t-legend")
    .attr("viewBox", `0 0 ${W} 44`)
    .attr("role", "img")
    .attr("aria-label", title);
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  const g = s.append("defs").append("linearGradient").attr("id", id);
  for (let k = 0; k <= 10; k++)
    g.append("stop")
      .attr("offset", `${k * 10}%`)
      .attr("stop-color", interp(k / 10));
  s.append("rect")
    .attr("x", 10)
    .attr("y", 4)
    .attr("width", W - 20)
    .attr("height", 12)
    .attr("fill", `url(#${id})`);
  const X = d3
    .scaleLinear()
    .domain(domain)
    .range([10, W - 10]);
  ticks.forEach((t, k) =>
    s
      .append("text")
      .attr("class", "c-tick")
      .attr("x", X(t))
      .attr("y", 34)
      .attr("text-anchor", k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle")
      .text(fmt(t)),
  );
}

/**
 * A map of a grid of values (lat0, lon0 the centre of the first cell, step, nlat x nlon, row = latitude),
 * equirectangular between 78 S and 78 N, land outlines over it. color(v) -> css colour or null (not drawn).
 * routes: [{path: [[lat, lon]], label}] drawn on top.
 */
export async function gridMap(
  node,
  { grid, color, label, routes = [], tip, compact = false, legendOpts = null },
) {
  const land = await loadLand();
  node.replaceChildren();
  node.setAttribute("aria-label", label);
  if (!node.getAttribute("role")) node.setAttribute("role", "img");
  const box = el("div", { class: "t-map" + (compact ? " compact" : "") });
  const canvas = el("canvas", { "aria-hidden": "true" });
  box.append(canvas);
  node.append(box);
  if (legendOpts) legend(node, legendOpts);
  const draw = (width) => {
    const W = Math.max(280, width);
    const H = Math.round(W * (156 / 360));
    const proj = d3
      .geoEquirectangular()
      .scale(W / (2 * Math.PI))
      .translate([W / 2, H / 2])
      .precision(0.5);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.aspectRatio = `${W} / ${H}`;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f3f5f2";
    ctx.fillRect(0, 0, W, H);
    const cw = W / (360 / grid.step);
    for (let i = 0; i < grid.nlat; i++) {
      const la = grid.lat0 + i * grid.step;
      const y = H / 2 - ((la + grid.step / 2) / 180) * (W / 2);
      for (let j = 0; j < grid.nlon; j++) {
        const c = color(grid.values[i * grid.nlon + j]);
        if (!c) continue;
        const lo = grid.lon0 + j * grid.step;
        ctx.fillStyle = c;
        ctx.fillRect(W / 2 + ((lo - grid.step / 2) / 360) * W, y, cw + 0.6, cw + 0.6);
      }
    }
    const path = d3.geoPath(proj, ctx);
    ctx.beginPath();
    path(land);
    ctx.strokeStyle = "rgba(20, 32, 46, 0.55)";
    ctx.lineWidth = compact ? 0.5 : 0.8;
    ctx.stroke();
    for (const r of routes) {
      ctx.beginPath();
      path({ type: "LineString", coordinates: r.path.map(([a, b]) => [b, a]) });
      ctx.strokeStyle = "#14202e";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (tip)
      canvas.onpointermove = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * W;
        const y = ((ev.clientY - rect.top) / rect.height) * H;
        const lo = (x / W) * 360 - 180;
        const la = ((H / 2 - y) / (W / 2)) * 180;
        const i = Math.round((la - grid.lat0) / grid.step);
        const j = Math.round((lo - grid.lon0) / grid.step);
        if (i < 0 || i >= grid.nlat || j < 0 || j >= grid.nlon) return hideTip();
        const t = tip(grid.values[i * grid.nlon + j], la, lo);
        if (t) showTip(ev, t.title, t.rows);
        else hideTip();
      };
    canvas.onpointerleave = hideTip;
  };
  onResize(box, draw);
  draw(box.clientWidth || 720);
}

/** where: "48° N, 30° O" */
export const where = (la, lo) =>
  `${fmtNum(Math.abs(Math.round(la)), 0)}° ${la >= 0 ? "N" : "S"}, ${fmtNum(Math.abs(Math.round(lo)), 0)}° ${lo >= 0 ? "E" : "O"}`;

/** The legend of the frequency maps, alone (under the four seasons). */
export function seqLegend(node, max) {
  legend(node, {
    interp: (t) => SEQ(t ** 0.75),
    domain: [0, max],
    ticks: [0, max / 4, max / 2, (3 * max) / 4, max],
    fmt: (t) => (t === max ? `${pc(t, 1)} et +` : pc(t, t === 0 ? 0 : 1)),
    title: "Échelle : part des analyses aux conditions propices",
  });
}

/** The frequency map of a season (values = frequency x scale). */
export function freqMap(node, C, key, { routes = [], compact = false, label, max }) {
  const g = { ...C.meta, values: bytes(C.maps[key]) };
  const sc = C.meta.mapScale;
  return gridMap(node, {
    grid: { lat0: g.lat0, lon0: g.lon0, step: g.step, nlat: g.nlat, nlon: g.nlon, values: g.values },
    color: (v) => SEQ(Math.min(1, v / sc / max) ** 0.75),
    label,
    routes,
    compact,
    tip: (v, la, lo) => ({
      title: where(la, lo),
      rows: [{ label: "Conditions propices", value: pc(v / sc) }],
    }),
    legendOpts: compact
      ? null
      : {
          interp: (t) => SEQ(t ** 0.75),
          domain: [0, max],
          ticks: [0, max / 4, max / 2, (3 * max) / 4, max],
          fmt: (t) => (t === max ? `${pc(t, 1)} et +` : pc(t, t === 0 ? 0 : 1)),
          title: "Échelle : part des analyses aux conditions propices",
        },
  });
}

/** The change map: last years against first years, percent (offset 128), 255 = too rare to compare. */
export function changeMap(node, C, { label }) {
  const ch = C.change;
  return gridMap(node, {
    grid: {
      lat0: ch.lat0,
      lon0: ch.lon0,
      step: ch.step,
      nlat: ch.nlat,
      nlon: ch.nlon,
      values: bytes(ch.values),
    },
    color: (v) => (v === 255 ? null : DIV(Math.max(0, Math.min(1, ((v - 128) / 100 + 1) / 2)))),
    label,
    tip: (v, la, lo) =>
      v === 255
        ? { title: where(la, lo), rows: [{ label: "Évolution", value: "conditions trop rares" }] }
        : {
            title: where(la, lo),
            rows: [{ label: "Évolution", value: `${v >= 128 ? "+" : "−"}${fmtNum(Math.abs(v - 128), 0)} %` }],
          },
    legendOpts: {
      interp: DIV,
      domain: [-100, 100],
      ticks: [-100, -50, 0, 50, 100],
      fmt: (t) => (t > 0 ? `+${t} %` : t < 0 ? `−${-t} %` : "0"),
      title: "Échelle : évolution en %",
    },
  });
}

/**
 * A heatmap: rows x columns of values, coloured by `color`, with row and column labels. Rows are drawn
 * top to bottom. cell: (r, c) -> {v, title}. Labels every `every` rows.
 */
export function heatmap(
  node,
  {
    rows,
    cols,
    value,
    color,
    label,
    rowLabel,
    colLabel,
    every = 1,
    tipFmt,
    table,
    hiRow = null,
    left = null,
    rowH = null,
    right = null,
    tipName = "Conditions propices",
    colEvery = null,
    colMark = null,
  },
) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const M = { t: 26, r: right ? (narrow ? 56 : 70) : 8, b: 8, l: left ? left(narrow) : narrow ? 52 : 64 };
    const cw = (W - M.l - M.r) / cols.length;
    const ch = rowH ? rowH(narrow) : Math.max(3, Math.min(narrow ? 10 : 14, cw * 0.9, 420 / rows.length));
    const H = M.t + ch * rows.length + M.b;
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const g = s.append("g");
    rows.forEach((r, i) =>
      cols.forEach((c, j) => {
        const v = value(i, j);
        g.append("rect")
          .attr("x", M.l + j * cw)
          .attr("y", M.t + i * ch)
          .attr("width", cw + 0.5)
          .attr("height", ch + 0.5)
          .attr("fill", v === null ? "transparent" : color(v))
          .on("pointermove", (ev) =>
            showTip(ev, `${rowLabel(r)}, ${colLabel(c, true)}`, [{ label: tipName, value: tipFmt(v) }]),
          )
          .on("pointerleave", hideTip);
      }),
    );
    if (colMark !== null)
      s.append("line")
        .attr("class", "k-mark")
        .attr("x1", M.l + colMark * cw)
        .attr("x2", M.l + colMark * cw)
        .attr("y1", M.t - 4)
        .attr("y2", M.t + ch * rows.length + 2);
    if (hiRow !== null)
      s.append("rect")
        .attr("class", "t-hi")
        .attr("x", M.l - 1)
        .attr("y", M.t + hiRow * ch - 1)
        .attr("width", cw * cols.length + 2)
        .attr("height", ch + 2);
    if (right)
      rows.forEach((r, i) => {
        const t = right(r);
        s.append("text")
          .attr("class", `c-end-v t-right${t.cls ? ` ${t.cls}` : ""}`)
          .attr("x", W - 4)
          .attr("y", M.t + (i + 0.5) * ch)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .text(t.text);
      });
    const step = colEvery ?? (narrow ? Math.ceil(cols.length / 6) : Math.ceil(cols.length / 12));
    cols.forEach((c, j) => {
      if (j % step) return;
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", M.l + (j + 0.5) * cw)
        .attr("y", M.t - 8)
        .attr("text-anchor", "middle")
        .text(colLabel(c, false));
    });
    rows.forEach((r, i) => {
      if (i % every) return;
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", M.l - 6)
        .attr("y", M.t + (i + 0.5) * ch)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(rowLabel(r));
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 720);
  if (table) dataTable(node, table);
}

/** Month x latitude: one row per latitude (north at the top), one column per month. */
export function monthLatitude(node, C, { label, max }) {
  const n = C.meta.nlat;
  const lats = d3
    .range(n)
    .map((i) => C.meta.lat0 + i * C.meta.step)
    .reverse();
  const z = C.zonal.all;
  const row = (la) => Math.round((la - C.meta.lat0) / C.meta.step);
  heatmap(node, {
    rows: lats,
    cols: d3.range(12),
    value: (i, j) => z[j][row(lats[i])],
    color: (v) => SEQ(Math.min(1, v / max) ** 0.75),
    label,
    rowLabel: (la) => (la === 0 ? "Équateur" : `${fmtNum(Math.abs(la), 0)}° ${la > 0 ? "N" : "S"}`),
    colLabel: (m, long) => (long ? MONTHS_FR[m] : MONTHS_SHORT[m]),
    every: 10,
    tipFmt: (v) => pc(v),
    table: {
      head: ["Latitude", ...MONTHS_SHORT],
      rows: lats
        .filter((la) => Math.round(la) % 15 === 0)
        .map((la) => [
          la === 0 ? "Équateur" : `${fmtNum(Math.abs(la), 0)}° ${la > 0 ? "N" : "S"}`,
          ...d3.range(12).map((m) => pc(z[m][row(la)])),
        ]),
    },
  });
}

/** Years x months over a region: the « stripes » of each winter. */
export function yearMonth(node, region, years, { label, max }) {
  heatmap(node, {
    rows: years,
    cols: d3.range(12),
    value: (i, j) => region.monthly[i][j],
    color: (v) => SEQ(Math.min(1, v / max) ** 0.75),
    label,
    rowLabel: (y) => String(y),
    colLabel: (m, long) => (long ? MONTHS_FR[m] : MONTHS_SHORT[m]),
    every: 5,
    tipFmt: (v) => pc(v),
    table: {
      head: ["Année", ...MONTHS_SHORT],
      rows: years.map((y, i) => [String(y), ...region.monthly[i].map((v) => pc(v))]),
    },
  });
}

const PLANE =
  "M0 -9 L1.8 -3 L9 1.5 L9 3.4 L1.8 1.4 L1.2 6.5 L3.8 8.4 L3.8 9.6 L0 8.4 L-3.8 9.6 L-3.8 8.4 L-1.2 6.5 L-1.8 1.4 L-9 3.4 L-9 1.5 L-1.8 -3 Z";
const ALT = { 200: 11800, 250: 10400, 300: 9200 };

/**
 * The vertical section: the three cruise levels stacked as in the sky (FL390 on top), latitude across, each
 * cell the share of the time the conditions are met around the globe at that latitude; a plane on each level.
 */
export function crossSection(node, C, key, { label, max }) {
  const S = C.section[key];
  const levels = [...C.meta.levels]; // 200 (top) .. 300
  const n = S[levels[0]].length;
  const lat = (i) => C.meta.lat0 + i * C.meta.step;
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const M = { t: 30, r: 10, b: 34, l: narrow ? 74 : 132 };
    const rh = narrow ? 52 : 70;
    const H = M.t + rh * levels.length + M.b;
    const X = d3
      .scaleLinear()
      .domain([lat(0) - 0.75, lat(n - 1) + 0.75])
      .range([M.l, W - M.r]);
    const cw = X(lat(1)) - X(lat(0));
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    // sky gradient behind, from the night of the top level to the paper of the lowest
    levels.forEach((L, k) => {
      const y = M.t + k * rh;
      S[L].forEach((v, i) =>
        s
          .append("rect")
          .attr("x", X(lat(i)) - cw / 2)
          .attr("y", y)
          .attr("width", cw + 0.6)
          .attr("height", rh - 4)
          .attr("fill", SEQ(Math.min(1, v / max) ** 0.75))
          .on("pointermove", (ev) =>
            showTip(
              ev,
              `Niveau ${C.meta.fl[L]}, ${lat(i) === 0 ? "équateur" : `${fmtNum(Math.abs(lat(i)), 1)}° ${lat(i) > 0 ? "N" : "S"}`}`,
              [{ label: "Conditions propices", value: pc(v, 1) }],
            ),
          )
          .on("pointerleave", hideTip),
      );
      // the busiest latitude of the level, north and south
      for (const north of [true, false]) {
        let b = -1;
        S[L].forEach((v, i) => {
          if (lat(i) > 0 === north && (b < 0 || v > S[L][b])) b = i;
        });
        s.append("rect")
          .attr("class", "t-hi")
          .attr("x", X(lat(b)) - cw / 2 - 1)
          .attr("y", y - 1)
          .attr("width", cw + 2)
          .attr("height", rh - 2);
      }
      const g = s.append("g").attr("transform", `translate(${narrow ? 14 : 18} ${y + (rh - 4) / 2})`);
      g.append("path").attr("d", PLANE).attr("class", "t-plane").attr("transform", "rotate(90) scale(1.25)");
      s.append("text")
        .attr("class", "t-fl")
        .attr("x", narrow ? 30 : 38)
        .attr("y", y + (rh - 4) / 2 - (narrow ? 0 : 6))
        .attr("dy", "0.32em")
        .text(`FL${C.meta.fl[L]}`);
      if (!narrow)
        s.append("text")
          .attr("class", "c-tick")
          .attr("x", 38)
          .attr("y", y + (rh - 4) / 2 + 12)
          .attr("dy", "0.32em")
          .attr("text-anchor", "start")
          .text(`${fmtNum(ALT[L], 0)} m`);
    });
    for (const t of [-60, -30, 0, 30, 60]) {
      s.append("line")
        .attr("class", "t-lat")
        .attr("x1", X(t))
        .attr("x2", X(t))
        .attr("y1", M.t - 6)
        .attr("y2", M.t + rh * levels.length);
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(t))
        .attr("y", H - 12)
        .attr("text-anchor", "middle")
        .text(t === 0 ? "équateur" : `${Math.abs(t)}° ${t > 0 ? "N" : "S"}`);
    }
    s.append("text").attr("class", "c-tick").attr("x", M.l).attr("y", 16).text("← pôle Sud");
    s.append("text")
      .attr("class", "c-tick")
      .attr("x", W - M.r)
      .attr("y", 16)
      .attr("text-anchor", "end")
      .text("pôle Nord →");
  };
  onResize(node, draw);
  draw(node.clientWidth || 720);
  dataTable(node, {
    head: ["Latitude", ...levels.map((L) => `FL${C.meta.fl[L]}`)],
    rows: d3
      .range(0, n, 10)
      .map((i) => [
        `${fmtNum(Math.abs(lat(i)), 0)}° ${lat(i) >= 0 ? "N" : "S"}`,
        ...levels.map((L) => pc(S[L][i])),
      ]),
  });
}

/**
 * The routes from Paris over the map of a season: each route coloured point by point by the frequency of the
 * cell it crosses, its share of the trip written at its end, the season's map faint below.
 */
export async function routeMap(node, C, key, { routes, airports, label, max }) {
  const land = await loadLand();
  const vals = bytes(C.maps[key]);
  const sc = C.meta.mapScale;
  const m = C.meta;
  const at = (la, lo) => {
    const i = Math.round((la - m.lat0) / m.step);
    let j = Math.round((lo - m.lon0) / m.step);
    j = ((j % m.nlon) + m.nlon) % m.nlon;
    return i < 0 || i >= m.nlat ? 0 : vals[i * m.nlon + j] / sc;
  };
  let box = node.querySelector(".t-map");
  if (!box) {
    node.replaceChildren();
    node.setAttribute("aria-label", label);
    box = el("div", { class: "t-map t-routes" }, [el("canvas", { "aria-hidden": "true" })]);
    node.append(box);
  }
  const canvas = /** @type {HTMLCanvasElement} */ (box.querySelector("canvas"));
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = Math.round(W * (narrow ? 0.78 : 0.56));
    const proj = d3.geoNaturalEarth1().rotate([-25, 0]);
    proj.fitExtent(
      [
        [6, 6],
        [W - 6, H - 6],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [-80, 60],
          [145, 60],
          [-50, -30],
          [100, -30],
          [25, 72],
        ],
      },
    );
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.aspectRatio = `${W} / ${H}`;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f3f5f2";
    ctx.fillRect(0, 0, W, H);
    const path = d3.geoPath(proj, ctx);
    // the season's frequencies, faint
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < m.nlat; i++)
      for (let j = 0; j < m.nlon; j++) {
        const v = vals[i * m.nlon + j] / sc;
        if (v < 0.004) continue;
        const la = m.lat0 + i * m.step;
        const lo = m.lon0 + j * m.step;
        const h = m.step / 2;
        ctx.beginPath();
        path({
          type: "Polygon",
          coordinates: [
            [
              [lo - h, la - h],
              [lo - h, la + h],
              [lo + h, la + h],
              [lo + h, la - h],
              [lo - h, la - h],
            ],
          ],
        });
        ctx.fillStyle = SEQ(Math.min(1, v / max) ** 0.75);
        ctx.fill();
      }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    path(land);
    ctx.strokeStyle = "rgba(20, 32, 46, 0.5)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    const placed = [];
    for (const r of routes) {
      const [a, b] = r.key.split("-").map((k) => airports[k]);
      const ip = d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
      const pts = d3.range(0, 121).map((k) => ip(k / 120));
      const xy = pts.map((q) => /** @type {[number, number]} */ (proj(q)));
      ctx.lineCap = "round";
      ctx.strokeStyle = "#14202e";
      ctx.lineWidth = narrow ? 5 : 7;
      ctx.beginPath();
      xy.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.lineWidth = narrow ? 3 : 4.5;
      for (let k = 1; k < xy.length; k++) {
        ctx.strokeStyle = SEQ(Math.min(1, at(pts[k][1], pts[k][0]) / max) ** 0.75);
        ctx.beginPath();
        ctx.moveTo(...xy[k - 1]);
        ctx.lineTo(...xy[k]);
        ctx.stroke();
      }
      const [ex, ey] = xy.at(-1);
      ctx.fillStyle = "#14202e";
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, 2 * Math.PI);
      ctx.fill();
      const txt = `${b.city} ${Math.round(routeMinutes(r, key))} min`;
      ctx.font = `700 ${narrow ? 11 : 13}px Archivo, system-ui, sans-serif`;
      const tw = ctx.measureText(txt).width;
      const lx = Math.min(W - tw - 6, Math.max(6, ex + (b.lon < a.lon ? -tw - 8 : 8)));
      // labels pushed down until they no longer overlap one already written
      let ly = ey;
      while (placed.some((q) => lx < q.x + q.w + 4 && q.x < lx + tw + 4 && Math.abs(q.y - ly) < 19)) ly += 19;
      placed.push({ x: lx, y: ly, w: tw });
      ctx.fillStyle = "rgba(243, 245, 242, 0.9)";
      ctx.fillRect(lx - 3, ly - 9, tw + 6, 18);
      ctx.fillStyle = "#14202e";
      ctx.fillText(txt, lx, ly + 4.5);
    }
    const [px, py] = /** @type {[number, number]} */ (proj([airports.CDG.lon, airports.CDG.lat]));
    ctx.fillStyle = "#b5246e";
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
    ctx.fill();
  };
  onResize(box, draw);
  draw(box.clientWidth || 720);
  dataTable(node, {
    head: ["Route", "Durée à 900 km/h", "Décembre à février", "Juin à août"],
    rows: routes.map((r) => [
      r.label,
      `${Math.round(flightMinutes(r))} min`,
      `${Math.round(routeMinutes(r, "DJF"))} min (${pc(r.seasons.DJF)})`,
      `${Math.round(routeMinutes(r, "JJA"))} min (${pc(r.seasons.JJA)})`,
    ]),
  });
}

/**
 * Stripes: one row per region, one stripe per year, coloured by the year against the region's own mean over
 * the period (blue calmer, magenta more agitated); the decade change written at the right.
 */
export function regionStripes(node, rows, years, { label, fmtChange }) {
  heatmap(node, {
    rows,
    cols: years,
    value: (i, j) => rows[i].annual[j] / rows[i].clim - 1,
    color: (v) => DIV(Math.max(0, Math.min(1, (v / 0.3 + 1) / 2))),
    label,
    rowLabel: (r) => r.short ?? r.label,
    colLabel: (y) => String(y),
    colEvery: 10,
    left: (narrow) => (narrow ? 104 : 150),
    rowH: (narrow) => (narrow ? 26 : 34),
    right: (r) => ({ text: fmtChange(r.change), cls: r.change >= 0 ? "up" : "down" }),
    tipName: "Écart à la moyenne de la région",
    tipFmt: (v) => `${v >= 0 ? "+" : "−"}${fmtNum(Math.abs(v) * 100, 0)} %`,
    table: {
      head: ["Région", ...years.filter((_, k) => k % 5 === 0).map(String), "Évolution"],
      rows: rows.map((r) => [
        r.label,
        ...years.flatMap((_, k) => (k % 5 === 0 ? [pc(r.annual[k], 2)] : [])),
        fmtChange(r.change),
      ]),
    },
  });
}

/**
 * One decade of the opening comparison: the strongest conditions over the North Atlantic, Europe and North
 * America, on the same scale for both decades (max), smoothed over the 3 x 3 neighbouring cells, the land and
 * the Paris - New York great circle over it.
 */
export async function decadeMap(node, C, key, { max, label }) {
  const land = await loadLand();
  const m = C.meta;
  const D = C.decades;
  const raw = bytes(D.sev[key]);
  // 3 x 3 smoothing (longitudes wrap): ten years of the rarest situations are still grainy at 1.5°
  const v = new Float32Array(raw.length);
  for (let i = 0; i < m.nlat; i++)
    for (let j = 0; j < m.nlon; j++) {
      let sum = 0;
      let w = 0;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const ii = i + di;
          if (ii < 0 || ii >= m.nlat) continue;
          const k = di || dj ? 1 : 2;
          sum += raw[ii * m.nlon + ((j + dj + m.nlon) % m.nlon)] * k;
          w += k;
        }
      v[i * m.nlon + j] = sum / w / D.scale;
    }
  const [L0, L1, P0, P1] = [-92, 24, 22, 72];
  node.replaceChildren();
  node.setAttribute("aria-label", label);
  const canvas = el("canvas", { "aria-hidden": "true" });
  const box = el("div", { class: "t-map" }, [canvas]);
  node.append(box);
  const draw = (width) => {
    const W = Math.max(260, width);
    const H = Math.round((W * (P1 - P0)) / (L1 - L0));
    const proj = d3
      .geoEquirectangular()
      .center([(L0 + L1) / 2, (P0 + P1) / 2])
      .scale(W / (((L1 - L0) * Math.PI) / 180))
      .translate([W / 2, H / 2]);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.aspectRatio = `${W} / ${H}`;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f3f5f2";
    ctx.fillRect(0, 0, W, H);
    const h = m.step / 2;
    for (let i = 0; i < m.nlat; i++) {
      const la = m.lat0 + i * m.step;
      if (la < P0 - 2 || la > P1 + 2) continue;
      for (let j = 0; j < m.nlon; j++) {
        const lo = m.lon0 + j * m.step;
        if (lo < L0 - 2 || lo > L1 + 2) continue;
        const [x0, y0] = /** @type {[number, number]} */ (proj([lo - h, la + h]));
        const [x1, y1] = /** @type {[number, number]} */ (proj([lo + h, la - h]));
        ctx.fillStyle = SEQ(Math.min(1, v[i * m.nlon + j] / max) ** 0.8);
        ctx.fillRect(x0, y0, x1 - x0 + 0.7, y1 - y0 + 0.7);
      }
    }
    const path = d3.geoPath(proj, ctx);
    ctx.beginPath();
    path(land);
    ctx.strokeStyle = "rgba(20, 32, 46, 0.55)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    const A = C.airports.CDG;
    const B = C.airports.JFK;
    ctx.beginPath();
    path({
      type: "LineString",
      coordinates: [
        [A.lon, A.lat],
        [B.lon, B.lat],
      ],
    });
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#14202e";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [p, name, dx] of [
      [A, "Paris", 7],
      [B, "New York", -7],
    ]) {
      const [x, y] = /** @type {[number, number]} */ (proj([p.lon, p.lat]));
      ctx.fillStyle = "#14202e";
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `700 ${W < 420 ? 11 : 13}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = dx > 0 ? "left" : "right";
      ctx.fillText(name, x + dx, y + 16);
    }
  };
  onResize(box, draw);
  draw(box.clientWidth || 600);
}

/** The scale under the two decades. */
export function decadeLegend(node, max) {
  legend(node, {
    interp: (t) => SEQ(t ** 0.8),
    domain: [0, max],
    ticks: [0, max / 2, max],
    fmt: (t) => (t === max ? `${pc(t, 1)} et +` : t ? pc(t, 1) : "0"),
    title: "Échelle : part du temps aux conditions les plus fortes",
  });
}
