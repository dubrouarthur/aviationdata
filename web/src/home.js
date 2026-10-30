import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./eu.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { openMap } from "./eu/map.js";

watchFrenchSpacing(document.body);
initSiteMenu();

/** The lead story's opening figure: the airports of Europe in the last year, against 2019. */
async function leadMap() {
  const node = document.getElementById("lead-map");
  if (!node) return;
  const get = (u) => fetch(asset(u)).then((r) => r.json());
  const [data, geo] = await Promise.all([get("data/eu/eu.json"), get("geo/europe-50m.json")]);
  openMap(node, data, geo);
}

leadMap().catch((err) => console.error("lead map:", err));
