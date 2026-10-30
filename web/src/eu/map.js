// The maps of the fourth investigation: Europe with its airports and the centre of gravity of their
// passengers (opening), the countries against 2019 (choropleth), and the path of the centre of gravity.
// Projection: Lambert azimuthal equal-area centred on 52° N, 10° E, as Eurostat's own maps (ETRS89-LAEA).
import * as d3 from "d3";
import { el, showTip, hideTip, onResize, reducedMotion } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { mio, pct } from "./charts.js";

const projectionFor = (w, h, frame) =>
  d3
    .geoAzimuthalEqualArea()
    .rotate([-10, -52])
    .fitExtent(
      [
        [4, 4],
        [w - 4, h - 4],
      ],
      frame,
    );

// the area a map must show, as points along its edges (a polygon's winding would decide which side is "in")
const box = (w, s, e, n) => ({
  type: "MultiPoint",
  coordinates: d3.range(0, 1.0001, 0.125).flatMap((t) => [
    [w + (e - w) * t, s],
    [w + (e - w) * t, n],
    [w, s + (n - s) * t],
    [e, s + (n - s) * t],
  ]),
});

function svgFor(node, height) {
  const width = node.clientWidth || 700;
  const svg = d3
    .select(node)
    .selectAll("svg")
    .data([0])
    .join("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();
  return { svg, width };
}

/** The airports' change on 2019 as a colour: amber above, blue below, grey without 2019. */
const changeColor = (ch) =>
  ch == null ? "var(--map-neutral)" : ch >= 0 ? "var(--south-hi)" : "var(--north-hi)";

/**
 * The opening: every airport drawn, sized by its passengers of the year, coloured by its change on 2019
 * once 2019 is past; the centre of gravity of the passengers, year after year, in white.
 */
export function openMap(node, data, geo, controls) {
  const codes = new Set(data.zones.map((z) => z.iso).filter(Boolean));
  const years = data.airportYears;
  const i19 = years.indexOf(2019);
  let year = years.at(-1);
  let paint = () => {};

  const draw = () => {
    const width = node.clientWidth || 700;
    const height = Math.round(Math.min(760, Math.max(380, width * 0.92)));
    const { svg } = svgFor(node, height);
    const proj = projectionFor(width, height, box(-24, 30, 34, 70.5));
    const path = d3.geoPath(proj);
    svg
      .append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("class", (f) => (codes.has(+f.id) ? "land in" : "land"));
    const r = d3
      .scaleSqrt()
      .domain([0, d3.max(data.airports, (a) => d3.max(a.pax))])
      .range([0, Math.max(14, width / 34)]);
    const dots = svg.append("g").attr("class", "apt-dots");
    const trail = svg.append("g").attr("class", "bary");
    const B = data.barycentre;

    paint = () => {
      const i = years.indexOf(year);
      const shown = data.airports
        .filter((a) => a.pax[i] && a.box)
        .sort((a, b) => b.pax[i] - a.pax[i])
        .map((a) => ({
          a,
          v: a.pax[i],
          ch: i > i19 && a.pax[i19] ? 100 * (a.pax[i] / a.pax[i19] - 1) : null,
        }));
      dots
        .selectAll("circle")
        .data(shown, (d) => d.a.code)
        .join("circle")
        .attr("cx", (d) => proj([d.a.lon, d.a.lat])[0])
        .attr("cy", (d) => proj([d.a.lon, d.a.lat])[1])
        .attr("r", (d) => r(d.v))
        .attr("fill", (d) => (i > i19 ? changeColor(d.ch) : "var(--map-neutral)"))
        .on("pointermove", (ev, d) =>
          showTip(ev, d.a.name, [
            { label: `passagers en ${year}`, value: mio(d.v) },
            ...(d.ch != null ? [{ label: "par rapport à 2019", value: pct(d.ch) }] : []),
          ]),
        )
        .on("pointerleave", hideTip);
      const upto = B.filter((b) => b.y <= year);
      const pts = upto.map((b) => proj([b.lon, b.lat]));
      trail.selectAll("*").remove();
      trail.append("path").attr("class", "bary-line").attr("d", d3.line()(pts));
      const now = pts.at(-1);
      trail.append("circle").attr("class", "bary-ring").attr("cx", now[0]).attr("cy", now[1]).attr("r", 9);
      trail.append("circle").attr("class", "bary-dot").attr("cx", now[0]).attr("cy", now[1]).attr("r", 3.5);
      trail
        .append("text")
        .attr("class", "bary-lab")
        .attr("x", now[0] + 14)
        .attr("y", now[1] + 4)
        .text("centre de gravité");
      controls?.onYear?.(year);
    };
    paint();
  };
  draw();
  onResize(node, draw);
  return {
    set(y) {
      year = y;
      paint();
    },
    years,
  };
}

/** Year slider and play button for the opening map; the map plays once on screen. */
export function yearControls(box, data, map, readout) {
  const years = map.years;
  const input = el("input", {
    type: "range",
    min: years[0],
    max: years.at(-1),
    step: 1,
    value: years.at(-1),
    "aria-label": "Année affichée sur la carte",
  });
  const out = el("output", { class: "ey-year" });
  const play = el("button", { type: "button", class: "ey-play", "aria-label": "Faire défiler les années" });
  play.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l9-5z" fill="currentColor"/></svg>';
  const set = (y) => {
    input.value = y;
    out.textContent = y;
    map.set(y);
    readout(y);
  };
  input.addEventListener("input", () => set(+input.value));
  let timer = 0;
  const run = () => {
    clearInterval(timer);
    let y = years[0];
    set(y);
    timer = setInterval(() => {
      y += 1;
      if (y > years.at(-1)) return clearInterval(timer);
      set(y);
    }, 520);
  };
  play.addEventListener("click", run);
  box.replaceChildren(
    el("div", { class: "ey-row" }, [play, input, out]),
    el("p", { class: "ey-read", id: "ey-read" }),
  );
  set(years.at(-1));
  if (!reducedMotion()) {
    let done = false;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done) {
        done = true;
        setTimeout(run, 600);
      }
    }).observe(box);
  }
}

/** Each country coloured by its change on 2019; a click opens it in the dashboard. */
export function choropleth(node, geo, rows, { onPick } = {}) {
  const by = new Map(rows.map((r) => [r.iso, r]));
  const ext = 40;
  const color = d3
    .scaleDiverging()
    .domain([-ext, 0, ext])
    .interpolator((t) =>
      t < 0.5
        ? d3.interpolateRgb("#2a78d6", "#eef2f0")(t * 2)
        : d3.interpolateRgb("#eef2f0", "#b8660b")((t - 0.5) * 2),
    )
    .clamp(true);
  const draw = () => {
    const width = node.clientWidth || 600;
    const height = Math.round(Math.min(620, width * 0.95));
    const { svg } = svgFor(node, height + 40);
    const proj = projectionFor(width, height, box(-24, 34, 34, 70.5));
    const path = d3.geoPath(proj);
    svg
      .append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("class", (f) => (by.has(+f.id) ? "cty in" : "cty"))
      .style("fill", (f) => (by.has(+f.id) ? color(by.get(+f.id).change) : null))
      .style("cursor", (f) => (by.has(+f.id) && onPick ? "pointer" : null))
      .on("pointermove", (ev, f) => {
        const r = by.get(+f.id);
        if (r) showTip(ev, r.name, [{ label: "par rapport à 2019", value: pct(r.change, 1) }]);
      })
      .on("pointerleave", hideTip)
      .on("click", (_, f) => by.has(+f.id) && onPick?.(by.get(+f.id).code));
    // the legend: a diverging ramp from -40 % to +40 %
    const lg = svg
      .append("g")
      .attr("class", "eu-legend")
      .attr("transform", `translate(8,${height + 14})`);
    const W = Math.min(260, width - 20);
    const steps = 40;
    for (let k = 0; k < steps; k++)
      lg.append("rect")
        .attr("x", (k * W) / steps)
        .attr("y", 0)
        .attr("width", W / steps + 0.5)
        .attr("height", 9)
        .attr("fill", color(-ext + (2 * ext * (k + 0.5)) / steps));
    for (const t of [-ext, 0, ext])
      lg.append("text")
        .attr("x", ((t + ext) / (2 * ext)) * W)
        .attr("y", 22)
        .attr("text-anchor", t === -ext ? "start" : t === ext ? "end" : "middle")
        .text(t === ext ? `${pct(t)} et plus` : t === -ext ? `${pct(t)} et moins` : "comme en 2019");
  };
  draw();
  onResize(node, draw);
}

/** The path of the centre of gravity, close up, with a few airports as landmarks and a scale. */
export function baryMap(node, geo, data, { marks }) {
  const B = data.barycentre;
  const draw = () => {
    const width = node.clientWidth || 600;
    const height = Math.round(Math.min(560, Math.max(320, width * 0.62)));
    const { svg } = svgFor(node, height);
    const lats = B.map((b) => b.lat);
    const lons = B.map((b) => b.lon);
    const pad = 0.55;
    const frame = box(
      d3.min(lons) - pad * 1.6,
      d3.min(lats) - pad,
      d3.max(lons) + pad * 1.6,
      d3.max(lats) + pad,
    );
    const proj = projectionFor(width, height, frame);
    const path = d3.geoPath(proj);
    svg
      .append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("class", "cty-zoom");
    // the countries, for orientation (points inside each country, checked on the map)
    for (const [name, lon, lat] of [
      ["France", 5.75, 46.95],
      ["Suisse", 7.95, 46.72],
      ["Allemagne", 8.25, 47.86],
      ["Italie", 8.65, 45.82],
    ]) {
      const [x, y] = proj([lon, lat]);
      if (x > 30 && x < width - 30 && y > 14 && y < height - 14)
        svg
          .append("text")
          .attr("class", "cty-lab")
          .attr("x", x)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .text(name);
    }
    // landmarks: the airports of the area
    for (const a of data.airports.filter((x) => marks.includes(x.code))) {
      const [x, y] = proj([a.lon, a.lat]);
      if (x < 0 || x > width || y < 0 || y > height) continue;
      svg.append("circle").attr("class", "mark-apt").attr("cx", x).attr("cy", y).attr("r", 3);
      svg
        .append("text")
        .attr("class", "mark-lab")
        .attr("x", x + 6)
        .attr("y", y + 4)
        .text(a.name);
    }
    const pts = B.map((b) => ({ ...b, p: proj([b.lon, b.lat]) }));
    const before = pts.filter((b) => b.y <= 2019);
    const after = pts.filter((b) => b.y >= 2019);
    svg
      .append("path")
      .attr("class", "bary-path before")
      .attr("d", d3.line()(before.map((b) => b.p)));
    svg
      .append("path")
      .attr("class", "bary-path after")
      .attr("d", d3.line()(after.map((b) => b.p)));
    const labelled = new Set([B[0].y, 2013, 2019, 2021, B.at(-1).y]);
    for (const b of pts) {
      svg
        .append("circle")
        .attr("class", b.y > 2019 ? "bary-pt after" : "bary-pt")
        .attr("cx", b.p[0])
        .attr("cy", b.p[1])
        .attr("r", labelled.has(b.y) ? 4.5 : 2.6)
        .on("pointermove", (ev) =>
          showTip(ev, `Centre de gravité ${b.y}`, [
            { label: "latitude", value: `${fmtNum(b.lat, 2)}° N` },
            { label: "longitude", value: `${fmtNum(b.lon, 2)}° E` },
          ]),
        )
        .on("pointerleave", hideTip);
      if (labelled.has(b.y))
        svg
          .append("text")
          .attr("class", b.y > 2019 ? "bary-y after" : "bary-y")
          .attr("x", b.p[0] + 8)
          .attr("y", b.p[1] + 4)
          .text(b.y);
    }
    // a 50 km scale bar, measured on the projection where the path runs
    const c = B.at(-1);
    const a0 = proj([c.lon, c.lat]);
    const a1 = proj([c.lon + 50 / (111.32 * Math.cos((c.lat * Math.PI) / 180)), c.lat]);
    const len = Math.abs(a1[0] - a0[0]);
    const sb = svg
      .append("g")
      .attr("class", "scalebar")
      .attr("transform", `translate(16,${height - 18})`);
    sb.append("line").attr("x1", 0).attr("x2", len).attr("y1", 0).attr("y2", 0);
    sb.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -4).attr("y2", 4);
    sb.append("line").attr("x1", len).attr("x2", len).attr("y1", -4).attr("y2", 4);
    sb.append("text")
      .attr("x", len / 2)
      .attr("y", -7)
      .attr("text-anchor", "middle")
      .text("50 km");
  };
  draw();
  onResize(node, draw);
}
