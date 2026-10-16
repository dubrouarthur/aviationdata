import * as d3 from "d3";
import { $, rich, segmented, showTip, hideTip, onResize } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { ranksByYear, pctChange, toDate, isNum } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtNum, ordinal } from "../lib/format.js";

const TOP = 10;
const LOWCOST_COLOR = "var(--s-tra)";
const OTHER_COLOR = "var(--ink-2)";

export function initCarriers(data) {
  const { years, carriers, lowcost_share: share } = data.compagnies;
  const ranks = ranksByYear(carriers);
  const L = years.length - 1;
  const first = 0;
  const byRankLast = [...carriers].sort((a, b) => (ranks.get(a.nom)[L] ?? 99) - (ranks.get(b.nom)[L] ?? 99));
  const leader = byRankLast[0];
  const ryanair = carriers.find((c) => c.nom === "Ryanair");

  $("#lede-cie").replaceChildren(
    rich([
      `${leader.nom} reste le premier transporteur avec `,
      { b: fmtPax(leader.pax[L]) },
      ` de passagers en ${years[L]}. Mais les compagnies à bas coûts pèsent désormais `,
      { b: `${fmtNum(share[L] * 100, 0)} %` },
      ` du trafic, contre `,
      { b: `${fmtNum(share[first] * 100, 0)} %` },
      ` en ${years[first]}. Derrière ${leader.nom} : ${byRankLast
        .slice(1, 4)
        .map((c) => c.nom)
        .join(", ")}.`,
      ...(ryanair
        ? [
            ` Ryanair a transporté `,
            { b: fmtPax(ryanair.pax[L]) },
            ` de passagers en ${years[L]}, soit `,
            { b: fmtPct(pctChange(ryanair.pax[L - 1], ryanair.pax[L])) },
            ` sur un an.`,
          ]
        : []),
    ]),
  );
  $("#note-cie").textContent =
    "Compagnies regroupées par marque (par exemple Malta Air avec Ryanair). Sont classées à bas coûts : easyJet, Ryanair, Transavia, Volotea, Vueling, Wizz Air, Eurowings, Norwegian et Jet2 ; ce classement est un choix éditorial. Les compagnies sous 10 000 passagers par mois sont comptées dans le total mais pas dans le classement.";

  // ---------------------------------------------------------------- bump chart
  const state = { mode: "rank", hot: null, pinned: null };
  const node = $("#chart-bump");
  const shown = carriers.filter((c) => ranks.get(c.nom).some((r) => r && r <= TOP));
  let width = node.clientWidth || 900;

  function draw() {
    node.replaceChildren();
    const narrow = width < 640;
    const m = { top: 16, right: narrow ? 104 : 150, bottom: 28, left: narrow ? 30 : 150 };
    const h = state.mode === "rank" ? 44 + TOP * (narrow ? 30 : 36) : 380;
    const x = d3
      .scalePoint()
      .domain(years)
      .range([m.left, width - m.right]);
    const y =
      state.mode === "rank"
        ? d3
            .scaleLinear()
            .domain([1, TOP])
            .range([m.top + 8, h - m.bottom - 8])
        : d3
            .scaleLinear()
            .domain([0, d3.max(shown, (c) => d3.max(c.pax))])
            .nice()
            .range([h - m.bottom, m.top]);
    const val = (c, i) => (state.mode === "rank" ? ranks.get(c.nom)[i] : c.pax[i]);
    const ok = (c, i) =>
      state.mode === "rank"
        ? isNum(ranks.get(c.nom)[i]) && ranks.get(c.nom)[i] <= TOP
        : isNum(c.pax[i]) && c.pax[i] > 0;
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);

    if (state.mode === "pax") {
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
        .call(d3.axisLeft(y).ticks(5).tickFormat(fmtPaxAxis).tickSize(0).tickPadding(8))
        .call((g) => g.select(".domain").remove());
    }
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom + 6})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(years.filter((yy, i) => !narrow || i % 3 === 0 || i === L))
          .tickSize(0),
      )
      .call((g) => g.select(".domain").remove());

    const line = d3
      .line()
      .defined((d) => d.ok)
      .x((d) => x(d.year))
      .y((d) => y(d.v))
      .curve(state.mode === "rank" ? d3.curveBumpX : d3.curveMonotoneX);
    const color = (c) => (c.lowcost ? LOWCOST_COLOR : OTHER_COLOR);
    const pts = (c) => years.map((yy, i) => ({ year: yy, i, v: val(c, i), ok: ok(c, i) }));
    const active = () => state.pinned || state.hot;

    const gLines = svg.append("g");
    const paths = gLines
      .selectAll("path")
      .data(shown, (c) => c.nom)
      .join("path")
      .attr("class", "bump-line")
      .attr("d", (c) => line(pts(c)))
      .style("stroke", color);
    const gDots = svg.append("g");
    const dots = gDots
      .selectAll("g")
      .data(shown, (c) => c.nom)
      .join("g")
      .selectAll("circle")
      .data((c) =>
        pts(c)
          .filter((p) => p.ok)
          .map((p) => ({ ...p, c })),
      )
      .join("circle")
      .attr("class", "bump-dot")
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.v))
      .attr("r", state.mode === "rank" ? 4 : 3)
      .style("fill", (d) => color(d.c))
      .style("stroke", "var(--surface)")
      .style("stroke-width", 1.5);

    const labelData = (side) =>
      shown
        .map((c) => {
          const i =
            side === "end"
              ? [...years.keys()].reverse().find((k) => ok(c, k))
              : [...years.keys()].find((k) => ok(c, k));
          return i === undefined ? null : { c, i, v: val(c, i) };
        })
        .filter((d) => d && (side === "end" ? d.i === L : d.i === first));
    const endLabels = labelData("end");
    if (state.mode === "pax") {
      endLabels.sort((a, b) => y(a.v) - y(b.v));
      let lastY = -Infinity;
      endLabels.forEach((d) => {
        d.y = Math.max(y(d.v), lastY + 14);
        lastY = d.y;
      });
    }
    const labels = svg
      .append("g")
      .selectAll("text")
      .data(endLabels)
      .join("text")
      .attr("class", "bump-label")
      .attr("x", (d) => x(years[d.i]) + 10)
      .attr("y", (d) => (d.y ?? y(d.v)) + 4)
      .text((d) => (state.mode === "rank" ? `${d.v}. ${d.c.nom}` : d.c.nom));
    let startLabels = null;
    if (!narrow) {
      startLabels = svg
        .append("g")
        .selectAll("text")
        .data(labelData("start").filter((d) => state.mode === "rank" || d.c.pax[d.i] > 3e6))
        .join("text")
        .attr("class", "bump-label")
        .attr("x", (d) => x(years[d.i]) - 10)
        .attr("y", (d) => y(d.v) + 4)
        .attr("text-anchor", "end")
        .text((d) => d.c.nom);
    }

    function highlight() {
      const a = active();
      paths.classed("is-faded", (c) => a && c.nom !== a).classed("is-hot", (c) => c.nom === a);
      dots.classed("is-faded", (d) => a && d.c.nom !== a);
      labels.classed("is-faded", (d) => a && d.c.nom !== a);
      startLabels?.classed("is-faded", (d) => a && d.c.nom !== a);
    }

    // hit layer: nearest carrier at the nearest year
    svg
      .append("rect")
      .attr("x", m.left - 20)
      .attr("y", m.top - 10)
      .attr("width", width - m.left - m.right + 40)
      .attr("height", h - m.top - m.bottom + 20)
      .attr("fill", "transparent")
      .style("touch-action", "pan-y")
      .on("pointermove", (event) => {
        const [px, py] = d3.pointer(event);
        const i = d3.minIndex(years, (yy) => Math.abs(x(yy) - px));
        const cand = shown.filter((c) => ok(c, i));
        if (!cand.length) return;
        const c = d3.least(cand, (c2) => Math.abs(y(val(c2, i)) - py));
        state.hot = c.nom;
        highlight();
        const r = ranks.get(c.nom)[i];
        showTip(event, `${c.nom} en ${years[i]}`, [
          { label: "passagers", value: fmtPax(c.pax[i]), color: color(c) },
          { label: "rang", value: r ? ordinal(r) : "–" },
          { label: "sur un an", value: i > 0 ? fmtPct(pctChange(c.pax[i - 1], c.pax[i])) : "–" },
          { label: c.lowcost ? "compagnie à bas coûts" : "compagnie traditionnelle", value: "" },
        ]);
      })
      .on("pointerleave", () => {
        state.hot = null;
        highlight();
        hideTip();
      })
      .on("click", () => {
        state.pinned = state.pinned === state.hot ? null : state.hot;
        highlight();
      });
    highlight();
  }

  segmented($("#cie-mode"), state.mode, (v) => {
    state.mode = v;
    draw();
  });
  onResize(node, (w) => {
    width = w;
    draw();
  });
  draw();

  // ---------------------------------------------------------------- low-cost share
  lineChart($("#chart-lowcost"), {
    dates: years.map((yy) => toDate(yy)),
    series: [
      {
        key: "lc",
        label: "Part des bas coûts",
        color: LOWCOST_COLOR,
        values: share.map((v) => (isNum(v) ? v * 100 : null)),
        width: 2.5,
      },
    ],
    xDomain: [toDate(years[0]), toDate(years[L])],
    yFormat: (v) => `${fmtNum(v, 0)} %`,
    tipFormat: (v) => `${fmtNum(v, 1)} %`,
    title: (i) => String(years[i]),
    height: 220,
    yZero: true,
    endLabels: false,
  });
}
