import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import { loadAll } from "./lib/data.js";
import { el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
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
  collapseLongIntros(); // the intros are written by the chapters
  scrollHints(".topnav, .seg, .moments");
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

watchFrenchSpacing(document.body); // "Source : DGAC" never breaks before its colon
trackChapters();
numberChapters();
readingProgress();

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

/** "03 / 11" above each chapter title: where the reader is in the story. */
function numberChapters() {
  const ids = [...document.querySelectorAll(".topnav a")]
    .map((a) => a.hash.slice(1))
    .filter((id) => id !== "monde" && id !== "resume");
  ids.forEach((id, i) => {
    const h2 = document.querySelector(`#${id} h2.section-title`);
    if (!h2 || h2.previousElementSibling?.classList.contains("chapter-num")) return;
    h2.before(
      el("p", { class: "chapter-num" }, [
        el("b", { text: String(i + 1).padStart(2, "0") }),
        ` / ${String(ids.length).padStart(2, "0")}`,
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
