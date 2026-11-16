import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./jets.css";
import "./cat.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, segmented, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { getJSON, safely } from "./court/page.js";
import { addSourceLines } from "./court/sources.js";
import { catFacts, SEASONS, SEASON_FR } from "./cat/facts.js";
import {
  freqMap,
  changeMap,
  monthLatitude,
  yearMonth,
  seqLegend,
  crossSection,
  routeMap,
  regionStripes,
  decadeMap,
  decadeLegend,
} from "./cat/charts.js";
import { TSOURCES } from "./cat/sources.js";
import * as T from "./cat/text.js";

async function main() {
  let C;
  try {
    C = await getJSON("data/cat/cat.json");
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = catFacts(C);
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F);
    T.writeOu(F);
    T.writeAltitude(F);
    T.writeRoutes(F);
    T.writeTendance(F);
    T.writeReponse(F);
    T.writeSources(C, F);
  });
  // one scale for every frequency map: the 99th percentile of the winter cells, rounded up to the half-percent
  const max = Math.ceil(C.meta.mapMax * 0.6 * 200) / 200;
  safely("opening", () => {
    // two decades side by side, the strongest conditions, one scale
    const D = C.decades;
    const atl = F.atl.decadesSev;
    const max = 0.006;
    const head = (id, years, f, strong) =>
      $(id).replaceChildren(
        el("b", { text: `${years[0]}-${years[1]}` }),
        el("span", { class: strong ? "up" : "", text: `${T.fmt.hrs(f)} de ciel très agité par an` }),
      );
    head("#tc-h0", D.first, atl.first, false);
    head("#tc-h1", D.last, atl.last, true);
    for (const [id, key, years] of [
      ["#tc-map0", "first", D.first],
      ["#tc-map1", "last", D.last],
    ])
      decadeMap($(id), C, key, {
        max,
        label: `Carte des conditions les plus fortes de turbulence en air clair, ${years[0]}-${years[1]}, Atlantique Nord, Europe et Amérique du Nord.`,
      });
    decadeLegend($("#tc-legend"), max);
  });
  safely("map", () =>
    freqMap($("#chart-map"), C, "annual", {
      max,
      label: `Carte de la part des analyses aux conditions propices, toutes saisons, ${F.first}-${F.last}.`,
    }),
  );
  safely("seasons", () => {
    const box = $("#chart-seasons");
    box.replaceChildren();
    for (const s of SEASONS) {
      const cell = el("div", { class: "t-season" }, [el("p", { class: "t-season-h", text: SEASON_FR[s] })]);
      const m = el("div", { class: "t-season-map" });
      cell.append(m);
      box.append(cell);
      freqMap(m, C, s, { max, compact: true, label: `Carte, ${SEASON_FR[s]}.` });
    }
    const leg = el("div", { class: "t-season-legend" });
    box.append(leg);
    seqLegend(leg, max);
  });
  safely("lat", () =>
    monthLatitude($("#chart-lat"), C, {
      max: Math.max(...C.zonal.all.flat()),
      label: `Part des analyses aux conditions propices par latitude et par mois, ${F.first}-${F.last}.`,
    }),
  );
  safely("levels", () => {
    const smax = Math.max(...Object.values(C.section.DJF).flat());
    const draw = (k) =>
      crossSection($("#chart-levels"), C, k, {
        max: smax,
        label: `Coupe de l'atmosphère : part des analyses aux conditions propices à trois niveaux de vol, par latitude, ${F.first}-${F.last}.`,
      });
    segmented($("#levels-seg"), "annual", draw);
    draw("annual");
  });
  safely("routes", () => {
    const paris = C.routes.filter((r) => r.key.startsWith("CDG"));
    const draw = (k) =>
      routeMap($("#chart-routes"), C, k, {
        routes: paris,
        airports: C.airports,
        max,
        label: `Carte des routes depuis Paris, colorées par les conditions propices qu'elles traversent, ${F.first}-${F.last}.`,
      });
    segmented($("#routes-seg"), "DJF", draw);
    draw("DJF");
  });
  safely("stripes", () =>
    yearMonth($("#chart-stripes"), F.atl, F.years, {
      max: Math.max(...F.atl.monthly.flat()) * 0.85,
      label: `Part des analyses aux conditions propices au-dessus de l'Atlantique Nord, chaque mois de ${F.first} à ${F.last}.`,
    }),
  );
  safely("trend", () =>
    regionStripes(
      $("#chart-trend"),
      [...F.local, { ...F.nh, short: "Tout le nord" }, { ...F.sh, short: "Tout le sud" }].sort(
        (a, b) => b.change - a.change,
      ),
      F.years,
      {
        label: `Fréquence des conditions propices chaque année de ${F.first} à ${F.last}, par région, comparée à la moyenne de la région.`,
        fmtChange: (v) => T.fmt.chg(v),
      },
    ),
  );
  safely("change", () =>
    changeMap($("#chart-change"), C, {
      label: `Carte de l'évolution des conditions propices, ${F.span[0][0]}-${F.span[0][1]} à ${F.span[1][0]}-${F.span[1][1]}.`,
    }),
  );
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(TSOURCES, document, "tsource");
  shareBlock();
  scrollHints(".topnav");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
