import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./about.css";
import "./donnees.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing, scrollHints } from "./lib/ui.js";

watchFrenchSpacing(document.body);
initSiteMenu();
scrollHints(".data-filter");

// the filter: the datasets, references and facts of one investigation, or all of them; the choice stays
// in the address (?enquete=eu) so that a link can open the page filtered
const buttons = [...document.querySelectorAll(".data-filter button")];
const items = [...document.querySelectorAll("[data-issues]")];
function show(key) {
  for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.issue === key));
  for (const it of items) it.hidden = key !== "all" && !it.dataset.issues.split(" ").includes(key);
  const url = new URL(location.href);
  if (key === "all") url.searchParams.delete("enquete");
  else url.searchParams.set("enquete", key);
  history.replaceState(null, "", url);
}
for (const b of buttons) b.addEventListener("click", () => show(b.dataset.issue));
const asked = new URLSearchParams(location.search).get("enquete");
if (asked && buttons.some((b) => b.dataset.issue === asked)) show(asked);
