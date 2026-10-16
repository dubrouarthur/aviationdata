import * as d3 from "d3";
import { $, el, rich, chips, segmented, showTip, hideTip, onResize } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { toDate, pctChange } from "../lib/series.js";
import { fmtPct, fmtPctAbs, fmtNum } from "../lib/format.js";

const GROUPS = [
  { key: "all", label: "Ensemble", color: "var(--ink)", width: 2.6, parts: null },
  { key: "intl", label: "International", color: "var(--blue)", parts: ["MET_INTL", "OM_INTL"] },
  { key: "rad", label: "Paris–province", color: "var(--magenta)", parts: ["MET_RAD"] },
  { key: "tra", label: "Province–province", color: "var(--teal)", parts: ["MET_TRA"] },
  { key: "om", label: "Métropole–Outre-mer", color: "var(--ochre)", parts: ["MET_OM"], off: true },
];
const SEG_LABEL = {
  MET_INTERIEUR: "Intérieur métropole",
  "MET-OM_ET_OM-OM": "Outre-mer",
  INTL_MC: "International moyen-courrier",
  INTL_LC: "International long-courrier",
};

/** Average trip length (passenger-km / passengers, LSN) and the CO2 change split into traffic vs efficiency. */
export function initDistance(data) {
  const { years, par_faisceau: PF } = {
    years: data.fracture.annual.years,
    par_faisceau: data.fracture.par_faisceau,
  };
  const keysAll = Object.keys(PF);
  const dist = (parts) =>
    years.map((_, i) => {
      const ks = parts || keysAll;
      const pkt = d3.sum(ks, (k) => PF[k]?.pkt[i] ?? 0);
      const pax = d3.sum(ks, (k) => PF[k]?.pax[i] ?? 0);
      return pax ? pkt / pax : null;
    });
  const values = Object.fromEntries(GROUPS.map((g) => [g.key, dist(g.parts)]));
  const L = years.length - 1;
  const co2 = data.co2;
  const [p1, p2] = co2.decomp.periods;

  $("#dist-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Un passager parcourt en moyenne `,
        { b: `${fmtNum(values.all[L])} km` },
        ` par vol en ${years[L]}, contre ${fmtNum(values.all[0])} km en ${years[0]} (`,
        { b: fmtPct(pctChange(values.all[0], values.all[L]), 0) },
        `). Les vols intérieurs reculent, les destinations lointaines progressent.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `De ${p1.from} à ${p1.to}, la hausse du trafic aurait ajouté `,
        { b: `${fmtNum(p1.trafic, 1)} Mt` },
        ` de CO2 à efficacité constante ; des avions plus sobres et mieux remplis en ont retiré `,
        { b: `${fmtNum(-p1.intensite, 1)} Mt` },
        `. Bilan : `,
        {
          b: `${fmtNum(p1.c1 - p1.c0 >= 0 ? p1.c1 - p1.c0 : p1.c0 - p1.c1, 1)} Mt ${p1.c1 >= p1.c0 ? "de plus" : "de moins"}`,
        },
        `. Depuis 2019, les émissions ont reculé de `,
        { b: fmtPctAbs(pctChange(p2.c0, p2.c1), 1) },
        `, pour un trafic quasi stable.`,
      ]),
    ),
  );

  // ---------------------------------------------------------------- distance chart
  const node = $("#chart-dist");
  let on = new Set(GROUPS.filter((g) => !g.off).map((g) => g.key));
  const opts = () => ({
    dates: years.map((y) => toDate(y)),
    series: GROUPS.filter((g) => on.has(g.key)).map((g) => ({ ...g, values: values[g.key] })),
    xDomain: [toDate(years[0]), toDate(years[L])],
    yZero: true,
    yFormat: (v) => `${fmtNum(v)} km`,
    tipFormat: (v) => `${fmtNum(v)} km`,
    title: (i) => `${years[i]}, distance moyenne par passager`,
    height: 300,
    endLabels: false,
    animate: true,
  });
  const chart = lineChart(node, opts());
  on = chips(
    $("#chips-dist"),
    GROUPS.map((g) => ({ key: g.key, label: g.label, color: g.color, on: !g.off })),
    (next) => {
      on = next;
      chart.update(opts());
    },
  );

  // ---------------------------------------------------------------- CO2 waterfall
  const wNode = $("#chart-waterfall");
  let view = "total";
  const periodSeg = $("#co2-period");
  periodSeg.replaceChildren(
    el("button", { type: "button", "data-v": "total", text: "Ensemble" }),
    el("button", { type: "button", "data-v": "seg", text: "Par segment" }),
  );
  segmented(periodSeg, view, (v) => {
    view = v;
    drawW(wNode.clientWidth);
  });

  function drawW(width) {
    wNode.replaceChildren();
    if (view === "seg") return drawSegments(width);
    let run = 0;
    const steps = [];
    const total = (label, v) => {
      steps.push({ label, kind: "total", y0: 0, y1: v, v });
      run = v;
    };
    const effect = (label, v) => {
      steps.push({ label, kind: v >= 0 ? "up" : "down", y0: run, y1: run + v, v });
      run += v;
    };
    total(String(p1.from), p1.c0);
    effect("hausse du trafic", p1.trafic);
    effect("avions plus sobres", p1.intensite);
    total(String(p1.to), p1.c1);
    effect("trafic", p2.trafic);
    effect("sobriété", p2.intensite);
    total(String(p2.to), p2.c1);
    const m = { top: 24, right: 8, bottom: 46, left: 40 };
    const h = 300;
    const x = d3
      .scaleBand()
      .domain(steps.map((_, i) => i))
      .range([m.left, width - m.right])
      .padding(0.22);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(steps, (s) => Math.max(s.y0, s.y1)) * 1.08])
      .range([h - m.bottom, m.top]);
    const svg = d3.select(wNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
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
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", m.left)
      .attr("y", 12)
      .style("font-weight", 500)
      .text("Mt de CO2");
    const color = { total: "var(--ink)", up: "var(--magenta)", down: "var(--teal)" };
    const g = svg.selectAll("g.step").data(steps).join("g").attr("class", "step");
    g.append("rect")
      .attr("x", (_, i) => x(i))
      .attr("width", x.bandwidth())
      .attr("y", (s) => y(Math.max(s.y0, s.y1)))
      .attr("height", (s) => Math.max(1, Math.abs(y(s.y0) - y(s.y1))))
      .attr("rx", 3)
      .style("fill", (s) => color[s.kind])
      .on("pointermove", (event, s) =>
        showTip(event, s.label, [
          {
            label: s.kind === "total" ? "émissions" : "effet",
            value: `${s.kind === "total" ? "" : s.v >= 0 ? "+" : "−"}${fmtNum(Math.abs(s.v), 1)} Mt`,
          },
        ]),
      )
      .on("pointerleave", hideTip);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", (_, i) => x(i) + x.bandwidth() / 2)
      .attr("y", (s) => y(Math.max(s.y0, s.y1)) - 6)
      .attr("text-anchor", "middle")
      .text((s) =>
        s.kind === "total" ? fmtNum(s.v, 1) : `${s.v >= 0 ? "+" : "−"}${fmtNum(Math.abs(s.v), 1)}`,
      );
    // connectors
    steps.slice(0, -1).forEach((s, i) => {
      svg
        .append("line")
        .attr("x1", x(i) + x.bandwidth())
        .attr("x2", x(i + 1))
        .attr("y1", y(s.y1))
        .attr("y2", y(s.y1))
        .style("stroke", "var(--axis)")
        .style("stroke-dasharray", "2 2");
    });
    g.append("text")
      .attr("class", "axis")
      .attr("x", (_, i) => x(i) + x.bandwidth() / 2)
      .attr("y", h - m.bottom + 16)
      .attr("text-anchor", "middle")
      .style("fill", "var(--ink-2)")
      .style("font-size", width < 520 ? "9.5px" : "11px")
      .each(function (s, i) {
        const t = d3.select(this);
        if (width < 520) {
          // narrow: one short word per bar, staggered on two rows so neighbours never collide
          const short = s.kind === "total" ? s.label : i < 3 ? ["trafic", "sobriété"][i - 1] : s.label;
          t.append("tspan").attr("x", t.attr("x")).attr("dy", i % 2 ? 13 : 0).text(short);
          return;
        }
        const words = s.label.split(" ");
        const lines = words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [s.label];
        lines.forEach((line, k) =>
          t
            .append("tspan")
            .attr("x", t.attr("x"))
            .attr("dy", k ? 13 : 0)
            .text(line),
        );
      });
  }

  function drawSegments(width) {
    const segs = Object.entries(co2.decomp.segments).map(([k, d]) => ({ k, ...d }));
    const m = { top: 30, right: 16, bottom: 10, left: 168 };
    const rowH = 54;
    const h = m.top + m.bottom + segs.length * rowH;
    const lim = d3.max(segs, (s) => Math.max(Math.abs(s.trafic), Math.abs(s.intensite))) * 1.15;
    const x = d3
      .scaleLinear()
      .domain([-lim, lim])
      .range([m.left, width - m.right]);
    const svg = d3.select(wNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", m.left)
      .attr("y", 14)
      .style("font-weight", 500)
      .text(`Effets sur les émissions, ${segs[0]?.from}–${segs[0]?.to} (Mt)`);
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", m.top - 4)
      .attr("y2", h - m.bottom)
      .style("stroke", "var(--axis)");
    const g = svg
      .selectAll("g.seg")
      .data(segs)
      .join("g")
      .attr("transform", (_, i) => `translate(0,${m.top + i * rowH})`);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", m.left - 10)
      .attr("y", 22)
      .attr("text-anchor", "end")
      .style("font-weight", 600)
      .text((s) => SEG_LABEL[s.k] || s.k);
    [
      ["trafic", 6, "trafic_pct", "trafic"],
      ["intensite", 26, "intensite_pct", "CO2 par passager-km"],
    ].forEach(([key, dy, pctKey, name]) => {
      g.append("rect")
        .attr("x", (s) => Math.min(x(0), x(s[key])))
        .attr("y", dy)
        .attr("height", 16)
        .attr("width", (s) => Math.max(1, Math.abs(x(s[key]) - x(0))))
        .attr("rx", 3)
        .style("fill", (s) => (s[key] >= 0 ? "var(--magenta)" : "var(--teal)"))
        .on("pointermove", (event, s) =>
          showTip(event, `${SEG_LABEL[s.k] || s.k}, ${name}`, [
            {
              label: "effet sur les émissions",
              value: `${s[key] >= 0 ? "+" : "−"}${fmtNum(Math.abs(s[key]), 2)} Mt`,
            },
            { label: `évolution ${name}`, value: fmtPct(s[pctKey], 0) },
          ]),
        )
        .on("pointerleave", hideTip);
      g.append("text")
        .attr("class", "end-label")
        .style("font-weight", 500)
        .attr("x", (s) => (s[key] >= 0 ? x(s[key]) + 6 : x(s[key]) - 6))
        .attr("y", dy + 12)
        .attr("text-anchor", (s) => (s[key] >= 0 ? "start" : "end"))
        .text((s) => `${name} ${fmtPct(s[pctKey], 0)}`);
    });
  }
  onResize(wNode, drawW);
  drawW(wNode.clientWidth || 500);
}
