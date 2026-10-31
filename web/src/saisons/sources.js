// Sources of the fifth investigation: Eurostat's monthly passengers by country, and the map. The same
// entries as the European story (eu/sources.js), so that a link is written once.
import { $, el } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { ESOURCES } from "../eu/sources.js";

export const SSOURCES = {
  paoc: ESOURCES.paoc,
  paoa: ESOURCES.paoa,
  ourairports: ESOURCES.ourairports,
  naturalearth: ESOURCES.naturalearth,
  esms: ESOURCES.esms,
  copyright: ESOURCES.copyright,
};

const link = (s, text) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: text ?? s.short });

/** "Source : ..." under every element carrying data-ssource="paoc naturalearth". */
export function addSourceLines(root = document) {
  for (const node of root.querySelectorAll("[data-ssource]")) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset.ssource.split(/\s+/).filter((k) => SSOURCES[k]);
    const links = [];
    keys.forEach((k, i) => {
      if (i) links.push(i === keys.length - 1 ? " et " : ", ");
      links.push(link(SSOURCES[k]));
    });
    node.append(
      el("div", { class: "source-line" }, el("p", {}, ["Source : ", ...links, ". Calculs aviationdata."])),
    );
  }
}

/** The method and the sources, at the end of the page. */
export function initSources(data, Q) {
  const m = data.meta;
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(SSOURCES.paoc, SSOURCES.paoc.label),
        ` : passagers transportés par pays déclarant, chaque mois, tous vols, vols intérieurs et vols internationaux. Mise à jour d'Eurostat du ${m.updated.slice(8, 10)}/${m.updated.slice(5, 7)}/${m.updated.slice(0, 4)}.`,
      ]),
      li([
        link(SSOURCES.paoa, SSOURCES.paoa.label),
        " et ",
        link(SSOURCES.ourairports),
        " : passagers et position des aéroports, pour classer les pays du nord au sud.",
      ]),
      li([link(SSOURCES.naturalearth, SSOURCES.naturalearth.label), ", pour la carte."]),
      li([
        "Réutilisation : ",
        link(SSOURCES.copyright, "Eurostat autorise la réutilisation de ses données, source citée"),
        ". Les profils, écarts et classements de cette page sont des calculs d'aviationdata, pas des chiffres d'Eurostat.",
      ]),
    ]),
    el("h3", { text: "Ce que compte Eurostat" }),
    el("ul", {}, [
      li([
        "Des passagers transportés : un passager compte une fois par vol, le transit direct n'est pas compté (",
        link(SSOURCES.esms, "métadonnées d'Eurostat"),
        "). Un vol intérieur reste dans le pays (pour la France, l'outre-mer compris) ; un vol international le quitte.",
      ]),
      li([
        "Les 27 pays de l'Union et les trois pays de l'AELE qui déclarent à Eurostat (Norvège, Suisse, Islande), comme dans l'enquête « Cap au sud ».",
      ]),
    ]),
    el("h3", { text: "Les saisons" }),
    el("ul", {}, [
      li([
        "Chaque mois compte ses passagers par jour, pour qu'un mois de 31 jours ne paraisse pas plus chargé qu'un mois de 30. Le profil d'une année rapporte les passagers par jour de chaque mois à la moyenne de l'année ; l'écart saisonnier divise les passagers par jour du mois le plus chargé par ceux du mois le plus creux.",
      ]),
      li([
        `Les années 2020 à 2022, années de Covid, sont écartées : en janvier 2022 encore, l'Union comptait ${fmtNum(Q.jan2022)} % de passagers de moins qu'en janvier 2019. Les années montrées, de ${Q.first} à ${Q.last}, sont celles où les trente pays et l'Union ont leurs douze mois.`,
      ]),
      li([
        "Vols intérieurs et internationaux : seuls les pays où les vols intérieurs font au moins 5 % des passagers sont comparés ; ailleurs, quelques vols suffisent à faire un écart sans signification.",
      ]),
      li([
        "Ordre « du nord au sud » : la latitude moyenne des passagers des aéroports de chaque pays, ceux de l'enquête « Cap au sud ».",
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Les causes : vacances scolaires, tourisme, météo, offre des compagnies. Eurostat compte des passagers, pas les raisons de leur voyage, et le texte ne les affirme pas.",
      ]),
      li(["Les jours : les données sont mensuelles ; un pic de quelques jours se fond dans son mois."]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=sea", text: "la page des données" }),
      ".",
    ]),
  );
}
