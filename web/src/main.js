import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import { loadAll, selection } from "./lib/data.js";
import { el, segmented } from "./lib/ui.js";
import { initMap } from "./modules/map.js";
import { initTrajectories } from "./modules/trajectories.js";
import { initAirport } from "./modules/airport.js";
import { initPrices } from "./modules/prices.js";
import { initCarriers } from "./modules/carriers.js";
import { initCo2 } from "./modules/co2.js";
import { initSources } from "./modules/sources.js";

function initTheme() {
  const root = document.documentElement;
  const current =
    root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  segmented(
    document.getElementById("theme-toggle"),
    current,
    (v) => {
      root.dataset.theme = v;
      try {
        localStorage.setItem("theme", v);
      } catch {
        /* storage may be unavailable */
      }
    },
    "theme",
  );
}

async function main() {
  initTheme();
  let data;
  try {
    data = await loadAll();
  } catch (err) {
    document
      .querySelector("main")
      .prepend(
        el("p", {
          class: "wrap lede",
          text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
        }),
      );
    return;
  }
  if (data.meta.demo) document.getElementById("demo-banner").hidden = false;

  initMap(data);
  initTrajectories(data);
  initAirport(data);
  initPrices(data);
  initCarriers(data);
  initCo2(data);
  initSources(data);

  const fromHash = selection.fromHash();
  const fallback = data.aeroports.airports[0]?.code;
  selection.set(fromHash && data.aeroports.airports.some((a) => a.code === fromHash) ? fromHash : fallback);
  if (fromHash) document.getElementById("aeroport")?.scrollIntoView();
}

main();
