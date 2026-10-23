// Every source of the jet-stream story, with its licence, and the dated facts from outside the
// data. Used for the line under each chart (data-jsource) and for the method section.
import { $, el } from "../lib/ui.js";
import { longDate } from "./fmt.js";

export const JSOURCES = {
  opensky: {
    short: "OpenSky Network",
    label: "The OpenSky Network, données de vols 2019-2022 (Zenodo, Strohmeier et al., 2021)",
    url: "https://doi.org/10.5281/zenodo.7923702",
  },
  era5: {
    short: "ERA5, Copernicus/ECMWF",
    label: "ERA5, Copernicus Climate Change Service / ECMWF (Hersbach et al., 2020)",
    url: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-pressure-levels",
  },
  r1: {
    short: "NCEP/NCAR, NOAA",
    label: "Réanalyse NCEP/NCAR R1, NOAA Physical Sciences Laboratory (Kalnay et al., 1996)",
    url: "https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.html",
  },
  nao: {
    short: "indice NAO, NOAA CPC",
    label: "Indice mensuel de l'oscillation nord-atlantique, NOAA Climate Prediction Center",
    url: "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/nao.shtml",
  },
  igra: {
    short: "Météo-France, archive IGRA de la NOAA",
    label:
      "Radiosondages de Météo-France à Trappes (station 07145), archive IGRA 2, NOAA NCEI (Durre et al., 2016)",
    url: "https://www.ncei.noaa.gov/products/weather-balloon/integrated-global-radiosonde-archive",
  },
  nasa: {
    short: "NASA Worldview",
    label: "Image VIIRS (satellite Suomi NPP), NASA Worldview / GIBS",
    url: "https://worldview.earthdata.nasa.gov/",
  },
};

/** "Source : ..." under every element carrying data-jsource="opensky era5". */
export function addJetSourceLines(root = document) {
  for (const node of root.querySelectorAll("[data-jsource]")) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset.jsource.split(/\s+/).filter((k) => JSOURCES[k]);
    const links = [];
    keys.forEach((k, i) => {
      if (i) links.push(i === keys.length - 1 ? " et " : ", ");
      links.push(
        el("a", { href: JSOURCES[k].url, target: "_blank", rel: "noopener", text: JSOURCES[k].short }),
      );
    });
    const line = el(
      "div",
      { class: "source-line" },
      el("p", {}, ["Source : ", ...links, ". Calculs aviationdata."]),
    );
    (node.classList.contains("explorer") ? node.querySelector(".explorer-foot") : node).append(line);
  }
}

/** Facts from outside the data: dated, sourced, never presented as caused by what the charts show. */
export const FACTS = {
  ba112: {
    text: "Vol BA112 de British Airways, New York-JFK–Londres-Heathrow, décollage le 8 février 2020 à 23 h 21 UTC, atterrissage le 9 à 04 h 17 : 4 h 56, record du vol commercial subsonique transatlantique le plus rapide.",
    source: "Guinness World Records",
    url: "https://www.guinnessworldrecords.com/world-records/601621-fastest-subsonic-transatlantic-commercial-flight",
  },
  nat: {
    text: "Les North Atlantic Tracks sont publiées par les centres de contrôle de Shanwick (EGGX) et de Gander (CZQX), recalculées deux fois par jour pour suivre les vents en altitude, vers l'ouest le jour et vers l'est la nuit.",
    source: "OACI, North Atlantic Operations and Airspace Manual (NAT Doc 007), mars 2025, via Wikipédia",
    url: "https://en.wikipedia.org/wiki/North_Atlantic_Tracks",
  },
  williams: {
    text: "Williams, P. D. (2016), « Transatlantic flight times and climate change », Environmental Research Letters, publié le 10 février 2016 : avec un doublement du CO2, le vent d'hiver sur Londres–New York passerait de 77 à 89 km/h, les allers vers l'Amérique s'allongeraient et les retours raccourciraient, pour environ 2 000 heures de vol de plus par an.",
    source: "IOP Publishing",
    url: "https://ioppublishing.org/news/climate-change-will-delay-transatlantic-flights/",
  },
  prosser: {
    text: "Prosser, M. C., Williams, P. D., Marlton, G. J. et Harrison, R. G. (2023), « Evidence for large increases in clear-air turbulence over the past four decades », Geophysical Research Letters : en un point moyen de l'Atlantique Nord, la turbulence sévère en air clair est passée de 17,7 heures par an en 1979 à 27,4 en 2020 (+55 %).",
    source: "AGU, communiqué du 8 juin 2023",
    url: "https://news.agu.org/press-release/hazardous-clear-air-turbulence-up-55-from-1979-study-shows",
  },
};

const link = (s) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.label || s.source });

export function initJetSources({ flights, trappes, climate, meta }) {
  const li = (children) => el("li", {}, children);
  $("#sources-body").replaceChildren(
    el("p", {}, [
      "Toutes les données de cette enquête sont ouvertes. Les chiffres du texte sont calculés à partir d'elles par le code publié sur ",
      el("a", {
        href: "https://github.com/dubrouarthur/aviationdata",
        target: "_blank",
        rel: "noopener",
        text: "GitHub",
      }),
      ", et un script vérifie chaque nombre cité avant publication.",
    ]),
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(JSOURCES.opensky),
        `. ${flights.n_raw.toLocaleString("fr-FR")} vols entre un aéroport français et un aéroport d'Amérique du Nord, de janvier 2019 à décembre 2022, dont ${flights.n_valid.toLocaleString("fr-FR")} retenus. Données publiées par The OpenSky Network, https://opensky-network.org, pour la recherche et l'enseignement à but non lucratif : seuls des agrégats sont publiés ici, sans aucun identifiant d'avion.`,
      ]),
      li([
        link(JSOURCES.era5),
        ". Vents à 250 hPa toutes les 6 heures, 2019-2022, sur une grille de 1,5° (WeatherBench 2, Rasp et al., 2024), et à 0,5° pour la carte d'ouverture (ARCO-ERA5, Google). Contient des informations modifiées du Copernicus Climate Change Service.",
      ]),
      li([
        link(JSOURCES.r1),
        `. Moyennes mensuelles à 250 hPa depuis 1948, jusqu'à ${climate.last_month}. Domaine public.`,
      ]),
      li([link(JSOURCES.nao), ". Indice standardisé depuis 1950."]),
      li([
        link(JSOURCES.igra),
        `. Vent à 250 hPa des sondages de 00 h et 12 h UTC, ${trappes.from}-${trappes.to}. ${trappes.rejected} valeurs isolées, supérieures de plus de 60 km/h au vent mesuré à la fois à 300 et à 200 hPa, sont écartées comme erreurs probables.`,
      ]),
      li([link(JSOURCES.nasa), ", image du 8 février 2020 (couleurs naturelles)."]),
      li([
        el("a", {
          href: "https://ourairports.com/data/",
          target: "_blank",
          rel: "noopener",
          text: "OurAirports",
        }),
        ", coordonnées des aéroports (domaine public).",
      ]),
    ]),
    el("h3", { text: "La méthode" }),
    el("ul", {}, [
      li([
        "Durée d'un vol : du premier au dernier signal capté par OpenSky, quand ces deux positions sont à moins de 50 km des aéroports. Les durées à plus de 20 % sous la médiane de leur ligne et de leur sens, ou à plus de 25 % au-dessus (vols suivis en partie, déroutements, vols enchaînés), sont écartées.",
      ]),
      li([
        "Vent le long de la route : composante du vent ERA5 à 250 hPa (environ 10 400 m) dans l'axe du grand cercle, moyennée sur le trajet, au pas de 6 heures le plus proche du milieu du vol. Positive quand elle pousse l'avion.",
      ]),
      li([
        "Meilleure route : programmation dynamique sur 64 points le long du grand cercle et 61 écarts latéraux possibles en chacun (jusqu'à 1 800 km de part et d'autre), pour un avion à 900 km/h par rapport à l'air dont le cap corrige le vent de travers, dans le champ de vent d'une heure donnée, figé. Le modèle ignore la montée, la descente, les changements d'altitude, les couloirs imposés par le contrôle et l'évolution du vent pendant le vol : ses temps sont des ordres de grandeur.",
      ]),
      li([
        "Tendances : droite des moindres carrés, avec une marge à 95 % (± 1,96 erreur type). Corrélations de Pearson.",
      ]),
    ]),
    el("h3", { text: "Faits extérieurs aux données" }),
    el(
      "ul",
      {},
      Object.values(FACTS).map((f) => li([f.text, " Source : ", link(f), "."])),
    ),
    el("p", { class: "note", text: `Données traitées le ${longDate(meta.generated)}.` }),
  );
}
