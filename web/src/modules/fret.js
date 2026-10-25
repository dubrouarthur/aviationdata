import * as d3 from "d3";
import { $, el, rich, showTip, hideTip, onResize, dataTable } from "../lib/ui.js";
import { addSummary } from "../lib/summary.js";
import { stackedArea } from "../lib/stacked.js";
import { pctChange } from "../lib/series.js";
import { fmtPctAbs, fmtNum } from "../lib/format.js";
import { shortName } from "./names.js";

const kt = (v) => `${fmtNum(v / 1e3, 0)} kt`;
const tonnes = (v) => (v >= 1e6 ? `${fmtNum(v / 1e6, 2)} Mt` : kt(v));

/** Freight and mail by air (LSN by continent; APT for airports). */
export function initFret(data) {
  const f = data.fret;
  const { years, total: T, continents: C } = f;
  const L = years.length - 1;
  const i19 = years.indexOf(2019);
  const i20 = years.indexOf(2020);
  const zero = years.map(() => 0);
  const get = (k) => C[k] || zero;

  // passengers, same LSN source, for the Covid comparison
  const A = data.fracture.annual;
  const pax = (y) => A.TOTAL[A.years.indexOf(y)];
  const paxCovid = pctChange(pax(2019), pax(2020));
  const fretCovid = pctChange(T[i19], T[i20]);
  const peakDom = d3.maxIndex(get("Intérieur"));

  // airports: last year, freight loaded and unloaded
  const AP = data.aeroports;
  const ai = AP.years.length - 1;
  const aptYear = AP.years[ai];
  const apts = AP.airports
    .map((a) => ({ a, v: a.fret?.[ai] ?? 0 }))
    .filter((d) => d.v > 0)
    .sort((p, q) => q.v - p.v);
  // national totals keep the airports below the publication threshold
  const inYear = (arr) => d3.sum(AP.months, (mo, i) => (mo.startsWith(String(aptYear)) ? (arr[i] ?? 0) : 0));
  const aptTotal = inYear(AP.national.fret);
  const top = apts[0];
  const topShare = (top.v / aptTotal) * 100;
  const topPaxShare = (inYear(top.a.pax) / inYear(AP.national.pax)) * 100;

  const share = (k) => (get(k)[L] / T[L]) * 100;
  $("#fret-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${years[L]}, `,
        { b: `${fmtNum(T[L] / 1e6, 2)} millions de tonnes` },
        ` de fret et de courrier ont voyagé en avion, entre la France et le reste du monde ou à l'intérieur du pays. C'est `,
        { b: `${fmtPctAbs(pctChange(T[i19], T[L]), 0)} de moins` },
        ` qu'en 2019 (${fmtNum(T[i19] / 1e6, 2)} Mt).`,
      ]),
    ),
  );
  $("#fret-after").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Le fret a pourtant mieux traversé la crise sanitaire que les passagers. En 2020, il n'avait reculé que de `,
        { b: fmtPctAbs(fretCovid, 0) },
        `, quand les passagers chutaient de `,
        { b: fmtPctAbs(paxCovid, 0) },
        `.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `L'Asie (${kt(get("Asie")[L])}) et l'Europe (${kt(get("Europe")[L])}) en représentent chacune près d'un tiers (`,
        { b: `${fmtPctAbs(share("Asie"), 0)} et ${fmtPctAbs(share("Europe"), 0)}` },
        `), devant l'Amérique (${fmtPctAbs(share("Amérique"), 0)}). Le fret intérieur, lui, a reculé de `,
        { b: fmtPctAbs(pctChange(get("Intérieur")[peakDom], get("Intérieur")[L]), 0) },
        ` depuis son sommet de ${years[peakDom]}.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `Le fret est bien plus concentré que les passagers : ${top.a.nom} en traite `,
        { b: fmtPctAbs(topShare, 0) },
        ` à lui seul, contre ${fmtPctAbs(topPaxShare, 0)} des passagers des aéroports français.`,
      ]),
    ),
  );
  addSummary("fret", {
    value: tonnes(T[L]),
    label: `de fret et de courrier par avion en ${years[L]}, ${fmtPctAbs(pctChange(T[i19], T[L]), 0)} ${T[L] < T[i19] ? "de moins" : "de plus"} qu'en 2019`,
    color: "var(--blue)",
  });

  // ---------------------------------------------------------------- by continent (stacked, largest at the bottom)
  const other = years.map((_, i) => get("Afrique")[i] + get("Océanie")[i]);
  stackedArea($("#chart-fret"), {
    years,
    series: [
      { key: "asie", label: "Asie", color: "var(--blue)", values: get("Asie") },
      { key: "europe", label: "Europe", color: "var(--teal)", values: get("Europe") },
      { key: "amerique", label: "Amérique", color: "var(--ochre)", values: get("Amérique") },
      { key: "autres", label: "Afrique, Océanie", color: "#8d98a5", values: other },
      { key: "france", label: "Vols intérieurs", color: "var(--magenta)", values: get("Intérieur") },
    ],
    yFormat: (v) => (v ? `${fmtNum(v / 1e6, 1)} Mt` : "0"),
    valueFormat: tonnes,
    height: 290,
    events: [
      { year: 2009, label: "Crise de 2008" },
      { year: 2020, label: "Covid" },
    ],
    tableHead: "Année",
  });

  // ---------------------------------------------------------------- airports (thin bars)
  $("#fret-apt-note").textContent =
    `Fret et courrier chargés ou déchargés en ${aptYear}, en milliers de tonnes (kt). Un envoi intérieur compte à son départ et à son arrivée.`;
  const node = $("#chart-fret-apt");
  const rows = apts.slice(0, 8);
  function draw(width) {
    node.replaceChildren();
    const narrow = width < 480;
    const m = { top: 4, right: 12, bottom: 4, left: narrow ? 104 : 132 };
    const step = 34;
    const bh = 20;
    const h = m.top + m.bottom + rows.length * step;
    const x = d3
      .scaleLinear()
      .domain([0, rows[0].v])
      .range([m.left, width - m.right]);
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    const g = svg
      .selectAll("g")
      .data(rows)
      .join("g")
      .attr("transform", (_, i) => `translate(0,${m.top + i * step})`);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", m.left - 10)
      .attr("y", bh / 2 + 4)
      .attr("text-anchor", "end")
      .style("font-weight", (_, i) => (i ? 500 : 700))
      .text((d) => shortName(d.a));
    g.append("rect")
      .attr("x", m.left)
      .attr("y", 0)
      .attr("height", bh)
      .attr("width", (d) => Math.max(2, x(d.v) - m.left))
      .attr("rx", 4)
      .style("fill", (_, i) => (i ? "var(--blue)" : "var(--ink-2)"))
      .on("pointermove", (event, d) =>
        showTip(event, d.a.nom, [
          { label: `fret ${aptYear}`, value: kt(d.v) },
          { label: "part des aéroports", value: fmtPctAbs((d.v / aptTotal) * 100, 1) },
        ]),
      )
      .on("pointerleave", hideTip);
    // value inside the long bar, after the short ones
    g.append("text")
      .attr("class", "end-label")
      .attr("y", bh / 2 + 4)
      .each(function (d, i) {
        const t = d3.select(this);
        const label = i ? kt(d.v) : `${kt(d.v)} · ${fmtPctAbs(topShare, 0)}`;
        const inside = x(d.v) - m.left > label.length * 7 + 16;
        t.attr("x", inside ? x(d.v) - 8 : x(d.v) + 6)
          .attr("text-anchor", inside ? "end" : "start")
          .style("fill", inside ? "#fff" : null)
          .style("stroke", inside ? "none" : null)
          .style("font-weight", 600)
          .text(label);
      });
  }
  onResize(node, draw);
  draw(node.clientWidth || 500);
  dataTable(node, {
    head: ["Aéroport", `Fret ${aptYear} (kt)`, "Part"],
    rows: rows.map((d) => [d.a.nom, fmtNum(d.v / 1e3, 1), fmtPctAbs((d.v / aptTotal) * 100, 1)]),
  });
}
