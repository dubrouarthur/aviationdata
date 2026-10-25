import { $, el, rich } from "../lib/ui.js";
import { addSummary } from "../lib/summary.js";
import { lineChart } from "../lib/linechart.js";
import { toDate, pctChange } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtPctAbs, fmtNum } from "../lib/format.js";

// foreign carriers' countries shown as lines; order chosen for colour-blind separation (teal, ochre, magenta)
const COUNTRIES = [
  { nom: "Irlande", color: "var(--teal)" },
  { nom: "Autriche", color: "var(--ochre)" },
  { nom: "Espagne", color: "var(--magenta)" },
  { nom: "Royaume-Uni", color: "#6f7c8b", dashed: true },
];

const M = (v) => `${fmtNum(v / 1e6, 1)} M`;

function legendRow(series) {
  return el(
    "div",
    { class: "legend-row" },
    series.map((s) =>
      el("span", { class: "lg" }, [
        el("i", {
          style: `--c:${s.color}${s.dashed ? ";background:repeating-linear-gradient(90deg,var(--c) 0 5px,transparent 5px 8px)" : ""}`,
        }),
        s.long || s.label,
      ]),
    ),
  );
}

/** French vs foreign carriers (DGAC carrier nationality), and foreign carriers by country. */
export function initPavillon(data) {
  const c = data.compagnies;
  const { years } = c;
  const L = years.length - 1;
  const F = c.pavillon.F;
  const E = c.pavillon.E;
  const share = (i) => (F[i] / (F[i] + E[i])) * 100;
  const gF = pctChange(F[0], F[L]);
  const gE = pctChange(E[0], E[L]);
  const byName = Object.fromEntries((c.pays || []).map((p) => [p.nom, p.pax]));
  const i17 = years.indexOf(2017);
  const at = (nom, i) => byName[nom]?.[i];
  const first = c.pays[0];
  const times = gF > 0 ? Math.round(gE / gF) : null;
  const timesWord = { 2: "deux", 3: "trois", 4: "quatre", 5: "cinq", 6: "six", 7: "sept", 8: "huit" }[times];

  $("#pav-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${years[0]}, près d'un passager sur deux (${fmtPctAbs(share(0), 1)}) voyageait sur une compagnie française. En ${years[L]}, ils ne sont plus que `,
        { b: fmtPctAbs(share(L), 1) },
        `. Les compagnies françaises ont pourtant gagné des passagers (${fmtPct(gF, 0)}, ${M(F[L])}), mais les étrangères ont progressé `,
        timesWord ? { b: `${timesWord} fois plus vite` } : "bien plus vite",
        ` (${fmtPct(gE, 0)}, ${M(E[L])}).`,
      ]),
    ),
  );
  $("#pav-after").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En juillet 2017, à l'approche du Brexit, easyJet a créé easyJet Europe, une compagnie installée à Vienne. Les compagnies autrichiennes sont passées de ${M(at("Autriche", i17))} de passagers en 2017 à `,
        { b: M(at("Autriche", L)) },
        ` en ${years[L]}, et les britanniques de ${M(at("Royaume-Uni", i17))} à `,
        { b: M(at("Royaume-Uni", L)) },
        `. ${first.nom === "Autriche" ? "L'Autriche est devenue le premier pays des compagnies étrangères en France" : `${first.nom} est le premier pays des compagnies étrangères en France`}, devant l'Irlande (${M(at("Irlande", L))}), pays de Ryanair, et l'Espagne (${M(at("Espagne", L))}), celui de Vueling et de Volotea.`,
      ]),
    ),
  );
  addSummary("pavillon", {
    value: fmtPctAbs(share(L), 0),
    label: `des passagers voyagent sur une compagnie française en ${years[L]}, contre ${fmtPctAbs(share(0), 0)} en ${years[0]}`,
    color: "var(--blue)",
  });

  const dates = years.map((y) => toDate(y));
  const covid = { date: toDate(2020), label: "Covid", short: "Covid" };

  // ---------------------------------------------------------------- French vs foreign
  const s1 = [
    {
      key: "F",
      label: "Françaises",
      long: "Compagnies françaises",
      color: "var(--blue)",
      values: F,
      width: 2.8,
    },
    {
      key: "E",
      label: "Étrangères",
      long: "Compagnies étrangères",
      color: "var(--ink-2)",
      values: E,
      width: 2.8,
    },
  ];
  const n1 = $("#chart-pav");
  n1.before(legendRow(s1));
  lineChart(n1, {
    dates,
    series: s1,
    xDomain: [dates[0], dates[L]],
    yZero: true,
    yFormat: fmtPaxAxis,
    tipFormat: fmtPax,
    title: (i) => `${years[i]}, part des compagnies françaises ${fmtPctAbs(share(i), 1)}`,
    events: [covid],
    endDots: true,
    endText: (s) => `${s.label} ${M(s.values[L])}`,
    height: 290,
    animate: true,
    table: { head: "Année (passagers)", date: (d) => String(d.getUTCFullYear()), value: fmtPax },
  });

  // ---------------------------------------------------------------- foreign carriers by country
  const s2 = COUNTRIES.filter((k) => byName[k.nom]).map((k) => ({
    key: k.nom,
    label: k.nom,
    color: k.color,
    dashed: k.dashed,
    values: byName[k.nom],
    width: 2.4,
  }));
  const n2 = $("#chart-pav-pays");
  n2.before(legendRow(s2));
  lineChart(n2, {
    dates,
    series: s2,
    xDomain: [dates[0], dates[L]],
    yZero: true,
    yFormat: fmtPaxAxis,
    tipFormat: fmtPax,
    title: (i) => `${years[i]}, compagnies étrangères par pays`,
    events: [{ date: toDate("2017-07"), label: "easyJet Europe", short: "easyJet" }, covid],
    endDots: true,
    endText: (s) => `${s.label} ${M(s.values[L])}`,
    height: 290,
    animate: true,
    table: { head: "Année (passagers)", date: (d) => String(d.getUTCFullYear()), value: fmtPax },
  });
}
