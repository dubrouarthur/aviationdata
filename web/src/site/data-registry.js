// Every dataset the magazine reads, every reference value and every dated fact, in one place: the data
// page (/donnees) is written from here at build time (partials.js). Names and addresses come from each
// story's own source table, so that a link is written once; src/site/data-registry.test.js fails if a
// source of a story is missing here, web/scripts/check_site.py if a link under a figure is missing from
// the page.
import { ESOURCES } from "../eu/sources.js";
import { JSOURCES, FACTS as JET_FACTS } from "../jet/sources.js";
import { HSOURCES, FACTS as HF_FACTS } from "../hf/sources.js";
import { CASES } from "../hf/cases.js";
import { DATASETS as DGAC } from "../lib/datasets.js";
import { FACTS as CIEL_FACTS } from "../modules/sources.js";
import { SSOURCES } from "../saisons/sources.js";
import { BSOURCES } from "../billet/sources.js";
import { CSOURCES } from "../carbone/sources.js";
import { ASOURCES } from "../avions/sources.js";

/** The source tables of the stories, by investigation key (issues.js). */
export const TABLES = { eu: ESOURCES, jet: JSOURCES, hf: HSOURCES, ciel: DGAC, sea: SSOURCES, billet: BSOURCES, carbone: CSOURCES, avions: ASOURCES };

const NOTICE_EUROSTAT = { text: "réutilisation autorisée, source citée", url: ESOURCES.copyright.url };
const PUBLIC = { text: "domaine public" };
const PRODUCER = { text: "celles du producteur", producer: true };

/**
 * The datasets. refs: [investigation, key in its source table]; the first one gives the name and the
 * address. files: what the magazine publishes from it (under web/public/), etl: the code that reads it,
 * checks: the code that recomputes the numbers written from it.
 */
export const DATASETS = [
  {
    id: "eurostat-pays",
    producer: "Eurostat",
    title: "Passagers aériens par pays (avia_paoc)",
    refs: [
      ["eu", "paoc"],
      ["sea", "paoc"],
    ],
    what: "Passagers transportés par chaque pays déclarant, par mois et par an : vols intérieurs, vols vers un autre pays de l'Union, vols hors de l'Union.",
    period: "Depuis 2004 pour les pays (Bulgarie 2007, Croatie et Union 2008).",
    terms: NOTICE_EUROSTAT,
    files: ["data/eu/eu.json"],
    etl: ["etl/eu/eurostat.py", "etl/eu/build_eu.py"],
    checks: ["tests/test_eu.py", "web/scripts/check_eu.py"],
  },
  {
    id: "eurostat-aeroports",
    producer: "Eurostat",
    title: "Passagers aériens par aéroport (avia_paoa)",
    refs: [
      ["eu", "paoa"],
      ["sea", "paoa"],
    ],
    what: "Passagers des principaux aéroports de chaque pays déclarant, départs et arrivées, correspondances comprises.",
    period: "Par an, depuis 2008.",
    terms: NOTICE_EUROSTAT,
    files: ["data/eu/eu.json"],
    etl: ["etl/eu/eurostat.py", "etl/eu/build_eu.py"],
    checks: ["tests/test_eu.py", "web/scripts/check_eu.py"],
  },
  {
    id: "ntsb",
    producer: "NTSB, États-Unis",
    title: "Base des accidents d'aviation civile (avall.mdb)",
    refs: [["hf", "ntsb"]],
    what: "Chaque accident survenu aux États-Unis, ses circonstances et les constats codés par les enquêteurs, dont ceux retenus dans la cause probable.",
    period:
      "Accidents depuis 2008 ; l'enquête s'arrête à la dernière année où 90 % des accidents ont une cause probable.",
    terms: PUBLIC,
    files: ["data/hf/accidents.json", "data/hf/people.json", "data/hf/events.json", "data/hf/cases.json"],
    etl: ["etl/hf/ntsb.py", "etl/hf/build_hf.py", "etl/hf/codes.py", "etl/hf/cases.py"],
    checks: ["web/scripts/check_hf.py"],
  },
  {
    id: "ntsb-1982",
    producer: "NTSB, États-Unis",
    title: "Base des accidents de 1982 à 2007 (Pre2008.mdb)",
    refs: [["hf", "ntsbold"]],
    what: "Les accidents antérieurs à 2008, avec une grille de codage différente, qui ne se raccorde pas à la suivante.",
    period: "1982-2007.",
    terms: PUBLIC,
    files: ["data/hf/history.json"],
    etl: ["etl/hf/ntsb.py", "etl/hf/build_hf.py"],
    checks: ["web/scripts/check_hf.py"],
  },
  {
    id: "dgac-trafic",
    producer: "DGAC, via data.gouv.fr",
    title: "Trafic aérien commercial mensuel français",
    refs: [
      ["ciel", "trafic"],
      ["jet", "dgacpap"],
    ],
    what: "Passagers, mouvements et fret des aéroports français, par liaison, par paire d'aéroports et par compagnie, chaque mois.",
    period: "Depuis 1990.",
    terms: PRODUCER,
    files: [
      "data/aeroports.json",
      "data/routes.json",
      "data/compagnies.json",
      "data/fracture.json",
      "data/monde.json",
      "data/fret.json",
      "data/jet/cost.json",
    ],
    etl: ["etl/fetch.py", "etl/dgac.py", "etl/build.py", "etl/jet/build_cost.py"],
    checks: ["tests/test_etl.py", "web/scripts/audit_numbers.py", "web/scripts/check_site.py"],
  },
  {
    id: "dgac-prix",
    producer: "DGAC, via data.gouv.fr",
    title: "Indices des prix du transport aérien de passagers (IPTAP)",
    refs: [
      ["ciel", "iptap"],
      ["billet", "iptap"],
    ],
    what: "Prix des billets d'avion au départ de France, en indice.",
    period: "Indices mensuels, base 100 en 2023.",
    terms: PRODUCER,
    files: ["data/prix.json"],
    etl: ["etl/fetch.py", "etl/build.py"],
    checks: ["tests/test_etl.py", "web/scripts/audit_numbers.py", "web/scripts/check_billet.py"],
  },
  {
    id: "eurostat-liaisons",
    producer: "Eurostat",
    title: "Liaisons aériennes de la France (avia_par_fr)",
    refs: [["carbone", "routes"]],
    what: "Pour chaque paire d'aéroports reliée à la France, chaque trimestre : passagers transportés, sièges offerts et vols commerciaux, dans les deux sens.",
    period: "Trimestriel ; les deux dernières années complètes sur le site. Une liaison qui révélerait les chiffres d'une seule compagnie est confidentielle.",
    terms: NOTICE_EUROSTAT,
    files: ["data/co2/liaisons.json"],
    etl: ["etl/co2/routes.py", "etl/co2/build_routes.py"],
    checks: ["web/scripts/check_carbone.py"],
  },
  {
    id: "desnz-facteurs",
    producer: "Gouvernement britannique (DESNZ)",
    title: "Facteurs de conversion des gaz à effet de serre 2025",
    refs: [["carbone", "desnz"]],
    what: "Le CO2 par passager-kilomètre selon la classe (économie, premium, affaires, première) et avec ou sans les effets hors CO2 : le calculateur n'en garde que les rapports à la place moyenne.",
    period: "Édition 2025 (10 juin 2025).",
    terms: { text: "Open Government Licence v3.0, source citée" },
    files: ["data/co2/classes.json"],
    etl: ["etl/co2/desnz.py"],
    checks: ["web/scripts/check_carbone.py"],
  },
  {
    id: "eurostat-ipch",
    producer: "Eurostat",
    title: "Indice des prix à la consommation harmonisé, France (prc_hicp_minr)",
    refs: [["billet", "hicp"]],
    what: "L'ensemble des prix à la consommation en France, et le prix du transport de voyageurs par avion et par train.",
    period: "Mensuel, indice 100 en 2015, depuis 2012 sur le site.",
    terms: NOTICE_EUROSTAT,
    files: ["data/billet/hicp.json"],
    etl: ["etl/billet/hicp.py", "etl/billet/build_billet.py"],
    checks: ["web/scripts/check_billet.py"],
  },
  {
    id: "dgac-co2",
    producer: "DGAC, via data.gouv.fr",
    title: "Émissions de CO2 du trafic aérien commercial en France",
    refs: [
      ["ciel", "co2"],
      ["jet", "dgac"],
      ["carbone", "co2"],
    ],
    what: "Émissions nettes annuelles, en tonnes et en grammes par passager-équivalent-kilomètre, par type de vol.",
    period: "Par an.",
    terms: PRODUCER,
    files: ["data/co2.json", "data/jet/cost.json"],
    etl: ["etl/fetch.py", "etl/build.py", "etl/jet/build_cost.py"],
    checks: [
      "tests/test_etl.py",
      "web/scripts/audit_numbers.py",
      "web/scripts/check_site.py",
      "web/scripts/check_carbone.py",
    ],
  },
  {
    id: "era5",
    producer: "Copernicus / ECMWF",
    title: "Réanalyse ERA5",
    refs: [["jet", "era5"]],
    what: "Vents et températures en altitude reconstitués heure par heure sur tout le globe.",
    period:
      "Vents à 250 hPa toutes les 6 heures de 2019 à 2022 (grille de 1,5°, via WeatherBench 2), vents et températures à 300, 250 et 200 hPa pour le simulateur, quelques instantanés à 0,25°.",
    terms: { text: "citer « Contient des informations modifiées du Copernicus Climate Change Service »" },
    files: [
      "data/jet/winds.json",
      "data/jet/winds-*.bin",
      "data/jet/hero.json",
      "data/jet/hero.bin",
      "data/jet/sim/",
      "data/jet/routing.json",
      "data/jet/sim.json",
      "data/jet/sim_stats.json",
      "data/jet/flights.json",
    ],
    etl: [
      "etl/jet/era5.py",
      "etl/jet/era5_daily.py",
      "etl/jet/era5_levels.py",
      "etl/jet/build_jet.py",
      "etl/jet/build_sim.py",
    ],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "ncep",
    producer: "NOAA, Physical Sciences Laboratory",
    title: "Réanalyse NCEP/NCAR R1",
    refs: [["jet", "r1"]],
    what: "Le vent à 250 hPa sur une grille plus grossière qu'ERA5 : il sert à la série longue de l'enquête, jour par jour depuis 1948.",
    period: "Depuis 1948.",
    terms: PUBLIC,
    files: ["data/jet/climate.json", "data/jet/history.json"],
    etl: ["etl/jet/reanalysis.py", "etl/jet/build_history.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "nao",
    producer: "NOAA, Climate Prediction Center",
    title: "Indice de l'oscillation nord-atlantique",
    refs: [["jet", "nao"]],
    what: "L'indice de la NOAA qui résume, chaque mois, l'état de la circulation atmosphérique au-dessus de l'Atlantique Nord.",
    period: "Indice mensuel standardisé depuis 1950.",
    terms: PRODUCER,
    files: ["data/jet/climate.json"],
    etl: ["etl/jet/nao.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "igra",
    producer: "Météo-France, archive IGRA 2 de la NOAA",
    title: "Radiosondages de Trappes",
    refs: [["jet", "igra"]],
    what: "Le vent mesuré par les ballons-sondes lâchés à Trappes (Yvelines), une mesure directe et non une reconstitution.",
    period: "Sondages de 00 h et 12 h UTC depuis 1973.",
    terms: PRODUCER,
    files: ["data/jet/trappes.json"],
    etl: ["etl/jet/radiosonde.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "opensky",
    producer: "The OpenSky Network",
    title: "Vols observés, 2019-2022 (Zenodo)",
    refs: [
      ["jet", "opensky"],
      ["avions", "opensky"],
    ],
    what: "Les vols captés par le réseau de récepteurs d'OpenSky, avec le type de l'avion, ses aéroports de départ et d'arrivée et ses heures de premier et de dernier signal : ceux entre la France et l'Amérique du Nord pour le courant-jet, tous les avions de ligne pour la comparaison des modèles.",
    period: "2019-2022 ; 2019 et 2022 pour les modèles.",
    terms: {
      text: "recherche et enseignement à but non lucratif ; seuls des agrégats sont publiés ici, sans aucun identifiant d'avion",
    },
    files: ["data/jet/flights.json", "data/avions/monde.json"],
    etl: ["etl/jet/opensky.py", "etl/avions/fetch.py", "etl/avions/build_world.py", "etl/avions/types_table.py"],
    checks: ["web/scripts/check_site.py", "web/scripts/check_avions.py"],
  },
  {
    id: "opensky-avions",
    producer: "The OpenSky Network",
    title: "Base des avions (aircraft database)",
    refs: [["avions", "aircraft"]],
    what: "Pour chaque transpondeur, l'immatriculation et le type de l'avion : elle donne le modèle d'un vol américain par son immatriculation, et celui d'un vol d'OpenSky quand sa liste ne le dit pas.",
    period: "Version d'avril 2024.",
    terms: { text: "usage non commercial ; aucune immatriculation ni aucun identifiant n'est publié ici" },
    files: ["data/avions/us.json", "data/avions/monde.json"],
    etl: ["etl/avions/fetch.py", "etl/avions/build_us.py"],
    checks: ["web/scripts/check_avions.py"],
  },
  {
    id: "bts-ontime",
    producer: "Bureau of Transportation Statistics (États-Unis)",
    title: "Reporting Carrier On-Time Performance",
    refs: [["avions", "bts"]],
    what: "Chaque vol intérieur des grandes compagnies américaines : immatriculation, horaires, retard et ses causes, annulation, déroutement.",
    period: "Mensuel ; l'année 2025 sur le site.",
    terms: PUBLIC,
    files: ["data/avions/us.json"],
    etl: ["etl/avions/fetch.py", "etl/avions/build_us.py"],
    checks: ["web/scripts/check_avions.py"],
  },
  {
    id: "openap",
    producer: "TU Delft",
    title: "OpenAP, modèle ouvert de performances des avions",
    refs: [["jet", "openap"]],
    what: "Le nombre de Mach de croisière et la consommation relative de quatre avions long-courriers selon leur niveau de vol.",
    period: "Modèle (Sun, Hoekstra et Ellerbroek, 2020).",
    terms: PRODUCER,
    files: ["data/jet/sim.json"],
    etl: ["etl/jet/build_sim.py", "etl/jet/sim.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "weatherbench",
    producer: "WeatherBench 2 (ECMWF HRES, Pangu-Weather)",
    title: "Prévisions météorologiques archivées",
    refs: [
      ["jet", "hres"],
      ["jet", "pangu"],
    ],
    what: "Le vent prévu par le modèle du Centre européen et par le modèle d'apprentissage Pangu-Weather, archivé pour comparer les prévisions à ce qui s'est passé.",
    period: "Prévisions émises 12 h et 108 h avant chaque départ de 2020.",
    terms: PRODUCER,
    files: ["data/jet/forecast.json"],
    etl: ["etl/jet/forecasts.py", "etl/jet/build_forecast.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "eia",
    producer: "U.S. Energy Information Administration",
    title: "Prix spot du kérosène (côte du golfe du Mexique)",
    refs: [["jet", "eia"]],
    what: "Le prix du kérosène en dollars par gallon, chaque mois : un prix américain, un ordre de grandeur pour l'Europe.",
    period: "Mensuel.",
    terms: PRODUCER,
    files: ["data/jet/cost.json"],
    etl: ["etl/jet/prices.py", "etl/jet/build_cost.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "bce",
    producer: "Banque centrale européenne",
    title: "Taux de change de référence dollar-euro",
    refs: [["jet", "ecb"]],
    what: "Pour convertir le prix du kérosène en euros.",
    period: "Moyenne mensuelle.",
    terms: PRODUCER,
    files: ["data/jet/cost.json"],
    etl: ["etl/jet/prices.py", "etl/jet/build_cost.py"],
    checks: ["web/scripts/check_site.py"],
  },
  {
    id: "nasa",
    producer: "NASA Worldview / GIBS",
    title: "Image satellite VIIRS (Suomi NPP)",
    refs: [["jet", "nasa"]],
    what: "La tempête Ciara vue du ciel, le 8 février 2020, en couleurs naturelles.",
    period: "8 février 2020.",
    terms: PRODUCER,
    files: ["img/jet/ciara-viirs.jpg"],
    etl: ["etl/jet/nasa.py"],
    checks: [],
  },
  {
    id: "ourairports",
    producer: "OurAirports",
    title: "Coordonnées des aéroports",
    refs: [
      ["eu", "ourairports"],
      ["jet", "ourairports"],
      ["sea", "ourairports"],
      ["carbone", "ourairports"],
      ["avions", "ourairports"],
    ],
    what: "La position de chaque aéroport, complétée à la main pour les aéroports fermés, comme Berlin-Tegel, et pour les noms français.",
    period: "Fichier courant.",
    terms: PUBLIC,
    files: ["data/eu/eu.json", "data/aeroports.json", "data/routes.json", "data/co2/trajets.json", "data/avions/monde.json"],
    alsoIn: ["ciel"],
    etl: [
      "etl/eu/eurostat.py",
      "etl/airports_ref.py",
      "etl/co2/build_trips.py",
      "data/ref/eu_airports.csv",
      "data/ref/airports_manual.csv",
    ],
    checks: ["tests/test_eu.py"],
  },
  {
    id: "naturalearth",
    producer: "Natural Earth, via world-atlas",
    title: "Frontières des pays",
    refs: [
      ["eu", "naturalearth"],
      ["sea", "naturalearth"],
    ],
    extra: [
      {
        label: "world-atlas, Natural Earth 4.1.0 en TopoJSON (licence ISC)",
        url: "https://github.com/topojson/world-atlas",
      },
    ],
    what: "Les contours des pays des cartes et du globe.",
    period: "Échelles 1:50 000 000 (Europe) et 1:110 000 000 (monde).",
    terms: PUBLIC,
    files: ["geo/europe-50m.json", "geo/world-110m.json", "geo/land-dots.json"],
    alsoIn: ["ciel", "jet"],
    etl: ["web/scripts/make_europe_geo.mjs", "web/scripts/geo_assets.mjs"],
    checks: [],
  },
  {
    id: "france-geojson",
    producer: "Grégoire David, d'après l'IGN",
    title: "france-geojson, contours administratifs de la France",
    refs: [],
    extra: [
      {
        label: "france-geojson (IGN, Admin Express COG, édition 2018)",
        url: "https://github.com/gregoiredavid/france-geojson",
      },
    ],
    what: "Le contour de la France métropolitaine de la première enquête.",
    period: "Édition 2018 d'Admin Express.",
    terms: { text: "Licence ouverte, conditions d'Admin Express (IGN)" },
    files: ["geo/metropole.geojson"],
    alsoIn: ["ciel"],
    etl: [],
    checks: [],
  },
];

/** Reference values and texts the numbers lean on: a factor, a density, a definition, a regulation. */
export const REFERENCES = [
  {
    refs: [["jet", "icao"]],
    use: "3,16 kg de CO2 par kilo de kérosène brûlé, pour passer des émissions de la DGAC au kérosène.",
  },
  { refs: [["jet", "density"]], use: "0,8 kg par litre, pour passer du prix au gallon au prix à la tonne." },
  { refs: [["jet", "isa"]], use: "La température standard des routes calculées sur les prévisions." },
  {
    refs: [["jet", "eurocontrol"]],
    use: "Le coût moyen d'une minute de retard, 100 € (prix 2022), comme point de comparaison.",
  },
  {
    refs: [
      ["eu", "esms"],
      ["sea", "esms"],
    ],
    use: "Les définitions d'Eurostat : un passager par vol, les doubles comptes des aéroports.",
  },
  {
    refs: [["carbone", "sdes"]],
    use: "L'empreinte carbone moyenne d'un Français, 8,2 tonnes équivalent CO2 en 2024 (provisoire), pour dire ce que pèse un vol.",
  },
  {
    refs: [["carbone", "bilan"]],
    use: "La méthode du CO2 de la DGAC : TARMAAC, passager-équivalent, partage entre départ et arrivée, ce qui n'est pas compté.",
  },
  {
    refs: [["billet", "bulletin"]],
    use: "La méthode de l'indice des prix des billets : liaisons suivies, tarifs relevés, pondération.",
  },
  { refs: [["eu", "reg"]], use: "Le règlement qui rend les séries comparables depuis 2003 à 2005." },
  {
    refs: [
      ["eu", "copyright"],
      ["sea", "copyright"],
      ["billet", "copyright"],
      ["carbone", "copyright"],
    ],
    use: "Les conditions de réutilisation des données d'Eurostat.",
  },
];

/** Models of risk the third investigation reads the NTSB with. */
export const MODELS = [
  { refs: [["hf", "heinrich"]] },
  { refs: [["hf", "reason"]] },
  { refs: [["hf", "hfacs"]] },
  { refs: [["hf", "tem"]] },
];

/** The six accidents of "À la loupe": their report and what followed, each with its source. */
const caseFacts = Object.values(CASES).flatMap((c) => [
  { text: `${c.name}, ${c.when} : rapport d'enquête.`, source: c.report.label, url: c.report.url },
  ...(c.followed ?? []).map((f) => ({ text: `${c.name} : ${f.text}`, source: f.source, url: f.url })),
  // "Mort de Kobe Bryant : Halldale, 12 février 2021." -> the fact, then its source
  ...(c.extra
    ? [c.extra.text.split(" : ")].map(([fact, source]) => ({
        text: `${c.name} : ${fact[0].toLowerCase()}${fact.slice(1)}.`,
        source: source.replace(/\.$/, ""),
        url: c.extra.url,
      }))
    : []),
]);

/** Dated facts from outside the data, by investigation: never given as the cause of a curve. */
export const FACTS = [
  { issue: "ciel", facts: Object.values(CIEL_FACTS) },
  { issue: "jet", facts: Object.values(JET_FACTS) },
  { issue: "hf", facts: [...Object.values(HF_FACTS), ...caseFacts] },
];

/** A dataset's or a reference's own name and address, from the first story table it is in. */
export function sourceOf(entry) {
  const [issue, key] = entry.refs[0] ?? [];
  const s = issue ? TABLES[issue][key] : null;
  return s ? { label: s.label, url: s.url } : entry.extra?.[0];
}

/** The other names and addresses of an entry: its other story sources, then its own extras. */
export function alsoOf(entry) {
  const first = sourceOf(entry);
  const seen = new Set([first?.url]);
  return [
    ...entry.refs.slice(1).map(([i, k]) => ({ label: TABLES[i][k].label, url: TABLES[i][k].url })),
    ...(entry.extra ?? []),
  ].filter((e) => !seen.has(e.url) && seen.add(e.url));
}

/** Every [investigation, key] the registry places, to find the ones it forgets. */
export const placed = () =>
  new Set([...DATASETS, ...REFERENCES, ...MODELS].flatMap((e) => e.refs.map(([i, k]) => `${i}:${k}`)));
