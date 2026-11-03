// Sources of « Le billet d'avion est-il plus cher ? »: the DGAC's airfare index (the same dataset as the
// first investigation), the DGAC's monthly bulletin for its method, Eurostat's consumer prices.
import { DATASETS as DGAC } from "../lib/datasets.js";
import { ESOURCES } from "../eu/sources.js";

export const BSOURCES = {
  iptap: { ...DGAC.iptap, producer: "DGAC" },
  bulletin: {
    producer: "DGAC",
    label:
      "DGAC, Indices des prix du transport aérien de passagers, bulletin n° 166 (juillet 2026), 15 août 2026",
    short: "bulletin IPTAP n° 166",
    url: "https://www.ecologie.gouv.fr/sites/default/files/documents/IPTAP%20166.pdf",
  },
  hicp: {
    producer: "Eurostat",
    label: "Eurostat, indice des prix à la consommation harmonisé, France (prc_hicp_minr)",
    short: "indice des prix à la consommation harmonisé (prc_hicp_minr)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table?lang=fr",
  },
  copyright: ESOURCES.copyright,
};

/** What the DGAC says of its index (bulletin n° 166, 15 August 2026), quoted in the method. */
export const METHOD = {
  fares: "plus de 300 000",
  routes: "627",
  carriers: "un peu plus de 70",
};
