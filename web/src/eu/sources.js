// Every source of the fourth investigation, with its terms of reuse: the line under each figure
// (data-esource) and the method section at the end of the page.
import { $, el } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { seasonFacts } from "./facts.js";

export const ESOURCES = {
  paoc: {
    short: "Eurostat, passagers aériens par pays (avia_paoc)",
    label:
      "Eurostat, Air passenger transport by type of schedule, transport coverage and country (avia_paoc)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/avia_paoc/default/table",
  },
  paoa: {
    short: "Eurostat, passagers aériens par aéroport (avia_paoa)",
    label: "Eurostat, Air passenger transport by main airports in each reporting country (avia_paoa)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/avia_paoa/default/table",
  },
  ourairports: {
    short: "OurAirports (coordonnées)",
    label: "OurAirports, coordonnées des aéroports (domaine public)",
    url: "https://ourairports.com/data/",
  },
  naturalearth: {
    short: "Natural Earth (fond de carte)",
    label: "Natural Earth, frontières des pays au 1:50 000 000 (domaine public), via world-atlas",
    url: "https://www.naturalearthdata.com/",
  },
  esms: {
    short: "Eurostat, métadonnées (avia_pa_esms)",
    label: "Eurostat, Air transport measurement - passengers, métadonnées de référence (avia_pa_esms)",
    url: "https://ec.europa.eu/eurostat/cache/metadata/en/avia_pa_esms.htm",
  },
  reg: {
    short: "Règlement (CE) n° 437/2003",
    label: "Règlement (CE) n° 437/2003 du 27 février 2003 relatif aux statistiques du transport aérien",
    url: "https://eur-lex.europa.eu/eli/reg/2003/437/oj",
  },
  copyright: {
    short: "Eurostat, conditions de réutilisation",
    label: "Eurostat, avis sur les droits d'auteur : réutilisation autorisée, source citée",
    url: "https://ec.europa.eu/eurostat/help/copyright-notice",
  },
};

const link = (s, text) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: text ?? s.short });

/** "Source : ..." under every element carrying data-esource="paoc naturalearth". */
export function addSourceLines(root = document) {
  for (const node of root.querySelectorAll("[data-esource]")) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset.esource.split(/\s+/).filter((k) => ESOURCES[k]);
    const links = [];
    keys.forEach((k, i) => {
      if (i) links.push(i === keys.length - 1 ? " et " : ", ");
      links.push(link(ESOURCES[k]));
    });
    node.append(
      el("div", { class: "source-line" }, el("p", {}, ["Source : ", ...links, ". Calculs aviationdata."])),
    );
  }
}

/** The method and the sources, at the end of the page. */
export function initSources(data) {
  const m = data.meta;
  const li = (parts) => el("li", {}, parts);
  const box = m.box;
  const left = m.leftOut;
  const i19 = data.airportYears.indexOf(2019);
  const mio = (v) => `${fmtNum(v / 1e6, 1)} million${v >= 2e6 ? "s" : ""}`;
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(ESOURCES.paoc, ESOURCES.paoc.label),
        ` : passagers transportés par pays déclarant, par mois et par an, de ${m.first} à ${m.last} (mois publiés jusqu'en ${data.zones[0].monthLast.slice(0, 4)}). Mise à jour d'Eurostat du ${m.updated.slice(8, 10)}/${m.updated.slice(5, 7)}/${m.updated.slice(0, 4)}.`,
      ]),
      li([
        link(ESOURCES.paoa, ESOURCES.paoa.label),
        ` : passagers transportés par aéroport, par an, de ${m.cross} à ${m.last}.`,
      ]),
      li([
        link(ESOURCES.ourairports),
        " : position des aéroports ; quatre aéroports fermés (Berlin-Tegel, Berlin-Tempelhof, Brive-La Roche, Narvik-Framnes) viennent de leurs fiches d'aéroports fermés.",
      ]),
      li([link(ESOURCES.naturalearth, ESOURCES.naturalearth.label), "."]),
      li([
        "Réutilisation : ",
        link(ESOURCES.copyright, "Eurostat autorise la réutilisation de ses données, source citée"),
        ". Les agrégats, parts et classements de cette page sont des calculs d'aviationdata, pas des chiffres d'Eurostat.",
      ]),
    ]),
    el("h3", { text: "Ce que compte Eurostat" }),
    el("ul", {}, [
      li([
        "Des passagers transportés : un passager compte une fois par vol, quel que soit le nombre d'escales de ce vol ; le transit direct n'est pas compté (",
        link(ESOURCES.esms, "métadonnées d'Eurostat"),
        "). Un pays compte les passagers qui partent de ses aéroports ou y arrivent, ses vols intérieurs une seule fois. L'Union compte une seule fois un passager entre deux de ses pays.",
      ]),
      li([
        "Un aéroport compte ses propres départs et arrivées : un vol Paris–Madrid apparaît à Paris et à Madrid, et un passager en correspondance compte deux fois dans l'aéroport où il change d'avion, à l'arrivée et au départ. Les aéroports ne s'additionnent donc jamais pour faire un pays.",
      ]),
      li([
        "Les séries sont comparables depuis 2003, date d'application du ",
        link(ESOURCES.reg),
        ", certains pays ayant eu jusqu'en 2005 pour tout déclarer. Cette enquête part de ",
        String(m.first),
        ", de 2007 pour la Bulgarie et de 2008 pour la Croatie et l'Union. Les comparaisons entre pays et les aéroports partent de ",
        String(m.cross),
        ". Quand les mois d'un pays ne font pas son année, sa série mensuelle commence l'année suivante.",
      ]),
      li([
        "Les 27 pays de l'Union et les trois pays de l'AELE qui déclarent à Eurostat (Norvège, Suisse, Islande). Le Royaume-Uni, dont les données s'arrêtent en janvier 2020, et les pays de l'élargissement (Balkans occidentaux, Turquie), dont les séries commencent entre 2015 et 2025, sont laissés de côté pour comparer les mêmes pays chaque année.",
      ]),
    ]),
    el("h3", { text: "Le centre de gravité" }),
    el("ul", {}, [
      li([
        `Moyenne des positions de tous les aéroports, pondérée par leurs passagers de l'année, calculée sur la sphère. Seuls comptent les aéroports entre ${box[0]}° et ${box[1]}° nord, ${-box[2]}° ouest et ${box[3]}° est : Canaries, Açores et Madère y sont, pas les départements d'outre-mer ni le Svalbard (${mio(left.outside[i19])} de passagers en 2019).`,
      ]),
      li([
        `Les ensembles d'aéroports (« Paris airport system ») et les codes sans position ne comptent pas (au plus ${fmtNum(Math.max(...left.nocoord) / 1000)} 000 passagers par an).`,
      ]),
      li([
        "Le centre de gravité résume une géographie ; il ne dit pas pourquoi elle change, et un déplacement de quelques dizaines de kilomètres à l'échelle de l'Europe traduit déjà des millions de passagers.",
      ]),
    ]),
    el("h3", { text: "Gains et pertes depuis 2019" }),
    el("ul", {}, [
      li([
        `Écart entre les passagers de chaque aéroport en ${data.shift.from} et en ${data.shift.to}, avec les mêmes limites que le centre de gravité ; un aéroport sans données une année compte zéro cette année-là. Berlin-Tegel, fermé en 2020, est compté avec Berlin-Brandebourg, qui a repris le code de Berlin-Schönefeld.`,
      ]),
      li([
        `Les totaux au sud et au nord du ${data.shift.split}e parallèle et par tranche de deux degrés portent sur tous les aéroports ; la carte à pics montre ceux qui ont dépassé ${fmtNum(m.mapMin)} passagers au moins une année, et seulement quand leur écart dépasse 50 000 passagers. Ces sommes d'aéroports comptent deux fois un passager entre deux aéroports de la zone : elles ne se comparent pas aux passagers des pays.`,
      ]),
    ]),
    el("h3", { text: "Les saisons" }),
    el("ul", {}, [
      li([
        "Chaque mois compte ses passagers par jour, pour qu'un mois de 31 jours ne paraisse pas plus chargé qu'un mois de 30. Le profil d'une année rapporte les passagers par jour de chaque mois à la moyenne de l'année ; l'écart saisonnier divise les passagers par jour du mois le plus chargé par ceux du mois le plus creux.",
      ]),
      li([
        `Les années 2020 à 2022, années de Covid, sont écartées : en janvier 2022 encore, l'Union comptait ${fmtNum(seasonFacts(data).jan2022)} % de passagers de moins qu'en janvier 2019. Les années montrées sont celles où les trente pays et l'Union ont leurs douze mois.`,
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Les causes : la reprise de chaque pays tient au tourisme, aux compagnies, aux taxes, au train, à la guerre en Ukraine. Les données d'Eurostat ne les mesurent pas, et le texte ne les affirme pas.",
      ]),
      li(["Les vols : Eurostat compte des passagers, pas des avions ni des sièges ici."]),
      li([
        "Les révisions : Eurostat révise ses séries ; les communiqués plus anciens peuvent donner des chiffres légèrement différents.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=eu", text: "la page des données" }),
      ".",
    ]),
  );
}
