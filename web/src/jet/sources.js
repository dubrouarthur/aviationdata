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
  ourairports: {
    short: "OurAirports",
    label: "OurAirports, coordonnées des aéroports (domaine public)",
    url: "https://ourairports.com/data/",
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
  openap: {
    short: "OpenAP, TU Delft",
    label: "OpenAP, modèle ouvert de performances des avions (Sun, Hoekstra et Ellerbroek, 2020, Aerospace)",
    url: "https://doi.org/10.3390/aerospace7080104",
  },
  dgac: {
    short: "DGAC",
    label: "Émissions de CO2 du trafic aérien commercial en France, DGAC (data.gouv.fr)",
    url: "https://www.data.gouv.fr/datasets/emissions-nettes-annuelles-de-co2-du-trafic-aerien-commercial-en-france",
  },
  hres: {
    short: "ECMWF HRES",
    label:
      "Prévisions HRES du Centre européen pour les prévisions météorologiques à moyen terme (ECMWF), via WeatherBench 2 (Rasp et al., 2024)",
    url: "https://weatherbench2.readthedocs.io/en/latest/data-guide.html",
  },
  pangu: {
    short: "Pangu-Weather",
    label: "Prévisions Pangu-Weather (Bi et al., 2023, Nature), via WeatherBench 2",
    url: "https://doi.org/10.1038/s41586-023-06185-3",
  },
  dgacpap: {
    short: "DGAC (trafic par paire d'aéroports)",
    label: "Trafic aérien commercial mensuel par paire d'aéroports, DGAC (data.gouv.fr)",
    url: "https://www.data.gouv.fr/datasets/trafic-aerien-commercial-mensuel-francais-par-paire-daeroports-par-sens-depuis-1990",
  },
  eia: {
    short: "EIA",
    label:
      "Prix spot du kérosène sur la côte américaine du golfe du Mexique, en dollars par gallon, U.S. Energy Information Administration (série EER_EPJK_PF4_RGC_DPG)",
    url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EER_EPJK_PF4_RGC_DPG&f=M",
  },
  ecb: {
    short: "BCE",
    label: "Taux de change de référence dollar-euro, moyenne mensuelle, Banque centrale européenne",
    url: "https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A",
  },
  icao: {
    short: "OACI",
    label: "OACI, méthodologie du calculateur d'émissions de carbone, version 8, mai 2015",
    url: "https://www.icao.int/sites/default/files/sp-files/environmental-protection/CarbonOffset/Documents/Methodology%20ICAO%20Carbon%20Calculator_v8-2015.pdf",
  },
  isa: {
    short: "AMS (atmosphère type)",
    label:
      "Atmosphère type : 15 °C au niveau de la mer, 6,5 °C de moins par kilomètre jusqu'à 11 km, American Meteorological Society, Glossary of Meteorology",
    url: "https://glossary.ametsoc.org/wiki/Standard_atmosphere",
  },
  density: {
    short: "ExxonMobil (densité du Jet A-1)",
    label: "Fiche produit Jet A-1 d'ExxonMobil : densité à 15 °C de 775 à 840 kg par mètre cube",
    url: "https://www.mobil.com/en-gn/commercial-fuel/pds/gl-xx-jetfuel-series",
  },
  eurocontrol: {
    short: "EUROCONTROL",
    label:
      "EUROCONTROL, Standard Inputs for Economic Analyses, coût du retard (version 10.0.2, prix 2022, d'après l'université de Westminster)",
    url: "https://ansperformance.eu/economics/cba/standard-inputs/chapters/cost_of_delay.html",
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
    (node.querySelector(":scope > .explorer-foot") ?? node).append(line);
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
    text: "Williams, P. D. (2016), « Transatlantic flight times and climate change », Environmental Research Letters, 11, 024008, publié le 10 février 2016 : avec un doublement du CO2, un courant-jet plus fort allongerait les vols Londres–New York vers l'ouest et raccourcirait ceux vers l'est, sans que les deux s'annulent ; étendu à tout le trafic transatlantique, environ 2 000 heures de vol de plus par an.",
    source: "Environmental Research Letters (résumé de l'article)",
    url: "https://doi.org/10.1088/1748-9326/11/2/024008",
  },
  lothar: {
    text: "Tempêtes Lothar (26 décembre 1999, nord de la France) et Martin (nuit du 27 au 28 décembre 1999, sud de la France).",
    source: "Encyclopædia Universalis, « Tempêtes en France (1999 et 2009) »",
    url: "https://www.universalis.fr/encyclopedie/tempetes-en-france/",
  },
  klaus: {
    text: "Tempête Klaus, du 23 au 25 janvier 2009, arrivée sur la côte aquitaine dans la nuit du 23 au 24 janvier.",
    source: "Encyclopædia Universalis, « Tempêtes en France (1999 et 2009) »",
    url: "https://www.universalis.fr/encyclopedie/tempetes-en-france/",
  },
  xynthia: {
    text: "Tempête Xynthia, 27 et 28 février 2010.",
    source: "Météo Paris",
    url: "https://www.meteo-paris.com/actualites/27-28-fevrier-2010-tempete-xynthia-sur-la-france-01-mars-2014",
  },
  prosser: {
    text: "Prosser, M. C., Williams, P. D., Marlton, G. J. et Harrison, R. G. (2023), « Evidence for large increases in clear-air turbulence over the past four decades », Geophysical Research Letters : en un point moyen de l'Atlantique Nord, la turbulence sévère en air clair est passée de 17,7 heures par an en 1979 à 27,4 en 2020 (+55 %).",
    source: "AGU, communiqué du 8 juin 2023",
    url: "https://news.agu.org/press-release/hazardous-clear-air-turbulence-up-55-from-1979-study-shows",
  },
};

const link = (s) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.label || s.source });

export function initJetSources({ flights, trappes, climate, meta, cost }) {
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
        link(JSOURCES.hres),
        " et ",
        link(JSOURCES.pangu),
        ". Vent à 250 hPa prévu 12 h et 108 h avant chaque départ de 2020, grille de 1,5°.",
      ]),
      ...(cost
        ? [
            li([
              link(JSOURCES.dgacpap),
              `. Mouvements, passagers et passagers-équivalents entre Paris-CDG et New York-JFK, les deux sens confondus, ${cost.pair[0].y}-${cost.pair.at(-1).y}. Cette série ne détaille que les liaisons exploitées par au moins trois compagnies : elle sert ici au chargement moyen d'un vol, jamais à un total.`,
            ]),
            li([
              link(JSOURCES.dgac),
              `. Facteur moyen des vols internationaux long-courriers, ${cost.factors.g_peqkm_year}.`,
            ]),
            li([
              link(JSOURCES.eia),
              `, et `,
              link(JSOURCES.ecb),
              `. Prix mensuels de ${cost.prices[0][0].slice(0, 4)} à ${cost.last.m}.`,
            ]),
          ]
        : []),
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
        "Meilleure route : programmation dynamique sur 64 points le long du grand cercle et 61 écarts latéraux possibles en chacun (jusqu'à 1 800 km de part et d'autre). Dans l'explorateur, un avion à 900 km/h par rapport à l'air, dans le vent de midi à 250 hPa, figé.",
      ]),
      li([
        "Simulateur : vents et températures ERA5 toutes les 6 heures à 300, 250 et 200 hPa (niveaux de vol 300, 340 et 390), interpolés dans l'espace et dans le temps pendant le vol. L'avion vole à son nombre de Mach de croisière (OpenAP) : sa vitesse par rapport à l'air dépend de la température. Quand l'altitude est libre, la route peut changer d'un niveau à chaque point, sans coût de montée. Le kérosène suit le temps de vol, minute pour minute (voir l'encadré sur les coûts), corrigé de la consommation relative de chaque niveau propre à chaque avion (OpenAP, à 80 % de la masse maximale au décollage) : sans vent à FL340, les quatre avions brûlent la même quantité, celle d'un long-courrier moyen selon la DGAC. Le CO2 est compté par passager-équivalent (un passager, ou 100 kg de fret). Le modèle ignore la montée, la descente, les couloirs imposés et les contraintes du contrôle : ses temps sont des ordres de grandeur.",
      ]),
      li([
        "Gains de la meilleure route : pour chaque jour de 2019 à 2022, un Boeing 777-300ER à Mach 0,84 parti de Paris à 12 h UTC et de New York à 00 h UTC, au niveau de vol 340, dans les vents ERA5 qui évoluent pendant le vol ; la meilleure route est comparée à la ligne droite au même niveau.",
      ]),
      li([
        "Prévisions : pour chaque jour de 2020 et chaque sens, la meilleure route au niveau de vol 340 est calculée sur une information (vent moyen du mois sur 2019-2022, prévision HRES ou Pangu-Weather émise 12 h ou 108 h avant le départ, ou vent ERA5 lui-même), à température standard, puis volée dans le vent et la température ERA5. Les prévisions viennent de WeatherBench 2, sur la même grille de 1,5° qu'ERA5. Pangu-Weather a été entraîné sur ERA5, ce qui l'avantage quand ERA5 sert de référence. L'erreur sur le vent est l'écart moyen, en valeur absolue, de la composante du vent le long de la ligne droite, six heures après le départ.",
      ]),
      li([
        "Une minute de croisière en kilos et en euros : voir l'encadré « ",
        el("a", { href: "#couts", text: "D'où viennent ces kilos et ces euros" }),
        " », qui détaille le calcul étape par étape, avec ses sources (",
        link(JSOURCES.dgac),
        " ; ",
        link(JSOURCES.dgacpap),
        " ; ",
        link(JSOURCES.icao),
        " ; ",
        link(JSOURCES.isa),
        " ; ",
        link(JSOURCES.eia),
        " ; ",
        link(JSOURCES.ecb),
        " ; ",
        link(JSOURCES.density),
        "). C'est un prix de marché américain : celui que paie une compagnie dépend de ses contrats, de ses couvertures et du lieu d'achat. Les euros sont des ordres de grandeur, et le temps de vol, qui a aussi un coût (équipage, entretien, correspondances), n'y est pas compté.",
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
