import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./eu.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, segmented, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { storyFacts, zoneFacts, shiftFacts, seasonFacts } from "./eu/facts.js";
import * as T from "./eu/text.js";
import { monthChart, heatmap, partsChart, rankBars, dumbbell, bumpChart, airportTable } from "./eu/charts.js";
import { openMap, yearControls, choropleth, baryMap, spikeMap } from "./eu/map.js";
import { bandsChart, offsetBars } from "./eu/shift.js";
import { ridgeline, seasonControls, gapLines } from "./eu/seasons.js";
import { addSourceLines, initSources } from "./eu/sources.js";

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

/** The dashboard: a zone and a kind of flight drive the readout, the monthly curve, the seasons, the parts
 * and the airports. Returns a function that opens a zone (the map and the ranking call it). */
function dashboard(data) {
  const zones = [data.zones[0], ...data.zones.slice(1).sort((a, b) => a.name.localeCompare(b.name, "fr"))];
  const select = $("#board-zone");
  select.replaceChildren(...zones.map((z) => el("option", { value: z.code, text: z.name })));
  const keyBox = $("#board-key");
  keyBox.replaceChildren(
    ...T.KEYS.map(([k, label]) => el("button", { type: "button", "data-v": k, text: label })),
  );
  const state = { zone: zones[0].code, key: "total" };
  const last = data.meta.last;
  const paint = () => {
    const zone = data.zones.find((z) => z.code === state.zone);
    const Z = zoneFacts(data, zone, state.key);
    T.writeBoard(data, zone, state.key, Z);
    monthChart($("#chart-board-month"), { months: Z.months, series: Z.series });
    heatmap($("#chart-board-heat"), { months: Z.months, series: Z.series });
    partsChart($("#chart-board-parts"), {
      years: data.years,
      parts: { nat: zone.nat, ieu: zone.ieu, xeu: zone.xeu },
      from: Math.max(zone.first, zone.code === "EU27_2020" ? data.meta.cross : data.meta.first),
    });
    const iL = data.airportYears.indexOf(last);
    const apts = data.airports
      .filter((a) => zone.code === "EU27_2020" || a.country === zone.code)
      .filter((a) => a.pax[iL] != null)
      .sort((a, b) => b.pax[iL] - a.pax[iL])
      .slice(0, zone.code === "EU27_2020" ? 15 : 10);
    T.writeAirports(zone, apts, last, data.airportYears);
    airportTable($("#board-apt"), apts, { years: data.airportYears, last });
  };
  select.addEventListener("change", () => ((state.zone = select.value), paint()));
  segmented(keyBox, "total", (k) => ((state.key = k), paint()));
  paint();
  return (code) => {
    state.zone = code;
    select.value = code;
    paint();
    $("#tableau").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

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
  const F = storyFacts(data);
  const H = shiftFacts(data);
  const Q = seasonFacts(data);
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F, H, Q);
    T.writeTableau(F);
    T.openNote(data);
  });
  safely("opening", () => {
    const map = openMap($("#open-map"), data, geo);
    yearControls($("#open-years"), data, map, T.yearReadout(F, data));
  });
  const open = safely("dashboard", () => dashboard(data));
  safely("record", () => {
    T.writeRecord(F);
    partsChart($("#chart-union"), {
      years: data.years,
      parts: { nat: F.eu.nat, ieu: F.eu.ieu, xeu: F.eu.xeu },
      from: data.meta.cross,
    });
  });
  safely("south", () => {
    T.writeSud(F);
    choropleth($("#chart-choro"), geo, F.vs, { onPick: open });
    rankBars($("#chart-rank"), F.vs, { onPick: open });
  });
  safely("national", () => {
    T.writeInterieur(F);
    dumbbell($("#chart-nat"), F.nat, { last: F.last });
  });
  safely("airports", () => {
    T.writeAeroports(F);
    const AY = data.airportYears;
    const ranks = data.airports.map((a) => {
      const rank = AY.map((y) => F.rank(y).find((r) => r.code === a.code)?.rank ?? null);
      return { code: a.code, name: a.name, pax: a.pax, rank };
    });
    const colors = {
      LEMD: "var(--south)",
      LIRF: "var(--south)",
      LGAV: "var(--south)",
      EDDF: "var(--north)",
      EDDM: "var(--north)",
      LFPG: "var(--ink)",
    };
    bumpChart($("#chart-bump"), {
      years: AY,
      ranks: ranks.map((r) => ({ ...r, color: colors[r.code] })),
      highlight: Object.keys(colors),
    });
  });
  safely("spikes", () => {
    T.writePics(H);
    spikeMap($("#chart-spikes"), geo, H, {
      inScope: new Set(data.zones.map((z) => z.iso).filter(Boolean)),
      labels: {
        LEMD: { text: "Madrid" },
        LGAV: { text: "Athènes" },
        LIRF: { text: "Rome", anchor: "end", dx: -2 },
        LEMG: { text: "Malaga", anchor: "end", dx: -2 },
        EDDB: { text: "Berlin" },
        EDDF: { text: "Francfort", anchor: "end", dx: -2 },
        EFHK: { text: "Helsinki" },
      },
    });
    bandsChart($("#chart-bands"), H);
  });
  safely("gravity", () => {
    T.writeGravite(F);
    offsetBars($("#chart-offset"), F.bary, { last: F.last });
    baryMap($("#chart-bary"), geo, data, {
      marks: ["LSGG", "LSZB", "LSZH", "LFSB", "LFSN", "LFLL", "LIMC", "LSZA"],
    });
  });
  safely("seasons", () => {
    T.writeSaisons(Q);
    // the ridges call the readout whenever the year or the picked country changes
    const ridges = ridgeline($("#chart-ridge"), Q, { onPick: T.seasonReadout(Q, open) });
    seasonControls($("#season-controls"), Q, ridges);
  });
  safely("gap", () => {
    T.writeEcart(Q);
    gapLines($("#chart-gaps"), Q, {
      highlight: {
        EU27_2020: "var(--eu-accent)",
        HR: "var(--south)",
        EL: "var(--south-text)",
        BG: "var(--north)",
        IS: "var(--north-text)",
      },
    });
  });
  safely("answer", () => T.writeReponse(F, H, Q));
  safely("sources", () => initSources(data));
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
