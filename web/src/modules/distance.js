import * as d3 from "d3";
import { $, el, rich, chips } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { toDate, pctChange } from "../lib/series.js";
import { fmtPct, fmtNum } from "../lib/format.js";

const GROUPS = [
  { key: "all", label: "Ensemble", color: "var(--ink)", width: 2.6, parts: null },
  { key: "intl", label: "International", color: "var(--blue)", parts: ["MET_INTL", "OM_INTL"] },
  { key: "rad", label: "Paris–province", color: "var(--magenta)", parts: ["MET_RAD"] },
  { key: "tra", label: "Province–province", color: "var(--teal)", parts: ["MET_TRA"] },
  { key: "om", label: "Métropole–Outre-mer", color: "var(--ochre)", parts: ["MET_OM"], off: true },
];

/** Average trip length: passenger-km / passengers (LSN), by segment. */
export function initDistance(data) {
  const years = data.fracture.annual.years;
  const PF = data.fracture.par_faisceau;
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

  $("#dist-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Un passager parcourt en moyenne `,
        { b: `${fmtNum(values.all[L])} km` },
        ` par vol en ${years[L]}, soit `,
        { b: fmtPct(pctChange(values.all[0], values.all[L]), 0) },
        ` par rapport à ${fmtNum(values.all[0])} km en ${years[0]}.`,
      ]),
    ),
  );
  $("#dist-after").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Les vols intérieurs reculent, les destinations lointaines progressent. Un vol international emmène ses passagers à `,
        { b: `${fmtNum(values.intl[L])} km` },
        ` en moyenne, un Paris–province à `,
        { b: `${fmtNum(values.rad[L])} km` },
        `.`,
      ]),
    ),
    el("p", {}, [
      "Plus de kilomètres par passager, c'est aussi plus de CO2 pour chaque voyage : ",
      el("a", { href: "#co2", text: "le chapitre sur le CO2" }),
      " fait le compte.",
    ]),
  );

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
    table: { head: "Année", date: (d) => String(d.getUTCFullYear()), value: (v) => `${fmtNum(v)} km` },
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
}
