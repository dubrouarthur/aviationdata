import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import { loadAll } from "./lib/data.js";
import { el } from "./lib/ui.js";

const CHAPTERS = [
  ["globe", () => import("./modules/globe.js").then((m) => m.initGlobe)],
  ["spiral", () => import("./modules/spiral.js").then((m) => m.initSpiral)],
  ["fill", () => import("./modules/fill.js").then((m) => m.initFill)],
  ["covid", () => import("./modules/covid.js").then((m) => m.initCovid)],
  ["france", () => import("./modules/france.js").then((m) => m.initFrance)],
  ["distance", () => import("./modules/distance.js").then((m) => m.initDistance)],
  ["airport", () => import("./modules/airport.js").then((m) => m.initAirport)],
  ["race", () => import("./modules/race.js").then((m) => m.initRace)],
  ["prices", () => import("./modules/prices.js").then((m) => m.initPrices)],
  ["sources", () => import("./modules/sources.js").then((m) => m.initSources)],
];

async function main() {
  let data;
  let geo;
  try {
    [data, geo] = await Promise.all([
      loadAll(),
      Promise.all(
        ["geo/land-dots.json", "geo/world-110m.json", "geo/metropole.geojson"].map((u) =>
          fetch(u).then((r) => {
            if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
            return r.json();
          }),
        ),
      ),
    ]);
  } catch (err) {
    document
      .querySelector("main")
      .prepend(
        el("p", {
          class: "wrap prose",
          text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
        }),
      );
    return;
  }
  if (data.meta.demo) document.getElementById("demo-banner").hidden = false;
  const [dots, world, france] = geo;
  const ctx = { dots, world, france };
  for (const [name, load] of CHAPTERS) {
    try {
      const init = await load();
      init(data, ctx);
    } catch (err) {
      // one broken chapter must not take the whole story down
      console.error(`chapter ${name}:`, err);
    }
  }
}

main();
