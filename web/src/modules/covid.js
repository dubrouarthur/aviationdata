import * as d3 from "d3";
import { $, el, rich, chips, keyFigures } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { toDate, isNum } from "../lib/series.js";
import { fmtPct, fmtPctAbs, fmtNum, fmtMonth } from "../lib/format.js";

const SERIES = [
  { key: "pax", label: "Passagers", color: "var(--blue)", width: 2.6 },
  { key: "vols", label: "Vols de passagers", color: "var(--ink-2)" },
  { key: "fret", label: "Fret et poste", color: "var(--ochre)", width: 2.4 },
  { key: "vols_cargo", label: "Vols tout-cargo", color: "var(--teal)" },
];

/** The 2020 crash, crossing passengers, flights and freight (APT series), each month vs the same month of 2019. */
export function initCovid(data) {
  const { months, national } = data.aeroports;
  const from = months.indexOf("2019-01");
  const to = Math.min(months.length - 1, months.indexOf("2023-12"));
  const span = d3.range(from, to + 1);
  const ref = (k, i) => national[k][months.indexOf(`2019-${months[i].slice(5, 7)}`)];
  const idx = Object.fromEntries(
    SERIES.map((s) => [
      s.key,
      span.map((i) => (ref(s.key, i) ? (national[s.key][i] / ref(s.key, i)) * 100 : null)),
    ]),
  );
  const at = (k, ym) => idx[k][span.indexOf(months.indexOf(ym))];
  const recovered = (k, level) => {
    const start = span.indexOf(months.indexOf("2020-05"));
    const j = idx[k].findIndex((v, n) => n > start && isNum(v) && v >= level);
    return j >= 0 ? months[span[j]] : null;
  };
  const paxBack = recovered("pax", 90);
  const fretBack = recovered("fret", 100);

  $("#covid-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En avril 2020, en plein premier confinement, les aéroports français perdent `,
        { b: fmtPctAbs(at("pax", "2020-04") - 100, 1) },
        ` de leurs passagers et `,
        { b: fmtPctAbs(at("vols", "2020-04") - 100, 0) },
        ` de leurs vols par rapport à avril 2019. Le fret, lui, ne recule que de `,
        { b: fmtPctAbs(at("fret", "2020-04") - 100, 0) },
        `, porté par les vols tout-cargo (`,
        { b: fmtPct(at("vols_cargo", "2020-04") - 100, 0) },
        `) qui remplacent les soutes des avions de ligne cloués au sol.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        fretBack ? `Le fret retrouve son niveau d'avant-crise dès ${fmtMonth(fretBack)}. ` : "",
        paxBack ? `Les passagers ne repassent la barre des 90 % de 2019 qu'en ${fmtMonth(paxBack)}.` : "",
      ]),
    ),
  );

  keyFigures($("#kf-covid"), [
    {
      value: fmtPct(at("pax", "2020-04") - 100, 0),
      label: "de passagers en avril 2020, face à avril 2019",
      color: "var(--blue)",
    },
    {
      value: fmtPct(at("fret", "2020-04") - 100, 0),
      label: "seulement pour le fret et la poste",
      color: "var(--ochre)",
    },
  ]);

  const node = $("#chart-covid");
  let on = new Set(SERIES.map((s) => s.key));
  const opts = () => ({
    dates: span.map((i) => toDate(months[i])),
    series: SERIES.filter((s) => on.has(s.key)).map((s) => ({ ...s, values: idx[s.key] })),
    xDomain: [toDate(months[from]), toDate(months[to])],
    baseline: 100,
    yZero: true,
    yFormat: (v) => fmtNum(v),
    tipFormat: (v) => `${fmtNum(v, 0)} (${fmtPct(v - 100, 0)})`,
    title: (i) => `${fmtMonth(months[span[i]])}, base 100 = même mois de 2019`,
    events: [
      { date: toDate("2020-03"), label: "1er confinement", short: "Confinement" },
      { date: toDate("2020-10"), label: "2e confinement", short: "2e" },
      { date: toDate("2021-04"), label: "3e confinement", short: "3e" },
    ],
    height: 380,
    animate: true,
    table: {
      head: "Mois (100 = même mois de 2019)",
      date: (d) => fmtMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`),
      value: (v) => fmtNum(v, 0),
    },
  });
  const chart = lineChart(node, opts());
  on = chips(
    $("#chips-covid"),
    SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color })),
    (next) => {
      on = next;
      chart.update(opts());
    },
  );
}
