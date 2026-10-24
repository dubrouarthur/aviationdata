import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./hf.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { $, el, rich, segmented, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { fmtNum } from "./lib/format.js";
import { BIT, LAYERS, SEG_SHORT, storyFacts, view, group, events } from "./hf/facts.js";
import * as T from "./hf/text.js";
import {
  bars,
  pyramid,
  chainDiagram,
  cheeseChart,
  eventsChart,
  segmentsChart,
  historyChart,
} from "./hf/charts.js";
import { mosaic } from "./hf/mosaic.js";
import { addSourceLines, initSources } from "./hf/sources.js";

const FILES = ["accidents", "people", "events", "history", "meta"];

async function load() {
  const parts = await Promise.all(
    FILES.map((f) =>
      fetch(asset(`data/hf/${f}.json`)).then((r) => {
        if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
        return r.json();
      }),
    ),
  );
  return Object.fromEntries(FILES.map((f, i) => [f, parts[i]]));
}

const safely = (name, fn) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name}:`, err);
  }
};

/** The layers of a view, as bars. */
const layerRows = (v) => LAYERS.map((l) => ({ label: l.label, value: v.share(BIT[l.key]), color: l.color }));

const FAMILY = {
  skill: ["Exécution", "var(--human)"],
  decision: ["Décision", "var(--human-2)"],
  perception: ["Perception", "var(--human-3)"],
  physical: ["Condition préalable", "var(--pre)"],
  mental: ["Condition préalable", "var(--pre)"],
  experience: ["Condition préalable", "var(--pre)"],
  crew: ["Condition préalable", "var(--pre)"],
};
const familyLegend = ["skill", "decision", "perception", "physical"].map((k) => ({
  label: FAMILY[k][0],
  color: FAMILY[k][1],
}));
const errorBars = (people, g, n) =>
  T.errorRows(people, g, n).map((r) => ({
    label: r.label,
    value: r.n,
    color: FAMILY[r.family]?.[1] ?? "var(--human)",
    text: fmtNum(r.n),
  }));

/** HFACS: each level, then its families, as shares of the accidents citing a person or an organization. */
function levelRows(F, people) {
  const share = (n) => (100 * n) / F.hfacsBase;
  const rows = [];
  for (const lv of [1, 2, 3, 4]) {
    rows.push({
      label: `${lv}. ${people.levels[lv]}`,
      value: share(F.levels[lv]),
      color: lv === 1 ? "var(--human)" : lv === 2 ? "var(--pre)" : "var(--org)",
      head: true,
      text: T.pct(share(F.levels[lv]), F.levels[lv] / F.hfacsBase < 0.02 ? 1 : 0),
    });
    if (lv > 2) continue;
    for (const [k, label, level] of people.hfacs)
      if (level === lv && F.families[k])
        rows.push({
          label,
          value: share(F.families[k]),
          color: lv === 1 ? "var(--human)" : "var(--pre)",
          sub: true,
          text: T.pct(share(F.families[k]), F.families[k] / F.hfacsBase < 0.02 ? 1 : 0),
        });
  }
  return rows;
}

function tool(data) {
  const { accidents: acc, people, events: ev } = data;
  const segBox = $("#tool-seg");
  const sevBox = $("#tool-sev");
  const opt = (k, label) => el("button", { type: "button", "data-v": k, text: label });
  segBox.replaceChildren(opt("all", "Tous"), ...acc.segments.map(([k, l]) => opt(k, SEG_SHORT[k] ?? l)));
  sevBox.replaceChildren(opt("all", "Toutes"), ...acc.severities.map(([k, l]) => opt(k, l)));
  const state = { seg: "all", sev: "all" };
  const paint = () => {
    const v = view(acc, state);
    $("#tool-read").replaceChildren(rich(T.toolSentence(v, state.seg, state.sev, acc)));
    bars($("#tool-layers"), layerRows(v), { max: 100 });
    const g = group(people, state.seg, state.sev);
    bars($("#tool-errors"), errorBars(people, g, 8), { legend: familyLegend });
    eventsChart($("#tool-events"), events(ev, state.seg, state.sev), 10);
  };
  segmented(segBox, "all", (k) => ((state.seg = k), paint()));
  segmented(sevBox, "all", (k) => ((state.sev = k), paint()));
  paint();
}

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
  const { accidents: acc, people } = data;
  safely("opening", () => {
    T.writeOpening(F);
    mosaic($("#mosaic"), acc, {
      onCount: (lit, total) =>
        $("#hf-count").replaceChildren(
          el("b", { text: fmtNum(lit) }),
          ` accidents sur ${fmtNum(F.n)} citent une personne dans leur cause probable`,
          lit === total ? "." : "",
        ),
    });
  });
  safely("essentials", () => T.writeEssentiel(F));
  safely("verdict", () => {
    T.writeVerdict(F);
    const box = $("#layers-seg");
    const choices = [["all", "Tous"], ...acc.segments.filter(([k]) => k !== "other")];
    box.replaceChildren(
      ...choices.map(([k, l]) => el("button", { type: "button", "data-v": k, text: SEG_SHORT[k] ?? l })),
    );
    const draw = (seg) => bars($("#chart-layers"), layerRows(view(acc, { seg })), { max: 100 });
    segmented(box, "all", draw);
    draw("all");
  });
  safely("severity", () => {
    T.writeGravite(F);
    pyramid($("#chart-pyramid"), F.severity);
  });
  safely("history", () => {
    T.writeHistoire(F);
    historyChart($("#chart-history"), data.history);
  });
  safely("who", () => {
    T.writeQui(F, people);
    const g = group(people);
    bars(
      $("#chart-roles"),
      people.roles
        .filter(([k]) => k !== "other")
        .map(([k, label]) => ({ label, value: g.roles[k] ?? 0, text: fmtNum(g.roles[k] ?? 0) }))
        .sort((a, b) => b.value - a.value),
    );
  });
  safely("errors", () => {
    T.writeErreurs(F, people);
    bars($("#chart-errors"), errorBars(people, group(people), 14), { legend: familyLegend });
  });
  safely("hfacs", () => {
    T.writeHfacs(F, people);
    bars($("#chart-levels"), levelRows(F, people), { max: 100 });
  });
  safely("tem", () => {
    T.writeTem(F);
    chainDiagram($("#chart-chain"), F.chain);
  });
  safely("cheese", () => {
    T.writeFromage(F);
    cheeseChart($("#chart-cheese"), F.cheese.rows);
  });
  safely("events", () => {
    T.writeEvenements(F);
    eventsChart($("#chart-events"), F.events, 16);
  });
  safely("airlines", () => {
    T.writeCompagnies(F);
    segmentsChart(
      $("#chart-segments"),
      F.segs.filter((s) => s.key !== "other"),
    );
  });
  safely("tool", () => {
    T.writeExplorer();
    tool(data);
  });
  safely("answer", () => T.writeReponse(F));
  safely("sources", () => initSources(data));
  numberChapters(".story-chapter");
  addSourceLines();
  shareBlock();
  scrollHints(".topnav, .seg");
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
main();
