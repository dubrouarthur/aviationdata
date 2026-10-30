// The atlas frame, on every story: "Figure n" above each figure, and at the top of each chapter the list
// of the data it draws on (the margin on wide screens, under the lede on narrow ones). Both are read from
// the page itself, from the "Source : ..." line every figure carries, so a chapter can never show a figure
// whose source it does not name. Figures and their source lines are drawn as the data arrive: the frame
// follows the page (MutationObserver) until it stops changing.
import { el } from "../lib/ui.js";

const TOP = ":scope > .chapter-lede, :scope > .chapter-head";

/** The figures of the story, in reading order: panels not nested in another one, not hidden. */
function figures(main) {
  return [...main.querySelectorAll(".panel")].filter(
    (p) => !p.parentElement.closest(".panel") && !p.closest("[hidden]"),
  );
}

/** "Figure 1", "Figure 2"... as the first line of each figure. */
export function numberFigures(main = document.querySelector("main")) {
  figures(main).forEach((p, i) => {
    const text = `Figure ${i + 1}`;
    let tag = p.querySelector(":scope > .fig-no");
    if (!tag) {
      tag = el("p", { class: "fig-no" });
      p.prepend(tag);
    }
    if (tag.textContent !== text) tag.textContent = text;
  });
}

/**
 * The sources a line names, one per link, each with its producer when the line gives it before the link
 * ("Source : DGAC, <a>trafic aérien commercial mensuel</a>" -> "DGAC, trafic aérien commercial mensuel").
 */
function sourceItems(line) {
  const p = line.querySelector("p");
  if (!p) return [];
  return [...p.querySelectorAll("a")].map((a) => {
    const before = a.previousSibling?.nodeType === Node.TEXT_NODE ? a.previousSibling.textContent : "";
    const producer = before
      .replace(/^.*:\s*/, "")
      .replace(/(^|\s)(et|,)\s*$/, "")
      .replace(/,\s*$/, "")
      .trim();
    const link = a.cloneNode(true);
    link.removeAttribute("id");
    return { key: a.href, item: el("li", {}, producer ? [`${producer}, `, link] : [link]) };
  });
}

/** "Les données de ce chapitre", from the source lines of its figures. */
export function chapterSources(main = document.querySelector("main")) {
  for (const section of main.querySelectorAll("section.chapter")) {
    const top = section.querySelector(TOP);
    if (!top || section.closest("[hidden]")) continue;
    const seen = new Map();
    for (const line of section.querySelectorAll(".source-line")) {
      if (line.closest(".chapter-sources")) continue;
      for (const { key, item } of sourceItems(line)) if (!seen.has(key)) seen.set(key, item);
    }
    let box = section.querySelector(":scope > .chapter-sources");
    if (!seen.size) {
      box?.remove();
      continue;
    }
    const sig = [...seen.keys()].join("|");
    if (box?.dataset.sig === sig) continue;
    const list = el("ul", {}, [...seen.values()]);
    const fresh = el("aside", { class: "chapter-sources", "aria-label": "Les données de ce chapitre" }, [
      el("p", {
        class: "cs-title",
        text: seen.size > 1 ? "Les données de ce chapitre" : "La donnée de ce chapitre",
      }),
      list,
    ]);
    fresh.dataset.sig = sig;
    if (box) box.replaceWith(fresh);
    else top.after(fresh);
  }
}

/** Number the figures and list each chapter's sources, now and whenever the story draws more. */
export function atlasFrame() {
  const main = document.querySelector("main");
  if (!main) return;
  let timer = 0;
  const run = () => {
    timer = 0;
    observer.disconnect();
    numberFigures(main);
    chapterSources(main);
    observer.observe(main, { childList: true, subtree: true });
  };
  // at most every quarter of a second, and never starved: a counter that animates for seconds keeps the
  // page changing, and a timer reset on each change would never fire
  const observer = new MutationObserver(() => {
    timer ||= setTimeout(run, 250);
  });
  run();
}
