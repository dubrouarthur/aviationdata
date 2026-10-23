import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./jet.css";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { shareUrl, linkedInShare } from "./lib/datasets.js";
import { kmh } from "./jet/fmt.js";
import { storyFacts, writeStory } from "./jet/text.js";
import { addJetSourceLines, initJetSources } from "./jet/sources.js";
import {
  histogram,
  routesChart,
  monthlyChart,
  scatterChart,
  dayStrip,
  gainsChart,
  roundTripChart,
  wintersChart,
  trappesMonths,
  trappesYears,
} from "./jet/charts.js";
import { openMap, explorer, climMap, coreAt } from "./jet/maps.js";

const FILES = ["flights", "routing", "hero", "climate", "trappes", "winds", "meta"];

async function load() {
  const parts = await Promise.all(
    FILES.map((f) =>
      fetch(asset(`data/jet/${f}.json`)).then((r) => {
        if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
        return r.json();
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
  safely("text", () => writeStory(data, F));
  safely("open map", () => openMap(data.hero));
  safely("histogram", () => histogram($("#chart-hist"), data.flights.pair, { east: F.medE, west: F.medW }));
  safely("routes", () => routesChart($("#chart-routes"), data.flights.routes));
  safely("monthly", () => monthlyChart($("#chart-monthly"), data.flights.pair.monthly));
  safely("scatter", () => scatterChart($("#chart-scatter"), data.flights.pair.days, data.flights.pair.fit));
  const exp = safely("explorer", () =>
    explorer({ grid: data.winds, flights: data.flights, onDay: (iso) => strip?.select(iso) }),
  );
  const strip = safely("strip", () =>
    dayStrip($("#chart-strip"), data.routing.days, (iso) => exp?.setDay(iso)),
  );
  strip?.select("2020-02-08");
  safely("gains", () => gainsChart($("#chart-gains"), data.routing.days));
  safely("round trip", () => roundTripChart($("#chart-rt"), data.routing));
  safely("winters", () => wintersChart($("#chart-winters"), data.climate));
  safely("clim", async () => {
    const a = data.winds.airports;
    const fields = await climMap(data.climate.clim, [a.KJFK, a.LFPG]);
    const w = coreAt(fields.djf, -60);
    const s = coreAt(fields.jja, -60);
    $("#clim-note").textContent =
      `Vitesse du vent moyen à 250 hPa, 1991-2020, réanalyse NCEP/NCAR (grille de 2,5°). Au large de l'Amérique (60° ouest), le jet d'hiver passe vers ${Math.round(w.lat)}° nord à ${kmh(w.kmh)} ; l'été, il remonte vers ${Math.round(s.lat)}° nord et faiblit à ${kmh(s.kmh)}.`;
  });
  safely("trappes months", () => trappesMonths($("#chart-tmonths"), data.trappes.months));
  safely("trappes years", () => trappesYears($("#chart-tyears"), data.trappes.years));
  safely("sources", () => initJetSources(data));
  addJetSourceLines();
  share();
  scrollHints(".topnav, .seg");
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

/** Sticky chapter nav: the chapter crossing the upper third of the screen is marked current. */
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
trackChapters();
readingProgress();
main();
