import * as d3 from "d3";
import {
  $,
  el,
  rich,
  segmented,
  showTip,
  hideTip,
  onResize,
  reducedMotion,
  dataTable,
  keyFigures,
} from "../lib/ui.js";
import { whileVisible } from "../lib/scrolly.js";
import { yoy, isNum, pctChange } from "../lib/series.js";
import { fmtPct, fmtPctAbs, fmtNum, fmtMonth, monthShort } from "../lib/format.js";

const HEAT = [
  { key: "FRA_ENS", label: "Tous départs" },
  { key: "MET_INTER_MET", label: "Intérieur" },
  { key: "MET_INTER_OM", label: "Outre-mer" },
  { key: "MET_INTAL_MC", label: "Moyen-courrier" },
  { key: "MET_INTAL_LC", label: "Long-courrier" },
];
const SEGMENTS = [
  {
    key: "dom",
    label: "Intérieur métropole",
    short: "Intérieur",
    color: "var(--magenta)",
    price: "MET_INTER_MET",
    traffic: ["MET_RAD", "MET_TRA"],
  },
  {
    key: "om",
    label: "Métropole–Outre-mer",
    short: "Outre-mer",
    color: "var(--ochre)",
    price: "MET_INTER_OM",
    traffic: ["MET_OM"],
  },
  {
    key: "intl",
    label: "International",
    short: "International",
    color: "var(--blue)",
    price: "MET_INTAL_TOT",
    traffic: ["MET_INTL"],
  },
];

/** Airfares (IPTAP) on their own and crossed with traffic (LSN) by segment. */
export function initPrices(data) {
  const P = data.prix;
  const Fr = data.fracture;
  const L = P.months.length - 1;
  const yoyOf = Object.fromEntries(Object.keys(P.series).map((k) => [k, yoy(P.series[k])]));
  const cur = yoyOf.FRA_ENS[L];
  let since = null;
  for (let i = L - 1; i >= 0 && cur > 0; i--) {
    if (isNum(yoyOf.FRA_ENS[i]) && yoyOf.FRA_ENS[i] >= cur) {
      since = P.months[i];
      break;
    }
  }
  // months elapsed since the Strait of Hormuz was all but closed (end of February 2026)
  const [ly, lm] = P.months[L].split("-").map(Number);
  const hormuz = (ly - 2026) * 12 + (lm - 2);
  const NUMBERS = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
  ];
  // crossing: average price level vs traffic, 2019 -> last full traffic year, by segment
  const lastT = Fr.annual.years.at(-1);
  const meanYear = (arr, months, y) =>
    d3.mean(months.map((m, i) => (m.startsWith(String(y)) ? arr[i] : null)).filter(isNum));
  const trafficYear = (keys, y) =>
    d3.sum(keys, (k) =>
      d3.sum(Fr.months.map((m, i) => (m.startsWith(String(y)) ? (Fr.faisceaux[k]?.[i] ?? 0) : 0))),
    );
  const cross = SEGMENTS.map((s) => ({
    ...s,
    dPrice: pctChange(
      meanYear(P.series[s.price], P.months, 2019),
      meanYear(P.series[s.price], P.months, lastT),
    ),
    dTraffic: pctChange(trafficYear(s.traffic, 2019), trafficYear(s.traffic, lastT)),
  }));
  const dom = cross[0];
  const intl = cross[2];

  $("#prix-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${fmtMonth(P.months[L])}, un billet au départ de France coûtait `,
        { b: fmtPctAbs(cur) },
        cur >= 0 ? ` de plus qu'un an plus tôt` : ` de moins qu'un an plus tôt`,
        since ? `, la plus forte hausse depuis ${fmtMonth(since)}` : "",
        `.`,
        hormuz > 0 && cur > 0
          ? ` Cette hausse arrive ${hormuz === 1 ? "un mois" : `${NUMBERS[hormuz] || hormuz} mois`} après la quasi-fermeture du détroit d'Ormuz, fin février 2026, qui a fait flamber le prix du kérosène.`
          : "",
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `Le croisement avec le trafic est frappant. Entre 2019 et ${lastT}, les prix des billets intérieurs ont ${dom.dPrice >= 0 ? "augmenté" : "baissé"} en moyenne de `,
        { b: fmtPctAbs(dom.dPrice, 0) },
        ` pendant que le trafic intérieur ${dom.dTraffic >= 0 ? "progressait" : "reculait"} de `,
        { b: fmtPctAbs(dom.dTraffic, 0) },
        `. À l'international, les prix ont ${intl.dPrice >= 0 ? "pris" : "perdu"} `,
        { b: fmtPctAbs(intl.dPrice, 0) },
        `, et le trafic a ${intl.dTraffic >= 0 ? "tout de même progressé" : "reculé"} de `,
        { b: fmtPctAbs(intl.dTraffic, 0) },
        `.`,
      ]),
    ),
  );

  keyFigures($("#kf-prix"), [
    {
      value: fmtPct(dom.dPrice, 0),
      label: `prix des billets intérieurs entre 2019 et ${lastT}`,
      color: "var(--magenta)",
    },
    { value: fmtPct(dom.dTraffic, 0), label: "de passagers sur ces mêmes lignes", color: "var(--blue)" },
  ]);

  // ---------------------------------------------------------------- heatmap
  const heatNode = $("#chart-heat");
  let heatKey = "FRA_ENS";
  $("#heat-series").replaceChildren(
    ...HEAT.filter((h) => P.series[h.key]).map((h) =>
      el("button", { type: "button", "data-v": h.key, text: h.label }),
    ),
  );
  segmented($("#heat-series"), heatKey, (v) => {
    heatKey = v;
    drawHeat(heatNode.clientWidth);
  });
  function drawHeat(width) {
    heatNode.replaceChildren();
    const vals = yoyOf[heatKey];
    const cells = P.months
      .map((m, i) => ({ m, i, y: +m.slice(0, 4), mo: +m.slice(5, 7) - 1, v: vals[i] }))
      .filter((c) => isNum(c.v));
    const ys = [...new Set(cells.map((c) => c.y))];
    const narrow = width < 460;
    const m = { top: 26, right: 8, bottom: narrow ? 46 : 30, left: 40 };
    const cw = (width - m.left - m.right) / 12;
    const ch = Math.max(20, Math.min(30, cw * 0.62));
    const h = m.top + m.bottom + ys.length * ch;
    const lim = 15;
    const color = (v) => {
      const t = Math.max(-1, Math.min(1, v / lim));
      return t >= 0
        ? d3.interpolateRgb("#f1f3f1", "#b5267e")(t)
        : d3.interpolateRgb("#f1f3f1", "#2a78d6")(-t);
    };
    const svg = d3.select(heatNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .selectAll("text")
      .data(d3.range(12))
      .join("text")
      .attr("class", "axis")
      .attr("x", (k) => m.left + k * cw + cw / 2)
      .attr("y", m.top - 8)
      .attr("text-anchor", "middle")
      .style("fill", "var(--muted)")
      .style("font-size", "11px")
      .text((k) => (cw < 34 ? monthShort(k).slice(0, 1).toUpperCase() : monthShort(k)));
    svg
      .append("g")
      .selectAll("text")
      .data(ys)
      .join("text")
      .attr("class", "axis")
      .attr("x", m.left - 8)
      .attr("y", (_, k) => m.top + k * ch + ch / 2 + 4)
      .attr("text-anchor", "end")
      .style("fill", "var(--muted)")
      .style("font-size", "11px")
      .text((y) => y);
    const g = svg
      .append("g")
      .selectAll("g")
      .data(cells)
      .join("g")
      .attr("transform", (c) => `translate(${m.left + c.mo * cw},${m.top + ys.indexOf(c.y) * ch})`);
    g.append("rect")
      .attr("x", 1)
      .attr("y", 1)
      .attr("width", cw - 2)
      .attr("height", ch - 2)
      .attr("rx", 3)
      .style("fill", (c) => color(c.v))
      .style("stroke", (c) => (c.i === L ? "var(--ink)" : "none"))
      .style("stroke-width", 2)
      .on("pointermove", (event, c) =>
        showTip(event, `${HEAT.find((x) => x.key === heatKey).label}, ${fmtMonth(c.m)}`, [
          { label: "sur un an", value: fmtPct(c.v) },
          { label: "indice (2023 = 100)", value: fmtNum(P.series[heatKey][c.i], 1) },
        ]),
      )
      .on("pointerleave", hideTip);
    if (cw >= 40)
      g.append("text")
        .attr("x", cw / 2)
        .attr("y", ch / 2 + 4)
        .attr("text-anchor", "middle")
        .style("font-size", "11.5px")
        .style("font-variant-numeric", "tabular-nums")
        .style("pointer-events", "none")
        .style("fill", (c) => (Math.abs(c.v) > 9 ? "#fff" : "var(--ink-2)"))
        .text((c) => {
          const r = Math.round(c.v);
          return `${r > 0 ? "+" : r < 0 ? "−" : ""}${fmtNum(Math.abs(r), 0)}`;
        });
    // legend
    const lg = svg.append("g").attr("transform", `translate(${m.left},${h - (narrow ? 28 : 12)})`);
    const ramp = [-lim, -lim / 2, 0, lim / 2, lim];
    ramp.forEach((v, k) => {
      lg.append("rect")
        .attr("x", k * 34)
        .attr("y", -9)
        .attr("width", 32)
        .attr("height", 10)
        .attr("rx", 2)
        .style("fill", color(v));
      lg.append("text")
        .attr("class", "axis")
        .attr("x", k * 34 + 16)
        .attr("y", 12)
        .attr("text-anchor", "middle")
        .style("fill", "var(--muted)")
        .style("font-size", "11px")
        .text(`${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} %`);
    });
    lg.append("text")
      .attr("class", "axis")
      .attr("x", narrow ? 0 : 5 * 34 + 8)
      .attr("y", narrow ? 27 : 0)
      .style("fill", "var(--ink-2)")
      .style("font-size", "11px")
      .text("baisse en bleu, hausse en magenta");
  }
  onResize(heatNode, drawHeat);
  drawHeat(heatNode.clientWidth || 900);

  // ---------------------------------------------------------------- prices vs traffic: the scissors
  // annual averages, both rebased to 2019 = 100, one small chart per segment
  const sNode = $("#chart-scissors");
  const fullYear = (months, y) => months.filter((m) => m.startsWith(String(y))).length === 12;
  const span = d3
    .range(+P.months[0].slice(0, 4), lastT + 1)
    .filter((y) => fullYear(P.months, y) && fullYear(Fr.months, y));
  const ORDER = ["dom", "intl", "om"];
  const panels = ORDER.map((k) => SEGMENTS.find((s) => s.key === k)).map((s) => {
    const p0 = meanYear(P.series[s.price], P.months, 2019);
    const t0 = trafficYear(s.traffic, 2019);
    return {
      ...s,
      pIdx: span.map((y) => (meanYear(P.series[s.price], P.months, y) / p0) * 100),
      tIdx: span.map((y) => (trafficYear(s.traffic, y) / t0) * 100),
    };
  });
  const yMax = d3.max(panels, (s) => d3.max([...s.pIdx, ...s.tIdx])) * 1.06;
  const yMin = Math.min(
    20,
    d3.min(panels, (s) => d3.min([...s.pIdx, ...s.tIdx])),
  );
  const i19 = span.indexOf(2019);
  let animated = false;

  sNode.replaceChildren(
    el("div", { class: "legend-row" }, [
      el("span", { class: "lg" }, [el("i", { style: "--c:var(--magenta)" }), "Prix des billets"]),
      el("span", { class: "lg" }, [el("i", { style: "--c:var(--blue)" }), "Passagers"]),
      el("span", { class: "lg" }, [el("i", { class: "area" }), `Écart depuis 2019`]),
    ]),
    el(
      "div",
      { class: "sm-grid" },
      panels.map((s) =>
        el("div", { class: "sm", "data-k": s.key }, [el("h4", { text: s.label }), el("div")]),
      ),
    ),
  );

  function drawPanel(host, s, animate) {
    const width = host.clientWidth;
    host.replaceChildren();
    if (!width) return;
    const h = 250;
    const m = { top: 12, right: 86, bottom: 24, left: 34 };
    const x = d3
      .scaleLinear()
      .domain(d3.extent(span))
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .nice()
      .range([h - m.bottom, m.top]);
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(-(width - m.left - m.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(
            span
              .filter((v) => v % 5 === 0 || v === span[0] || v === span.at(-1))
              .filter((v, k, a) => k === 0 || v - a[k - 1] > 2),
          )
          .tickFormat(String)
          .tickSizeOuter(0),
      );
    // 2019 = 100 reference
    svg
      .append("line")
      .attr("class", "ref-line")
      .attr("x1", m.left)
      .attr("x2", width - m.right)
      .attr("y1", y(100))
      .attr("y2", y(100));
    svg
      .append("line")
      .attr("x1", x(2019))
      .attr("x2", x(2019))
      .attr("y1", m.top)
      .attr("y2", h - m.bottom)
      .style("stroke", "var(--axis)")
      .style("stroke-dasharray", "2 3");
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", x(2019) - 4)
      .attr("y", m.top + 10)
      .attr("text-anchor", "end")
      .style("font-weight", 500)
      .style("font-size", "11.5px")
      .text("2019 = 100");
    // the gap that opens after 2019
    const after = span.map((yr, k) => ({ yr, p: s.pIdx[k], t: s.tIdx[k] })).filter((d) => d.yr >= 2019);
    const gap = svg
      .append("path")
      .attr(
        "d",
        d3
          .area()
          .x((d) => x(d.yr))
          .y0((d) => y(d.t))
          .y1((d) => y(d.p))
          .curve(d3.curveMonotoneX)(after),
      )
      .style("fill", "var(--magenta-soft)")
      .style("opacity", 0.7);
    const line = (vals) =>
      d3
        .line()
        .x((_, k) => x(span[k]))
        .y((v) => y(v))
        .curve(d3.curveMonotoneX)(vals);
    const paths = [
      ["tIdx", "var(--blue)"],
      ["pIdx", "var(--magenta)"],
    ].map(([k, color]) =>
      svg
        .append("path")
        .attr("class", "series-line")
        .attr("d", line(s[k]))
        .style("stroke", color)
        .style("stroke-width", 2.6),
    );
    // end labels, pushed apart when the two lines finish close together
    const L2 = span.length - 1;
    const ends = [
      { v: s.pIdx[L2], text: `prix ${fmtPct(s.pIdx[L2] - 100, 0)}`, color: "var(--magenta)" },
      { v: s.tIdx[L2], text: `trafic ${fmtPct(s.tIdx[L2] - 100, 0)}`, color: "var(--blue)" },
    ].map((e) => ({ ...e, py: y(e.v) }));
    ends.sort((a, b) => a.py - b.py);
    if (ends[1].py - ends[0].py < 15) {
      const mid = (ends[0].py + ends[1].py) / 2;
      ends[0].py = mid - 7.5;
      ends[1].py = mid + 7.5;
    }
    const labels = svg
      .append("g")
      .selectAll("text")
      .data(ends)
      .join("text")
      .attr("class", "end-label")
      .attr("x", width - m.right + 6)
      .attr("y", (e) => e.py + 4)
      .style("fill", "var(--ink)")
      .style("font-weight", 700)
      .text((e) => e.text);
    const dots = svg
      .append("g")
      .selectAll("circle")
      .data(ends)
      .join("circle")
      .attr("cx", x(span[L2]))
      .attr("cy", (e) => y(e.v))
      .attr("r", 3.5)
      .style("fill", (e) => e.color);

    // hover: one tooltip for both lines
    const cross = svg
      .append("line")
      .attr("class", "crosshair")
      .attr("y1", m.top)
      .attr("y2", h - m.bottom)
      .style("display", "none");
    svg
      .append("rect")
      .attr("x", m.left)
      .attr("y", 0)
      .attr("width", width - m.left - m.right)
      .attr("height", h)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [px] = d3.pointer(event);
        const k = Math.max(0, Math.min(L2, Math.round(x.invert(px) - span[0])));
        cross.attr("x1", x(span[k])).attr("x2", x(span[k])).style("display", null);
        showTip(event, `${s.label}, ${span[k]}`, [
          { label: "prix (2019 = 100)", value: fmtNum(s.pIdx[k], 0), color: "var(--magenta)" },
          { label: "passagers (2019 = 100)", value: fmtNum(s.tIdx[k], 0), color: "var(--blue)" },
        ]);
      })
      .on("pointerleave", () => {
        cross.style("display", "none");
        hideTip();
      });

    if (animate) {
      for (const pth of paths) {
        const len = pth.node().getTotalLength();
        pth
          .style("stroke-dasharray", `${len} ${len}`)
          .style("stroke-dashoffset", len)
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .style("stroke-dashoffset", 0);
      }
      gap.style("opacity", 0).transition().delay(900).duration(700).style("opacity", 0.7);
      labels.style("opacity", 0).transition().delay(1300).duration(400).style("opacity", 1);
      dots.style("opacity", 0).transition().delay(1300).duration(400).style("opacity", 1);
    }
  }
  function drawScissors(animate = false) {
    sNode.querySelectorAll(".sm").forEach((div) => {
      const s = panels.find((q) => q.key === div.dataset.k);
      drawPanel(div.lastElementChild, s, animate);
    });
  }
  const pending = !reducedMotion();
  whileVisible(
    sNode,
    () => {
      if (pending && !animated) {
        animated = true;
        drawScissors(true);
      }
    },
    () => {},
  );
  onResize(sNode, () => drawScissors(false));
  drawScissors(false);
  dataTable(sNode, {
    head: ["Année (2019 = 100)", ...panels.flatMap((q) => [`${q.label} : prix`, `${q.label} : passagers`])],
    rows: span.map((yr, k) => [
      String(yr),
      ...panels.flatMap((q) => [fmtNum(q.pIdx[k], 0), fmtNum(q.tIdx[k], 0)]),
    ]),
  });
}
