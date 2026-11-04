// Source lines of the short format: "Source : ..." under every element carrying data-csource="a b",
// from the article's own table, so that a link is written once (and listed on /donnees through
// site/data-registry.js, whose test fails if a key is missing there).
import { el } from "../lib/ui.js";

export const link = (s, text) =>
  el("a", { href: s.url, target: "_blank", rel: "noopener", text: text ?? s.short });

export function addSourceLines(table, root = document, attr = "csource") {
  for (const node of root.querySelectorAll(`[data-${attr}]`)) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset[attr].split(/\s+/).filter((k) => table[k]);
    const parts = [keys.length > 1 ? "Sources : " : "Source : "];
    keys.forEach((k, i) => {
      if (i) parts.push(i === keys.length - 1 ? " et " : ", ");
      if (table[k].producer) parts.push(`${table[k].producer}, `);
      parts.push(link(table[k]));
    });
    parts.push(". Calculs aviationdata.");
    node.append(el("div", { class: "source-line" }, el("p", {}, parts)));
  }
}
