import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./jet.css";
import { initSiteMenu } from "./site/menu.js";
import { $, el, segmented, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { shareUrl, linkedInShare } from "./lib/datasets.js";
import * as d3 from "d3";
import { euros, kmh, longDate, monthShort } from "./jet/fmt.js";
import {
  storyFacts,
  writeStory,
  writeAvion,
  recordMarks,
  initSim,
  initVol,
  writeBref,
  writeJet,
  writePlacer,
  writeHistoire,
  writeBilan,
  writePrevoir,
  writeQuels,
  writeEssentiel,
  costFacts,
  forecastFacts,
  forecastRows,
} from "./jet/text.js";
import { addJetSourceLines, initJetSources } from "./jet/sources.js";
import {
  histogram,
  routesChart,
  monthlyChart,
  scatterChart,
  dayStrip,
  roundTripChart,
  wintersChart,
  typesChart,
  profileChart,
  valueChart,
  forecastChart,
  pairedBars,
  simChart,
  volChart,
} from "./jet/charts.js";
import { openMap, climMap, coreAt } from "./jet/maps.js";
import { explorer } from "./jet/explorer.js";
import { simulator } from "./jet/simulator.js";

const FILES = [
  "flights",
  "routing",
  "hero",
  "climate",
  "trappes",
  "winds",
  "meta",
  "sim",
  "sim_stats",
  "history",
  "cost",
  "forecast",
];

const OPTIONAL = new Set(["sim_stats", "history", "forecast"]); // the story still stands without them

async function load() {
  const parts = await Promise.all(
    FILES.map((f) =>
      fetch(asset(`data/jet/${f}.json`))
        .then((r) => {
          if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
          return r.json();
        })
        .catch((err) => {
          if (OPTIONAL.has(f)) return null;
          throw err;
        }),
    ),
  );
  return Object.fromEntries(FILES.map((f, i) => [f, parts[i]]));
}

// one broken chart must not take the story down
const safely = (name, fn) => {
  try {
    const out = fn();
    if (out?.catch) out.catch((err) => console.error(`${name}:`, err));
    return out;
  } catch (err) {
    console.error(`${name}:`, err);
  }
};

async function main() {
  let data;
  try {
    data = await load();
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose load-error",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const F = storyFacts(data);
  // the money of the story: a minute of cruise in kilos and euros (cost.json), the forecasts if built
  const C = costFacts(data);
  const P = data.forecast ? forecastFacts(data.forecast) : null;
  safely("text", () => writeStory(data, F, C));
  safely("essentials", () => writeEssentiel(F, C, P));
  safely("open map", () => openMap(data.hero, C));
  safely("histogram", () => histogram($("#chart-hist"), data.flights.pair, { east: F.medE, west: F.medW }));
  safely("routes", () => routesChart($("#chart-routes"), data.flights.routes));
  safely("monthly", () => monthlyChart($("#chart-monthly"), data.flights.pair.monthly));
  const pair = data.flights.pair;
  safely("scatter", () => scatterChart($("#chart-scatter"), pair.days, pair.fit, recordMarks(pair.records)));
  safely("aircraft", () => {
    writeAvion(data.flights);
    typesChart($("#chart-types"), data.flights.aircraft.types);
  });
  const exp = safely("explorer", () =>
    explorer({
      grid: data.winds,
      flights: data.flights,
      routing: data.routing,
      onDay: (iso) => strip?.select(iso),
    }),
  );
  const strip = safely("strip", () =>
    dayStrip($("#chart-strip"), data.routing.days, (iso) => exp?.setDay(iso)),
  );
  strip?.select(exp?.day ?? "2020-02-08");
  safely("strip scale", () => stripScale($("#strip-scale")));
  safely("round trip", () => roundTripChart($("#chart-rt"), data.routing));
  safely("simulator", () => {
    const km = pair.km;
    const sim = simChart($("#chart-sim"), { km, tas: data.routing.tas, winter: data.climate.mean });
    initSim(sim, { km, tas: data.routing.tas });
  });
  safely("winters", () => wintersChart($("#chart-winters"), data.climate));
  safely("clim", async () => {
    const a = data.winds.airports;
    const fields = await climMap(data.climate.clim, [a.KJFK, a.LFPG]);
    const w = coreAt(fields.djf, -60);
    const s = coreAt(fields.jja, -60);
    $("#clim-note").textContent =
      `Vitesse du vent moyen à 250 hPa, 1991-2020, réanalyse NCEP/NCAR (grille de 2,5°). Au large de l'Amérique (60° ouest), le jet d'hiver passe vers ${Math.round(w.lat)}° nord à ${kmh(w.kmh)} ; l'été, il remonte vers ${Math.round(s.lat)}° nord et faiblit à ${kmh(s.kmh)}.`;
  });
  safely("jet", () => {
    writeJet(data);
    profileChart($("#chart-profile"), data.trappes.profile);
  });
  const sim = safely("simulator", () => {
    writePlacer({ sim: data.sim, stats: data.sim_stats });
    return simulator({ sim: data.sim, grid: data.winds, cost: data.cost });
  });
  safely("costs", () => {
    if (!C.route) return ($("#bilan").hidden = true);
    writeBilan({ stats: data.sim_stats, sim: data.sim, cost: data.cost }, C);
    valueChart($("#chart-value"), {
      prices: data.cost.prices,
      tonnes: C.route.tonnesYear,
      mark: [data.cost.last.m],
      average: data.cost.year,
    });
  });
  safely("forecasts", () => {
    if (!P) return ($("#prevoir").hidden = $("#partie-4").hidden = true);
    writePrevoir(data.forecast, C);
    const box = $("#fc-dir");
    const dirs = { west: "Vers New York", east: "Vers Paris" };
    box.replaceChildren(
      ...Object.entries(dirs).map(([k, t]) => el("button", { type: "button", "data-v": k, text: t })),
    );
    const opts = (dir) => ({
      rows: forecastRows(data.forecast, dir),
      color: dir === "west" ? "var(--west)" : "var(--east)",
      eurOf: (m) => euros(C.eurOf(m)),
    });
    const chart = forecastChart($("#chart-forecast"), opts("west"));
    segmented(box, "west", (k) => chart.set(opts(k)));
  });
  safely("which flights", () => {
    if (!C.route) return ($("#quels-vols").hidden = $("#partie-5").hidden = true);
    const Q = writeQuels(C);
    const months = d3.range(1, 13).map((m) => monthShort(m).replace(".", ""));
    const series = (w, e) => [
      { name: "Vers New York", color: "var(--west)", values: w.map((v) => C.eurOf(v)) },
      { name: "Vers Paris", color: "var(--east)", values: e.map((v) => C.eurOf(v)) },
    ];
    const fmt = (v) => euros(v);
    const letters = months.map((m) => m[0].toUpperCase());
    pairedBars($("#chart-months"), {
      series: series(Q.mw, Q.me),
      ticks: months,
      short: letters,
      fmt,
      unit: "€",
    });
    pairedBars($("#chart-deciles"), {
      series: series(Q.dw, Q.de),
      ticks: d3.range(1, 11).map((k) => (k === 1 ? "1er" : `${k}e`)),
      fmt,
      unit: "€",
    });
  });
  safely("history", () => {
    if (!data.history) return ($("#histoire").hidden = true);
    writeHistoire(data);
    const simDays = data.sim.days.map((d) => d.day);
    const open = (iso) => {
      if (!simDays.includes(iso)) return;
      sim?.setDay(iso);
      document.getElementById("simulateur").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    recordsList(data.history, simDays, open);
  });
  safely("your flight", () => initVol(data.flights, volChart($("#chart-vol"))));
  safely("in short", () => writeBref(data, F, C, P));
  safely("sources", () => initJetSources(data));
  numberChapters();
  addJetSourceLines();
  share();
  scrollHints(".topnav, .seg");
}

/** The record days since 1948, with the storms; those the simulator holds open in it. */
function recordsList(history, simDays, open) {
  const item = (iso, v, title) =>
    el("li", {}, [
      el("span", { class: "rec-date", text: longDate(iso) }),
      el("span", { class: "rec-val", text: `${kmh(Math.abs(v))} ${v >= 0 ? "dans le dos" : "de face"}` }),
      title ? el("span", { class: "rec-title", text: title }) : null,
      simDays.includes(iso)
        ? el("button", {
            type: "button",
            class: "rec-open",
            text: "Ouvrir dans le simulateur",
            onclick: () => open(iso),
          })
        : null,
    ]);
  $("#records-list").replaceChildren(
    el("li", { class: "rec-head", text: "Les plus forts vents arrière vers Paris" }),
    ...history.top.slice(0, 6).map(([iso, v]) => item(iso, v)),
    el("li", { class: "rec-head", text: "Les vents les plus contraires" }),
    ...history.reversed.slice(0, 3).map(([iso, v]) => item(iso, v)),
    el("li", { class: "rec-head", text: "Les tempêtes" }),
    ...history.storms.map(([iso, title, v]) => item(iso, v, title)),
  );
}

/** The colour scale of the day strip: what a dark day means. */
function stripScale(node) {
  node.replaceChildren(
    el("span", { text: "0" }),
    el("i", { class: "ss-ramp", "aria-hidden": "true" }),
    el("span", { text: "60 min et plus gagnées" }),
  );
}

/** "03 / 10" above each chapter title: where the reader is in the story. */
function numberChapters() {
  const titles = [...document.querySelectorAll("main .jet-chapter h2.section-title")].filter(
    (h) => h.id !== "h-bref",
  );
  titles.forEach((h, i) => {
    if (h.previousElementSibling?.classList.contains("chapter-num")) return;
    h.before(
      el("p", { class: "chapter-num" }, [
        el("b", { text: String(i + 1).padStart(2, "0") }),
        ` / ${String(titles.length).padStart(2, "0")}`,
      ]),
    );
  });
}

function share() {
  const url = shareUrl();
  const copy = el("button", { type: "button", class: "btn", text: "Copier le lien" });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Lien copié";
    } catch {
      copy.textContent = url;
    }
    setTimeout(() => (copy.textContent = "Copier le lien"), 2500);
  });
  $("#share").replaceChildren(
    el("div", { class: "author-card" }, [
      el("img", { src: asset("auteur.jpg"), alt: "Arthur Dubrou", width: 76, height: 76, loading: "lazy" }),
      el("div", {}, [
        el("p", { class: "ac-by", text: "Une enquête en données de" }),
        el("p", { class: "ac-name", text: "Arthur Dubrou" }),
        el("a", {
          href: "https://www.linkedin.com/in/arthur-dubrou/",
          target: "_blank",
          rel: "noopener",
          text: "Me suivre sur LinkedIn",
        }),
      ]),
    ]),
    el("div", { class: "share-box" }, [
      el("p", { text: "Cette enquête vous a appris quelque chose ? Partagez-la." }),
      el("div", { class: "share-actions" }, [
        el("a", {
          class: "btn primary",
          href: linkedInShare(url),
          target: "_blank",
          rel: "noopener",
          text: "Partager sur LinkedIn",
        }),
        copy,
      ]),
    ]),
  );
}

/**
 * The bar of parts: the last part whose start has passed the upper third of the screen is current
 * (none above the first part), and the bar scrolls to keep it in view.
 */
function trackChapters() {
  const links = [...document.querySelectorAll(".topnav a")]
    .map((a) => ({ a, target: document.getElementById(a.hash.slice(1)) }))
    .filter((l) => l.target);
  let current = null;
  let raf = 0;
  const update = () => {
    raf = 0;
    const line = innerHeight * 0.33;
    let on = null;
    for (const l of links) if (l.target.getBoundingClientRect().top <= line) on = l;
    if (on === current) return;
    current = on;
    links.forEach((l) => l.a.setAttribute("aria-current", String(l === on)));
    const nav = on?.a.parentElement;
    if (nav && nav.scrollWidth > nav.clientWidth)
      nav.scrollTo({ left: on.a.offsetLeft - nav.offsetLeft - 24, behavior: "smooth" });
  };
  addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
  update();
}

function readingProgress() {
  const bar = document.getElementById("read-progress");
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

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
main();
