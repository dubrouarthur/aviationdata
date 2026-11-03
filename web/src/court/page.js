// What every page of the short format ("En 5 minutes") does: the masthead, the reading route, the flight
// plan of its steps under the question, the glossary, the source lines and the share box. The article
// itself only computes its facts and writes its words and charts (run).
import { initSiteMenu } from "../site/menu.js";
import { numberChapters, readingProgress, shareBlock, trackChapters } from "../site/story.js";
import { storyGuide } from "../site/glossary.js";
import { atlasFrame } from "../site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { addSourceLines } from "./sources.js";

export const getJSON = (u) =>
  fetch(asset(u)).then((r) => {
    if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
    return r.json();
  });

export const safely = (name, fn) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name}:`, err);
  }
};

/** The steps of the article, as a route under the question: each one a reporting point and a link. */
export function flightPlan() {
  const list = $("#flightplan");
  if (!list) return;
  const steps = [...document.querySelectorAll("main .court-step")].map((s, i) => {
    const title = s.querySelector("h2.section-title");
    return el(
      "li",
      {},
      el("a", { href: `#${s.id}` }, [el("span", { class: "fp-no", text: String(i + 1) }), title.textContent]),
    );
  });
  steps.push(
    el(
      "li",
      { class: "fp-end" },
      el("a", { href: "#en-bref" }, [el("span", { class: "fp-no", text: "✓" }), "La réponse"]),
    ),
  );
  list.replaceChildren(...steps);
}

export async function courtPage({ files, sources, run }) {
  watchFrenchSpacing(document.body);
  initSiteMenu();
  trackChapters();
  readingProgress();
  atlasFrame();
  let data;
  try {
    data = await Promise.all(files.map(getJSON));
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  run(...data);
  numberChapters(".court-step");
  flightPlan();
  storyGuide();
  addSourceLines(sources);
  shareBlock();
  scrollHints(".topnav, .seg");
}
