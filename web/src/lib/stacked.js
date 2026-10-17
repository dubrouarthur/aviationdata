import * as d3 from "d3";
import { el, showTip, hideTip, onResize, dataTable } from "./ui.js";

/**
 * Stacked areas over years, with a legend, labels on the bands that are thick enough at the right end,
 * one tooltip for every band at the hovered year, and a table view.
 *
 * opts = {
 *   years: number[], series: [{key, label, color, values}] (bottom to top),
 *   yFormat: v => string (axis), valueFormat: v => string (labels, tooltip, table),
 *   height, events: [{year, label}], tableHead: string
 * }
 */
export function stackedArea(node, opts) {
  const { years, series } = opts;
  const height = opts.height || 300;
  const legend = el(
    "div",
    { class: "legend-row" },
    [...series]
      .reverse()
      .map((s) => el("span", { class: "lg" }, [el("i", { class: "sq", style: `--c:${s.color}` }), s.label])),
  );
  const host = el("div", { class: "chart-host" });
  node.replaceChildren(legend, host);

  const rows = years.map((y, i) =>
    Object.fromEntries([["year", y], ...series.map((s) => [s.key, s.values[i] ?? 0])]),
  );
  const stack = d3.stack().keys(series.map((s) => s.key))(rows);
  const totals = rows.map((r) => d3.sum(series, (s) => r[s.key]));

  function draw(width) {
    host.replaceChildren();
    const narrow = width < 560;
    // room for the longest "label value" at the right end
    const longest = d3.max(series, (s) => `${s.label} ${opts.valueFormat(s.values.at(-1) ?? 0)}`.length);
    const m = { top: 12, right: narrow ? 12 : Math.min(190, longest * 6.6 + 14), bottom: 26, left: 48 };
    const x = d3
      .scaleLinear()
      .domain(d3.extent(years))
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(totals) * 1.06])
      .nice()
      .range([height - m.bottom, m.top]);
    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - m.left - m.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6).tickFormat(opts.yFormat))
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(narrow ? 4 : 7)
          .tickFormat(d3.format("d"))
          .tickSizeOuter(0),
      );
    for (const e of opts.events || []) {
      if (e.year < years[0] || e.year > years.at(-1)) continue;
      svg
        .append("line")
        .attr("x1", x(e.year))
        .attr("x2", x(e.year))
        .attr("y1", m.top)
        .attr("y2", height - m.bottom)
        .style("stroke", "var(--muted)")
        .style("stroke-dasharray", "2 3");
      svg
        .append("text")
        .attr("class", "end-label")
        .attr("x", x(e.year) + 4)
        .attr("y", m.top + 10)
        .style("font-weight", 500)
        .style("font-size", "11.5px")
        .text(e.label);
    }
    const area = d3
      .area()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);
    svg
      .append("g")
      .selectAll("path")
      .data(stack)
      .join("path")
      .attr("d", area)
      .style("fill", (d) => series.find((s) => s.key === d.key).color)
      .style("fill-opacity", 0.85)
      .style("stroke", "var(--card)")
      .style("stroke-width", 1.5);
    // labels at the right end, on bands thick enough to hold them
    if (!narrow) {
      const L = years.length - 1;
      const labels = stack
        .map((d) => {
          const s = series.find((q) => q.key === d.key);
          const [a, b] = d[L];
          return { s, y: (y(a) + y(b)) / 2, h: y(a) - y(b), v: rows[L][d.key] };
        })
        .filter((l) => l.h >= 13);
      svg
        .append("g")
        .selectAll("text")
        .data(labels)
        .join("text")
        .attr("class", "end-label")
        .attr("x", width - m.right + 8)
        .attr("y", (l) => l.y + 4)
        .text((l) => `${l.s.label} ${opts.valueFormat(l.v)}`);
    }
    // hover: crosshair + one tooltip for all bands
    const cross = svg
      .append("line")
      .attr("class", "crosshair")
      .attr("y1", m.top)
      .attr("y2", height - m.bottom)
      .style("display", "none");
    svg
      .append("rect")
      .attr("x", m.left)
      .attr("y", 0)
      .attr("width", width - m.left - m.right)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [px] = d3.pointer(event);
        const i = Math.max(0, Math.min(years.length - 1, Math.round(x.invert(px) - years[0])));
        cross.attr("x1", x(years[i])).attr("x2", x(years[i])).style("display", null);
        showTip(event, `${years[i]} : ${opts.valueFormat(totals[i])}`, [
          ...[...series]
            .reverse()
            .map((s) => ({ label: s.label, value: opts.valueFormat(rows[i][s.key]), color: s.color })),
        ]);
      })
      .on("pointerleave", () => {
        cross.style("display", "none");
        hideTip();
      });
  }
  onResize(host, draw);
  draw(host.clientWidth || node.clientWidth || 600);
  dataTable(node, {
    head: [opts.tableHead || "Année", ...series.map((s) => s.label), "Total"],
    rows: years.map((yr, i) => [
      String(yr),
      ...series.map((s) => opts.valueFormat(rows[i][s.key])),
      opts.valueFormat(totals[i]),
    ]),
  });
}
