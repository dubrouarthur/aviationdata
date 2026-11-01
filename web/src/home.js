import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./eu.css";
import "./saisons.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { seasonFacts } from "./saisons/facts.js";
import { calendar } from "./saisons/charts.js";
import { quiz } from "./home/quiz.js";

watchFrenchSpacing(document.body);
initSiteMenu();

/** The lead story's opening figure: the calendar of thirty countries in the last year. */
async function leadCalendar() {
  const node = document.getElementById("lead-cal");
  if (!node) return;
  const data = await fetch(asset("data/eu/eu.json")).then((r) => r.json());
  calendar(node, seasonFacts(data), { onPick: () => {}, compact: true });
}

leadCalendar().catch((err) => console.error("lead calendar:", err));

const list = document.getElementById("quiz-list");
if (list) quiz(list);
