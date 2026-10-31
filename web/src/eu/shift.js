// The charts of "Cap au sud" that measure the move south: the passengers gained or lost by band of
// latitude since 2019, and the barycentre's distance north or south of its 2019 position each year.
import * as d3 from "d3";
import { showTip, hideTip, onResize, dataTable } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { mio } from "./charts.js";

const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${mio(Math.abs(v))}`;
const short = (name) => name.split(/-| \(/)[0];

function frame(node, height, margin) {
  const width = node.clientWidth || 480;
  const svg = d3
    .select(node)
    .selectAll("svg")
    .data([0])
    .join("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g, w: width - margin.left - margin.right, h: height - margin.top - margin.bottom };
}

/**
 * Net change of the passengers of every airport, by band of two degrees of latitude, north on top; the
 * names are the busiest airports of each band, on the side of the zero the bar leaves free.
 */
export function bandsChart(node, shift) {
  // every band from the southernmost to the northernmost, empty ones included (no airport there)
  const lats = shift.bands.map((b) => b.lat);
  const all = d3
    .range(d3.min(lats), d3.max(lats) + 1, 2)
    .map((lat) => shift.bands.find((b) => b.lat === lat) ?? { lat, change: 0, names: [] });
  const rows = all.reverse();
  const label = (b) => [...new Set(b.names.map(short))].slice(0, 2).join(", ");
  const draw = () => {
    const rowH = 24;
    const { g, w, h } = frame(node, rows.length * rowH + 34, { top: 8, right: 54, bottom: 26, left: 62 });
    const ext = d3.max(rows, (r) => Math.abs(r.change));
    const x = d3.scaleLinear().domain([-ext, ext]).nice().range([0, w]);
    const y = d3
      .scaleBand()
      .domain(rows.map((r) => r.lat))
      .range([0, h])
      .padding(0.18);
    for (const t of x.ticks(4)) {
      g.append("line")
        .attr("class", t === 0 ? "zero" : "grid")
        .attr("x1", x(t))
        .attr("x2", x(t))
        .attr("y1", 0)
        .attr("y2", h);
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(t))
        .attr("y", h + 16)
        .attr("text-anchor", "middle")
        .text(t ? `${t > 0 ? "+" : "−"}${fmtNum(Math.abs(t) / 1e6)} M` : "0");
    }
    // the 45th parallel, between two bands
    const yS = y(shift.split - 2) ?? h;
    const ySplit = yS - (y.step() * y.paddingInner()) / 2;
    g.append("line")
      .attr("class", "band-split")
      .attr("x1", -62)
      .attr("x2", w)
      .attr("y1", ySplit)
      .attr("y2", ySplit);
    const row = g
      .selectAll("g.r")
      .data(rows)
      .join("g")
      .attr("class", "r")
      .attr("transform", (r) => `translate(0,${y(r.lat)})`)
      .on("pointermove", (ev, r) =>
        showTip(ev, `De ${r.lat}° à ${r.lat + 2}° N`, [
          { label: `écart ${shift.from}-${shift.to}`, value: signed(r.change) },
          ...(r.names.length ? [{ label: "premiers aéroports", value: label(r) }] : []),
        ]),
      )
      .on("pointerleave", hideTip);
    row
      .append("rect")
      .attr("x", (r) => x(Math.min(0, r.change)))
      .attr("width", (r) => Math.abs(x(r.change) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", (r) => (r.change >= 0 ? "var(--south)" : "var(--north)"));
    row
      .append("text")
      .attr("class", "lab")
      .attr("x", -8)
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text((r) => `${r.lat}-${r.lat + 2}°`);
    row
      .append("text")
      .attr("class", "band-names")
      .attr("x", (r) => x(0) + (r.change >= 0 ? -6 : 6))
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", (r) => (r.change >= 0 ? "end" : "start"))
      .text(label);
    row
      .append("text")
      .attr("class", "val")
      .attr("x", (r) => x(r.change) + (r.change >= 0 ? 4 : -4))
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", (r) => (r.change >= 0 ? "start" : "end"))
      .text((r) => (Math.abs(r.change) >= 5e6 ? signed(r.change) : ""));
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Latitude", `Écart ${shift.from}-${shift.to}`, "Premiers aéroports"],
    rows: rows.map((r) => [`${r.lat}-${r.lat + 2}° N`, signed(r.change), label(r)]),
  });
}

/**
 * The barycentre each year, north (up, blue) or south (down, amber) of its 2019 position, in km; the
 * northernmost year, the lowest and the last are written on their bar.
 */
export function offsetBars(node, bary, { last }) {
  const rows = bary.offsets;
  const marked = new Set([bary.north.y, bary.lowest.y, last]);
  const kmWords = (o) => `${fmtNum(Math.abs(Math.round(o.km)))} km ${o.km >= 0 ? "au nord" : "au sud"}`;
  const draw = () => {
    const small = (node.clientWidth || 480) < 460;
    const { g, w, h } = frame(node, small ? 300 : 340, { top: 26, right: 10, bottom: 30, left: 50 });
    const x = d3
      .scaleBand()
      .domain(rows.map((r) => r.y))
      .range([0, w])
      .padding(0.22);
    const y = d3
      .scaleLinear()
      .domain([
        d3.min(rows, (r) => r.km) * 1.12,
        Math.max(
          10,
          d3.max(rows, (r) => r.km),
        ) * 1.5,
      ])
      .nice()
      .range([h, 0]);
    for (const t of y.ticks(5)) {
      g.append("line")
        .attr("class", t === 0 ? "zero" : "grid")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", y(t))
        .attr("y2", y(t));
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", -8)
        .attr("y", y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(t ? `${fmtNum(Math.abs(t))} km` : "2019");
    }
    g.append("text")
      .attr("class", "axis-t")
      .attr("x", -8)
      .attr("y", -12)
      .attr("text-anchor", "end")
      .text("nord");
    g.append("text")
      .attr("class", "axis-t")
      .attr("x", -8)
      .attr("y", h + 2)
      .attr("dy", "1.1em")
      .attr("text-anchor", "end")
      .text("sud");
    g.selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", (r) => x(r.y))
      .attr("width", x.bandwidth())
      .attr("y", (r) => Math.min(y(0), y(r.km)))
      .attr("height", (r) => Math.max(1, Math.abs(y(r.km) - y(0))))
      .attr("fill", (r) => (r.km >= 0 ? "var(--north)" : "var(--south)"))
      .on("pointermove", (ev, r) =>
        showTip(ev, `Centre de gravité ${r.y}`, [{ label: "par rapport à 2019", value: kmWords(r) }]),
      )
      .on("pointerleave", hideTip);
    const step = small ? 4 : 2;
    for (const r of rows) {
      if ((r.y - rows[0].y) % step === 0 || r.y === last)
        g.append("text")
          .attr("class", "axis-t")
          .attr("x", x(r.y) + x.bandwidth() / 2)
          .attr("y", h + 18)
          .attr("text-anchor", "middle")
          .text(r.y);
      if (!marked.has(r.y)) continue;
      const above = r.km >= 0;
      g.append("text")
        .attr("class", "eu-label")
        .attr("x", x(r.y) + x.bandwidth() / 2)
        .attr("y", y(r.km) + (above ? -7 : 16))
        .attr("text-anchor", r.y === last ? "end" : "middle")
        .text(kmWords(r));
    }
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Année", "Par rapport à 2019"],
    rows: rows.map((r) => [String(r.y), kmWords(r)]),
  });
}
