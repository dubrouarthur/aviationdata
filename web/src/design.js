import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./about.css";
import "./design.css";
import "./site/atlas.css";
import "./site/carte.css";
import { initSiteMenu } from "./site/menu.js";
import { el, watchFrenchSpacing } from "./lib/ui.js";
import { hbars } from "./court/charts.js";

watchFrenchSpacing(document.body);
initSiteMenu();

// every swatch reads its value from the stylesheet itself: the page can never show a stale colour
const root = getComputedStyle(document.documentElement);
for (const sw of document.querySelectorAll("[data-token]")) {
  const v = root.getPropertyValue(sw.dataset.token).trim();
  sw.style.setProperty("--sw", `var(${sw.dataset.token})`);
  sw.querySelector(".tk-val")?.replaceChildren(v);
}

// a live figure of the short format, with made-up values (said so in its title)
hbars(document.getElementById("demo-bars"), {
  rows: [
    { label: "Le constat", note: "magenta : ce dont parle l'article", value: 64, color: "magenta" },
    { label: "Une autre série", note: "bleu carte : les données", value: 41, color: "blue" },
    { label: "La référence", note: "encre : le total, la moyenne", value: 23, color: "ink", strong: true },
  ],
  label: "Exemple de barres, valeurs fictives",
  fmt: (v) => `${v} %`,
  head: "Valeur fictive",
});
document.getElementById("demo-bars").append(el("p", { class: "note lecture" }, [el("b", { text: "Lecture : " }), "valeurs fictives, pour montrer le composant."]));
