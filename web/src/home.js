// @ts-check
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./eu.css";
import "./saisons.css";
import "./jets.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { jetFacts, monthLabel } from "./jets/facts.js";
import { hundred } from "./jets/charts.js";
import { homeRoutes } from "./home/routes.js";
import { quiz } from "./home/quiz.js";

watchFrenchSpacing(document.body);
initSiteMenu();

/** The lead story's figure (n° 9): a hundred flights before, during and after the Covid; and the
 * business-jet routes behind the opening. Both read jets.json. */
async function leadJets() {
  const node = document.getElementById("lead-jets");
  const J = await fetch(asset("data/jets/jets.json")).then((r) => r.json());
  const routes = document.getElementById("home-routes");
  if (routes) homeRoutes(routes, J);
  if (!node) return;
  const F = jetFacts(J);
  hundred(node, [
    { label: `en ${F.first}`, share: F.share0 },
    { label: `en ${monthLabel(F.peak.month)}`, share: F.peak.share, strong: true },
  ]);
}

leadJets().catch((err) => console.error("lead:", err));

const list = document.getElementById("quiz-list");
if (list) quiz(list);
