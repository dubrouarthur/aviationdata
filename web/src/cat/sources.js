// @ts-check
// Sources of « Le ciel clair est-il plus agité ? »: the ERA5 reanalysis (the same as the jet stream's, read
// through WeatherBench 2), the Ellrod index, and the published work the trend is compared with.
import { JSOURCES, FACTS as JET_FACTS } from "../jet/sources.js";

export const TSOURCES = {
  era5: { ...JSOURCES.era5, short: "ERA5, Copernicus/ECMWF, 1979-2022" },
  wb2: {
    producer: "WeatherBench 2",
    label: "WeatherBench 2, ERA5 sur une grille de 1,5° toutes les 6 heures (Rasp et al., 2024)",
    short: "ERA5 à 1,5° toutes les 6 heures",
    url: "https://weatherbench2.readthedocs.io/en/latest/data-guide.html",
  },
  ellrod: {
    producer: "Ellrod et Knapp",
    label:
      "Ellrod, G. P. et Knapp, D. I. (1992), « An objective clear-air turbulence forecasting technique », Weather and Forecasting, 7, 150-165",
    short: "l'indice de turbulence (1992)",
    url: "https://doi.org/10.1175/1520-0434(1992)007<0150:AOCATF>2.0.CO;2",
  },
  naturalearth: {
    producer: "Natural Earth",
    label: "Natural Earth, contours des terres au 1:110 000 000 (via world-atlas)",
    short: "contours des terres",
    url: "https://www.naturalearthdata.com/",
  },
  ourairports: {
    producer: "OurAirports",
    label: "OurAirports, coordonnées des aéroports",
    short: "position des aéroports",
    url: "https://ourairports.com/data/",
  },
};

// facts outside the data, dated and sourced (checked on 16 November 2026)
export const FACTS = {
  prosser: JET_FACTS.prosser,
  storer: {
    text: "Storer, L. N., Williams, P. D. et Joshi, M. M. (2017), « Global response of clear-air turbulence to climate change », Geophysical Research Letters, 44, 9976-9984 : dans un modèle de climat (HadGEM2-ES), la turbulence en air clair augmente sur tout le globe d'ici 2050-2080, jusqu'à doubler par endroits, et davantage à 39 000 pieds qu'à 34 000 pieds.",
    source: "Geophysical Research Letters (résumé de l'article)",
    url: "https://doi.org/10.1002/2017GL074618",
  },
  lee: {
    text: "Lee, S. H., Williams, P. D. et Frame, T. H. A. (2019), « Increased shear in the North Atlantic upper-level jet stream over the past four decades », Nature, 572, 639-642 : de 1979 à 2017, le cisaillement vertical du vent au-dessus de l'Atlantique Nord a augmenté de 15 % dans les réanalyses, alors que la vitesse du vent à 250 hPa n'a pas changé.",
    source: "Nature (résumé de l'article)",
    url: "https://doi.org/10.1038/s41586-019-1465-z",
  },
  singapore: {
    text: "Vol SQ321 Londres-Singapour, 21 mai 2024 : turbulence au-dessus du sud de la Birmanie, à 37 000 pieds, un passager mort et des dizaines de blessés. Selon les premières constatations du Transport Safety Investigation Bureau de Singapour, l'avion passait probablement au-dessus d'une zone de convection naissante.",
    source: "Ministère des Transports de Singapour, premières constatations du TSIB, mai 2024",
    url: "https://www.mot.gov.sg/news/Details/transport-safety-investigation-bureau-preliminary-investigation-findings-of-incident-involving-sq321",
  },
};
