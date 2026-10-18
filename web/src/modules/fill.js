import * as d3 from "d3";
import { $, el, rich, showTip, hideTip, onResize, dataTable, keyFigures } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { toDate, pctChange, isNum } from "../lib/series.js";
import { fmtPax, fmtPct, fmtPctAbs, fmtNum } from "../lib/format.js";
import { shortName } from "./names.js";

/** Passengers vs flights: fewer movements, fuller aircraft (APT series: passengers and passenger flights). */
export function initFill(data) {
  const { months, national, airports, years } = data.aeroports;
  const ysum = (arr, y) => d3.sum(months.map((m, i) => (m.startsWith(String(y)) ? arr[i] : 0)));
  const pax = years.map((y) => ysum(national.pax, y));
  const vols = years.map((y) => ysum(national.vols, y));
  const base = years.indexOf(2000);
  const last = years.length - 1;
  const ratio = years.map((_, i) => pax[i] / vols[i]);

  $("#rempl-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Entre 2000 et ${years[last]}, le nombre de passagers dans les aéroports français a progressé de `,
        { b: fmtPctAbs(pctChange(pax[base], pax[last]), 0) },
        `, alors que le nombre de vols de passagers a reculé de `,
        { b: fmtPctAbs(pctChange(vols[base], vols[last]), 0) },
        `. Des avions plus grands ou mieux remplis : chaque vol emporte aujourd'hui `,
        { b: `${fmtNum(ratio[last], 0)} passagers` },
        ` en moyenne, contre ${fmtNum(ratio[base], 0)} en 2000.`,
      ]),
    ),
  );

  keyFigures($("#kf-rempl"), [
    {
      value: fmtPct(pctChange(pax[base], pax[last]), 0),
      label: `de passagers dans les aéroports entre 2000 et ${years[last]}`,
      color: "var(--blue)",
    },
    {
      value: fmtPct(pctChange(vols[base], vols[last]), 0),
      label: "de vols de passagers",
      color: "var(--ink-2)",
    },
  ]);

  // change since 2000, in %: easier to read than an index; the shaded gap is the gain in passengers per flight
  const since2000 = (arr) => arr.map((v) => (v / arr[base] - 1) * 100);
  const signed = (v, d = 0) => (Math.abs(v) < 0.5 ? "0 %" : fmtPct(v, d));
  $("#rempl-legend").replaceChildren(
    el("span", { class: "lg" }, [el("i", { style: "--c:var(--blue)" }), "Passagers"]),
    el("span", { class: "lg" }, [el("i", { style: "--c:var(--ink-2)" }), "Vols de passagers"]),
    el("span", { class: "lg" }, [
      el("i", { class: "area", style: "--c:var(--blue-soft)" }),
      "L'écart : chaque vol emporte plus de passagers",
    ]),
  );
  lineChart($("#chart-rempl"), {
    dates: years.map((y) => toDate(y)),
    series: [
      { key: "pax", label: "Passagers", color: "var(--blue)", values: since2000(pax), width: 2.6 },
      { key: "vols", label: "Vols", color: "var(--ink-2)", values: since2000(vols), width: 2.2 },
    ],
    band: { a: "pax", b: "vols", color: "var(--blue-soft)" },
    xDomain: [toDate(years[0]), toDate(years[last])],
    baseline: 0,
    yFormat: (v) => signed(v),
    tipFormat: (v) => `${signed(v, 1)} depuis 2000`,
    title: (i) => `${years[i]}`,
    events: [{ date: toDate(2020), label: "Covid", short: "Covid" }],
    endDots: true,
    endText: (s2) => `${s2.label} ${signed(s2.values[last])}`,
    height: 300,
    animate: true,
    table: {
      head: "Année (évolution depuis 2000)",
      date: (d) => String(d.getUTCFullYear()),
      value: (v) => signed(v, 1),
    },
  });

  $("#rempl-figure").textContent = fmtNum(ratio[last], 0);
  $("#rempl-caption").replaceChildren(
    rich([
      `passagers par vol en ${years[last]}, contre `,
      { b: fmtNum(ratio[base], 0) },
      ` en 2000 et `,
      { b: fmtNum(ratio[0], 0) },
      ` en ${years[0]}.`,
    ]),
  );

  // dumbbell: passengers per flight, 2000 -> last year, biggest airports
  const node = $("#chart-rempl-apt");
  const yi = (y) => years.indexOf(y);
  const ppf = (a, y) => {
    const p = ysum(
      a.pax.map((v) => v ?? 0),
      y,
    );
    const f = a.vols?.[yi(y)];
    return f ? p / f : null;
  };
  const rows = airports
    .slice(0, 14)
    .map((a) => ({ a, from: ppf(a, 2000), to: ppf(a, years[last]) }))
    .filter((r) => isNum(r.from) && isNum(r.to))
    .sort((p, q) => q.to - p.to);

  function draw(width) {
    node.replaceChildren();
    const m = { top: 26, right: 44, bottom: 32, left: 112 }; // the legend gets its own line under the rows
    const rowH = 24;
    const h = m.top + m.bottom + rows.length * rowH;
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r) => Math.max(r.from, r.to)) * 1.05])
      .range([m.left, width - m.right]);
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${m.top - 6})`)
      .call(
        d3
          .axisTop(x)
          .ticks(5)
          .tickSize(-(h - m.top))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${m.top - 6})`)
      .call(d3.axisTop(x).ticks(5).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    const g = svg
      .selectAll("g.row")
      .data(rows)
      .join("g")
      .attr("class", "row")
      .attr("transform", (_, i) => `translate(0,${m.top + i * rowH + rowH / 2})`);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", m.left - 10)
      .attr("y", 4)
      .attr("text-anchor", "end")
      .style("font-weight", 500)
      .text((r) => shortName(r.a));
    g.append("line")
      .attr("x1", (r) => x(r.from))
      .attr("x2", (r) => x(r.to))
      .style("stroke", "var(--blue-soft)")
      .style("stroke-width", 4)
      .style("stroke-linecap", "round");
    g.append("circle")
      .attr("cx", (r) => x(r.from))
      .attr("r", 4.5)
      .style("fill", "var(--axis)");
    g.append("circle")
      .attr("cx", (r) => x(r.to))
      .attr("r", 5.5)
      .style("fill", "var(--blue)");
    g.append("text")
      .attr("class", "end-label")
      .attr("x", (r) => x(Math.max(r.from, r.to)) + 9)
      .attr("y", 4)
      .text((r) => fmtNum(r.to, 0));
    g.append("rect")
      .attr("x", 0)
      .attr("y", -rowH / 2)
      .attr("width", width)
      .attr("height", rowH)
      .attr("fill", "transparent")
      .on("pointermove", (event, r) =>
        showTip(event, r.a.nom, [
          { label: `passagers par vol en ${years[last]}`, value: fmtNum(r.to, 0), color: "var(--blue)" },
          { label: "en 2000", value: fmtNum(r.from, 0), color: "var(--axis)" },
          { label: "évolution", value: fmtPct(pctChange(r.from, r.to), 0) },
          {
            label: `passagers en ${years[last]}`,
            value: fmtPax(
              ysum(
                r.a.pax.map((v) => v ?? 0),
                years[last],
              ),
            ),
          },
        ]),
      )
      .on("pointerleave", hideTip);
    svg
      .append("g")
      .attr("transform", `translate(${m.left},${h - 6})`)
      .call((lg) => {
        lg.append("circle").attr("cx", 0).attr("cy", -4).attr("r", 4).style("fill", "var(--axis)");
        lg.append("text")
          .attr("class", "end-label")
          .attr("x", 8)
          .attr("y", 0)
          .style("font-weight", 500)
          .text("2000");
        lg.append("circle").attr("cx", 52).attr("cy", -4).attr("r", 4).style("fill", "var(--blue)");
        lg.append("text")
          .attr("class", "end-label")
          .attr("x", 60)
          .attr("y", 0)
          .style("font-weight", 500)
          .text(String(years[last]));
      });
  }
  onResize(node, draw);
  draw(node.clientWidth || 500);
  dataTable(node, {
    head: ["Aéroport", "Passagers par vol en 2000", `en ${years[last]}`],
    rows: rows.map((r) => [r.a.nom, fmtNum(r.from, 0), fmtNum(r.to, 0)]),
  });
}
