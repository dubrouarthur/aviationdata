import { $, rich, segmented, chips, dataTable } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { yoy, toDate, isNum, pctChange } from "../lib/series.js";
import { fmtNum, fmtPct, fmtPctAbs, fmtMonth } from "../lib/format.js";
import { eventMarks } from "../lib/data.js";

export const PRICE_SERIES = [
  { key: "FRA_ENS", label: "Tous départs de France", color: "var(--ink)", width: 2.6 },
  { key: "MET_INTER_MET", label: "Intérieur métropole", color: "var(--s-rad)" },
  { key: "MET_INTER_OM", label: "Métropole–Outre-mer", color: "var(--s-om)" },
  { key: "MET_INTAL_MC", label: "International moyen-courrier", color: "var(--s-intl)" },
  { key: "MET_INTAL_LC", label: "International long-courrier", color: "var(--s-intl)", dashed: true },
];

export function initPrices(data) {
  const { months, series } = data.prix;
  const dates = months.map(toDate);
  const available = PRICE_SERIES.filter((s) => series[s.key]);
  const yoyOf = Object.fromEntries(available.map((s) => [s.key, yoy(series[s.key])]));
  const L = months.length - 1;
  const lastMonth = months[L];

  // ---------------------------------------------------------------- lede (computed)
  const ens = yoyOf.FRA_ENS;
  const cur = ens[L];
  let since = null;
  for (let i = L - 1; i >= 0; i--) {
    if (isNum(ens[i]) && ens[i] >= cur) {
      since = months[i];
      break;
    }
  }
  const y = lastMonth.slice(0, 4);
  const ytdMonths = months.map((m, i) => [m, i]).filter(([m]) => m.startsWith(y));
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const ytd = pctChange(
    mean(ytdMonths.map(([, i]) => series.FRA_ENS[i - 12])),
    mean(ytdMonths.map(([, i]) => series.FRA_ENS[i])),
  );
  const part = (k) => (yoyOf[k] ? fmtPct(yoyOf[k][L]) : "–");
  const rising = cur >= 0;
  $("#lede-prix").replaceChildren(
    rich([
      `En ${fmtMonth(lastMonth)}, un billet d'avion au départ de France coûtait `,
      { b: fmtPctAbs(cur) },
      rising ? ` de plus qu'un an plus tôt` : ` de moins qu'un an plus tôt`,
      rising
        ? since
          ? `, la plus forte hausse depuis ${fmtMonth(since)}`
          : `, la plus forte hausse sur un an depuis le début de la série`
        : "",
      `. Sur un an : international moyen-courrier `,
      { b: part("MET_INTAL_MC") },
      `, long-courrier `,
      { b: part("MET_INTAL_LC") },
      `, intérieur métropole `,
      { b: part("MET_INTER_MET") },
      `. Depuis janvier ${y}, l'évolution cumulée atteint `,
      { b: fmtPct(ytd) },
      `.`,
    ]),
  );


  // ---------------------------------------------------------------- chart
  const state = { mode: "yoy", from: "2019", on: new Set(available.map((s) => s.key)) };
  const node = $("#chart-prix");
  const opts = () => ({
    dates,
    series: available
      .filter((s) => state.on.has(s.key))
      .map((s) => ({ ...s, values: state.mode === "yoy" ? yoyOf[s.key] : series[s.key] })),
    xDomain: [toDate(`${state.from}-01`), dates.at(-1)],
    baseline: state.mode === "yoy" ? 0 : 100,
    yFormat: state.mode === "yoy" ? (v) => fmtPct(v, 0) : (v) => fmtNum(v),
    tipFormat: state.mode === "yoy" ? (v) => fmtPct(v) : (v) => fmtNum(v, 1),
    title: (i) => `${fmtMonth(months[i])}${state.mode === "yoy" ? ", évolution sur un an" : ", indice 2023 = 100"}`,
    events: eventMarks(),
    height: 360,
  });
  const chart = lineChart(node, opts());
  const redraw = () => chart.update(opts());

  state.on = chips(
    $("#chips-prix"),
    available.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed })),
    (on) => {
      state.on = on;
      redraw();
    },
  );
  segmented($("#prix-mode"), state.mode, (v) => {
    state.mode = v;
    redraw();
  });
  segmented($("#prix-range"), state.from, (v) => {
    state.from = v;
    redraw();
  });

  const recent = months
    .map((m, i) => [m, i])
    .slice(-36)
    .reverse();
  dataTable(
    $("#table-prix"),
    ["Mois", ...available.map((s) => s.label), "Tous départs, sur un an"],
    recent.map(([m, i]) => [
      fmtMonth(m),
      ...available.map((s) => fmtNum(series[s.key][i], 1)),
      fmtPct(ens[i]),
    ]),
  );
}
