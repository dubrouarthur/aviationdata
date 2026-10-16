import * as d3 from "d3";
import { $, el, rich, segmented, chips, showTip, hideTip, onResize } from "../lib/ui.js";
import { player } from "../lib/scrolly.js";
import { yoy, isNum, pctChange, sumSeries } from "../lib/series.js";
import { fmtPct, fmtPctAbs, fmtNum, fmtMonth, fmtMonthShort, monthShort } from "../lib/format.js";

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
// year-on-year changes are meaningless while either month sits in the Covid collapse or rebound
const COVID = (m) => m >= "2020-03" && m <= "2023-03";

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
        `. Une hausse qui arrive sept mois après la fermeture du détroit d'Ormuz, qui a fait flamber le prix du kérosène.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `Le croisement avec le trafic est frappant. Entre 2019 et ${lastT}, le prix moyen d'un billet intérieur a ${dom.dPrice >= 0 ? "augmenté" : "baissé"} de `,
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
        .style("font-size", "10.5px")
        .style("font-variant-numeric", "tabular-nums")
        .style("pointer-events", "none")
        .style("fill", (c) => (Math.abs(c.v) > 9 ? "#fff" : "var(--ink-2)"))
        .text((c) => `${c.v > 0 ? "+" : c.v < 0 ? "−" : ""}${fmtNum(Math.abs(c.v), 0)}`);
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
        .style("font-size", "10px")
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

  // ---------------------------------------------------------------- prices x traffic
  const months = P.months.filter((m) => Fr.months.includes(m));
  const pts = Object.fromEntries(
    SEGMENTS.map((s) => {
      const traffic = sumSeries(s.traffic.map((k) => Fr.faisceaux[k] || []));
      const ty = yoy(traffic);
      return [
        s.key,
        months
          .map((m) => {
            const pi = P.months.indexOf(m);
            const ti = Fr.months.indexOf(m);
            return { m, x: ty[ti], y: yoyOf[s.price]?.[pi] };
          })
          .filter((p) => isNum(p.x) && isNum(p.y) && !COVID(p.m)),
      ];
    }),
  );
  const allMonths = [...new Set(Object.values(pts).flatMap((arr) => arr.map((p) => p.m)))].sort();
  const sNode = $("#chart-pxt");
  let on = new Set(SEGMENTS.map((s) => s.key));
  let focus = allMonths.at(-1);
  on = chips(
    $("#chips-pxt"),
    SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color })),
    (next) => {
      on = next;
      drawScatter(sNode.clientWidth);
    },
  );
  function drawScatter(width) {
    sNode.replaceChildren();
    const h = Math.min(520, Math.max(340, width * 0.55));
    const m = { top: 16, right: 16, bottom: 40, left: 52 };
    const all = SEGMENTS.filter((s) => on.has(s.key)).flatMap((s) => pts[s.key]);
    const xl = Math.max(15, d3.quantile(all.map((p) => Math.abs(p.x)).sort(d3.ascending), 0.98) || 15);
    const yl = Math.max(15, d3.quantile(all.map((p) => Math.abs(p.y)).sort(d3.ascending), 0.98) || 15);
    const x = d3
      .scaleLinear()
      .domain([-xl, xl])
      .nice()
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain([-yl, yl])
      .nice()
      .range([h - m.bottom, m.top]);
    const xTicks = Math.max(4, Math.min(8, Math.floor((width - m.left - m.right) / 64)));
    const narrow = width < 560;
    const svg = d3.select(sNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(xTicks)
          .tickSize(-(h - m.top - m.bottom))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickSize(-(width - m.left - m.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(xTicks)
          .tickFormat((v) => `${fmtNum(v)} %`)
          .tickSizeOuter(0),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickFormat((v) => `${fmtNum(v)} %`)
          .tickSize(0)
          .tickPadding(6),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", m.top)
      .attr("y2", h - m.bottom)
      .style("stroke", "var(--ink-2)")
      .style("stroke-opacity", 0.5);
    svg
      .append("line")
      .attr("x1", m.left)
      .attr("x2", width - m.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .style("stroke", "var(--ink-2)")
      .style("stroke-opacity", 0.5);
    // quadrant captions; on narrow screens they wrap onto two lines to stay in their corner
    const q = (tx, ty, text, anchor, below) => {
      const t = svg
        .append("text")
        .attr("class", "end-label")
        .style("font-weight", 500)
        .style("fill", "var(--muted)")
        .attr("y", ty)
        .attr("text-anchor", anchor);
      const lines = narrow ? text.split(", ").map((l, k, a) => (k < a.length - 1 ? `${l},` : l)) : [text];
      lines.forEach((line, k) =>
        t
          .append("tspan")
          .attr("x", tx)
          .attr("dy", k ? 13 : below ? -(lines.length - 1) * 13 : 0)
          .text(line),
      );
    };
    q(width - m.right - 6, m.top + 14, "plus cher, plus de passagers", "end");
    q(m.left + 6, m.top + 14, "plus cher, moins de passagers", "start");
    q(m.left + 6, h - m.bottom - 8, "moins cher, moins de passagers", "start", true);
    q(width - m.right - 6, h - m.bottom - 8, "moins cher, plus de passagers", "end", true);
    const tags = [];
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", width - m.right)
      .attr("y", h - 6)
      .attr("text-anchor", "end")
      .style("font-weight", 500)
      .text("trafic sur un an →");
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", m.left + 4)
      .attr("y", m.top - 4)
      .style("font-weight", 500)
      .text("↑ prix sur un an");
    const fIdx = allMonths.indexOf(focus);
    for (const s of SEGMENTS.filter((seg) => on.has(seg.key))) {
      const arr = pts[s.key];
      svg
        .append("g")
        .selectAll("circle")
        .data(arr)
        .join("circle")
        .attr("cx", (p) => x(Math.max(-xl, Math.min(xl, p.x))))
        .attr("cy", (p) => y(Math.max(-yl, Math.min(yl, p.y))))
        .attr("r", 3)
        .style("fill", s.color)
        .style("opacity", 0.16);
      const trail = arr.filter((p) => {
        const k = allMonths.indexOf(p.m);
        return k <= fIdx && k > fIdx - 12;
      });
      svg
        .append("path")
        .attr(
          "d",
          d3
            .line()
            .x((p) => x(Math.max(-xl, Math.min(xl, p.x))))
            .y((p) => y(Math.max(-yl, Math.min(yl, p.y))))
            .curve(d3.curveCatmullRom)(trail),
        )
        .style("fill", "none")
        .style("stroke", s.color)
        .style("stroke-width", 1.6)
        .style("opacity", 0.7);
      svg
        .append("g")
        .selectAll("circle")
        .data(trail)
        .join("circle")
        .attr("cx", (p) => x(Math.max(-xl, Math.min(xl, p.x))))
        .attr("cy", (p) => y(Math.max(-yl, Math.min(yl, p.y))))
        .attr("r", (p) => (p.m === focus ? 7 : 3.4))
        .style("fill", s.color)
        .style("stroke", "var(--card)")
        .style("stroke-width", (p) => (p.m === focus ? 2 : 1))
        .on("pointermove", (event, p) =>
          showTip(event, `${s.label}, ${fmtMonth(p.m)}`, [
            { label: "trafic sur un an", value: fmtPct(p.x), color: s.color },
            { label: "prix sur un an", value: fmtPct(p.y) },
          ]),
        )
        .on("pointerleave", hideTip);
      const cur = trail.find((p) => p.m === focus);
      if (cur)
        tags.push({
          x: x(Math.max(-xl, Math.min(xl, cur.x))),
          y: y(Math.max(-yl, Math.min(yl, cur.y))) + 4,
          text: narrow ? s.short : s.label,
        });
    }
    // current-month labels: push apart vertically, flip left near the right edge
    tags.sort((a, b) => a.y - b.y);
    tags.forEach((t, k) => {
      if (k && t.y - tags[k - 1].y < 14) t.y = tags[k - 1].y + 14;
    });
    for (const t of tags) {
      const tw = t.text.length * 6.4;
      t.anchor = t.x + 10 + tw <= width - m.right || t.x - 10 - tw < m.left ? "start" : "end";
      t.lx = t.anchor === "start" ? Math.min(t.x + 10, width - m.right - tw) : t.x - 10;
    }
    svg
      .append("g")
      .selectAll("text")
      .data(tags)
      .join("text")
      .attr("class", "end-label")
      .attr("text-anchor", (t) => t.anchor)
      .attr("x", (t) => t.lx)
      .attr("y", (t) => t.y)
      .text((t) => t.text);
  }
  player({
    button: $("#pxt-play"),
    slider: $("#pxt-slider"),
    output: $("#pxt-out"),
    values: allMonths,
    interval: 260,
    format: fmtMonthShort,
    labels: { play: "Animer les mois", pause: "Mettre en pause" },
    onChange: (m) => {
      focus = m;
      drawScatter(sNode.clientWidth);
    },
  });
  onResize(sNode, drawScatter);
  drawScatter(sNode.clientWidth || 900);
}
