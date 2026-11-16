import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./jets.css";
import "./cat.css";
import "./kero.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { getJSON, safely } from "./court/page.js";
import { lineChart } from "./court/charts.js";
import { addSourceLines } from "./court/sources.js";
import { heatmap, SEQ } from "./cat/charts.js";
import { kgPerMinute } from "./jet/cost.js";
import { keroFacts, monthLabel, spanLabel, MONTHS_FR } from "./kero/facts.js";
import { flowMap, gapChart, shareStream, shiftDots, countryGrids, groupLegend, GCOL } from "./kero/charts.js";
import { KSOURCES } from "./kero/sources.js";
import * as T from "./kero/text.js";

async function main() {
  let K;
  try {
    K = await getJSON("data/kero/kero.json");
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = keroFacts(K);
  // one minute of cruise, from the jet-stream investigation, at the price paid at the border
  let minute = null;
  try {
    const cost = await getJSON("data/jet/cost.json");
    const kg = kgPerMinute(cost);
    minute = { kg, before: (kg / 1000) * F.eurB, after: (kg / 1000) * F.eurA };
  } catch {
    minute = null;
  }
  const labels = Object.fromEntries(
    Object.entries(K.groups).map(([g, v]) => [g, /** @type {any} */ (v).label]),
  );
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F);
    T.writeOu(F);
    T.writeOrmuz(F);
    T.writePrix(F, minute);
    T.writeReponse(F, minute);
    T.writeSources(K, F);
  });
  const flows = (key) =>
    F.partners.map((p) => ({ ...p, iso: K.partners[p.key]?.iso, t: key === "y25" ? 0 : p[key] }));
  const max = Math.max(...F.partners.map((p) => Math.max(p.tB, p.tA)));
  safely("opening", () => {
    flowMap($("#kr-map0"), {
      flows: flows("tB"),
      max,
      label: `Carte des importations de kérosène de l'Union par pays d'origine, ${spanLabel(F.before)}.`,
    });
    flowMap($("#kr-map1"), {
      flows: flows("tA"),
      max,
      label: `Carte des importations de kérosène de l'Union par pays d'origine, ${spanLabel(F.after)}.`,
    });
    groupLegend($("#kr-legend"), labels);
  });
  safely("gap", () => {
    const B = K.balance.EU27_2020;
    gapChart($("#chart-gap"), {
      months: B.months,
      refinery: B.refinery,
      deliveries: B.deliveries,
      label: `Kérosène raffiné et livré dans l'Union, chaque mois, ${F.first.slice(0, 4)}-${F.last.slice(0, 4)}.`,
      mark: { month: F.closure, text: "Ormuz" },
    });
  });
  safely("map25", () => {
    const y = K.months.map((m, i) => (m.startsWith("2025") ? i : -1)).filter((i) => i >= 0);
    const fl = Object.entries(K.eu.partners).map(([k, v]) => ({
      key: k,
      label: K.partners[k]?.label ?? k,
      group: K.partners[k]?.group ?? "autres",
      iso: K.partners[k]?.iso,
      t: y.reduce((s, i) => s + /** @type {any} */ ((v)[i] ?? 0), 0) / y.length,
    }));
    flowMap($("#chart-map25"), {
      flows: fl,
      max: Math.max(...fl.map((f) => f.t)),
      top: 6,
      label: "Carte des importations de kérosène de l'Union par pays d'origine, 2025.",
    });
    $("#chart-map25").after(el("div", { class: "kr-legend light", id: "kr-legend25" }));
    groupLegend($("#kr-legend25"), labels);
  });
  safely("stream", () =>
    shareStream($("#chart-stream"), {
      months: K.months,
      groups: K.eu.groups,
      total: K.eu.total,
      labels,
      label: `Part de chaque région d'origine dans le kérosène importé par l'Union, chaque mois, ${F.first.slice(0, 4)}-${F.last.slice(0, 4)}.`,
      marks: [
        { month: "2023-02", text: "Embargo russe" },
        { month: F.closure, text: "Ormuz" },
      ],
    }),
  );
  safely("heat", () => {
    const cols = K.months.map((m, i) => i).filter((i) => K.months[i] >= "2025-01");
    const rows = [...F.partners]
      .sort((a, b) => b.tB + b.tA - (a.tB + a.tA))
      .slice(0, 14)
      .sort((a, b) =>
        (a.group === "golfe") === (b.group === "golfe") ? b.tB - a.tB : a.group === "golfe" ? -1 : 1,
      );
    const vmax = Math.max(...rows.flatMap((r) => cols.map((i) => K.eu.partners[r.key][i] ?? 0)));
    heatmap($("#chart-heat"), {
      rows,
      cols,
      value: (i, j) => K.eu.partners[rows[i].key][cols[j]] ?? 0,
      color: (v) => SEQ(Math.min(1, v / vmax) ** 0.6),
      label: `Kérosène importé par l'Union depuis ses principaux fournisseurs, chaque mois de 2025 à ${monthLabel(F.last)}.`,
      rowLabel: (r) => r.label,
      colLabel: (i, long) =>
        long ? monthLabel(K.months[i]) : `${MONTHS_FR[+K.months[i].slice(5) - 1].slice(0, 4)}.`,
      left: (narrow) => (narrow ? 110 : 170),
      rowH: (narrow) => (narrow ? 20 : 26),
      colEvery: 3,
      colMark: cols.findIndex((i) => K.months[i] === F.closure),
      tipName: "Importé",
      tipFmt: (v) => `${fmtNum(v, 0)} kt`,
      table: {
        head: ["Fournisseur", ...cols.map((i) => monthLabel(K.months[i]))],
        rows: rows.map((r) => [r.label, ...cols.map((i) => fmtNum(K.eu.partners[r.key][i] ?? 0, 0))]),
      },
    });
  });
  safely("shift", () =>
    shiftDots($("#chart-shift"), {
      rows: Object.values(F.groups)
        .filter((g) => g.key !== "russie")
        .map((g) => ({ ...g, group: g.key }))
        .sort((a, b) => b.before - a.before),
      names: [spanLabel(F.before), spanLabel(F.after)],
      label: `Part de chaque région d'origine, ${spanLabel(F.before)} et ${spanLabel(F.after)}.`,
    }),
  );
  safely("price", () => {
    const P = K.prices.monthly;
    const from = P.months.indexOf("2024-01");
    const base = (v) => (v[P.months.indexOf("2026-01")] + v[P.months.indexOf("2026-02")]) / 2;
    const bj = base(P.jet);
    const bb = base(P.brent);
    lineChart($("#chart-price"), {
      x: P.months.slice(from).map((m) => `${MONTHS_FR[+m.slice(5) - 1].slice(0, 4)}. ${m.slice(2, 4)}`),
      series: [
        {
          key: "jet",
          label: "Kérosène",
          color: GCOL.golfe,
          values: P.jet.slice(from).map((v) => (v / bj) * 100),
        },
        {
          key: "brent",
          label: "Brent",
          color: "blue",
          values: P.brent.slice(from).map((v) => (v === null ? null : (v / bb) * 100)),
        },
      ],
      label: "Prix au comptant du kérosène et du Brent, base 100 = janvier-février 2026.",
      fmt: (v) => fmtNum(v, 0),
      base: 100,
    });
  });
  safely("grids", () =>
    countryGrids($("#chart-grids"), {
      countries: ["FR", "NL", "ES", "IT", "BE"].map((k) => K.countries[k]),
      names: [spanLabel(F.before), spanLabel(F.after)],
      label: `Origine du kérosène importé hors de l'Union par cinq pays, ${spanLabel(F.before)} et ${spanLabel(F.after)}.`,
    }),
  );
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(KSOURCES, document, "ksource");
  shareBlock();
  scrollHints(".topnav");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
