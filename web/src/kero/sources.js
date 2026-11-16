// @ts-check
// Sources of « D'où vient le kérosène des avions européens ? »: Eurostat (imports by partner, monthly balance,
// Comext), the US Energy Information Administration (prices), and the dated facts of the story.
import { FACTS as CIEL_FACTS } from "../modules/sources.js";

export const KSOURCES = {
  imports: {
    producer: "Eurostat",
    label:
      "Eurostat, importations de pétrole et de produits pétroliers par pays d'origine, données mensuelles (nrg_ti_oilm)",
    short: "importations par origine (nrg_ti_oilm)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/nrg_ti_oilm/default/table",
  },
  balance: {
    producer: "Eurostat",
    label:
      "Eurostat, approvisionnement, transformation et consommation de produits pétroliers, données mensuelles (nrg_cb_oilm)",
    short: "bilan mensuel (nrg_cb_oilm)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/nrg_cb_oilm/default/table",
  },
  comext: {
    producer: "Eurostat",
    label:
      "Eurostat Comext, commerce de l'Union par produit de la nomenclature combinée (DS-045409), code 2710 19 21, carburéacteurs type kérosène",
    short: "douanes, Comext (2710 19 21)",
    url: "https://ec.europa.eu/eurostat/comext/newxtweb/",
  },
  eia: {
    producer: "US Energy Information Administration",
    label:
      "US Energy Information Administration, prix au comptant du kérosène aviation (côte du golfe du Mexique) et du Brent",
    short: "prix au comptant, EIA",
    url: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm",
  },
  naturalearth: {
    producer: "Natural Earth",
    label: "Natural Earth, contours des pays au 1:110 000 000 (via world-atlas)",
    short: "Natural Earth (contours)",
    url: "https://www.naturalearthdata.com/",
  },
};

// facts outside the data, dated and sourced (checked on 16 November 2026)
export const FACTS = {
  hormuz: CIEL_FACTS.hormuz,
  russia: {
    text: "Depuis le 5 février 2023, l'Union européenne interdit l'importation des produits pétroliers russes, kérosène compris, en complément de l'embargo sur le pétrole brut russe transporté par mer entré en vigueur le 5 décembre 2022.",
    source:
      "Forum économique mondial, « Here's what you need to know about the EU's ban on Russian oil products », février 2023",
    url: "https://www.weforum.org/agenda/2023/02/eu-ban-on-russian-oil-products-ukraine",
  },
};
