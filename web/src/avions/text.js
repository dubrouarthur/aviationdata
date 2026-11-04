// The words of « Le ciel, modèle par modèle ». Every number comes from worldFacts() and usFacts()
// (facts.js) and is recomputed by web/scripts/check_avions.py. House rules (CLAUDE.md): a chapter title
// and a figure title state findings, a « Lecture » line says how to read a figure, at most two numbers in
// a sentence, no cause asserted: the data count flights, delays and cancellations, not their reasons.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { ASOURCES } from "./sources.js";
import { GROUPS } from "./charts.js";
import { essentialSteps } from "../site/story.js";

const p = (parts) => el("p", {}, rich(parts));
const pc = (v, d = 0) => `${fmtNum(v * 100, d)} %`;
const pt = (v) => `${fmtNum(Math.abs(v), 1)} point${Math.abs(v) >= 2 ? "s" : ""}`;
const n0 = (v) => fmtNum(v, 0);
const km = (v) => `${n0(Math.round(v / 10) * 10)} km`;
const hm = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};
/** "8 sur 10", "un sur deux"... for a share */
const outOfTen = (v) => `${n0(Math.round(v * 10))} sur 10`;
const groupLabel = (k) => GROUPS.find((g) => g.key === k).label;
export const fmt = { pc, pt, km, hm, n0 };

export function writeOpening(Wf, Uf) {
  $("#av-open-h").textContent = `Cent vols d'avions de ligne en ${Wf.last}, par famille`;
  $("#av-open-cap").textContent =
    `Chaque case est un vol sur cent parmi les ${n0(Wf.total)} vols d'avions de ligne que le réseau OpenSky a suivis en ${Wf.last}.`;
  $("#open-dek").replaceChildren(
    rich([
      "Deux familles d'avions, l'Airbus A320 et le Boeing 737, font ",
      { b: outOfTen(Wf.top2) },
      ` des vols de ligne que suit le réseau OpenSky. Le reste se partage entre avions régionaux et gros-porteurs. Aux États-Unis, où chaque vol intérieur est publié avec son retard, ${n0(Uf.flightsAll)} vols de ${Uf.year} disent aussi lesquels arrivent à l'heure. Réponse : moins l'avion que la compagnie.`,
    ]),
  );
}

export function writeEssentiel(Wf, Uf) {
  const busy = Wf.byUse[0];
  const calm = Wf.byUse.at(-1);
  const near = Uf.big.filter((m) => Math.abs(Uf.gap(m)) < 5).length;
  essentialSteps([
    {
      id: "familles",
      q: "Quels avions font le ciel ?",
      n: pc(Wf.top2),
      lead: "des vols de ligne se font en Airbus A320 ou en Boeing 737.",
      more: `Deux familles, avec leurs nouvelles versions (A320neo, 737 MAX). Vols suivis dans le monde en ${Wf.last}.`,
    },
    {
      id: "usage",
      q: "Lesquels volent le plus souvent ?",
      n: `${fmtNum(busy.flightsPerDay, 1)} vols`,
      lead: `par jour pour un ${busy.name}, le modèle le plus occupé.`,
      more: [
        `Les petits avions enchaînent les trajets courts. Un ${calm.name}, qui part loin, n'en fait que `,
        { b: fmtNum(calm.flightsPerDay, 1) },
        ". Comptés sur les jours où l'avion vole.",
      ],
    },
    {
      id: "ponctualite",
      q: "Lesquels arrivent le plus à l'heure ?",
      n: pc(Uf.best.ontime),
      lead: `des vols en ${Uf.best.name} arrivent à l'heure, le meilleur score.`,
      more: [
        `En ${Uf.worst.name}, le moins bon, `,
        { b: pc(Uf.worst.ontime) },
        `. Vols intérieurs américains de ${Uf.year} ; à l'heure veut dire moins de 15 minutes de retard.`,
      ],
    },
    {
      id: "compagnie",
      q: "Est-ce la faute de l'avion ?",
      n: `${n0(Math.round(Uf.across * 100))} vols`,
      lead: "à l'heure sur 100 séparent la compagnie la plus ponctuelle de la moins ponctuelle.",
      more: [
        "Rarement : c'est surtout la compagnie qui compte. Comparés à leurs propres compagnies, ",
        { b: `${near} modèles sur ${Uf.big.length}` },
        " font pareil, à moins de 5 vols sur 100 près.",
      ],
    },
  ]);
}

export function writeWorld(Wf) {
  const [f1, f2] = Wf.families;
  $("#h-familles").textContent = "Deux familles d'avions font l'essentiel du ciel";
  $("#familles-prose").replaceChildren(
    p([
      `En ${Wf.last}, le réseau OpenSky a suivi `,
      { b: `${n0(Wf.total)} vols` },
      " d'avions de ligne. Près des deux tiers sont faits par deux familles d'avions, toutes versions confondues.",
    ]),
  );
  $("#h-fam-fig").textContent = `L'A320 et le 737, ${outOfTen(Wf.top2)} des vols`;
  $("#fam-note").textContent =
    `Part des vols d'avions de ligne suivis par OpenSky en ${Wf.last}, par famille d'avions, en %.`;
  lecture(
    "#chart-fam",
    `chaque famille réunit ses versions : la famille A320 compte l'A319, l'A320, l'A321 et leurs « neo », la famille 737 ses générations Classic, NG et MAX.`,
  );
  $("#familles-after").replaceChildren(
    p([
      `La famille ${f1.label.replace("Airbus ", "")} fait `,
      { b: pc(f1.share) },
      ` des vols, celle du ${f2.label.replace("Boeing ", "")} `,
      { b: pc(f2.share) },
      ".",
    ]),
    p([
      "Les gros-porteurs, A350, 777, 787 et les autres, font ",
      { b: pc(Wf.groups.wide) },
      " des vols ; les avions régionaux, jets et turbopropulseurs de moins de cent places, ",
      { b: pc(Wf.groups.regional) },
      ".",
    ]),
  );

  // distances
  const s = Wf.shortest;
  const l = Wf.longest;
  $("#h-distances").textContent = "Du saut de puce au tour du monde";
  $("#distances-prose").replaceChildren(
    p([
      "Chaque modèle a son terrain. La distance entre les deux aéroports d'un vol, quand le réseau les a vus tous les deux, dit lequel.",
    ]),
  );
  $("#h-km-fig").textContent =
    `Un ${l.name} vole ${n0(Math.round(l.kmMedian / s.kmMedian))} fois plus loin qu'un ${s.name}`;
  $("#km-note").textContent =
    `Distance médiane d'un vol entre ses deux aéroports, par modèle, en ${Wf.last}, en kilomètres (échelle logarithmique).`;
  lecture(
    "#chart-km",
    "la moitié des vols du modèle sont plus courts que la distance indiquée, l'autre moitié plus longs. L'échelle grandit par multiples : chaque graduation double ou quintuple la précédente.",
  );
  $("#distances-after").replaceChildren(
    p([
      `Le vol médian d'un ${s.name} fait `,
      { b: km(s.kmMedian) },
      `, celui d'un ${l.name} `,
      { b: km(l.kmMedian) },
      ".",
    ]),
    p([
      `Entre les deux, les monocouloirs les plus vendus volent autour de ${km(Wf.model("A320").kmMedian)} pour l'A320 et ${km(Wf.model("B738").kmMedian)} pour le 737-800 : l'Europe, l'Amérique du Nord, l'Asie, d'une ville à l'autre.`,
    ]),
  );

  // usage
  const u0 = Wf.byUse[0];
  const u1 = Wf.byUse.at(-1);
  $("#h-usage").textContent = "Plus l'avion est petit, plus il enchaîne les vols";
  $("#usage-prose").replaceChildren(
    p([
      "Un avion de ligne coûte cher : il gagne sa vie en l'air. Le réseau suit chaque avion par son transpondeur, et compte ses vols chaque jour où il vole.",
    ]),
  );
  $("#h-use-fig").textContent =
    `${fmtNum(u0.flightsPerDay, 1)} vols par jour pour un ${u0.name}, ${fmtNum(u1.flightsPerDay, 1)} pour un ${u1.name}`;
  $("#use-note").textContent =
    `Nombre médian de vols d'un avion par jour où il vole, par modèle, en ${Wf.last}.`;
  lecture(
    "#chart-use",
    "pour chaque avion, ses vols divisés par ses jours de vol ; la barre donne l'avion du milieu de chaque modèle.",
  );
  $("#usage-after").replaceChildren(
    p([
      `Un ${u0.name} fait `,
      { b: `${fmtNum(u0.flightsPerDay, 1)} vols` },
      ` par jour de vol ; un ${u1.name} `,
      { b: fmtNum(u1.flightsPerDay, 1) },
      ".",
    ]),
    p([
      "Les courts trajets se multiplient dans la journée ; un long-courrier fait un aller, parfois un aller-retour, et repart le lendemain.",
    ]),
  );

  // changes
  const up = Wf.change.slice(0, 3);
  const down = Wf.change.slice(-3).reverse();
  $("#h-releve").textContent = `De ${Wf.first} à ${Wf.last}, la relève s'installe`;
  $("#releve-prose").replaceChildren(
    p([
      `Entre ${Wf.first} et ${Wf.last}, le Covid a vidé le ciel, puis le trafic a repris. Les avions qui volent, eux, ne sont plus tout à fait les mêmes : les nouvelles versions de l'A320 et du 737 prennent la place des anciennes.`,
    ]),
  );
  $("#h-chg-fig").textContent =
    `L'${up[0].name} gagne le plus, ${down[0].name.startsWith("A") ? "l'" : "le "}${down[0].name} perd le plus`;
  $("#chg-note").textContent =
    `Évolution de la part de chaque modèle dans les vols d'avions de ligne suivis par OpenSky, de ${Wf.first} à ${Wf.last}, en points de pourcentage.`;
  lecture("#chart-chg", "un point de pourcentage, c'est un vol sur cent qui change de modèle.");
  $("#releve-after").replaceChildren(
    p([
      `La part de l'${up[0].name} passe de `,
      { b: pc(up[0].share0, 1) },
      " à ",
      { b: pc(up[0].share, 1) },
      ` des vols ; ${up[1].name.startsWith("A") ? "l'" : "le "}${up[1].name} et ${up[2].name.startsWith("A") ? "l'" : "le "}${up[2].name} suivent.`,
    ]),
    p([
      "À l'inverse, ",
      down
        .map((m) => m.name)
        .join(", ")
        .replace(/, ([^,]*)$/, " et $1"),
      " reculent dans les vols suivis.",
    ]),
  );

  // countries
  const C = Wf.countries;
  const top = C[0];
  const lead = (c) => GROUPS.map((g) => g.key).reduce((a, b) => (c.shares[b] > c.shares[a] ? b : a));
  const b737 = C.filter((c) => lead(c) === "b737").map((c) => c.name);
  const a320 = C.filter((c) => lead(c) === "a320").map((c) => c.name);
  $("#h-pays").textContent = "À chaque pays sa flotte";
  $("#pays-prose").replaceChildren(
    p([
      "Les compagnies choisissent leurs avions, et les flottes d'un pays se ressemblent souvent. Les vols partis de chaque pays le montrent.",
    ]),
  );
  $("#h-heat-fig").textContent =
    `L'A320 domine en ${a320.length} pays sur ${C.length}, le 737 en ${b737.length}`;
  $("#heat-note").textContent =
    `Part des vols d'avions de ligne partis de chaque pays, par famille, en ${Wf.last}, pour les ${C.length} pays de départ les plus suivis par OpenSky, en %.`;
  lecture(
    "#chart-heat",
    "chaque ligne fait cent : plus la case est foncée, plus la famille pèse dans les départs du pays.",
  );
  $("#pays-after").replaceChildren(
    p([
      `Aux États-Unis, premier pays de départ suivi, le 737 fait `,
      { b: pc(top.shares.b737) },
      " des vols et la famille A320 ",
      { b: pc(top.shares.a320) },
      ".",
    ]),
    p([
      `La famille A320 domine notamment en ${a320
        .slice(0, 4)
        .join(", ")
        .replace(/, ([^,]*)$/, " et $1")} ; le 737 en ${b737
        .slice(0, 3)
        .join(", ")
        .replace(/, ([^,]*)$/, " et $1")}.`,
    ]),
  );
  $("#pays-aside").textContent =
    "OpenSky suit ce que ses récepteurs entendent : beaucoup de vols en Europe et en Amérique du Nord, peu en Afrique, en Chine ou au-dessus des océans. Les pays du tableau sont les plus suivis, pas forcément les plus actifs, et un vol n'a de pays que si son départ a été vu.";
}

export function writeUS(Uf) {
  const { best, worst } = Uf;
  $("#h-ponctualite").textContent =
    `Aux États-Unis, de ${pc(worst.ontime)} à ${pc(best.ontime)} de vols à l'heure selon l'avion`;
  $("#ponctualite-prose").replaceChildren(
    p([
      `Le ministère américain des Transports publie chaque vol intérieur des grandes compagnies, avec son immatriculation et son retard. En ${Uf.year}, `,
      { b: pc(Uf.modelledShare) },
      " de ces vols se relient à un modèle d'avion.",
    ]),
  );
  $("#h-ot-fig").textContent = "La ponctualité, modèle par modèle, et ce qu'en attendaient ses compagnies";
  $("#ot-note").textContent =
    `Part des vols arrivés moins de quinze minutes après l'heure prévue, États-Unis, vols intérieurs, ${Uf.year}, modèles d'au moins 50 000 vols, en %.`;
  lecture(
    "#chart-ot",
    "le point plein est la ponctualité du modèle ; le cercle, celle qu'il aurait si chacun de ses vols avait la ponctualité moyenne de sa compagnie. Point plein à droite du cercle : mieux que ses compagnies.",
  );
  const g0 = Uf.byGap[0];
  const g1 = Uf.byGap.at(-1);
  $("#ponctualite-after").replaceChildren(
    p([
      `Le ${best.name} arrive à l'heure dans `,
      { b: pc(best.ontime) },
      ` des cas, le ${worst.name} dans `,
      { b: pc(worst.ontime) },
      ".",
    ]),
    p([
      `Mais chaque modèle vole pour des compagnies plus ou moins ponctuelles. Une fois cet effet retiré, le ${g0.name} fait `,
      { b: `${pt(Uf.gap(g0))} de mieux` },
      ` que ses compagnies, le ${g1.name} `,
      { b: `${pt(Uf.gap(g1))} de moins` },
      ".",
    ]),
  );

  $("#h-compagnie").textContent = "La compagnie pèse au moins autant que l'avion";
  $("#compagnie-prose").replaceChildren(
    p([
      "Un retard naît rarement de l'avion lui-même : météo, aéroports encombrés, avion arrivé en retard du vol précédent. Comparer les modèles d'une même compagnie isole un peu ce qui tient à l'avion.",
    ]),
  );
  $("#h-sp-fig").textContent = "Dans chaque compagnie, ses modèles s'étalent autour de sa moyenne";
  $("#sp-note").textContent =
    `Part des vols à l'heure de chaque modèle dans chaque compagnie (au moins 3 000 vols), et moyenne de la compagnie, États-Unis, ${Uf.year}, en %.`;
  lecture(
    "#chart-sp",
    "chaque ligne est une compagnie ; le trait vertical, sa ponctualité moyenne ; chaque point, un de ses modèles.",
  );
  $("#compagnie-after").replaceChildren(
    p([
      `De la compagnie la plus ponctuelle à la moins ponctuelle, l'écart est de `,
      { b: pt(Uf.across * 100) },
      ". Au sein d'une même compagnie, ses modèles s'écartent en moyenne de ",
      { b: pt(Uf.withinMean * 100) },
      ".",
    ]),
    p([
      "Ces écarts ne disent pas que l'avion est en cause : une compagnie met ses modèles sur des lignes différentes, plus ou moins chargées, plus ou moins exposées à la météo. Le modèle hérite de ses lignes.",
    ]),
  );

  $("#h-annulations").textContent = "Les petits avions sont annulés plus souvent, comme leurs compagnies";
  $("#annulations-prose").replaceChildren(
    p([
      "Les jets régionaux de moins de cent places sont exploités par des compagnies régionales, sous les couleurs des grandes. Leurs vols sont annulés plus souvent.",
    ]),
  );
  $("#h-cx-fig").textContent =
    `${pc(Uf.regionalCancel, 1)} de vols annulés pour les avions régionaux, ${pc(Uf.mainlineCancel, 1)} pour les autres`;
  $("#cx-note").textContent =
    `Part des vols annulés, par modèle, États-Unis, vols intérieurs, ${Uf.year}, compagnies qui attribuent leurs annulations à un avion, en %.`;
  lecture(
    "#chart-cx",
    "le point plein est la part de vols annulés du modèle ; le cercle, celle qu'il aurait avec le taux d'annulation moyen de ses compagnies. Point plein à gauche du cercle : moins d'annulations que ses compagnies.",
  );
  $("#annulations-after").replaceChildren(
    p([
      "Les avions régionaux perdent ",
      { b: pc(Uf.regionalCancel, 1) },
      " de leurs vols, les autres ",
      { b: pc(Uf.mainlineCancel, 1) },
      ".",
    ]),
    p([
      "Mais les compagnies qui les exploitent annulent autant leurs autres vols : à compagnie égale, on attendait ",
      { b: pc(Uf.regionalExpected, 1) },
      " pour les avions régionaux. L'écart tient aux compagnies, pas aux avions.",
    ]),
  );
  $("#annulations-aside").textContent =
    `Un vol annulé n'a d'immatriculation que si un avion lui avait été attribué. En ${Uf.year}, ${pc(Uf.untailedCancelShare)} des annulations n'en ont pas ; quatre compagnies, dont United, ne les attribuent presque jamais. Leurs vols sont écartés de ce calcul, et les taux ne valent que pour les annulations attribuées.`;
}

export function writeReponse(Wf, Uf) {
  $("#reponse-prose").replaceChildren(
    p([
      `Le ciel tient sur deux familles : l'A320 et le 737 font `,
      { b: outOfTen(Wf.top2) },
      ` des vols de ligne suivis en ${Wf.last}, et leurs versions récentes gagnent du terrain.`,
    ]),
    p([
      `Chaque modèle a son métier : les petits enchaînent les vols courts, jusqu'à ${fmtNum(Wf.byUse[0].flightsPerDay, 1)} par jour, les gros-porteurs traversent les océans.`,
    ]),
    p([
      "Et pour arriver à l'heure, mieux vaut choisir sa compagnie que son avion : aux États-Unis, l'écart entre compagnies atteint ",
      { b: pt(Uf.across * 100) },
      ", et les modèles s'expliquent largement par les compagnies qui les font voler.",
    ]),
  );
}

export function writeSources(W, U, Wf, Uf) {
  const li = (parts) => el("li", {}, parts);
  const y = (yr) => W.years.find((x) => x.year === yr);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(ASOURCES.opensky, ASOURCES.opensky.label),
        `, version ${W.record.version} : ${Wf.years.map((yr) => `${n0(y(yr).rows)} vols en ${yr}`).join(", ")}, dont ${Wf.years.map((yr) => `${n0(y(yr).airliner)}`).join(" et ")} d'avions de ligne. Données publiées par The OpenSky Network, https://opensky-network.org, pour un usage non commercial : seuls des agrégats par modèle sont publiés ici, sans aucun identifiant d'avion.`,
      ]),
      li([
        link(ASOURCES.aircraft, ASOURCES.aircraft.label),
        " : le type de chaque avion par son transpondeur ou son immatriculation, quand la liste de vols ne le donne pas.",
      ]),
      li([
        link(ASOURCES.bts, ASOURCES.bts.label),
        ` : ${n0(U.flightsAll)} vols intérieurs de ${U.year}, données publiques du gouvernement américain. ${pc(U.modelledShare)} se relient à un modèle par leur immatriculation ; les autres sont des avions immatriculés après avril 2024 ou absents de la base d'OpenSky.`,
      ]),
      li([
        link(ASOURCES.ourairports, ASOURCES.ourairports.label),
        " : la position et le pays des aéroports.",
      ]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      li([
        "Avions de ligne : une liste fermée de modèles, de l'ATR 42 à l'A380 ; un modèle n'entre dans les comparaisons qu'avec au moins 2 000 vols suivis de bout en bout dans l'année.",
      ]),
      li([
        "Distance : à vol d'oiseau entre l'aéroport de départ et celui d'arrivée, quand le réseau les a vus tous les deux. Les traces de moins de 20 minutes ou de plus de 20 heures, ou plus rapides que 1 000 km/h en moyenne, sont écartées.",
      ]),
      li([
        "Vols par jour : pour chaque avion suivi au moins dix jours, ses vols divisés par ses jours de vol ; la valeur du modèle est celle de l'avion médian.",
      ]),
      li([
        "À l'heure : arrivé moins de quinze minutes après l'heure prévue, définition du ministère américain des Transports. Ponctualité attendue d'un modèle : la moyenne, sur ses vols, de la ponctualité de leur compagnie (standardisation directe).",
      ]),
      li([
        `Annulations : sur les vols des compagnies qui attribuent au moins 90 % de leurs annulations à un avion (${U.cancelAirlines.map((a) => U.airlines[a].name).join(", ")}).`,
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Les causes. Un modèle hérite des lignes, des aéroports, des horaires et de la compagnie qui le fait voler ; les données comptent des vols, des retards et des annulations, pas leurs raisons.",
      ]),
      li([
        "Le monde entier. OpenSky voit mal l'Afrique, la Chine et les océans, et ses listes publiques s'arrêtent fin 2022 ; les retards ne sont publics, vol par vol, qu'aux États-Unis.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=avions", text: "la page des données" }),
      ".",
    ]),
  );
}

export { groupLabel };
