import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./about.css";
import "./archive.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";

watchFrenchSpacing(document.body);
initSiteMenu();

// filter the investigations by topic; the choice stays in the address (?theme=...)
const buttons = [...document.querySelectorAll("#archive-topics button")];
const items = [...document.querySelectorAll("#archive-list .arc-item")];
const count = document.getElementById("archive-count");
const show = (topic, write = true) => {
  let n = 0;
  for (const it of items) {
    const on = !topic || it.dataset.topic === topic;
    it.hidden = !on;
    n += on;
  }
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.topic === topic)));
  count.textContent = `${n} enquête${n > 1 ? "s" : ""}`;
  if (write) {
    const url = new URL(location.href);
    if (topic) url.searchParams.set("theme", topic);
    else url.searchParams.delete("theme");
    history.replaceState(null, "", url);
  }
};
buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.topic)));
const wanted = new URL(location.href).searchParams.get("theme") ?? "";
show(buttons.some((b) => b.dataset.topic === wanted) ? wanted : "", false);
