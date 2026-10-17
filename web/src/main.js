import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import { loadAll } from "./lib/data.js";
import { el } from "./lib/ui.js";
import { addSourceLines } from "./lib/datasets.js";

const CHAPTERS = [
  ["globe", () => import("./modules/globe.js").then((m) => m.initGlobe)],
  ["spiral", () => import("./modules/spiral.js").then((m) => m.initSpiral)],
  ["fill", () => import("./modules/fill.js").then((m) => m.initFill)],
  ["covid", () => import("./modules/covid.js").then((m) => m.initCovid)],
  ["fret", () => import("./modules/fret.js").then((m) => m.initFret)],
  ["france", () => import("./modules/france.js").then((m) => m.initFrance)],
  ["distance", () => import("./modules/distance.js").then((m) => m.initDistance)],
  ["co2", () => import("./modules/co2.js").then((m) => m.initCo2)],
  ["airport", () => import("./modules/airport.js").then((m) => m.initAirport)],
  ["race", () => import("./modules/race.js").then((m) => m.initRace)],
  ["pavillon", () => import("./modules/pavillon.js").then((m) => m.initPavillon)],
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
    document.querySelector("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  if (data.meta.demo) document.getElementById("demo-banner").hidden = false;
  addSourceLines(); // a link to its DGAC dataset under every chart
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

/** Sticky chapter nav: the link of the chapter crossing the upper third of the screen is marked current. */
function trackChapters() {
  const links = new Map([...document.querySelectorAll(".topnav a")].map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a, id) => a.setAttribute("aria-current", String(id === e.target.id)));
        const a = links.get(e.target.id);
        const nav = a?.parentElement;
        if (nav && nav.scrollWidth > nav.clientWidth)
          nav.scrollTo({ left: a.offsetLeft - nav.offsetLeft - 24, behavior: "smooth" });
      }
    },
    { rootMargin: "-30% 0px -65% 0px" },
  );
  links.forEach((_, id) => document.getElementById(id) && io.observe(document.getElementById(id)));
}

trackChapters();
main();
