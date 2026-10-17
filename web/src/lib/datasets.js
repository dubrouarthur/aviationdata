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
    node.append(el("p", { class: "source-line" }, parts));
  }
}
