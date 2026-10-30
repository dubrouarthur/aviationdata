import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./about.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";

watchFrenchSpacing(document.body);
initSiteMenu();

// the table of contents marks the section being read
const links = new Map([...document.querySelectorAll(".about-toc a")].map((a) => [a.hash.slice(1), a]));
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, id) =>
        id === e.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"),
      );
    }
  },
  { rootMargin: "-20% 0px -70% 0px" },
);
links.forEach((_, id) => {
  const s = document.getElementById(id);
  if (s) io.observe(s);
});
