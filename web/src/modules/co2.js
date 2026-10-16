import * as d3 from "d3";
import { $, rich, chips, showTip, hideTip, onResize } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { pctChange, toDate, isNum } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtNum } from "../lib/format.js";

const TOTAL = "FRANCE_TOT";
export const CO2_SEGMENTS = [
  { key: TOTAL, label: "Ensemble", color: "var(--ink)", width: 2.6 },
  { key: "MET_INTERIEUR", label: "Intérieur métropole", color: "var(--s-rad)" },
  { key: "MET-OM_ET_OM-OM", label: "Outre-mer", color: "var(--s-om)" },
  { key: "INTL_MC", label: "International moyen-courrier", color: "var(--s-intl)" },
  { key: "INTL_LC", label: "International long-courrier", color: "var(--s-intl)", dashed: true },
];

export function initCo2(data) {
  const { years, mt, g_peqkm: g, pax } = data.co2;
  const tot = mt[TOTAL];
  const gt = g[TOTAL] || [];
  const at = (arr, y) => arr[years.indexOf(y)];
  const last = d3.max(years.filter((y, i) => isNum(tot[i]) && isNum(pax[i])));
  const firstY = years[0];
  const pts = years
    .map((y, i) => ({ y, x: pax[i], v: tot[i], g: gt[i] }))
    .filter((d) => isNum(d.x) && isNum(d.v));

  // ---------------------------------------------------------------- lede (computed)
  const dom = g.MET_INTERIEUR ? at(g.MET_INTERIEUR, last) : null;
  const lc = g.INTL_LC ? at(g.INTL_LC, last) : null;
  $("#lede-co2").replaceChildren(
    rich([
      `En ${last}, le transport aérien commercial en France a émis `,
      { b: `${fmtNum(at(tot, last), 1)} Mt` },
      ` de CO2, soit `,
      { b: fmtPct(pctChange(at(tot, 2019), at(tot, last))) },
      ` par rapport à 2019, pour un trafic de `,
      { b: fmtPct(pctChange(at(pax, 2019), at(pax, last))) },
      `. Entre ${firstY} et 2019, trafic `,
      { b: fmtPct(pctChange(at(pax, firstY), at(pax, 2019)), 0) },
      `, émissions `,
      { b: fmtPct(pctChange(at(tot, firstY), at(tot, 2019)), 0) },
      `. Chaque passager-kilomètre émet aujourd'hui `,
      { b: `${fmtNum(at(gt, last), 1)} g` },
      `, contre ${fmtNum(at(gt, firstY), 1)} g en ${firstY}.`,
      ...(dom && lc
        ? [
            ` Sur un vol intérieur, c'est `,
            { b: `${fmtNum(dom, 0)} g` },
            `, ${fmtNum(dom / lc, 1)} fois plus qu'en long-courrier.`,
          ]
        : []),
    ]),
  );

  // ---------------------------------------------------------------- connected scatter
  const node = $("#chart-co2");
  const slider = $("#co2-year");
  Object.assign(slider, { min: pts[0].y, max: last, step: 1, value: last });
  let focus = last;
  let width = node.clientWidth || 600;

  function readout() {
    const d = pts.find((p) => p.y === focus);
    $("#co2-year-out").textContent = focus;
    $("#co2-readout").textContent = d
      ? `${focus} : ${fmtPax(d.x)} passagers, ${fmtNum(d.v, 1)} Mt de CO2, ${fmtNum(d.g, 1)} g par passager-kilomètre.`
      : "";
  }

  function draw() {
    node.replaceChildren();
    const narrow = width < 520;
    const h = Math.min(420, Math.max(300, width * 0.68));
    const m = { top: 14, right: 18, bottom: 40, left: 46 };
    const x = d3
      .scaleLinear()
      .domain(d3.extent(pts, (d) => d.x))
      .nice()
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(pts, (d) => d.v))
      .nice()
      .range([h - m.bottom, m.top]);
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
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
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((v) => fmtNum(v))
          .tickSize(0)
          .tickPadding(8),
      )
      .call((g2) => g2.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(narrow ? 4 : 6)
          .tickFormat(fmtPaxAxis)
          .tickSizeOuter(0),
      );
    svg
      .append("text")
      .attr("class", "axis-title")
      .attr("x", width - m.right)
      .attr("y", h - 6)
      .attr("text-anchor", "end")
      .style("fill", "var(--muted)")
      .style("font-size", "11.5px")
      .text("Passagers (arrivées et départs)");
    svg
      .append("text")
      .attr("x", m.left)
      .attr("y", m.top - 2)
      .style("fill", "var(--muted)")
      .style("font-size", "11.5px")
      .text("Mt de CO2");

    svg
      .append("path")
      .attr(
        "d",
        d3
          .line()
          .x((d) => x(d.x))
          .y((d) => y(d.v))
          .curve(d3.curveCatmullRom.alpha(0.5))(pts),
      )
      .style("fill", "none")
      .style("stroke", "var(--axis)")
      .style("stroke-width", 1.5);
    const before = (d) => d.y <= focus;
    svg
      .append("g")
      .selectAll("circle")
      .data(pts)
      .join("circle")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.v))
      .attr("r", (d) => (d.y === focus ? 8 : 4.5))
      .style("fill", (d) => (d.y === focus ? "var(--glow)" : before(d) ? "var(--ink-2)" : "var(--axis)"))
      .style("stroke", "var(--surface)")
      .style("stroke-width", 2);
    const keyYears = new Set([pts[0].y, 2008, 2019, 2020, last, focus]);
    svg
      .append("g")
      .selectAll("text")
      .data(pts.filter((d) => keyYears.has(d.y)))
      .join("text")
      .attr("class", "end-label")
      .attr("x", (d) => x(d.x) + 10)
      .attr("y", (d) => y(d.v) - 9)
      .text((d) => d.y);

    // nearest-point hit layer (24px+ targets)
    const delaunay = d3.Delaunay.from(
      pts,
      (d) => x(d.x),
      (d) => y(d.v),
    );
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("touch-action", "pan-y")
      .on("pointermove", (event) => {
        const [px, py] = d3.pointer(event);
        const d = pts[delaunay.find(px, py)];
        if (Math.hypot(x(d.x) - px, y(d.v) - py) > 40) return hideTip();
        showTip(event, String(d.y), [
          { label: "passagers", value: fmtPax(d.x) },
          { label: "CO2", value: `${fmtNum(d.v, 1)} Mt` },
          { label: "par passager-km", value: `${fmtNum(d.g, 1)} g` },
        ]);
      })
      .on("pointerleave", hideTip)
      .on("click", (event) => {
        const [px, py] = d3.pointer(event);
        focus = pts[delaunay.find(px, py)].y;
        slider.value = focus;
        readout();
        draw();
      });
  }

  slider.addEventListener("input", () => {
    focus = +slider.value;
    readout();
    draw();
  });
  onResize(node, (w) => {
    width = w;
    draw();
  });
  readout();
  draw();

  // ---------------------------------------------------------------- intensity by segment
  const available = CO2_SEGMENTS.filter((s) => g[s.key]);
  const state = { on: new Set(available.map((s) => s.key)) };
  const iNode = $("#chart-intensity");
  const opts = () => ({
    dates: years.map((y) => toDate(y)),
    series: available.filter((s) => state.on.has(s.key)).map((s) => ({ ...s, values: g[s.key] })),
    xDomain: [toDate(years[0]), toDate(years.at(-1))],
    yFormat: (v) => `${fmtNum(v)} g`,
    tipFormat: (v) => `${fmtNum(v, 1)} g`,
    title: (i) => `${years[i]}, g de CO2 par passager-km`,
    height: 300,
    endLabels: false,
  });
  const chart = lineChart(iNode, opts());
  state.on = chips(
    $("#chips-co2"),
    available.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed })),
    (on) => {
      state.on = on;
      chart.update(opts());
    },
  );
}
