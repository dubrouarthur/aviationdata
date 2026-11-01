import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { loadAll } from "./lib/data.js";
import { el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { addSourceLines } from "./lib/datasets.js";
import { asset } from "./lib/site.js";
import { atlasFrame } from "./site/atlas.js";
import { trackChapters } from "./site/story.js";

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
  ["resume", () => import("./modules/resume.js").then((m) => m.initResume)],
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
          fetch(asset(u)).then((r) => {
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
  collapseLongIntros(); // the intros are written by the chapters
  scrollHints(".topnav, .seg, .moments");
}

watchFrenchSpacing(document.body); // "Source : DGAC" never breaks before its colon
initSiteMenu();
trackChapters();
numberChapters();
readingProgress();
atlasFrame();

/** On phones, a chapter intro of several paragraphs shows the first one and a "Lire la suite" toggle. */
function collapseLongIntros() {
  for (const prose of document.querySelectorAll(".chapter-lede .prose")) {
    if (prose.children.length < 2 || prose.classList.contains("collapsible")) continue;
    prose.classList.add("collapsible");
    const btn = el("button", {
      type: "button",
      class: "read-more",
      "aria-expanded": "false",
      text: "Lire la suite",
    });
    btn.addEventListener("click", () => {
      const open = prose.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Réduire" : "Lire la suite";
    });
    prose.after(btn);
  }
}

/** "03 / 11" above each chapter title: where the reader is in the story (its bar names only the parts). */
function numberChapters() {
  const titles = [
    ...document.querySelectorAll("main > section.chapter:not(.hero, #resume) h2.section-title"),
  ];
  titles.forEach((h2, i) => {
    if (h2.previousElementSibling?.classList.contains("chapter-num")) return;
    h2.before(
      el("p", { class: "chapter-num" }, [
        el("b", { text: String(i + 1).padStart(2, "0") }),
        ` / ${String(titles.length).padStart(2, "0")}`,
      ]),
    );
  });
}

/** Thin bar under the masthead: how far down the story the reader is. */
function readingProgress() {
  const bar = document.getElementById("read-progress");
  if (!bar) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0})`;
  };
  addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
  addEventListener("resize", update);
  update();
}
main();
