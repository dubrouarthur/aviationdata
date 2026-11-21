// @ts-check
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./eu.css";
import "./saisons.css";
import "./jets.css";
import "./cat.css";
import "./atfm.css";
import "./birds.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { getJSON } from "./court/page.js";
import { stats } from "./lib/chartkit.js";
import { birdFacts, openingNumbers } from "./birds/facts.js";
import { yearClock } from "./birds/charts.js";
import { homeRoutes } from "./home/routes.js";
import { quiz } from "./home/quiz.js";

watchFrenchSpacing(document.body);
initSiteMenu();

/** The business-jet routes behind the opening (jets.json). */
async function openingRoutes() {
  const routes = document.getElementById("home-routes");
  if (!routes) return;
  homeRoutes(routes, await getJSON("data/jets/jets.json"));
}

/** The lead story's figure (n° 13): its three opening numbers and the year as a clock. */
async function lead() {
  const node = document.getElementById("lead-clock");
  if (!node) return;
  const F0 = await getJSON("data/birds/birds.json");
  const F = birdFacts(F0);
  document.getElementById("lead-stats")?.replaceChildren(stats(openingNumbers(F)));
  yearClock(node, F0, { label: node.getAttribute("aria-label") ?? "" });
}

openingRoutes().catch((err) => console.error("routes:", err));
lead().catch((err) => console.error("lead:", err));

const list = document.getElementById("quiz-list");
if (list) quiz(list);
