// The words of « Combien de CO2 pour un vol en avion ? ». Every number comes from carboneFacts()
// (facts.js) and is recomputed by web/scripts/check_carbone.py. House rules (CLAUDE.md): a figure title
// states a finding, the « Lecture » line says how to read it, at most two numbers in a sentence.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { CSOURCES } from "./sources.js";

const p = (parts) => el("p", {}, rich(parts));
const pc = (v) => `${fmtNum(Math.abs(v), 0)} %`;
/** kilograms, rounded to ten (a distance times an average is not precise to the kilo) */
export const kg = (v) => `${fmtNum(Math.round(v / 10) * 10, 0)} kg`;
export const t1 = (v) => `${fmtNum(v / 1000, 1)} tonne`;
const g0 = (v) => `${fmtNum(v, 0)} g`;
const mt = (v) => `${fmtNum(Math.abs(v), 1)} millions de tonnes`;

export function writeAnswer(F) {
  $("#court-answer").replaceChildren(
    el("p", { class: "ca-yes", text: `${t1(F.ny.ret)}` }),
    p([
      "de CO2 par passager pour un aller-retour Paris–New York, ",
      { b: kg(F.toulouse.ret) },
      " pour un Paris–Toulouse. Par kilomètre, ce sont pourtant les vols courts qui émettent le plus.",
    ]),
    p([
      `Chaque passager émet un tiers de moins qu'en ${F.first}. Mais le trafic a monté plus vite : le total des vols de France, lui, a augmenté.`,
    ]),
    p([{ a: "Calculez le CO2 de votre vol", href: "#calculer" }, "."]),
  );
}

export function writeSteps(F) {
  const [top] = F.segments;
  // 1. per kilometre
  $("#km-prose").replaceChildren(
    p([
      "Pour comparer des vols de longueurs différentes, la DGAC rapporte le CO2 de chaque type de vol au nombre de passagers et à la distance parcourue : des grammes de CO2 par passager et par kilomètre.",
    ]),
  );
  $("#h-km-fig").textContent = "Par kilomètre, le vol intérieur émet le plus";
  $("#km-note").textContent =
    `CO2 émis par passager et par kilomètre selon le type de vol au départ ou à l'arrivée de la France, en ${F.last}, en grammes.`;
  lecture(
    "#chart-km",
    "plus la barre est longue, plus chaque kilomètre parcouru par un passager émet de CO2.",
  );
  $("#km-after").replaceChildren(
    p([
      "Sur un vol intérieur, chaque passager émet ",
      { b: `${g0(top.value)} de CO2` },
      " par kilomètre ; sur un long-courrier, ",
      { b: g0(F.lc) },
      ".",
    ]),
    p([
      "Au kilomètre, le vol intérieur émet donc ",
      { b: `${pc(F.domVsLc)} de plus` },
      ". La DGAC fait le même constat par distance : plus le vol est court, plus chaque kilomètre pèse.",
    ]),
  );

  // 2. a trip
  $("#trajet-prose").replaceChildren(
    p([
      "Au kilomètre, un long-courrier émet moins ; mais il en parcourt beaucoup. Multiplier la distance d'un voyage par les grammes de son type de vol donne un ordre de grandeur du CO2 de chaque passager.",
    ]),
  );
  $("#h-trajet-fig").textContent = `Un aller-retour Paris–New York : ${t1(F.ny.ret)} de CO2 par passager`;
  $("#trajet-note").textContent =
    `CO2 émis par passager pour un aller-retour depuis Paris, en kilos, d'après les moyennes de la DGAC pour ${F.last}.`;
  lecture(
    "#chart-trajet",
    "chaque barre multiplie deux fois la distance à vol d'oiseau entre les aéroports par les grammes de CO2 du type de vol.",
  );
  $("#trajet-after").replaceChildren(
    p([
      "Un aller-retour Paris–New York émet ",
      { b: kg(F.ny.ret) },
      " de CO2 par passager, celui de Paris à Toulouse ",
      { b: kg(F.toulouse.ret) },
      ".",
    ]),
    p([
      "Au kilomètre, Toulouse est le plus lourd. Au voyage, New York pèse ",
      { b: `${fmtNum(Math.round(F.ny.ret / F.toulouse.ret), 0)} fois plus` },
      " : sa distance est ",
      { b: `${fmtNum(Math.round(F.ny.km / F.toulouse.km), 0)} fois` },
      " plus longue.",
    ]),
  );

  // 3. per passenger since 2000
  $("#efficacite-prose").replaceChildren(
    p([
      `Les avions récents consomment moins, et ils volent plus remplis. La DGAC suit le CO2 par passager et par kilomètre de tous les vols de France depuis ${F.first}.`,
    ]),
  );
  $("#h-efficacite-fig").textContent = `Chaque passager émet un tiers de moins qu'en ${F.first}`;
  $("#efficacite-note").textContent =
    `CO2 émis par passager et par kilomètre, tous les vols de France, de ${F.first} à ${F.last}, en grammes.`;
  lecture("#chart-efficacite", "plus la ligne descend, moins chaque passager émet pour un même kilomètre.");
  $("#efficacite-after").replaceChildren(
    p([
      `En ${F.first}, un passager émettait `,
      { b: g0(F.intensityFirst) },
      ` de CO2 par kilomètre ; en ${F.last}, `,
      { b: g0(F.all) },
      ".",
    ]),
    p([
      "La baisse est de ",
      { b: pc(F.intensityChange) },
      " en vingt-quatre ans : un tiers de CO2 en moins pour le même voyage.",
    ]),
  );

  // 4. the total
  $("#total-prose").replaceChildren(
    p([
      "Si chaque passager émet moins, le CO2 de l'aviation française devrait baisser. Ce n'est pas ce que montrent les chiffres de la DGAC.",
    ]),
  );
  $("#h-total-fig").textContent = "Le trafic a monté plus vite que les avions ne se sont améliorés";
  $("#total-note").textContent =
    `Variation du CO2 de tous les vols de France de ${F.first} à ${F.last}, et ce qui l'explique, en millions de tonnes.`;
  lecture(
    "#chart-total",
    "la première barre ajoute le CO2 des passagers et des kilomètres en plus ; la deuxième retire ce que chaque passager émet en moins ; la dernière est le résultat.",
  );
  $("#total-after").replaceChildren(
    p([
      `De ${F.first} à ${F.last}, le trafic, compté en passagers et en kilomètres, augmente de `,
      { b: pc(F.trafficPct) },
      ". À lui seul, il ajouterait ",
      { b: mt(F.traffic) },
      " de CO2.",
    ]),
    p([
      "Les progrès par passager en retirent ",
      { b: mt(F.efficiency) },
      `. Au total, les vols de France émettent ${mt(F.totalLast)} en ${F.last}, contre ${fmtNum(F.totalFirst, 1)} en ${F.first}.`,
    ]),
  );
}

export function writeReponse(F) {
  $("#reponse-prose").replaceChildren(
    p([
      "Un aller-retour Paris–New York émet environ ",
      { b: `${t1(F.ny.ret)} de CO2` },
      " par passager ; un Paris–Toulouse, ",
      { b: kg(F.toulouse.ret) },
      ".",
    ]),
    p([
      `Au kilomètre, les vols courts émettent le plus. Et si chaque passager émet un tiers de moins qu'en ${F.first}, le total a augmenté de `,
      { b: pc(F.totalChange) },
      ", parce que l'on vole davantage.",
    ]),
  );
}

export function writeSources(F) {
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(CSOURCES.co2, CSOURCES.co2.label),
        `, DGAC, sur data.gouv.fr : le CO2 des vols commerciaux de France, chaque année de ${F.first} à ${F.last}, en tonnes et en grammes par passager-équivalent-kilomètre, par type de vol.`,
      ]),
      li([
        link(CSOURCES.ourairports, CSOURCES.ourairports.label),
        " : la position des aéroports, pour la distance à vol d'oiseau de chaque voyage.",
      ]),
      li([
        link(CSOURCES.routes, CSOURCES.routes.label),
        " : pour le calculateur, les passagers, les sièges et les vols de chaque liaison, chaque trimestre. Réutilisation : ",
        link(CSOURCES.copyright, "source citée, modifications signalées"),
        ". Passagers par vol, sièges occupés et vols par semaine sont des calculs d'aviationdata.",
      ]),
    ]),
    el("h3", { text: "Le calculateur" }),
    el("ul", {}, [
      li([
        "Le CO2 multiplie la distance à vol d'oiseau par les grammes par passager et par kilomètre de la DGAC pour le type de vol : intérieur si les deux aéroports sont en métropole, outre-mer si l'un est outre-mer et l'autre en France, long-courrier au-delà de 3 600 km pour un vol international (environ 4 h 30 de vol, la limite de la DGAC), moyen-courrier en deçà.",
      ]),
      li([
        "La liaison est décrite par le trimestre du mois choisi, la dernière année complète publiée par Eurostat, toutes compagnies et les deux sens confondus. Vols par semaine : les vols du trimestre divisés par treize semaines et par deux sens.",
      ]),
      li([
        "Le CO2 « rapporté au remplissage » suppose que le CO2 d'un vol se partage entre ses passagers : il multiplie l'estimation par le remplissage moyen des vols du même type ce trimestre-là, divisé par celui de la liaison.",
      ]),
      li([
        "Certaines liaisons ne sont pas publiées : leurs chiffres révéleraient ceux d'une seule compagnie (secret statistique). D'autres n'ont pas de vol direct.",
      ]),
    ]),
    el("h3", { text: "Ce que compte la DGAC" }),
    el("ul", {}, [
      li([
        "D'après son ",
        link(CSOURCES.bilan),
        ", la DGAC calcule le CO2 vol par vol avec son outil TARMAAC : le carburant brûlé selon l'avion et la distance, au roulage, au décollage, en croisière et à l'atterrissage.",
      ]),
      li([
        "Un passager-équivalent compte un passager, ou 100 kg de fret et de courrier : le CO2 d'un vol est partagé entre ses passagers et sa soute.",
      ]),
      li([
        "Les émissions d'un vol entre la France et l'étranger sont partagées entre le pays de départ et celui d'arrivée, pour ne pas les compter deux fois.",
      ]),
      li([
        "Les biocarburants (carburants d'aviation durables) sont comptés avec le reste du carburant, comme dans la première enquête du magazine.",
      ]),
    ]),
    el("h3", { text: "Ce que cette page ne compte pas" }),
    el("ul", {}, [
      li([
        "Les effets hors CO2. Les traînées de condensation et les oxydes d'azote réchauffent aussi le climat ; la DGAC ne les compte pas, leur effet étant encore mal mesuré.",
      ]),
      li(["La production du carburant, avant qu'il n'arrive dans l'avion."]),
      li([
        "Le CO2 d'un vol précis. Chaque voyage est calculé avec la moyenne de son type de vol : un avion plus récent, plus rempli ou en classe économique émet moins, une classe affaires ou un détour davantage.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=carbone", text: "la page des données" }),
      ".",
    ]),
  );
}
