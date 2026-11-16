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
import { $, el, segmented, reducedMotion, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
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
  yearsMap,
  yearsLine,
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
  safely("opening", async () => {
    // year after year: the change against the reference decade, the North Atlantic line under it
    const Y = C.yearly;
    const run = F.years.map((_, k) => {
      const w = F.atl.annual.slice(Math.max(0, k - 2), k + 3);
      return (w.reduce((a, b) => a + b, 0) / w.length) * 8766;
    });
    const map = await yearsMap($("#tc-open-map"), C, {
      label: `Carte animée : évolution des conditions propices à la turbulence en air clair année après année, de ${F.first} à ${F.last}, par rapport à ${Y.baseYears[0]}-${Y.baseYears[1]}.`,
    });
    const line = yearsLine($("#tc-spark"), F.years, run, {
      label: `Heures par an de conditions propices au-dessus de l'Atlantique Nord, moyenne sur cinq ans, ${F.first}-${F.last}.`,
    });
    const range = /** @type {HTMLInputElement} */ ($("#tc-range"));
    const btn = $("#tc-play");
    range.max = String(map.count - 1);
    const show = (k) => {
      map.show(k);
      line(k);
      range.value = String(k);
      $("#tc-year").textContent = String(F.years[k]);
      $("#tc-spark-h").textContent = `Atlantique Nord : ${T.fmt.hrs(run[k] / 8766)} par an`;
    };
    let timer = 0;
    let k = 0;
    const stop = () => {
      clearInterval(timer);
      timer = 0;
      btn.textContent = "▶";
      btn.setAttribute("aria-label", "Lecture");
    };
    const play = () => {
      if (k >= map.count - 1) k = 0;
      btn.textContent = "❚❚";
      btn.setAttribute("aria-label", "Pause");
      timer = window.setInterval(() => {
        show(k);
        if (++k >= map.count) stop();
      }, 220);
    };
    btn.addEventListener("click", () => (timer ? stop() : play()));
    range.addEventListener("input", () => {
      stop();
      k = +range.value;
      show(k);
    });
    if (reducedMotion()) {
      k = map.count - 1;
      show(k);
      stop();
    } else {
      show(0);
      // start when the opening is seen
      new IntersectionObserver((es, obs) => {
        if (es.some((e) => e.isIntersecting)) {
          obs.disconnect();
          play();
        }
      }).observe($("#tc-open-map"));
    }
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
