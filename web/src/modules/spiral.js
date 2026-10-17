import * as d3 from "d3";
import { $, el, rich, segmented, showTip, hideTip, onResize, reducedMotion, cssVar } from "../lib/ui.js";
import { sumSeries, pctChange, isNum } from "../lib/series.js";
import { fmtPax, fmtPct, fmtMonth, monthShort, fmtNum } from "../lib/format.js";
import { whileVisible } from "../lib/scrolly.js";

/** 35 years as concentric rings: one ring per year (1990 at the centre), one sector per month. */
export function initSpiral(data) {
  const { months, faisceaux: F } = data.fracture;
  const intl = sumSeries([F.MET_INTL, F.OM_INTL].filter(Boolean));
  const nat = sumSeries([F.MET_RAD, F.MET_TRA, F.MET_OM, F.OM_OM].filter(Boolean));
  const total = sumSeries([intl, nat]);
  // multi-hue ramps built from the site inks (ochre, teal, blue, ink / ochre, magenta, plum), lightness falling
  // steadily from one end to the other, so that years and seasons stay distinct and the order stays readable
  const BLUES = [
    "#fbf5e4",
    "#f3dc9c",
    "#c9dba0",
    "#7cc0a6",
    "#3a9bb0",
    "#2a78d6",
    "#1d4f9c",
    "#122a52",
    "#0b1726",
  ];
  const MAGENTAS = [
    "#fcf5e8",
    "#f6dba6",
    "#f0b383",
    "#e2877f",
    "#cc5687",
    "#b5267e",
    "#7f1660",
    "#47103c",
    "#1f0a1c",
  ];
  const SERIES = {
    total: { label: "Tous les vols", values: total, color: "--blue", ramp: BLUES },
    intl: { label: "International", values: intl, color: "--blue", ramp: BLUES },
    nat: { label: "Intérieur", values: nat, color: "--magenta", ramp: MAGENTAS },
  };
  const years = [...new Set(months.map((m) => +m.slice(0, 4)))];
  const node = $("#chart-spirale");
  let mode = "total";
  let width = node.clientWidth || 600;
  let animated = false;

  // ---------------------------------------------------------------- computed text
  const peakI = d3.maxIndex(total);
  const covidI = d3.minIndex(total.map((v, i) => (months[i] >= "2020-01" ? v : Infinity)));
  const ysum = (arr, y) => d3.sum(months.map((m, i) => (m.startsWith(String(y)) ? arr[i] : 0)));
  const share = (y) => (ysum(nat, y) / ysum(total, y)) * 100;
  const lastY = years.at(-1);
  $("#spirale-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Le mois le plus chargé de l'histoire est ${fmtMonth(months[peakI])}, avec `,
        { b: fmtPax(total[peakI]) },
        ` de passagers. Le plus vide, ${fmtMonth(months[covidI])}, n'en compte que `,
        { b: fmtNum(total[covidI]) },
        `.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `En vue « Intérieur », les anneaux extérieurs pâlissent : les vols intérieurs pesaient `,
        { b: `${fmtNum(share(years[0]), 0)} %` },
        ` du trafic en ${years[0]}, `,
        { b: `${fmtNum(share(2000), 0)} %` },
        ` en 2000, et seulement `,
        { b: `${fmtNum(share(lastY), 0)} %` },
        ` en ${lastY}.`,
      ]),
    ),
  );

  // ---------------------------------------------------------------- drawing
  function draw() {
    node.replaceChildren();
    const S = Math.min(width, 660);
    const H = S + 58; // room under the rings for the colour legend
    const cx = width / 2;
    const cy = S / 2;
    const r0 = S * 0.1;
    const r1 = S * 0.43;
    const gap = 0.42; // radians left open at the top for the year labels
    const ring = (r1 - r0) / years.length;
    const a0 = gap / 2;
    const step = (2 * Math.PI - gap) / 12;
    const { values, color, ramp } = SERIES[mode];
    const vmax = d3.max(values) || 1;
    // the ramp starts just under the quietest normal month (Covid months excluded), so the colours spread over
    // the real range of the data; anything lower, like the Covid hole, takes the lightest colour
    const normal = values.filter((v, i) => isNum(v) && !(months[i] >= "2020-03" && months[i] <= "2021-12"));
    const unit = vmax > 5e6 ? 5e5 : 1e5;
    const vmin = Math.floor((d3.quantile(normal.sort(d3.ascending), 0.01) * 0.9) / unit) * unit;
    const scale = d3.scaleSequential(d3.interpolateRgbBasis(ramp)).domain([vmin, vmax]).clamp(true);
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${H}`).attr("height", H);
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);
    const arc = d3.arc().padAngle(0.006).cornerRadius(1.2);
    const cells = months.map((m, i) => {
      const yi = years.indexOf(+m.slice(0, 4));
      const mi = +m.slice(5, 7) - 1;
      return { m, i, yi, mi, v: values[i] };
    });
    const paths = g
      .append("g")
      .selectAll("path")
      .data(cells)
      .join("path")
      .attr("d", (d) =>
        arc({
          innerRadius: r0 + d.yi * ring + 0.4,
          outerRadius: r0 + (d.yi + 1) * ring - 0.4,
          startAngle: a0 + d.mi * step,
          endAngle: a0 + (d.mi + 1) * step,
        }),
      )
      .style("fill", (d) => (isNum(d.v) ? scale(d.v) : "transparent"))
      .on("pointermove", (event, d) => {
        const prev = values[d.i - 12];
        showTip(event, fmtMonth(d.m), [
          { label: "passagers", value: fmtPax(d.v), color: cssVar(color) },
          ...(isNum(prev) ? [{ label: "sur un an", value: fmtPct(pctChange(prev, d.v)) }] : []),
        ]);
        hl.attr(
          "d",
          d3.arc()({
            innerRadius: r0 + d.yi * ring,
            outerRadius: r0 + (d.yi + 1) * ring,
            startAngle: a0,
            endAngle: 2 * Math.PI - a0,
          }),
        ).style("display", null);
      })
      .on("pointerleave", () => {
        hideTip();
        hl.style("display", "none");
      });
    const hl = g
      .append("path")
      .style("fill", "none")
      .style("stroke", "var(--ochre)")
      .style("stroke-width", 2)
      .style("display", "none")
      .style("pointer-events", "none");

    // month labels around the outside
    g.append("g")
      .selectAll("text")
      .data(d3.range(12))
      .join("text")
      .attr("class", "end-label")
      .style("font-weight", 500)
      .style("fill", "var(--muted)")
      .attr("text-anchor", "middle")
      .attr("x", (m) => Math.sin(a0 + (m + 0.5) * step) * (r1 + 16))
      .attr("y", (m) => -Math.cos(a0 + (m + 0.5) * step) * (r1 + 16) + 4)
      .text((m) => (width < 480 ? monthShort(m).slice(0, 1).toUpperCase() : monthShort(m)));

    // year labels in the top gap
    const marks = years.filter((y) => y % 5 === 0 || y === years.at(-1) || y === years[0]);
    g.append("g")
      .selectAll("text")
      .data(marks)
      .join("text")
      .attr("class", "end-label")
      .style("font-size", "10.5px")
      .attr("text-anchor", "middle")
      .attr("x", 0)
      .attr("y", (y) => -(r0 + (years.indexOf(y) + 0.5) * ring) + 3.5)
      .text((y) => (ring < 6 && y % 10 !== 0 && y !== years.at(-1) ? "" : y));

    // annotation: the Covid ring, pointing left (inside the frame)
    const y20 = years.indexOf(2020);
    if (y20 >= 0) {
      const ang = a0 + 9.5 * step;
      const rr = r0 + (y20 + 0.5) * ring;
      const x1 = Math.sin(ang) * rr;
      const y1 = -Math.cos(ang) * rr;
      const x2 = -Math.min(width / 2 - 8, r1 + 30);
      const y2 = y1 - 30;
      g.append("path")
        .attr("d", `M${x1},${y1} L${x1 - 18},${y2} L${x2 + 2},${y2}`)
        .style("fill", "none")
        .style("stroke", "var(--ink-2)")
        .style("stroke-width", 1);
      g.append("text")
        .attr("class", "end-label")
        .attr("x", x2)
        .attr("y", y2 - 6)
        .text("2020 : le trou du Covid");
    }

    // colour legend: the ramp, its two ends written underneath, "passagers par mois" as its title
    const LW = Math.min(240, width - 16);
    const lg = svg.append("g").attr("transform", `translate(${Math.max(8, cx - S / 2 + 4)},${H - 34})`);
    const grad = svg.append("defs").append("linearGradient").attr("id", "spiral-ramp");
    for (let k = 0; k <= 10; k++)
      grad
        .append("stop")
        .attr("offset", `${k * 10}%`)
        .attr("stop-color", scale(vmin + ((vmax - vmin) * k) / 10));
    lg.append("rect").attr("width", LW).attr("height", 10).attr("rx", 5).style("fill", "url(#spiral-ramp)");
    const mln = (v) => `${fmtNum(v / 1e6, 1)} M`;
    lg.append("text")
      .attr("class", "end-label")
      .attr("x", 0)
      .attr("y", -6)
      .style("font-weight", 600)
      .text("Passagers par mois");
    lg.append("text")
      .attr("class", "end-label")
      .attr("x", 0)
      .attr("y", 26)
      .style("font-weight", 500)
      .text(`${mln(vmin)} ou moins`);
    lg.append("text")
      .attr("class", "end-label")
      .attr("x", LW)
      .attr("y", 26)
      .attr("text-anchor", "end")
      .style("font-weight", 500)
      .text(mln(vmax));

    if (!animated && !reducedMotion()) paths.style("opacity", 0);
    return paths;
  }

  let paths = draw();
  const reveal = () => {
    animated = true;
    paths
      .style("opacity", 0)
      .transition()
      .delay((d) => d.yi * 55 + d.mi * 4)
      .duration(380)
      .style("opacity", 1);
  };
  whileVisible(
    node,
    () => !animated && !reducedMotion() && reveal(),
    () => {},
  );
  segmented($("#spirale-mode"), mode, (v) => {
    mode = v;
    paths = draw();
  });
  $("#spirale-replay").addEventListener("click", () => {
    paths = draw();
    reveal();
  });
  onResize(node, (w) => {
    width = w;
    paths = draw();
  });
}
