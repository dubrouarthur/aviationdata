import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./jets.css";
import "./cat.css";
import "./atfm.css";
import "./birds.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { getJSON, safely } from "./court/page.js";
import { addSourceLines } from "./court/sources.js";
import { stats } from "./lib/chartkit.js";
import { birdFacts, openingNumbers } from "./birds/facts.js";
import {
  yearClock,
  hourGrid,
  speciesSeasons,
  heightLadder,
  phaseProfile,
  partsPlane,
  speciesScatter,
  reportsLines,
} from "./birds/charts.js";
import { WSOURCES } from "./birds/sources.js";
import * as T from "./birds/text.js";

async function main() {
  let B;
  try {
    B = await getJSON("data/birds/birds.json");
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = birdFacts(B);
  safely("text", () => {
    T.writeOpening(F);
    T.writeEssentiel(F);
    T.writeQuand(F);
    T.writeOu(F);
    T.writeGravite(F);
    T.writeReponse(F);
    T.writeSources(F);
  });
  safely("opening", () => {
    $("#bd-open-stats").replaceChildren(stats(openingNumbers(F)));
    yearClock($("#bd-open-clock"), B, {
      label: `Horloge de l'année : impacts déclarés selon l'heure et le mois, ${F.p0}-${F.p1}.`,
    });
  });
  safely("hours", () =>
    hourGrid($("#chart-hours"), B, F, {
      label: `Impacts déclarés selon l'heure et le mois, ${F.p0}-${F.p1}.`,
    }),
  );
  safely("species", () =>
    speciesSeasons($("#chart-species"), F, {
      keys: [
        "Mourning dove",
        "Barn swallow",
        "Killdeer",
        "Horned lark",
        "American kestrel",
        "European starling",
        "Canada goose",
        "Turkey vulture",
      ],
      label: `Impacts déclarés chaque mois pour huit espèces, ${F.p0}-${F.p1}.`,
    }),
  );
  safely("height", () =>
    heightLadder($("#chart-height"), F, { label: `Impacts déclarés selon la hauteur au-dessus du sol, ${F.p0}-${F.p1}.` }),
  );
  safely("phase", () =>
    phaseProfile($("#chart-phase"), F, { label: `Impacts déclarés selon la phase du vol, ${F.p0}-${F.p1}.` }),
  );
  safely("parts", () =>
    partsPlane($("#chart-parts"), F, { label: `Impacts déclarés sur chaque pièce de l'avion, ${F.p0}-${F.p1}.` }),
  );
  safely("scatter", () =>
    speciesScatter($("#chart-scatter"), F, {
      label: `Espèces : impacts déclarés et part avec dégâts, ${F.p0}-${F.p1}.`,
      named: [
        { key: "Mourning dove", dy: -34, anchor: "end", dx: -6 },
        { key: "Turkey vulture", dy: -36 },
        { key: "White-tailed deer", dy: 4, dx: 26, anchor: "start" },
        { key: "Canada goose", dy: 40, wide: true },
        { key: "Barn swallow", dy: -56, dx: -30, anchor: "end", wide: true },
        { key: "Black vulture", dy: -30, wide: true },
        { key: "Red-tailed hawk", dy: -40, wide: true },
      ],
    }),
  );
  safely("lines", () =>
    reportsLines($("#chart-lines"), B, F, {
      label: `Impacts déclarés et impacts avec dégâts chaque année, ${F.first}-${F.last}.`,
    }),
  );
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(WSOURCES, document, "bsource");
  shareBlock();
  scrollHints(".topnav");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
