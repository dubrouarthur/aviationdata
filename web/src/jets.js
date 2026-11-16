import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./jets.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { getJSON, safely } from "./court/page.js";
import { hbars } from "./court/charts.js";
import { addSourceLines } from "./court/sources.js";
import { jetFacts, monthLabel, DAYS_FR } from "./jets/facts.js";
import { hundred, monthLines, pairBars, seasonGrid, stackBars, yearDays } from "./jets/charts.js";
import { JPSOURCES } from "./jets/sources.js";
import * as T from "./jets/text.js";

async function main() {
  let J;
  try {
    J = await getJSON("data/jets/jets.json");
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = jetFacts(J);
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F);
    T.writeCombien(F);
    T.writeOu(F);
    T.writeQui(F);
    T.writeReponse(F);
    T.writeSources(J, F);
  });
  const pc1 = (v) => `${fmtNum(v * 100, 1)} %`;
  const pc0 = (v) => `${fmtNum(v * 100, 0)} %`;
  safely("opening", () =>
    hundred($("#jp-open-big"), [
      { label: `en ${F.first}`, share: F.share0 },
      { label: `en ${monthLabel(F.peak.month)}`, share: F.peak.share, strong: true },
    ]),
  );
  // the fleet panel's figures stop at the end of 2020: later levels no longer compare with 2019
  const to = F.months.indexOf(F.panelTo) + 1;
  safely("share", () =>
    monthLines($("#chart-share"), {
      months: F.months.slice(0, to),
      series: [{ label: "Jets d'affaires", color: "jets", values: F.share.slice(0, to) }],
      label: `Part des jets d'affaires dans les vols au-dessus de l'Europe des avions suivis en ${F.first}, par mois, ${F.first}-2020.`,
      fmt: pc1,
      tick: pc0,
      floor: 0,
      mark: { i: F.months.indexOf(F.peak.month), text: monthLabel(F.peak.month) },
    }),
  );
  safely("index", () => {
    const from = F.months.indexOf("2020-01");
    monthLines($("#chart-index"), {
      months: F.months.slice(from, to),
      series: [
        { label: "Jets d'affaires", color: "jets", values: F.ij.slice(from, to) },
        { label: "Avions de ligne", color: "liners", values: F.il.slice(from, to) },
      ],
      label: `Vols de chaque mois de 2020 en indice, 100 = le même mois de ${F.first}, avions suivis en ${F.first}.`,
      fmt: (v) => fmtNum(v, 0),
      base: 100,
      floor: 0,
    });
  });
  safely("distances", () => {
    const lab = (c) =>
      c.hi === Infinity ? `plus de ${fmtNum(c.lo, 0)} km` : `${fmtNum(c.lo, 0)} à ${fmtNum(c.hi, 0)} km`;
    pairBars($("#chart-km"), {
      rows: F.classesJ.map((c, k) => ({ label: lab(c), a: c.share, b: F.classesL[k].share })),
      names: ["Jets d'affaires", "Avions de ligne"],
      label: `Part des vols par tranche de distance, ${F.last}.`,
      fmt: pc0,
      head: "Distance",
      strongRows: [0, 1],
    });
  });
  safely("routes", () =>
    hbars($("#chart-routes"), {
      rows: F.routes.map((r) => ({
        label: r.label,
        note: `${fmtNum(Math.round(r.km / 10) * 10, 0)} km`,
        value: r.flights,
        color: r.km < J.shortKm ? "magenta" : "blue",
        strong: r.km < J.shortKm,
      })),
      label: `Les dix routes de jets d'affaires les plus fréquentées depuis ou vers la France, ${F.last}.`,
      fmt: (v) => `${fmtNum(v, 0)} vols`,
      head: `Vols en ${F.last}`,
    }),
  );
  safely("seasons", () =>
    seasonGrid($("#chart-season"), F.seasons, {
      label: `Mouvements de jets d'affaires par mois rapportés au mois moyen, ${F.first} et ${F.last}.`,
    }),
  );
  safely("week", () =>
    pairBars($("#chart-week"), {
      rows: DAYS_FR.map((d, k) => ({ label: d, a: F.weekJ[k] * 100, b: F.weekL[k] * 100 })),
      names: ["Jets d'affaires", "Avions de ligne"],
      label: `Vols de chaque jour de la semaine, 100 = le jour moyen, ${F.last}.`,
      fmt: (v) => fmtNum(v, 0),
      head: "Jour",
      strongRows: [5],
    }),
  );
  safely("callsign", () =>
    stackBars(
      $("#chart-cs"),
      [
        ["Tous", F.callsign],
        ["Jets légers", F.callsignL],
        ["Moyens et lourds", F.callsignM],
      ].map(([label, c]) => ({
        label,
        parts: [
          { key: "op", label: "Code d'un exploitant", value: c.operator },
          { key: "reg", label: "Immatriculation", value: c.registration },
          { key: "oth", label: "Autre", value: c.other },
        ],
      })),
      { label: `Indicatif des vols de jets d'affaires selon leur taille, ${F.last}.`, fmt: pc0 },
    ),
  );
  safely("days", () =>
    yearDays(
      $("#chart-days"),
      [
        { label: "pour un jet d'affaires", days: F.daysJ, kind: "jets" },
        { label: "pour un avion de ligne", days: F.daysL, kind: "liners" },
      ],
      { label: `Jours de vol de l'avion médian, ${F.last}.`, fmtDays: (v) => `${fmtNum(v, 0)} jours` },
    ),
  );
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(JPSOURCES, document, "jsource");
  shareBlock();
  scrollHints(".topnav");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
