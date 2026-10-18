import { el } from "./ui.js";

/** DGAC datasets on data.gouv.fr: the only sources of the page. */
export const DATASETS = {
  trafic: {
    label: "Trafic aérien commercial mensuel français",
    short: "trafic aérien commercial mensuel",
    url: "https://www.data.gouv.fr/datasets/trafic-aerien-commercial-mensuel-francais-par-paire-daeroports-par-sens-depuis-1990",
  },
  iptap: {
    label: "Indices des prix du transport aérien de passagers (IPTAP)",
    short: "indices des prix du transport aérien (IPTAP)",
    url: "https://www.data.gouv.fr/datasets/indices-des-prix-du-transport-aerien-de-passagers",
  },
  co2: {
    label: "Émissions nettes annuelles de CO2 du trafic aérien commercial en France",
    short: "émissions de CO2 du trafic aérien commercial",
    url: "https://www.data.gouv.fr/datasets/emissions-nettes-annuelles-de-co2-du-trafic-aerien-commercial-en-france",
  },
};

/** Address to share: the canonical one when the build knows it, else this page; optional chapter anchor. */
export function shareUrl(id = "") {
  const og = document.querySelector('meta[property="og:url"]')?.content || "";
  const base = /^https?:\/\//.test(og) ? og : location.href.split("#")[0];
  return id ? `${base}#${id}` : base;
}
export const linkedInShare = (url) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
const SHARE_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2h4v4M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * A source line with a link to each DGAC dataset, at the end of every element carrying data-source
 * ("trafic", "co2", "iptap trafic"...). data-series names the DGAC series used, e.g. "par compagnie".
 */
export function addSourceLines(root = document) {
  for (const node of root.querySelectorAll("[data-source]")) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset.source.split(/\s+/).filter((k) => DATASETS[k]);
    if (!keys.length) continue;
    const parts = [keys.length > 1 ? "Sources : DGAC, " : "Source : DGAC, "];
    keys.forEach((k, i) => {
      if (i) parts.push(i === keys.length - 1 ? " et " : ", ");
      parts.push(
        el("a", { href: DATASETS[k].url, target: "_blank", rel: "noopener", text: DATASETS[k].short }),
      );
    });
    if (node.dataset.series) parts.push(` (${node.dataset.series})`);
    parts.push(", data.gouv.fr");
    // and a way to share this very chart: the link opens the page at its chapter
    const chapter = node.closest("section[id]");
    const share = el("a", {
      class: "share-chart",
      href: linkedInShare(shareUrl(chapter?.id)),
      target: "_blank",
      rel: "noopener",
      "aria-label": `Partager ce graphique sur LinkedIn${chapter ? ` (chapitre ${chapter.querySelector("h2")?.textContent.trim() || ""})` : ""}`,
    });
    share.innerHTML = `${SHARE_ICON}<span>Partager sur LinkedIn</span>`;
    node.append(el("div", { class: "source-line" }, [el("p", {}, parts), share]));
  }
}
