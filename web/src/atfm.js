import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./jets.css";
import "./cat.css";
import "./atfm.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { getJSON, safely } from "./court/page.js";
import { addSourceLines } from "./court/sources.js";
import { stats } from "./lib/chartkit.js";
import { atfmFacts, dayLabel } from "./atfm/facts.js";
import {
  calendar,
  yearLine,
  reasonsStream,
  dayDots,
  tileMap,
  providerMultiples,
  weekDiscs,
} from "./atfm/charts.js";
import { RSOURCES } from "./atfm/sources.js";
import * as T from "./atfm/text.js";

async function main() {
  let A;
  try {
    A = await getJSON("data/atfm/atfm.json");
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = atfmFacts(A);
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F);
    T.writeCombien(F);
    T.writePourquoi(F);
    T.writeOu(F);
    T.writeReponse(F);
    T.writeSources(F);
  });
  const calMax = 6;
  safely("opening", () => {
    $("#rt-open-stats").replaceChildren(
      stats([
        {
          value: `1 sur ${fmtNum(T.fmt.oneIn(F.delayed), 0)}`,
          label: `vols retardés par le contrôle en route en ${F.year}`,
        },
        { value: `${fmtNum(F.perDelayed, 0)} min`, label: "d'attente en moyenne pour ces vols" },
        { value: `× ${fmtNum(F.ratio, 1)}`, label: "de retard par vol depuis 2014-2017", hi: true },
      ]),
    );
    calendar($("#rt-open-cal"), A, {
      max: calMax,
      night: true,
      label: `Calendrier du retard par vol, chaque jour du 1er janvier ${F.first} au ${dayLabel(F.last)}.`,
    });
  });
  safely("year", () =>
    yearLine($("#chart-year"), A, {
      lastFull: F.year,
      ytd: true,
      label: `Retard ATFM en route par vol, chaque année de ${F.first} à ${F.year}.`,
      notes: [
        {
          year: 2018,
          text: "2018 : le retard\ndouble en un an",
          dy: -34,
          dx: -8,
          anchor: "end",
          short: "2018",
        },
        { year: 2020, text: "Covid : deux fois\nmoins de vols", dy: -52, short: "Covid" },
        { year: F.peak, text: `${F.peak} : le record`, dy: -22, short: String(F.peak) },
      ],
    }),
  );
  safely("cal", () =>
    calendar($("#chart-cal"), A, {
      max: calMax,
      label: `Calendrier du retard par vol, chaque jour du 1er janvier ${F.first} au ${dayLabel(F.last)}.`,
    }),
  );
  safely("reasons", () =>
    reasonsStream($("#chart-reasons"), A, {
      lastFull: F.year,
      label: `Retard par vol selon le motif déclaré, chaque mois de ${F.first} à ${F.cur}.`,
    }),
  );
  safely("dots", () =>
    dayDots($("#chart-dots"), A, {
      label: `Retard par vol, chaque jour depuis ${F.first}, coloré par premier motif déclaré.`,
      named: A.worst.map((w) => ({ date: w.date, text: dayLabel(w.date) })),
    }),
  );
  safely("tiles", () =>
    tileMap($("#chart-tiles"), F, {
      max: F.byPer[0].perFlight,
      label: `Carte en cases de l'Europe : retard par vol contrôlé, par pays, ${F.year}.`,
    }),
  );
  safely("multi", () =>
    providerMultiples($("#chart-multi"), A, F, {
      codes: F.byDelay.slice(0, 12).map((p) => p.code),
      max: Math.max(
        ...F.byDelay
          .slice(0, 12)
          .flatMap((p) =>
            F.years.map((y) =>
              A.providers[p.code].years[y]?.flights
                ? A.providers[p.code].years[y].delay / A.providers[p.code].years[y].flights
                : 0,
            ),
          ),
      ),
      label: `Retard par vol contrôlé de douze pays, chaque année de ${F.first} à ${F.year}.`,
    }),
  );
  safely("week", () =>
    weekDiscs($("#chart-week"), A, { label: `Retard par vol selon le jour de la semaine, été ${F.year}.` }),
  );
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(RSOURCES, document, "rsource");
  shareBlock();
  scrollHints(".topnav");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
