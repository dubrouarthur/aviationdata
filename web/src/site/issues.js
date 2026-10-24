// The magazine's table of contents. One entry per investigation, newest first: the pages Vite builds
// (vite.config.js), the shared masthead menu, footer, bylines and "read also" (partials.js), the
// home page's list, the Atom feed and the sitemap all come from here.
// A new investigation = its folder + an entry in ISSUES (+ its lead or strip on the home page).

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
    key: "hf",
    slug: "facteur-humain",
    no: 3,
    topic: "Sécurité",
    title: "L'erreur est humaine",
    dek: "Dans les accidents aériens, le facteur humain est-il vraiment la première cause ? Seize ans de verdicts des enquêteurs américains, 21 400 accidents, lus avec les grands modèles du risque aérien.",
    published: "2026-10-24",
    updated: "2026-10-24",
    minutes: 20,
    chapters: 11,
    image: "og-hf.jpg",
    accent: "#b3460a",
    sources: "NTSB",
  },
  {
    key: "jet",
    slug: "courant-jet",
    no: 2,
    topic: "Météo et coûts",
    title: "Le vent dans le dos",
    dek: "Le courant-jet rallonge d'une heure les vols vers l'Amérique. Jouer avec le vent et le prévoir peut-il faire baisser le coût d'un vol ? La réponse, sur 105 000 vols et quatre ans de vents.",
    published: "2026-10-24",
    updated: "2026-10-24",
    minutes: 30,
    chapters: 13,
    image: "og-jet.jpg",
    accent: "var(--night)",
    sources: "ERA5 Copernicus, NOAA, Météo-France, NASA, OpenSky",
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
    accent: "var(--magenta)",
    sources: "DGAC, data.gouv.fr",
  },
];

// interactive tools inside the investigations, offered on their own from the home page and the menu
export const TOOLS = [
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
  { key: "about", slug: "a-propos", title: "À propos" },
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
