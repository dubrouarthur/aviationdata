import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./avions.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { numberChapters, partContents, readingProgress, shareBlock, trackChapters } from "./site/story.js";
import { storyGuide } from "./site/glossary.js";
import { atlasFrame } from "./site/atlas.js";
import { $, el, watchFrenchSpacing, scrollHints } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { getJSON, safely } from "./court/page.js";
import { addSourceLines } from "./court/sources.js";
import { worldFacts, usFacts } from "./avions/facts.js";
import { waffle, legend, bars, strip, dumbbell, heat, airlineSpread, GROUPS } from "./avions/charts.js";
import { compare } from "./avions/compare.js";
import { ASOURCES } from "./avions/sources.js";
import * as T from "./avions/text.js";

async function main() {
  let W;
  let U;
  try {
    [W, U] = await Promise.all([getJSON("data/avions/monde.json"), getJSON("data/avions/us.json")]);
  } catch (err) {
    $("main").prepend(
      el("p", {
        class: "wrap prose",
        text: `Les données n'ont pas pu être chargées (${err.message}). Rechargez la page.`,
      }),
    );
    return;
  }
  const Wf = worldFacts(W);
  const Uf = usFacts(U);
  safely("text", () => {
    T.writeOpening(Wf, Uf);
    T.writeEssentiel(Wf, Uf);
    T.writeWorld(Wf);
    T.writeUS(Uf);
    T.writeReponse(Wf, Uf);
    T.writeSources(W, U, Wf, Uf);
  });
  const pct =
    (d = 0) =>
    (v) =>
      `${fmtNum(v * 100, d)} %`;
  safely("opening", () => {
    waffle(
      $("#open-waffle"),
      GROUPS.map((g) => ({ key: g.key, value: Wf.groups[g.key] })),
      { label: `Cent vols d'avions de ligne suivis en ${Wf.last}, par famille.` },
    );
    legend($("#open-legend"), undefined, true);
  });
  safely("families", () =>
    bars(
      $("#chart-fam"),
      Wf.families.slice(0, 12).map((f) => ({
        label: f.label,
        note: Wf.families0.has(f.label)
          ? `${fmtNum(Wf.families0.get(f.label) * 100, 1)} % en ${Wf.first}`
          : "",
        value: f.share,
        group: f.group,
      })),
      {
        label: `Part des vols par famille, ${Wf.last}.`,
        fmt: pct(1),
        head: ["Famille", `Part des vols, ${Wf.last}`],
      },
    ),
  );
  safely("distances", () => {
    legend($("#km-legend"));
    strip(
      $("#chart-km"),
      Wf.byKm.map((m) => ({ label: m.name, value: m.kmMedian, group: m.group })),
      {
        label: `Distance médiane d'un vol par modèle, ${Wf.last}.`,
        fmt: T.fmt.km,
        log: true,
        head: ["Modèle", "Distance médiane"],
      },
    );
  });
  safely("usage", () =>
    bars(
      $("#chart-use"),
      Wf.byUse.map((m) => ({ label: m.name, value: m.flightsPerDay, group: m.group, note: m.kindFr })),
      {
        label: `Vols par jour de vol, par modèle, ${Wf.last}.`,
        fmt: (v) => fmtNum(v, 1),
        head: ["Modèle", "Vols par jour de vol"],
      },
    ),
  );
  safely("changes", () => {
    const rows = [...Wf.change.slice(0, 6), ...Wf.change.slice(-6)];
    const node = $("#chart-chg");
    const max = Math.max(...rows.map((r) => Math.abs(r.pp)));
    node.replaceChildren(
      el(
        "ol",
        { class: "av-div", "aria-label": `Évolution de la part de chaque modèle, ${Wf.first}-${Wf.last}.` },
        rows.map((r) =>
          el("li", { class: r.pp >= 0 ? "up" : "down" }, [
            el("span", { class: "av-div-l", text: r.name }),
            el(
              "span",
              { class: "av-div-t" },
              el("i", { style: `width:${((Math.abs(r.pp) / max) * 50).toFixed(1)}%` }),
            ),
            el("b", { text: `${r.pp >= 0 ? "+" : "−"}${fmtNum(Math.abs(r.pp), 1)} pt` }),
          ]),
        ),
      ),
    );
  });
  safely("countries", () => {
    const cols = GROUPS.map((g) => ({ label: g.label, group: g.key }));
    heat($("#chart-heat"), {
      cols,
      rows: Wf.countries.map((c) => ({
        label: c.name,
        note: `${fmtNum(c.total, 0)} vols`,
        cells: GROUPS.map((g) => c.shares[g.key]),
      })),
      label: `Part de chaque famille dans les vols partis de chaque pays, ${Wf.last}.`,
      fmt: pct(0),
    });
  });
  safely("ontime", () =>
    dumbbell(
      $("#chart-ot"),
      Uf.byOntime.map((m) => ({ label: m.name, a: m.ontimeExpected, b: m.ontime })),
      {
        label: `Ponctualité par modèle et ponctualité attendue de ses compagnies, États-Unis, ${Uf.year}.`,
        fmt: pct(0),
        domain: [0.68, 0.88],
        aName: "attendue de ses compagnies",
        bName: "à l'heure",
      },
    ),
  );
  safely("spread", () => {
    legend($("#sp-legend"), [...new Set(Uf.spreadRows.flatMap((r) => r.models.map((m) => m.group)))]);
    airlineSpread($("#chart-sp"), Uf.spreadRows, {
      label: `Ponctualité des modèles de chaque compagnie, ${Uf.year}.`,
      fmt: pct(0),
      domain: [0.64, 0.9],
    });
  });
  safely("cancel", () =>
    dumbbell(
      $("#chart-cx"),
      [...Uf.cm]
        .sort((x, y) => y.cancelRate - x.cancelRate)
        .map((m) => ({ label: m.name, a: m.cancelExpected, b: m.cancelRate })),
      {
        label: `Part des vols annulés par modèle, États-Unis, ${Uf.year}.`,
        fmt: pct(1),
        domain: [0, 0.04],
        better: "low",
        aName: "attendue de ses compagnies",
        bName: "annulés",
      },
    ),
  );
  safely("compare", () => {
    $("#cmp-note").textContent =
      `Dans le monde : vols suivis par OpenSky en ${Wf.last}. Aux États-Unis : vols intérieurs de ${Uf.year} (BTS). Chaque barre compare les deux modèles entre eux.`;
    compare($("#compare"), W, U, Wf);
  });
  numberChapters(".story-chapter");
  partContents();
  storyGuide();
  addSourceLines(ASOURCES, document, "asource");
  shareBlock();
  scrollHints(".topnav, .seg");
  if (location.hash === "#comparer") $("#comparer").scrollIntoView();
}

watchFrenchSpacing(document.body);
initSiteMenu();
trackChapters();
readingProgress();
atlasFrame();
main();
