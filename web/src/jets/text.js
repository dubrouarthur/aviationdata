// The words of « Le ciel des jets privés ». Every number comes from jetFacts() (facts.js) and is recomputed
// by web/scripts/check_jets.py. House rules (CLAUDE.md): a chapter title and a figure title state
// findings, a « Lecture » line says how to read a figure, at most two numbers in a sentence, no cause
// asserted: the data count flights, days and kilometres, not who flies or why.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { essentialSteps } from "../site/story.js";
import { JPSOURCES, FACTS } from "./sources.js";
import { DAYS_FR, MONTHS_FR, monthLabel } from "./facts.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(v, 0);
const pc = (v, d = 0) => `${fmtNum(v * 100, d)} %`;
/** a change against a base, signed: +98 %, −12 % */
const chg = (ratio) => `${ratio >= 1 ? "+" : "−"}${fmtNum(Math.abs(ratio - 1) * 100, 0)} %`;
const km = (v) => `${n0(Math.round(v / 10) * 10)} km`;
const idx = (v) => n0(v);
const WORDS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
/** "près de quatre vols sur dix", for a share: « près de » under the round tenth, « plus de » above */
const onTen = (v, noun = "vols") => {
  const n = Math.round(v * 10);
  const q = v < n / 10 - 0.005 ? "près de " : v > n / 10 + 0.005 ? "plus de " : "";
  return `${q}${WORDS[n]} ${noun} sur dix`;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** "près de deux fois", "trois fois", "1,6 fois", for a ratio */
const times = (r) => {
  const n = Math.round(r);
  if (n >= 2 && n <= 10 && Math.abs(r - n) < 0.15) {
    const q = r < n - 0.03 ? "près de " : r > n + 0.03 ? "plus de " : "";
    return `${q}${WORDS[n]} fois`;
  }
  return `${fmtNum(r, 1)} fois`;
};
const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}`);
export const fmt = { n0, pc, chg, km, idx, onTen, times };

/** "Grenoble les reçoit surtout l'hiver, Mykonos l'été", from the clearly seasonal airports; null without both */
const seasonPair = (F) =>
  F.winter.length && F.summer.length ? { winter: F.winter[0].label, summer: F.summer[0].label } : null;

export function writeOpening(F) {
  $("#jp-open-h").textContent = "Sur cent vols suivis au-dessus de l'Europe, combien de jets d'affaires ?";
  $("#jp-open-cap").textContent =
    `Vols des avions que le réseau OpenSky suivait déjà au-dessus de l'Europe en ${F.first} : ${n0(F.fleetJets)} jets d'affaires et ${n0(F.fleetLiners)} avions de ligne. Un point par vol sur cent ; en magenta, les jets d'affaires.`;
  const sp = seasonPair(F);
  $("#open-dek").replaceChildren(
    rich([
      `Parmi les vols que le réseau OpenSky suivait au-dessus de l'Europe avant le Covid, un sur ${n0(F.oneIn0)} était celui d'un jet d'affaires. En ${monthLabel(F.peak.month)}, quand les avions de ligne restaient au sol, `,
      { b: `un sur ${n0(F.peak.oneIn)}` },
      `. ${cap(onTen(F.shortJ))} font moins de 500 km. ${sp ? `À ${sp.winter}, ils viennent surtout l'hiver ; à ${sp.summer}, l'été ; et ils` : "Ils"} volent moins le ${DAYS_FR[F.quietDay]}.`,
    ]),
  );
}

export function writeEssentiel(F) {
  const sp = seasonPair(F);
  essentialSteps([
    {
      id: "part-du-ciel",
      q: "Quelle part du ciel font les jets d'affaires ?",
      n: pc(F.share0, 1),
      lead: `des vols suivis au-dessus de l'Europe en ${F.first}, parmi les avions que le réseau voyait cette année-là.`,
      more: [
        `Un vol sur ${n0(F.oneIn0)}. En ${monthLabel(F.peak.month)}, quand les avions de ligne restaient au sol, `,
        { b: pc(F.peak.share) },
        `, un vol sur ${n0(F.peak.oneIn)}.`,
      ],
    },
    {
      id: "covid",
      q: "Le Covid les a-t-il arrêtés ?",
      n: `${idx(F.april.jets)} %`,
      lead: `des vols des jets d'affaires d'avril ${F.first} : c'est ce qu'il en reste en avril 2020.`,
      more: ["Les avions de ligne, ", { b: `${idx(F.april.liners)} %` }, `. En juillet, les jets d'affaires remontent à ${idx(F.july.jets)} %.`],
    },
    {
      id: "distances",
      q: "Volent-ils loin ?",
      n: pc(F.shortJ),
      lead: "de leurs vols font moins de 500 km.",
      more: [
        `${cap(times(F.shortJ / F.shortL))} la part des avions de ligne, `,
        { b: pc(F.shortL) },
        ". Vols dont le réseau a vu le départ et l'arrivée.",
      ],
    },
    {
      id: "saisons",
      q: "Volent-ils toute l'année au même endroit ?",
      n: `${fmtNum(F.mostSeasonal.weight, 1)} fois`,
      lead: `un mois moyen : les jets d'affaires à ${F.mostSeasonal.label} en ${MONTHS_FR[F.mostSeasonal.peak]}, le mois le plus chargé.`,
      more: [
        sp
          ? `L'hiver, ${list(F.winter.slice(0, 2).map((x) => x.label))} ; l'été, ${list(F.summer.slice(0, 2).map((x) => x.label))}.`
          : "Chaque aéroport a sa saison.",
      ],
    },
    {
      id: "usage",
      q: "Combien de jours volent-ils ?",
      n: `${n0(F.daysJ)} jours`,
      lead: `par an pour le jet d'affaires médian basé en Europe, en ${F.last}.`,
      more: ["Un avion de ligne vole ", { b: `${n0(F.daysL)} jours` }, ". Jours où le réseau l'a vu en vol."],
    },
  ]);
}

export function writeCombien(F) {
  // ------------------------------------------------------------ chapter 1: the share
  $("#h-part-du-ciel").textContent =
    `Un vol sur ${n0(F.oneIn0)} avant le Covid, un sur ${n0(F.peak.oneIn)} au printemps 2020`;
  $("#part-du-ciel-prose").replaceChildren(
    p([
      `Parmi les vols au-dessus de l'Europe des avions que le réseau OpenSky suivait déjà en ${F.first}, les jets d'affaires font `,
      { b: pc(F.share0, 1) },
      " cette année-là. Le reste, ce sont les avions de ligne.",
    ]),
  );
  $("#h-share-fig").textContent = `En ${monthLabel(F.peak.month)}, un vol sur ${n0(F.peak.oneIn)}`;
  $("#share-note").textContent =
    `Part des jets d'affaires dans les vols au-dessus de l'Europe des avions suivis en ${F.first} (${n0(F.fleetJets)} jets d'affaires, ${n0(F.fleetLiners)} avions de ligne), chaque mois de ${F.first} et 2020, en %.`;
  lecture(
    "#chart-share",
    `chaque point est un mois. Un vol compte s'il a été vu au-dessus de l'Europe au départ ou à l'arrivée, que le réseau ait reconnu ses aéroports ou non ; un avion entre dans le panel s'il y a fait au moins ${n0(F.fleetMin)} vols en ${F.first}.`,
  );
  $("#part-du-ciel-after").replaceChildren(
    p([
      `Au printemps 2020, la part bondit : en ${monthLabel(F.peak.month)}, elle atteint `,
      { b: pc(F.peak.share, 0) },
      ". Les jets d'affaires volent encore quand les avions de ligne sont presque tous au sol.",
    ]),
    F.ij.slice(F.months.indexOf("2020-03"), F.months.indexOf(F.panelTo) + 1).every((v) => v < 100)
      ? p([
          `Ce n'est pas que les jets d'affaires volent davantage : eux aussi font moins de vols qu'en ${F.first}, jusqu'à la fin de 2020. Ce sont les avions de ligne qui s'arrêtent.`,
        ])
      : p(["C'est surtout que les avions de ligne s'arrêtent."]),
  );
  $("#part-du-ciel-aside").replaceChildren(
    rich([
      `Compter tous les vols suivis aurait faussé la comparaison. Le réseau a gagné des récepteurs d'année en année, et beaucoup de jets d'affaires n'émettaient pas encore leur position en ${F.first} : l'Union européenne l'a imposé aux avions de plus de 5,7 tonnes pour le 7 décembre 2020 (`,
      { a: "règlement 2020/587", href: FACTS.adsb.url },
      `). Ce chapitre et le suivant suivent donc les mêmes avions, ceux que le réseau voyait déjà en ${F.first}. Deux biais restent : un avion vendu à l'étranger change d'adresse et sort du panel, et le réseau voit chaque année un peu mieux les vols courts et bas, ceux des jets d'affaires. Les grands écarts du printemps 2020 y résistent ; les niveaux des années suivantes ne se comparent plus à ${F.first}, et les figures s'arrêtent fin 2020. Ces parts sont celles des vols suivis : les jets d'affaires qui n'émettaient pas encore leur position n'y sont pas.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 2: the Covid
  $("#h-covid").textContent = "Le Covid les a beaucoup moins arrêtés que les avions de ligne";
  $("#covid-prose").replaceChildren(
    p([
      "En avril 2020, les avions de ligne du panel ne font plus que ",
      { b: `${idx(F.april.liners)} %` },
      ` de leurs vols d'avril ${F.first}. Les jets d'affaires en font encore `,
      { b: `${idx(F.april.jets)} %` },
      ".",
    ]),
  );
  $("#h-index-fig").textContent = `En juillet 2020, les jets d'affaires à ${idx(F.july.jets)}, les avions de ligne à ${idx(F.july.liners)}`;
  $("#index-note").textContent =
    `Vols de chaque mois de 2020 au-dessus de l'Europe, en indice : 100 = le même mois de ${F.first}. Seulement les avions déjà suivis en ${F.first}.`;
  lecture(
    "#chart-index",
    `à 100, autant de vols que le même mois de ${F.first} ; à 50, moitié moins. Le trait horizontal marque 100.`,
  );
  $("#covid-after").replaceChildren(
    p([
      "Les jets d'affaires remontent vite : à l'indice ",
      { b: idx(F.july.jets) },
      " en juillet 2020, quand les avions de ligne restent à ",
      { b: idx(F.july.liners) },
      ".",
    ]),
    p([
      "Une partie de l'écart vient du réseau, qui voit chaque année un peu mieux les jets d'affaires. En février, avant le Covid, ceux du panel étaient déjà à l'indice ",
      { b: idx(F.feb.jets) },
      ", contre ",
      { b: idx(F.feb.liners) },
      ` pour les avions de ligne. Mais en avril, leur indice est ${times(F.april.jets / F.april.liners)} celui des avions de ligne, contre ${fmtNum(F.feb.jets / F.feb.liners, 1)} fois en février.`,
    ]),
  );
}

export function writeOu(F) {
  // ------------------------------------------------------------ chapter 3: distances
  $("#h-distances").textContent = `${cap(onTen(F.shortJ))} font moins de 500 km`;
  $("#distances-prose").replaceChildren(
    p([
      "Quand le réseau a vu le départ et l'arrivée, la distance entre les deux aéroports se mesure. Le vol médian d'un jet d'affaires fait ",
      { b: km(F.medianKmJ) },
      " ; celui d'un avion de ligne, ",
      { b: km(F.medianKmL) },
      ".",
    ]),
  );
  $("#h-km-fig").textContent = `${cap(times(F.shortJ / F.shortL))} plus de vols courts qu'en avion de ligne`;
  $("#km-note").textContent =
    `Part des vols par distance à vol d'oiseau entre les deux aéroports, ${F.last}, vols placés en Europe, en %.`;
  lecture(
    "#chart-km",
    "chaque ligne est une tranche de distance ; la barre du haut compte les jets d'affaires, celle du bas les avions de ligne.",
  );
  $("#distances-after").replaceChildren(
    p([
      "Moins de 500 km, c'est ",
      { b: pc(F.shortJ) },
      " des vols de jets d'affaires, contre ",
      { b: pc(F.shortL) },
      " des vols de ligne.",
    ]),
    p([
      "Pour les vols de jets d'affaires qui partent de France ou y arrivent, la part est de ",
      { b: pc(F.shortFr) },
      ".",
    ]),
  );

  // ------------------------------------------------------------ chapter 4: routes
  const r0 = F.routes[0];
  $("#h-routes").textContent = `${r0.label}, la première route du jet en France`;
  $("#routes-prose").replaceChildren(
    p([
      `Dix routes reviennent le plus souvent parmi les vols de jets d'affaires qui touchent la France en ${F.last}. `,
      { b: `${n0(F.shortRoutes)} sur dix` },
      " font moins de 500 km.",
    ]),
  );
  $("#h-routes-fig").textContent =
    `${n0(r0.flights)} vols en ${F.last} entre ${r0.label.replace(" – ", " et ")}`;
  $("#routes-note").textContent =
    `Vols de jets d'affaires entre deux aéroports, les deux sens réunis, ${F.last}, routes qui partent de France ou y arrivent ; distance à vol d'oiseau.`;
  lecture(
    "#chart-routes",
    "une barre par route, la plus fréquentée en haut ; en magenta, les routes de moins de 500 km.",
  );
  $("#routes-after").replaceChildren(
    p([
      "Paris-Le Bourget est au bout de ",
      { b: `${n0(F.parisRoutes)} routes` },
      ` sur dix. Londres en compte ${n0(F.londonRoutes)}, par ${F.londonAirports.length > 1 ? "ses aéroports d'affaires" : "son aéroport d'affaires"} : ${list(F.londonAirports)}.`,
    ]),
    p([
      "Le réseau ne dit pas qui est à bord. Un même avion peut porter un dirigeant à l'aller et voler à vide au retour, pour rejoindre son prochain client.",
    ]),
  );

  // ------------------------------------------------------------ chapter 5: seasons
  const m = F.mostSeasonal;
  const sp = seasonPair(F);
  $("#h-saisons").textContent = sp ? `${sp.winter} l'hiver, ${sp.summer} l'été` : "Chaque aéroport a sa saison";
  $("#saisons-prose").replaceChildren(
    p(["Certains aéroports reçoivent des jets d'affaires toute l'année, d'autres surtout à une saison."]),
  );
  $("#h-season-fig").textContent = `À ${m.label}, ${MONTHS_FR[m.peak]} pèse ${fmtNum(m.weight, 1)} fois un mois moyen`;
  $("#season-note").textContent =
    `Décollages et atterrissages de jets d'affaires de chaque mois, rapportés au mois moyen de l'année (100), moyenne de ${F.first} et ${F.last} ; aéroports rangés par mois le plus chargé.`;
  lecture(
    "#chart-season",
    "chaque ligne est un aéroport, chaque case un mois : plus elle est foncée, plus le mois est chargé ; le mois le plus chargé est encadré. 200 veut dire deux fois un mois moyen.",
  );
  const names = (xs) => list(xs.map((s) => s.label));
  const strongWords = `au moins ${fmtNum(F.seasonStrong, 1)} fois un mois moyen`;
  $("#saisons-after").replaceChildren(
    F.winter.length
      ? p([`L'hiver, ${names(F.winter)} ont leur mois le plus chargé, ${strongWords}.`])
      : p(["Aucun aéroport de la figure n'a de mois d'hiver nettement plus chargé que les autres."]),
    F.summer.length
      ? p([`L'été, c'est le tour de ${names(F.summer)}.`])
      : p(["Aucun aéroport de la figure n'a de mois d'été nettement plus chargé que les autres."]),
    F.steady.length >= 2
      ? p([
          `À ${F.steady[0].label} et à ${F.steady[1].label}, le mois le plus chargé ne dépasse pas `,
          { b: `${fmtNum(Math.ceil(Math.max(...F.steady.slice(0, 2).map((x) => x.weight)) * 10) / 10, 1)} fois` },
          " un mois moyen.",
        ])
      : null,
  );
  $("#saisons-aside").textContent =
    `Ces profils comparent les mois d'un même aéroport : ils ne dépendent pas du nombre de vols que le réseau y voit, tant qu'il les voit aussi bien toute l'année. Pour écarter un aéroport mieux suivi à partir d'un certain mois, l'enquête ne garde que ceux qui ont au moins ${n0(F.seasonMin)} mouvements de jets d'affaires en ${F.first} et en ${F.last}, et le même profil les deux années. ${n0(F.seasonAirports)} aéroports d'Europe passent ces deux tests ; la figure en montre ${n0(F.seasonShown)}, les plus fréquentés puis les plus saisonniers des autres.${F.niceInSeasons ? "" : ` Nice, presque invisible en ${F.first}, n'y est pas.`}`;
}

export function writeQui(F) {
  // ------------------------------------------------------------ chapter 6: the week
  const quiet = DAYS_FR[F.quietDay];
  $("#h-semaine").textContent = `Le ${quiet}, le jour creux du jet d'affaires`;
  $("#semaine-prose").replaceChildren(
    p([`Les avions de ligne volent presque autant chaque jour de la semaine. Les jets d'affaires, moins le ${quiet}.`]),
  );
  $("#h-week-fig").textContent = `Le ${quiet}, ${pc(1 - F.weekJ[F.quietDay])} de vols de moins qu'un jour moyen`;
  $("#week-note").textContent =
    `Vols de chaque jour de la semaine rapportés au jour moyen (100), ${F.last}, vols partis d'Europe ou arrivés en Europe.`;
  lecture(
    "#chart-week",
    "chaque ligne est un jour ; la barre du haut compte les jets d'affaires, celle du bas les avions de ligne. 100 = un jour moyen.",
  );
  $("#semaine-after").replaceChildren(
    p([
      `Le ${DAYS_FR[F.busyDay]} est le jour le plus chargé des jets d'affaires, à l'indice `,
      { b: idx(F.weekJ[F.busyDay] * 100) },
      ` ; le ${DAYS_FR[F.quietDay]}, le plus calme, à `,
      { b: idx(F.weekJ[F.quietDay] * 100) },
      ".",
    ]),
    p([
      "Les avions de ligne restent entre ",
      { b: idx(Math.min(...F.weekL) * 100) },
      " et ",
      { b: idx(Math.max(...F.weekL) * 100) },
      ".",
    ]),
  );

  // ------------------------------------------------------------ chapter 7: operators
  $("#h-exploitants").textContent = `${cap(onTen(F.callsign.operator))} sous le code d'une société`;
  $("#exploitants-prose").replaceChildren(
    p([
      "Un vol parle au contrôle aérien sous un indicatif : l'immatriculation de l'avion, ou le code à trois lettres que l'OACI attribue à la société qui l'exploite.",
    ]),
  );
  $("#h-cs-fig").textContent =
    F.callsignL.registration > F.callsignM.registration + 0.05
      ? "Les petits jets volent plus souvent sous leur propre nom"
      : `${pc(F.callsign.operator)} des vols sous le code d'un exploitant en ${F.last}`;
  $("#cs-note").textContent =
    `Indicatif des vols de jets d'affaires partis d'Europe ou arrivés en Europe, ${F.last}, selon la taille de l'avion, en %.`;
  lecture(
    "#chart-cs",
    "une barre par taille d'avion ; chaque couleur est un type d'indicatif. « Immatriculation » : l'avion vole sous son propre nom. Jets légers : moins de 7 tonnes au décollage.",
  );
  const light = F.topModels.filter((t) => t.wtc === "L").map((t) => `${t.maker} ${t.name}`);
  $("#exploitants-after").replaceChildren(
    p([
      "Sous leur immatriculation, les jets légers font ",
      { b: pc(F.callsignL.registration) },
      " de leurs vols ; les jets moyens et lourds, ",
      { b: pc(F.callsignM.registration) },
      ".",
    ]),
    p([
      `Le modèle le plus fréquent est le ${F.topModels[0].maker} ${F.topModels[0].name}. Les jets légers font `,
      { b: pc(F.light) },
      ` des vols${light.length ? ` ; parmi eux, ${list(light.slice(0, 3))}` : ""}.`,
    ]),
  );
  $("#exploitants-aside").textContent =
    "Un jet d'affaires peut appartenir à une personne, à une entreprise ou à un État, voler en taxi aérien ou en multipropriété. Les données ne disent ni qui est à bord ni qui paie : l'indicatif dit seulement sous quel nom le vol est déclaré. Les jets légers sont ceux de la catégorie de turbulence de sillage « L » de l'OACI.";

  // ------------------------------------------------------------ chapter 8: days in the air
  $("#h-usage").textContent = `Un jet d'affaires vole un jour sur ${n0(365 / F.daysJ)}`;
  $("#usage-prose").replaceChildren(
    p([
      "Un avion de ligne vole presque tous les jours, plusieurs fois par jour. Un jet d'affaires, la plupart des jours, n'est pas vu en vol.",
    ]),
  );
  $("#h-days-fig").textContent =
    `${n0(F.daysJ)} jours de vol par an, contre ${n0(F.daysL)} pour un avion de ligne`;
  $("#days-note").textContent =
    `Jours où l'avion médian a été vu en vol, ${F.last} ; avions basés en Europe (la moitié au moins de leurs vols placés y partent ou y arrivent), vus au moins dix jours. Un carré par jour de l'année.`;
  lecture(
    "#chart-days",
    "chaque carré est un jour de l'année ; les carrés pleins comptent les jours où l'avion médian a volé, rangés à la suite, sans leur date.",
  );
  $("#usage-after").replaceChildren(
    p([
      "Les jours où il vole, il fait ",
      { b: `${fmtNum(F.perDayJ, 1)} ${F.perDayJ < 2 ? "vol" : "vols"}` },
      ", contre ",
      { b: fmtNum(F.perDayL, 1) },
      " pour un avion de ligne.",
    ]),
    p([
      "La moitié des jets d'affaires basés en Europe volent entre ",
      { b: `${n0(F.daysQJ[0])} et ${n0(F.daysQJ[1])} jours` },
      ` par an. Ce sont des jours vus par le réseau : un vol au-dessus d'une zone sans récepteur n'y compte pas.`,
    ]),
  );
}

export function writeReponse(F) {
  const sp = seasonPair(F);
  $("#reponse-prose").replaceChildren(
    p([
      "Parmi les vols que le réseau suivait au-dessus de l'Europe, les jets d'affaires en font ",
      { b: pc(F.share0, 1) },
      ` en ${F.first}. En ${monthLabel(F.peak.month)}, quand les avions de ligne étaient au sol, un vol sur ${n0(F.peak.oneIn)}. Leur part est alors ${times(F.peak.times)} celle de ${MONTHS_FR[+F.peak.month.slice(5) - 1]} ${F.first}.`,
    ]),
    p([
      "Ils volent court : ",
      { b: pc(F.shortJ) },
      ` de leurs vols font moins de 500 km. Ils ont leurs saisons${sp ? `, l'hiver à ${sp.winter}, l'été à ${sp.summer}` : ""}, et volent moins le ${DAYS_FR[F.quietDay]}.`,
    ]),
    p([
      "Et ils volent peu : le jet médian n'est pas vu en vol ",
      { b: `${n0(365 - F.daysJ)} jours` },
      ` par an. ${cap(onTen(F.callsign.operator))} se font sous le code d'un exploitant, plutôt que sous l'immatriculation de l'avion.`,
    ]),
  );
}

export function writeSources(J, F) {
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(JPSOURCES.opensky, JPSOURCES.opensky.label),
        ` : ${J.years.map((y) => `${n0(J.flightsSeen[y])} vols en ${y}`).join(", ")}. Données publiées par The OpenSky Network, https://opensky-network.org, pour un usage non commercial : seuls des totaux sont publiés ici, sans aucun identifiant d'avion, ni indicatif, ni immatriculation.`,
      ]),
      li([
        link(JPSOURCES.aircraft, JPSOURCES.aircraft.label),
        " : le type de l'avion d'un vol quand la liste ne le donne pas, et son immatriculation, comparée en mémoire à l'indicatif du vol.",
      ]),
      li([
        link(JPSOURCES.icao, JPSOURCES.icao.label),
        " : les types d'avions et leur catégorie de turbulence de sillage (L : moins de 7 t au décollage).",
      ]),
      li([
        link(JPSOURCES.ourairports, JPSOURCES.ourairports.label),
        " : la position et le pays des aéroports.",
      ]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      li([
        `Jets d'affaires : une liste fermée de ${n0(Object.keys(J.types).length)} types d'avions, des Citation de Cessna aux Global de Bombardier et aux Falcon de Dassault. Les avions de ligne aménagés en jets privés (Boeing Business Jet, Airbus ACJ) ont le type de l'avion de ligne et n'y sont pas ; les turbopropulseurs non plus.`,
      ]),
      li(["Avions de ligne : la liste fermée de l'enquête sur les modèles d'avions, de l'ATR 42 à l'A380."]),
      li([
        `Europe : l'Union européenne, le Royaume-Uni, la Suisse, la Norvège, l'Islande et les micro-États. Un vol y compte si son aéroport de départ ou d'arrivée y est. France : les aéroports de métropole et de Corse.`,
      ]),
      li([
        `Panel d'avions : les ${n0(F.fleetJets)} jets d'affaires et ${n0(F.fleetLiners)} avions de ligne que le réseau a vus faire au moins ${n0(F.fleetMin)} vols au-dessus de l'Europe en ${F.first}. Parts et indices des deux premiers chapitres comptent leurs vols vus au-dessus de l'Europe (premier ou dernier point dans un cadre de 34° à 72° N et de 25° O à 45° E), que le réseau ait reconnu leurs aéroports ou non, de ${F.first} à la fin de 2020.`,
      ]),
      li([
        `Vols placés : ceux dont le réseau a vu l'aéroport de départ et celui d'arrivée, ${pc(F.coverage.both)} des vols de jets d'affaires suivis au-dessus de l'Europe en ${F.last}. Les distances et les routes sont comptées sur eux ; les jours de la semaine et les indicatifs, sur tous les vols dont le réseau a vu l'aéroport de départ ou d'arrivée en Europe. Les traces de moins de 10 minutes ou de plus de 20 heures, de moins de 30 km ou plus rapides que 1 000 km/h en moyenne sont écartées.`,
      ]),
      li([
        "Jours de vol : pour chaque avion basé en Europe et vu au moins dix jours, les jours distincts où le réseau l'a vu voler, partout ; la valeur donnée est celle de l'avion médian.",
      ]),
      li([
        "Indicatif : celui d'un vol est comparé à l'immatriculation de son avion. Égal à elle : « immatriculation » ; trois lettres suivies d'un chiffre : « code d'un exploitant » ; le reste : « autre ».",
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Qui est à bord, et pourquoi. Les données comptent des vols, des kilomètres et des jours, pas des passagers. Un vol peut être vide, quand l'avion rejoint son prochain client.",
      ]),
      li([
        "Le carburant et le CO2. Ils ne sont pas publiés vol par vol, et dépendent de l'avion, de sa charge et de sa route : l'enquête ne les estime pas.",
      ]),
      li([
        "Les années récentes. Les listes de vols publiques d'OpenSky s'arrêtent fin 2022. Le réseau voit mal certaines régions, la mer et les petits aérodromes de montagne.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=jets", text: "la page des données" }),
      ".",
    ]),
  );
}
