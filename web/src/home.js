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
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { getJSON } from "./court/page.js";
import { stats } from "./lib/chartkit.js";
import { atfmFacts } from "./atfm/facts.js";
import { calendar } from "./atfm/charts.js";
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

/** The lead story's figure (n° 12): its three opening numbers and the calendar of every day since 2014. */
async function lead() {
  const node = document.getElementById("lead-cal");
  if (!node) return;
  const A = await getJSON("data/atfm/atfm.json");
  const F = atfmFacts(A);
  document.getElementById("lead-stats")?.replaceChildren(
    stats([
      { value: `1 sur ${fmtNum(Math.round(1 / F.delayed), 0)}`, label: `vols retardés par le contrôle en route en ${F.year}` },
      { value: `${fmtNum(F.perDelayed, 0)} min`, label: "d'attente en moyenne pour ces vols" },
      { value: `× ${fmtNum(F.ratio, 1)}`, label: "de retard par vol depuis 2014-2017", hi: true },
    ]),
  );
  calendar(node, A, { max: 6, night: true, label: node.getAttribute("aria-label") ?? "" });
}

openingRoutes().catch((err) => console.error("routes:", err));
lead().catch((err) => console.error("lead:", err));

const list = document.getElementById("quiz-list");
if (list) quiz(list);
