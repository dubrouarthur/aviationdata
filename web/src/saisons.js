import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./eu.css";
import "./saisons.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { seasonFacts } from "./saisons/facts.js";
import * as T from "./saisons/text.js";
import {
  calendar,
  calendarControls,
  calendarKey,
  profiles,
  gapMap,
  kindsChart,
  gapLines,
} from "./saisons/charts.js";
import { addSourceLines, initSources } from "./saisons/sources.js";

async function load() {
  const get = (u) =>
    fetch(asset(u)).then((r) => {
      if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
      return r.json();
    });
  const [data, geo] = await Promise.all([get("data/eu/eu.json"), get("geo/europe-50m.json")]);
  return { data, geo };
}

const safely = (name, fn) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name}:`, err);
  }
};

async function main() {
  let data;
  let geo;
  try {
    ({ data, geo } = await load());
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const Q = seasonFacts(data);
  safely("text", () => {
    T.writeOpening(Q);
    T.writeEssentiel(Q);
    T.writeCalendar(Q);
  });
  // one year and one country for the whole page: the calendar sets them, the profiles and the map follow
  const readout = T.calendarReadout(Q);
  let pf = null;
  let map = null;
  let cal = null;
  safely("calendar", () => {
    calendarKey($("#cal-key"));
    cal = calendar($("#cal-chart"), Q, {
      onPick: (row, year) => {
        readout(row, year);
        pf?.set({ extra: row?.code ?? null });
      },
    });
    calendarControls($("#cal-controls"), Q, {
      onYear: (year) => {
        cal.set({ year });
        pf?.set({ year });
        map?.set(year);
      },
      onSort: (sort) => cal.set({ sort }),
    });
  });
  safely("profiles", () => {
    T.writeProfils(Q);
    pf = profiles($("#chart-pf"), Q, {
      codes: ["HR", "EL", "EU27_2020", "FI"],
      colors: { HR: "#8a3a00", EL: "#c2630a", EU27_2020: "var(--eu-accent)", FI: "#2c5878" },
    });
  });
  safely("map", () => {
    T.writeCarte(Q);
    map = gapMap($("#chart-gm"), geo, Q, {
      onPick: (code) => {
        cal?.pick(code);
        $("#calendrier").scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
  });
  safely("national", () => {
    T.writeInterieurs(Q);
    kindsChart($("#chart-kd"), Q);
  });
  safely("gap", () => {
    T.writeEvolution(Q);
    gapLines($("#chart-gaps"), Q, {
      highlight: {
        EU27_2020: "var(--eu-accent)",
        HR: "#8a3a00",
        EL: "#c2630a",
        BG: "#2c5878",
        IS: "#5b86a5",
      },
    });
  });
  safely("answer", () => T.writeReponse(Q));
  safely("sources", () => initSources(data, Q));
  numberChapters(".story-chapter");
  addSourceLines();
  shareBlock();
  scrollHints(".topnav, .seg");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
