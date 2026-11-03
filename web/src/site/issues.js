// The magazine's table of contents. One entry per investigation, newest first: the pages Vite builds
// (vite.config.js), the shared masthead menu, footer, bylines and "read also" (partials.js), the
// home page's list, the Atom feed and the sitemap all come from here.
// A new investigation = its folder + an entry in ISSUES (+ its lead or strip on the home page).
// `related`: keys of publications on the same subject, offered at the end with the previous and next.
// `format: "court"` marks the short format (« En 5 minutes », src/court/): one question, four steps.
// `hook` is the investigation's own question, as its opening asks it; `cover` frames the picture of
// its card on the home page (object-position of the og image: its figure, not its title).

export const SITE = {
  name: "aviationdata",
  tagline: "Enquêtes en données ouvertes sur le transport aérien",
  url: "https://aviationdata.vercel.app/",
  author: { name: "Arthur Dubrou", url: "https://www.linkedin.com/in/arthur-dubrou/" },
  repo: "https://github.com/dubrouarthur/aviationdata",
  report: "https://github.com/dubrouarthur/aviationdata/issues/new",
  since: 2026,
};

export const ISSUES = [
  {
    key: "carbone",
    slug: "co2-par-passager",
    no: 7,
    format: "court",
    topic: "Climat",
    title: "Combien de CO2 pour un vol ?",
    dek: "Le CO2 d'un vol par passager : par kilomètre selon le type de vol, pour un aller-retour Paris–New York ou Paris–Toulouse, et pourquoi le total monte quand chaque passager émet moins.",
    published: "2026-11-03",
    updated: "2026-11-03",
    minutes: 5,
    chapters: 4,
    image: "og-co2.jpg",
    cover: "96% 50%",
    hook: "Combien de CO2 pour un vol en avion ?",
    accent: "var(--magenta)",
    sources: "DGAC",
    related: ["ciel", "jet"],
  },
  {
    key: "billet",
    slug: "prix-des-billets",
    no: 6,
    format: "court",
    topic: "Prix",
    title: "Le billet d'avion est-il plus cher ?",
    dek: "Dix ans sans hausse, puis un bond en deux ans : le prix des billets d'avion au départ de France depuis 2012, comparé à l'inflation, à la saison, au type de vol et au train.",
    published: "2026-11-03",
    updated: "2026-11-03",
    minutes: 5,
    chapters: 4,
    image: "og-billet.jpg",
    cover: "96% 50%",
    hook: "Le billet d'avion est-il plus cher qu'avant ?",
    accent: "var(--magenta)",
    sources: "DGAC, Eurostat",
    related: ["ciel"],
  },
  {
    key: "sea",
    slug: "calendrier-du-ciel",
    no: 5,
    topic: "Europe",
    title: "Le calendrier du ciel",
    dek: "Quand l'Europe prend-elle l'avion ? Partout en été, mais pas au même rythme : chaque pays a son calendrier, et il change. Quinze ans de données mensuelles d'Eurostat, pays par pays, dans un calendrier interactif.",
    published: "2026-10-31",
    updated: "2026-10-31",
    minutes: 8,
    chapters: 4,
    image: "og-saisons.jpg",
    cover: "70% 50%",
    hook: "Quand l'Europe prend-elle l'avion ?",
    accent: "var(--magenta)",
    sources: "Eurostat",
  },
  {
    key: "eu",
    slug: "ciel-europeen",
    no: 4,
    topic: "Europe",
    title: "Cap au sud",
    dek: "Le transport aérien européen a effacé le Covid et bat des records, mais pas partout : le ciel a glissé vers le sud. Vingt ans de données Eurostat, pays par pays et aéroport par aéroport, dans un tableau de bord.",
    published: "2026-10-30",
    updated: "2026-10-31",
    minutes: 15,
    chapters: 7,
    image: "og-eu.jpg",
    cover: "96% 50%",
    hook: "Le transport aérien européen a-t-il effacé le Covid ?",
    accent: "var(--magenta)",
    sources: "Eurostat",
  },
  {
    key: "hf",
    slug: "facteur-humain",
    no: 3,
    topic: "Sécurité",
    title: "L'erreur est humaine",
    dek: "Dans les accidents aériens, le facteur humain est-il vraiment la première cause ? Seize ans de verdicts des enquêteurs américains, 21 400 accidents, lus avec les grands modèles du risque aérien.",
    published: "2026-10-24",
    updated: "2026-10-24",
    minutes: 20,
    chapters: 12,
    image: "og-hf.jpg",
    cover: "78% 50%",
    hook: "Dans les accidents aériens, le facteur humain est-il vraiment la première cause ?",
    accent: "var(--magenta)",
    sources: "NTSB",
  },
  {
    key: "jet",
    slug: "courant-jet",
    no: 2,
    topic: "Météo et coûts",
    title: "Le vent dans le dos",
    dek: "Le courant-jet rallonge d'une heure les vols vers l'Amérique. Les données météo peuvent-elles aider à brûler moins de kérosène ? La réponse, sur 105 000 vols et quatre ans de vents.",
    published: "2026-10-24",
    updated: "2026-10-24",
    minutes: 30,
    chapters: 13,
    image: "og-jet.jpg",
    cover: "100% 50%",
    hook: "Les données météo peuvent-elles aider à brûler moins de kérosène ?",
    accent: "var(--magenta)",
    sources: "ERA5 Copernicus, NOAA, Météo-France, NASA, OpenSky",
    related: ["carbone"],
  },
  {
    key: "ciel",
    slug: "le-ciel-a-deux-vitesses",
    no: 1,
    topic: "Trafic et économie",
    title: "Le ciel à deux vitesses",
    dek: "Trente-cinq ans de transport aérien français : l'international repart, l'intérieur décroche. Destinations, aéroports, compagnies, prix, fret et CO2.",
    published: "2026-10-16",
    updated: "2026-10-19",
    minutes: 25,
    chapters: 12,
    image: "og.png",
    cover: "95% 50%",
    hook: "Tout le transport aérien français a-t-il retrouvé son niveau d'avant-Covid ?",
    accent: "var(--magenta)",
    sources: "DGAC, data.gouv.fr",
    related: ["billet", "carbone"],
  },
];

// interactive tools inside the investigations, offered on their own from the home page and the menu
export const TOOLS = [
  {
    issue: "carbone",
    hash: "calculer",
    title: "Le CO2 de votre vol",
    dek: "Choisissez votre départ et votre arrivée : le CO2 par passager, et ce qu'Eurostat dit de la liaison, passagers par vol, sièges occupés et vols par semaine.",
  },
  {
    issue: "eu",
    hash: "tableau",
    title: "Le tableau de bord européen",
    dek: "Chaque pays de l'Union et de l'AELE, mois par mois depuis 2004 : ses passagers, ses saisons, ses vols intérieurs et ses aéroports.",
  },
  {
    issue: "sea",
    hash: "calendrier",
    title: "Le calendrier des saisons",
    dek: "Les trente pays de l'Union et de l'AELE, année par année depuis 2010 : leur mois le plus chargé, le plus creux, et l'écart entre les deux, comparé à l'Union.",
  },
  {
    issue: "hf",
    hash: "explorer",
    title: "Les causes d'accidents, segment par segment",
    dek: "Aviation générale, taxi aérien, compagnies ou travail aérien, accidents mortels ou non : ce que citent les enquêteurs, qui ils nomment et ce qui s'est passé.",
  },
  {
    issue: "jet",
    hash: "placer",
    title: "Le simulateur de vol",
    dek: "Tracez votre route au-dessus de l'Atlantique, choisissez l'altitude et l'heure de départ, puis faites voler trois avions dans les vents d'une journée réelle.",
  },
  {
    issue: "ciel",
    hash: "aeroport",
    title: "Votre aéroport",
    dek: "Passagers, destinations, saisons et compagnies de chaque aéroport français, mois par mois depuis 1990.",
  },
  {
    issue: "jet",
    hash: "route",
    title: "Le vent, jour par jour",
    dek: "Chaque journée de 2019 à 2022 : le vent sur l'Atlantique, la route la plus rapide et la durée réelle des vols.",
  },
  {
    issue: "jet",
    hash: "votre-vol",
    title: "Votre vol transatlantique",
    dek: "La durée médiane de votre ligne entre la France et l'Amérique du Nord, aller et retour, mois après mois.",
  },
];

// every correction of a fact, newest first: { date: "2026-11-02", issue: "jet", text: "..." }
export const CORRECTIONS = [];
export const CORRECTIONS_SINCE = "2026-10-24";

// pages of the magazine itself (not investigations)
export const PAGES = [
  { key: "archive", slug: "enquetes", title: "Toutes les enquêtes" },
  { key: "data", slug: "donnees", title: "Les données" },
  { key: "about", slug: "a-propos", title: "À propos" },
  { key: "design", slug: "design", title: "Le design system", noindex: true },
];

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** "2026-10-24" -> "24 octobre 2026" (1er for the first of the month). */
export function frDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-10-24" -> "octobre 2026" */
export function frMonth(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export const issueByKey = (key) => ISSUES.find((i) => i.key === key);

/** "Enquête" or "En 5 minutes": what a publication is called in kickers, cards and the archive. */
export const kind = (i) => (i.format === "court" ? "En 5 minutes" : "Enquête");

/** "Enquête n° 3" or "En 5 minutes, n° 6". */
export const numbered = (i) => (i.format === "court" ? `En 5 minutes, n° ${i.no}` : `Enquête n° ${i.no}`);
