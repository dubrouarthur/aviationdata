// The words of « Qui retarde les avions en Europe ? ». Every number comes from atfmFacts() (facts.js) and is
// recomputed by web/scripts/check_atfm.py. House rules (CLAUDE.md): titles state findings, « Lecture » lines say
// how to read a figure, at most two numbers in a sentence. The reasons are those the control centres declared
// with each regulation: the text says « motif déclaré », and never explains a delay beyond it.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { essentialSteps } from "../site/story.js";
import { RSOURCES, FACTS } from "./sources.js";
import { DAYS_FR, MONTHS_FR, dayLabel } from "./facts.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(v, 0);
const pc = (v, d = 0) => `${fmtNum(v * 100, d)} %`;
/** minutes -> "1 min 40" (to the ten seconds) */
const mins = (v) => {
  const s = Math.round((v * 60) / 10) * 10;
  if (s < 60) return `${s} secondes`;
  return s % 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}` : `${s / 60} min`;
};
const WORDS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
];
/** "près de deux fois", "2,2 fois" */
const times = (r) => {
  const n = Math.round(r);
  if (n >= 2 && n <= 10 && Math.abs(r - n) < 0.12)
    return `${r < n - 0.03 ? "près de " : r > n + 0.03 ? "plus de " : ""}${WORDS[n]} fois`;
  return `${fmtNum(r, 1)} fois`;
};
/** one flight in N */
const oneIn = (share) => Math.round(1 / share);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const fmt = { n0, pc, mins, times, oneIn };
const G = {
  capacite: "la capacité du contrôle",
  effectifs: "les effectifs du contrôle",
  meteo: "la météo",
  greves: "les grèves",
  autres: "les pannes et événements",
};

export function writeOpening(F) {
  $("#rt-open-cap").textContent =
    `Chaque case est un jour, du 1er janvier ${F.first} au ${dayLabel(F.last)} ; chaque ligne, une année. Plus la case est claire, plus les avions ont attendu au sol ce jour-là un créneau du contrôle aérien en route (minutes de retard ATFM par vol, tous les vols d'Europe). La bande sombre de 2020-2021 est celle du Covid.`;
  $("#open-dek").replaceChildren(
    rich([
      `En ${F.year}, un vol sur ${n0(oneIn(F.delayed))} a attendu au sol que le contrôle aérien lui fasse une place en route, `,
      { b: `${n0(F.perDelayed)} minutes` },
      ` en moyenne. C'est ${times(F.ratio)} plus de retard par vol qu'entre 2014 et 2017. Plus de la moitié se joue en trois mois d'été, et le contrôle français en porte ${pc(F.fr.share)}.`,
    ]),
  );
}

export function writeEssentiel(F) {
  essentialSteps([
    {
      id: "niveau",
      q: "Le contrôle aérien retarde-t-il plus qu'avant ?",
      n: times(F.ratio),
      lead: `plus de retard par vol en ${F.year} qu'entre 2014 et 2017.`,
      more: [
        `${mins(F.perFlight)} par vol, tous vols confondus, contre ${mins(F.basePer)}. Le record : `,
        { b: String(F.peak) },
        ".",
      ],
    },
    {
      id: "calendrier",
      q: "Quand attend-on le plus ?",
      n: pc(F.summerDelay),
      lead: `des minutes de retard de ${F.year} tombent en juin, juillet et août.`,
      more: [`Ces trois mois ne comptent que `, { b: pc(F.summerFlights) }, " des vols."],
    },
    {
      id: "motifs",
      q: "Pour quels motifs ?",
      n: pc(F.share.capacite + F.share.effectifs),
      lead: "des minutes sont déclarées pour capacité ou effectifs du contrôle.",
      more: [
        `La météo, `,
        { b: pc(F.share.meteo) },
        `, contre ${pc(F.share0.meteo)} en ${F.first}. Les grèves, ${pc(F.share.greves)}.`,
      ],
    },
    {
      id: "pays",
      q: "Où ?",
      n: pc(F.fr.share),
      lead: `des minutes de retard d'Europe sont attribuées au contrôle français en ${F.year}.`,
      more: [
        `Avec l'Allemagne et l'Espagne, `,
        { b: pc(F.top3) },
        `. ${F.calm} pays sur ${F.nProv} n'en génèrent presque aucune.`,
      ],
    },
    {
      id: "semaine",
      q: "Quel jour éviter ?",
      n: `le ${DAYS_FR[F.wHi]}`,
      lead: `d'été : ${times(F.weekRatio)} plus de retard par vol que le ${DAYS_FR[F.wLo]}.`,
      more: [
        "De juin à août, ",
        { b: `${fmtNum(F.A.week[F.wHi], 1)} minutes` },
        ` par vol le ${DAYS_FR[F.wHi]}, ${fmtNum(F.A.week[F.wLo], 1)} le ${DAYS_FR[F.wLo]}.`,
      ],
    },
  ]);
}

export function writeCombien(F) {
  // ------------------------------------------------------------ chapter 1: the level
  $("#h-niveau").textContent = `${cap(times(F.ratio))} plus de retard par vol qu'il y a dix ans`;
  $("#niveau-prose").replaceChildren(
    p([
      "Un avion prêt à partir attend parfois à sa porte, moteurs coupés : quelque part sur sa route, un centre de contrôle a trop d'avions à guider en même temps, et le réseau lui a donné un créneau plus tard. Ces minutes sont comptées, jour après jour, depuis des années.",
    ]),
    p([
      `En ${F.year}, elles font `,
      { b: mins(F.perFlight) },
      ` par vol, en comptant tous les vols d'Europe, retardés ou non. Entre 2014 et 2017, ${mins(F.basePer)}.`,
    ]),
  );
  $("#h-year-fig").textContent = `Depuis 2018, le retard ne redescend plus`;
  $("#year-note").textContent =
    `Retard ATFM en route par vol, en minutes, moyenne de chaque année sur tous les vols de la zone EUROCONTROL, ${F.first}-${F.year}.`;
  lecture(
    "#chart-year",
    `chaque point est une année : le total des minutes de retard divisé par le nombre de vols, retardés ou non. À 2, chaque vol d'Europe a attendu deux minutes en moyenne.`,
  );
  $("#niveau-after").replaceChildren(
    p([
      `Une moyenne aussi basse cache l'essentiel : la plupart des vols n'attendent pas. En ${F.year}, ${pc(1 - F.delayed)} des vols n'ont eu aucun retard de ce type. Les autres ont attendu `,
      { b: `${n0(F.perDelayed)} minutes` },
      " en moyenne.",
    ]),
    p([
      `Un vol sur ${n0(oneIn(F.delayed15))} a attendu plus d'un quart d'heure. Mises bout à bout, les minutes de ${F.year} font `,
      { b: `${n0(F.delayYears)} ans` },
      " d'attente.",
    ]),
    F.hasYtd
      ? p([
          `De janvier à ${MONTHS_FR[+F.ytdTo - 1]} ${F.cur}, le retard par vol est de ${mins(F.ytd)}, contre ${mins(F.ytdPrev)} sur les mêmes mois de ${F.year}.`,
        ])
      : null,
  );
  $("#niveau-aside").replaceChildren(
    rich([
      "Ce retard n'est qu'une partie de celui que vit un passager. Il ne compte ni l'avion arrivé en retard du vol précédent, ni l'embarquement qui traîne, ni les régulations demandées par les aéroports eux-mêmes : seulement l'attente imposée par un centre de contrôle en route. En avril 2016, son calcul a été affiné : les toutes premières années ne se comparent pas aux suivantes à la minute près.",
    ]),
  );

  // ------------------------------------------------------------ chapter 2: the calendar
  $("#h-calendrier").textContent = `Plus de la moitié du retard en trois mois d'été`;
  $("#calendrier-prose").replaceChildren(
    p([
      `Juin, juillet et août ne comptent que ${pc(F.summerFlights)} des vols de ${F.year}. Ils concentrent `,
      { b: pc(F.summerDelay) },
      " des minutes de retard.",
    ]),
  );
  $("#h-cal-fig").textContent = "Chaque été, la même bande s'allume";
  $("#cal-note").textContent =
    `Retard ATFM en route par vol, chaque jour du 1er janvier ${F.first} au ${dayLabel(F.last)}, en minutes, tous les vols de la zone EUROCONTROL.`;
  lecture(
    "#chart-cal",
    "chaque ligne est une année, chaque case un jour, de janvier à gauche à décembre à droite. Plus la case va vers le magenta, plus le retard par vol a été fort ce jour-là.",
  );
  $("#calendrier-after").replaceChildren(
    p([
      "L'hiver, le ciel d'Europe a de la place : les cases restent pâles de novembre à mars. Dès le mois de mai, la bande se colore, et ne s'éteint qu'en octobre.",
    ]),
    p([
      `La bande blanche de 2020 et 2021 est celle du Covid : presque plus de vols, donc presque plus d'attente. Dès l'été 2022, elle revient, plus large qu'avant.`,
    ]),
  );
}

export function writePourquoi(F) {
  // ------------------------------------------------------------ chapter 3: the declared reasons
  const ctl = F.share.capacite + F.share.effectifs;
  $("#h-motifs").textContent =
    `${cap(WORDS[Math.round(ctl * 10)])} minutes sur dix pour capacité ou effectifs`;
  $("#motifs-prose").replaceChildren(
    p([
      "À chaque régulation, le centre de contrôle qui la demande en déclare le motif. Deux d'entre eux tiennent à lui : il n'a pas assez de secteurs ouverts pour le trafic, ou pas assez de contrôleurs pour les ouvrir.",
    ]),
    p([
      `En ${F.year}, la capacité représente `,
      { b: pc(F.share.capacite) },
      ` des minutes de retard, les effectifs ${pc(F.share.effectifs)}.`,
    ]),
  );
  $("#h-reasons-fig").textContent = "La météo prend de la place, les grèves vont et viennent";
  $("#reasons-note").textContent =
    `Retard ATFM en route par vol, chaque mois de ${F.first} à ${F.cur}, en minutes, selon le motif déclaré de la régulation.`;
  lecture(
    "#chart-reasons",
    "chaque marche est un mois ; sa hauteur, le retard par vol de ce mois ; ses couleurs, les motifs déclarés.",
  );
  $("#motifs-after").replaceChildren(
    p([
      `La météo, surtout les orages d'été, pèse `,
      { b: pc(F.share.meteo) },
      ` des minutes en ${F.year}. En ${F.first}, ${pc(F.share0.meteo)}.`,
    ]),
    p([
      `Les grèves du contrôle en font ${pc(F.share.greves)} en ${F.year}, contre ${pc(F.share0.greves)} en ${F.first} : elles comptent certaines années, presque pas d'autres.`,
    ]),
  );
  $("#motifs-aside").replaceChildren(
    rich([
      "Le motif est celui que déclare le centre qui demande la régulation, pas le résultat d'une enquête. Un orage peut être déclaré « météo » par un centre et « capacité » par son voisin, qui reçoit les avions déroutés. L'enquête reprend ces motifs tels qu'ils sont déclarés.",
    ]),
  );

  // ------------------------------------------------------------ chapter 4: the worst days
  const w = F.worst;
  $("#h-pires").textContent =
    `${cap(WORDS[F.worstInYear] ?? String(F.worstInYear))} des ${n0(F.nWorst)} pires journées datent de ${F.worstYear}`;
  $("#pires-prose").replaceChildren(
    p([
      `Le ${dayLabel(w.date)}, chaque vol d'Europe a attendu `,
      { b: `${fmtNum(w.perFlight, 0)} minutes` },
      ` en moyenne : c'est la pire journée depuis ${F.first}.`,
    ]),
  );
  $("#h-dots-fig").textContent = "Les pires journées sont d'été, et de météo";
  $("#dots-note").textContent =
    `Retard ATFM en route par vol, chaque jour du 1er janvier ${F.first} au ${dayLabel(F.last)}, en minutes ; couleur : premier motif déclaré ce jour-là.`;
  lecture(
    "#chart-dots",
    "chaque point est un jour ; plus il est haut, plus les vols ont attendu ce jour-là. Sa couleur est celle du motif qui a pesé le plus de minutes.",
  );
  const nMeteo = F.A.worst.filter((x) => x.group === "meteo").length;
  $("#pires-after").replaceChildren(
    p([
      `Ce jour-là, le premier motif déclaré est ${G[w.group]}, pour ${pc(w.groupShare)} des minutes. Sur les ${n0(F.nWorst)} pires journées, `,
      { b: `${WORDS[nMeteo] ?? nMeteo}` },
      " ont la météo pour premier motif.",
    ]),
    p([
      "Un jour ordinaire d'hiver, le retard par vol tient en quelques secondes. Le réseau ne sature pas un peu tous les jours : il sature beaucoup, quelques dizaines de jours par an.",
    ]),
  );
}

export function writeOu(F) {
  const [a, b, c] = F.byDelay;
  // ------------------------------------------------------------ chapter 5: the map
  $("#h-pays").textContent = `Le contrôle français porte ${pc(F.fr.share)} du retard d'Europe`;
  $("#pays-prose").replaceChildren(
    p([
      "Chaque minute de retard est attribuée au centre de contrôle qui a demandé la régulation, et donc à son pays. Le compte n'est pas du tout égal.",
    ]),
    p([
      `En ${F.year}, ${pc(a.share)} des minutes sont attribuées à la France, `,
      { b: pc(b.share) },
      ` à l'Allemagne et ${pc(c.share)} à l'Espagne.`,
    ]),
  );
  $("#h-tiles-fig").textContent = "Un couloir de retard, de l'Espagne à la Grèce";
  $("#tiles-note").textContent =
    `Retard ATFM en route par vol contrôlé, par pays du prestataire de contrôle, ${F.year}, en minutes.`;
  lecture(
    "#chart-tiles",
    "chaque case est un pays, placé à peu près là où il est sur la carte ; le chiffre est le retard qu'il génère par vol qu'il contrôle. MUAC est le centre de Maastricht, qui contrôle le ciel d'altitude du Benelux et du nord de l'Allemagne.",
  );
  $("#pays-after").replaceChildren(
    p([
      `La France contrôle beaucoup de vols : elle est sur la route de presque tout ce qui relie le nord de l'Europe à l'Espagne, au Portugal et au Maroc. Mais rapporté à chaque vol contrôlé, son retard reste le plus fort : `,
      { b: mins(F.fr.perFlight) },
      `, contre ${mins(b.perFlight)} en Allemagne.`,
    ]),
    p([`À l'inverse, ${F.calm} des ${F.nProv} pays génèrent moins de six secondes de retard par vol.`]),
  );
  $("#pays-aside").replaceChildren(
    rich([
      "Un vol Paris-Athènes est contrôlé par plusieurs pays, et chacun le compte : les vols contrôlés des pays ne s'additionnent pas. Le retard, lui, n'est attribué qu'une fois, au centre qui a demandé la régulation. Être le pays le plus cité ne dit pas qui est fautif : un centre peut réguler parce que son voisin est saturé, ou parce qu'un orage ferme une partie de son ciel.",
    ]),
  );

  // ------------------------------------------------------------ chapter 6: trajectories
  $("#h-trajectoires").textContent =
    "Depuis 2018, le retard a changé d'échelle en France, en Allemagne et en Espagne";
  $("#trajectoires-prose").replaceChildren(
    p([
      `En France, le premier motif déclaré en ${F.year} est ${G[F.frTop]} : `,
      { b: pc(F.fr.groups[F.frTop] / F.fr.delay) },
      " des minutes.",
    ]),
  );
  $("#h-multi-fig").textContent = "Douze pays, douze trajectoires";
  $("#multi-note").textContent =
    `Retard ATFM en route par vol contrôlé, en minutes, chaque année de ${F.first} à ${F.year}, pour les douze pays qui génèrent le plus de minutes en ${F.year}. Même échelle pour tous.`;
  lecture(
    "#chart-multi",
    "chaque vignette est un pays ; la courbe, son retard par vol contrôlé, année après année. Toutes les vignettes ont la même échelle : une courbe haute est un pays où l'on attend plus.",
  );
  $("#trajectoires-after").replaceChildren(
    p([
      "Presque partout, la courbe suit le même dessin : un premier palier jusqu'en 2017, une marche en 2018, le creux du Covid, puis un niveau plus haut qu'avant.",
    ]),
    p([
      "Les pays ne sont pas indépendants : quand un centre sature, les compagnies le contournent, et chargent ses voisins.",
    ]),
  );

  // ------------------------------------------------------------ chapter 7: the week
  $("#h-semaine").textContent =
    `L'été, le ${DAYS_FR[F.wHi]} attend ${times(F.weekRatio)} plus que le ${DAYS_FR[F.wLo]}`;
  $("#semaine-prose").replaceChildren(
    p([
      `De juin à août ${F.year}, un vol du ${DAYS_FR[F.wHi]} attend en moyenne `,
      { b: `${fmtNum(F.A.week[F.wHi], 1)} minutes` },
      ` un créneau du contrôle en route. Un vol du ${DAYS_FR[F.wLo]}, ${fmtNum(F.A.week[F.wLo], 1)} minutes.`,
    ]),
  );
  $("#h-week-fig").textContent = "Le week-end des départs en vacances";
  $("#week-note").textContent =
    `Retard ATFM en route par vol selon le jour de la semaine, juin à août ${F.year}, en minutes.`;
  lecture("#chart-week", "chaque disque est un jour de la semaine ; sa surface suit le retard par vol.");
  $("#semaine-after").replaceChildren(
    p([
      "Du jeudi au dimanche, le retard par vol dépasse trois minutes : ce sont les jours où le trafic de loisirs s'ajoute au reste. C'est une moyenne sur tout l'été : un mardi d'orage peut être pire qu'un dimanche calme.",
    ]),
  );
}

export function writeReponse(F) {
  $("#reponse-prose").replaceChildren(
    p([
      `En ${F.year}, le contrôle aérien en route a retardé un vol sur ${n0(oneIn(F.delayed))} en Europe, de ${n0(F.perDelayed)} minutes en moyenne. Par vol, c'est `,
      { b: times(F.ratio) },
      " plus qu'entre 2014 et 2017.",
    ]),
    p([
      `Ce retard se concentre : ${pc(F.summerDelay)} en trois mois d'été, ${pc(F.top3)} dans trois pays. Le contrôle français en porte à lui seul `,
      { b: pc(F.fr.share) },
      ".",
    ]),
    p([
      `Les motifs déclarés sont d'abord la capacité et les effectifs du contrôle, ${pc(F.share.capacite + F.share.effectifs)} des minutes, puis la météo, ${pc(F.share.meteo)}. Ce sont des motifs déclarés, pas des responsabilités établies : l'enquête dit où et quand le ciel d'Europe sature, pas qui en est fautif.`,
    ]),
  );
}

export function writeSources(F) {
  const li = (parts) => el("li", {}, parts);
  const fact = (f) =>
    li([`${f.text} (`, el("a", { href: f.url, target: "_blank", rel: "noopener", text: f.source }), ")."]);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(RSOURCES.atfm, RSOURCES.atfm.label),
        ` : pour chaque jour du 1er janvier ${F.first} au ${dayLabel(F.last)} et chaque prestataire, les vols contrôlés, les minutes de retard ATFM en route qui lui sont attribuées, par motif déclaré, et le nombre de vols retardés. Réutilisation libre, source citée.`,
      ]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      fact(FACTS.definition),
      li([
        "Europe : la zone des États membres d'EUROCONTROL, ligne « EUROCONTROL Area (MS) » des fichiers, où chaque vol est compté une fois. Retard par vol : minutes de retard divisées par tous les vols, retardés ou non.",
      ]),
      li([
        "Pays : celui du prestataire de contrôle auquel le retard est attribué. Les prestataires qui ont changé de nom sont réunis (Belgocontrol et skeyes, HCAA et HASP, IAA et AirNav Ireland...). Le centre de Maastricht (MUAC), qui contrôle l'espace supérieur de la Belgique, des Pays-Bas, du Luxembourg et du nord-ouest de l'Allemagne, est compté à part. Retard par vol contrôlé : minutes attribuées au prestataire divisées par les vols qu'il a contrôlés.",
      ]),
      li([
        "Motifs : capacité du contrôle (codes C, R, M, G d'EUROCONTROL : capacité, routage, gestion de l'espace, capacité d'aérodrome), effectifs du contrôle (S), météo (W, D), grèves (I du contrôle, N hors contrôle), pannes, événements et autres (T, E, P, O, A, V et non précisé).",
      ]),
      li([
        `Été : juin, juillet et août. Pires journées : les ${n0(F.nWorst)} jours au plus grand total de minutes de retard. Semaine : juin à août ${F.year}.`,
      ]),
      fact(FACTS.method2016),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Le retard total d'un vol. Le retard ATFM en route n'en est qu'une part : les retards des compagnies, des aéroports et ceux hérités du vol précédent n'y sont pas.",
      ]),
      li([
        "Qui est fautif. Le retard est attribué au centre qui demande la régulation, avec le motif qu'il déclare ; les données ne disent pas pourquoi sa capacité ou ses effectifs manquaient ce jour-là.",
      ]),
      li([
        "Le retard à l'arrivée du passager. Un avion parti en retard peut en rattraper une partie en vol.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=atfm", text: "la page des données" }),
      ".",
    ]),
  );
}
