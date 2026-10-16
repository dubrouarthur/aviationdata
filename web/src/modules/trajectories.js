import * as d3 from "d3";
import { $, el, rich, segmented, chips, dataTable, showTip, hideTip, onResize } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { rolling12, rebase, sumSeries, yearSum, pctChange, toDate, isNum } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtNum, fmtMonth, fmtMonthShort } from "../lib/format.js";
import { eventMarks } from "../lib/data.js";

export const GROUPS = [
  { key: "intl", label: "International", color: "var(--s-intl)", parts: ["MET_INTL", "OM_INTL"] },
  { key: "rad", label: "Paris–province", color: "var(--s-rad)", parts: ["MET_RAD"] },
  { key: "om", label: "Outre-mer", color: "var(--s-om)", parts: ["MET_OM", "OM_OM"] },
  { key: "tra", label: "Province–province", color: "var(--s-tra)", parts: ["MET_TRA"] },
];

export function initTrajectories(data) {
  const { months, faisceaux, annual, continents } = data.fracture;
  const dates = months.map(toDate);
  const lastYear = annual.years.at(-1);
  const monthly = Object.fromEntries(
    GROUPS.map((g) => [g.key, sumSeries(g.parts.filter((p) => faisceaux[p]).map((p) => faisceaux[p]))]),
  );
  const yr = (k, y) => yearSum(months, monthly[k], y);
  const base2019 = Object.fromEntries(GROUPS.map((g) => [g.key, yr(g.key, 2019)]));

  // ---------------------------------------------------------------- lede (computed)
  const ch = (k) => fmtPct(pctChange(base2019[k], yr(k, lastYear)));
  const radYears = d3.range(+months[0].slice(0, 4), lastYear).filter((y) => y !== 2020 && y !== 2021);
  const radLower = radYears.filter((y) => yr("rad", y) <= yr("rad", lastYear));
  const radPeakYear = d3.greatest(radYears, (y) => yr("rad", y));
  const lowText = radLower.length
    ? `au plus bas depuis ${d3.max(radLower)} (hors Covid)`
    : `à leur plus bas niveau depuis le début de la série en ${months[0].slice(0, 4)}, années Covid exceptées`;
  $("#lede-traj").replaceChildren(
    rich([
      `Entre 2019 et ${lastYear} : international `,
      { b: ch("intl") },
      `, Outre-mer `,
      { b: ch("om") },
      `, province–province `,
      { b: ch("tra") },
      `, Paris–province `,
      { b: ch("rad") },
      `. Les liaisons entre Paris et la province sont ${lowText}, `,
      { b: fmtPct(pctChange(yr("rad", radPeakYear), yr("rad", lastYear)), 0) },
      ` par rapport à leur pic de ${radPeakYear}.`,
    ]),
  );


  // ---------------------------------------------------------------- chart
  const state = { mode: "index", smooth: "r12", from: "1990", on: new Set(GROUPS.map((g) => g.key)) };
  const node = $("#chart-traj");

  function seriesFor() {
    return GROUPS.filter((g) => state.on.has(g.key)).map((g) => {
      const raw = monthly[g.key];
      let values = state.smooth === "r12" ? rolling12(raw) : raw;
      if (state.mode === "index")
        values = rebase(values, state.smooth === "r12" ? base2019[g.key] : base2019[g.key] / 12);
      return { key: g.key, label: g.label, color: g.color, values };
    });
  }
  const opts = () => ({
    dates,
    series: seriesFor(),
    xDomain: [toDate(`${state.from}-01`), dates.at(-1)],
    baseline: state.mode === "index" ? 100 : null,
    yZero: state.mode === "pax",
    yFormat: state.mode === "index" ? (v) => fmtNum(v) : fmtPaxAxis,
    tipFormat: state.mode === "index" ? (v) => fmtNum(v, 1) : (v) => fmtPax(v),
    title: (i) =>
      state.smooth === "r12"
        ? `12 mois jusqu'à ${fmtMonthShort(months[i])}${state.mode === "index" ? " (indice 2019 = 100)" : ""}`
        : `${fmtMonth(months[i])}${state.mode === "index" ? " (indice, moyenne mensuelle 2019 = 100)" : ""}`,
    events: eventMarks(),
    height: 380,
  });
  const chart = lineChart(node, opts());
  const redraw = () => chart.update(opts());

  state.on = chips(
    $("#chips-traj"),
    GROUPS.map((g) => ({ key: g.key, label: g.label, color: g.color })),
    (on) => {
      state.on = on;
      redraw();
    },
  );
  segmented($("#traj-mode"), state.mode, (v) => {
    state.mode = v;
    redraw();
  });
  segmented($("#traj-smooth"), state.smooth, (v) => {
    state.smooth = v;
    redraw();
  });
  segmented($("#traj-range"), state.from, (v) => {
    state.from = v;
    redraw();
  });

  dataTable(
    $("#table-traj"),
    ["Année", ...GROUPS.map((g) => g.label), "Total"],
    annual.years.map((y) => [
      String(y),
      ...GROUPS.map((g) => fmtPax(yr(g.key, y))),
      fmtPax(annual.TOTAL[annual.years.indexOf(y)]),
    ]),
  );

  // ---------------------------------------------------------------- continents (2019 vs last year)
  const cNode = $("#chart-continents");
  const i19 = continents.years.indexOf(2019);
  const iL = continents.years.indexOf(lastYear);
  const rows = Object.entries(continents.series)
    .map(([name, v]) => ({ name: name.charAt(0) + name.slice(1).toLowerCase(), a: v[i19], b: v[iL] }))
    .filter((d) => isNum(d.a) && isNum(d.b))
    .sort((p, q) => q.b - p.b);

  function drawContinents(width) {
    cNode.replaceChildren();
    const narrow = width < 560;
    const m = { top: 8, right: narrow ? 70 : 110, bottom: 8, left: narrow ? 84 : 110 };
    const rowH = 38;
    const h = m.top + m.bottom + rows.length * rowH;
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => Math.max(d.a, d.b))])
      .range([m.left, width - m.right]);
    const svg = d3.select(cNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    const g = svg
      .selectAll("g")
      .data(rows)
      .join("g")
      .attr("transform", (_, i) => `translate(0,${m.top + i * rowH})`);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", m.left - 10)
      .attr("y", rowH / 2 + 4)
      .attr("text-anchor", "end")
      .text((d) => d.name);
    g.append("rect")
      .attr("x", m.left)
      .attr("y", 7)
      .attr("height", 9)
      .attr("rx", 4)
      .attr("width", (d) => Math.max(1, x(d.a) - m.left))
      .style("fill", "var(--axis)");
    g.append("rect")
      .attr("x", m.left)
      .attr("y", 19)
      .attr("height", 11)
      .attr("rx", 4)
      .attr("width", (d) => Math.max(1, x(d.b) - m.left))
      .style("fill", "var(--s-intl)");
    g.append("text")
      .attr("class", "end-label")
      .attr("x", (d) => Math.max(x(d.a), x(d.b)) + 8)
      .attr("y", rowH / 2 + 4)
      .text((d) => fmtPct(pctChange(d.a, d.b)));
    g.append("rect")
      .attr("x", 0)
      .attr("width", width)
      .attr("height", rowH)
      .attr("fill", "transparent")
      .on("pointermove", (event, d) =>
        showTip(event, d.name, [
          { label: `passagers en ${lastYear}`, value: fmtPax(d.b), color: "var(--s-intl)" },
          { label: "passagers en 2019", value: fmtPax(d.a), color: "var(--axis)" },
          { label: "évolution", value: fmtPct(pctChange(d.a, d.b)) },
        ]),
      )
      .on("pointerleave", hideTip);
    cNode.append(
      el("div", { class: "map-legend" }, [
        el("span", {
          style: "display:inline-block;width:14px;height:8px;border-radius:4px;background:var(--axis)",
        }),
        el("span", { text: "2019" }),
        el("span", {
          style: "display:inline-block;width:14px;height:8px;border-radius:4px;background:var(--s-intl)",
        }),
        el("span", { text: String(lastYear) }),
      ]),
    );
  }
  onResize(cNode, drawContinents);
  drawContinents(cNode.clientWidth || 800);
}
