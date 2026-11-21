// The words of « Quand les avions heurtent-ils des oiseaux ? ». Every number comes from birdFacts() (facts.js) and is
// recomputed by web/scripts/check_birds.py. House rules (CLAUDE.md): titles state findings, « Lecture » lines say how
// to read a figure, at most two numbers in a sentence. The FAA counts reported strikes: a count is « déclaré », and
// the text never reads a rise of reports as a rise of risk.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { essentialSteps } from "../site/story.js";
import { WSOURCES, FACTS } from "./sources.js";
import { MONTHS_FR, FT } from "./facts.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(v, 0);
const pc = (v, d = 0) => `${fmtNum(v * 100, d)} %`;
/** to the hundred: 16 945 -> « 16 900 » */
const h100 = (v) => n0(Math.round(v / 100) * 100);
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
/** "près de cinq fois", "2,4 fois" */
const times = (r) => {
  const n = Math.round(r);
  if (n >= 2 && n <= 12 && Math.abs(r - n) < 0.15)
    return `${r < n - 0.03 ? "près de " : r > n + 0.03 ? "plus de " : ""}${WORDS[n]} fois`;
  return `${fmtNum(r, 1)} fois`;
};
/** « un sur 4 » */
const oneIn = (share) => `un sur ${n0(Math.round(1 / share))}`;
/** « 7 sur 10 » */
const tenths = (share) => `${n0(Math.round(share * 10))} sur 10`;
const metres = (ft) => {
  const m = ft * FT;
  return `${n0(m < 1000 ? Math.round(m / 10) * 10 : Math.round(m / 100) * 100)} mètres`;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** a species with its article: « la tourterelle triste », « l'urubu à tête rouge » */
const ART = { "Turkey vulture": "l'", "White-tailed deer": "le ", "Mourning dove": "la ", "Barn swallow": "l'", "Canada goose": "la " };
const the = (sp) => `${ART[sp.key] ?? ""}${sp.name[0].toLowerCase()}${sp.name.slice(1)}`;
/** « une fois sur 64 » */
const onceIn = (share) => `une fois sur ${n0(Math.round(1 / share))}`;
/** « en août » */
const inMonth = (k) => `en ${MONTHS_FR[k]}`;
export const fmt = { n0, pc, h100, times, oneIn, onceIn, tenths, metres };

export function writeOpening(F) {
  $("#bd-open-cap").textContent =
    `Chaque anneau est un mois, de janvier au centre à décembre au bord ; chaque secteur, une heure, minuit en haut. Plus la case est claire, plus d'impacts d'animaux ont été déclarés à la FAA à cette heure de ce mois, de ${F.p0} à ${F.p1} (heure locale de la déclaration).`;
  $("#open-dek").replaceChildren(
    rich([
      `Aux États-Unis, la FAA a reçu en moyenne `,
      { b: `${h100(F.perYear)} déclarations` },
      ` d'impacts d'oiseaux ou d'autres animaux par an, de ${F.p0} à ${F.p1}, ${n0(F.perDay)} par jour. Presque tous ont lieu près du sol, au décollage ou à l'atterrissage, et l'été plus que l'hiver. Un sur ${n0(Math.round(1 / F.damageShare))} a abîmé l'avion.`,
    ]),
  );
}

export function writeEssentiel(F) {
  essentialSteps([
    {
      id: "horloge",
      q: "À quelle heure ?",
      n: pc(F.nightLight),
      lead: "des impacts ont lieu de nuit, selon les déclarations.",
      more: [
        `La nuit, deux pics : ${inMonth(F.spring)} et ${inMonth(F.autumn)}, quand ${pc(F.nightShare[F.spring])} et ${pc(F.nightShare[F.autumn])} des impacts tombent entre 21 h et 5 h.`,
      ],
    },
    {
      id: "saisons",
      q: "À quelle saison ?",
      n: times(F.topOverLow),
      lead: `plus d'impacts déclarés ${inMonth(F.top)} qu'${inMonth(F.low)}.`,
      more: [`De juillet à octobre, `, { b: pc(F.jasO) }, " des impacts de l'année."],
    },
    {
      id: "hauteur",
      q: "À quelle hauteur ?",
      n: pc(F.low500),
      lead: "des impacts dont la hauteur est connue ont lieu à moins de 150 mètres du sol.",
      more: [
        `Mais plus haut, ils abîment plus souvent l'avion : ${pc(F.high.rate)} au-dessus de 3 000 mètres, contre ${pc(F.groundRate)} au sol.`,
      ],
    },
    {
      id: "especes",
      q: "Quels animaux abîment les avions ?",
      n: pc(F.sizes.grand.rate),
      lead: "des impacts de gros oiseau ou de gros animal abîment l'avion.",
      more: [`Pour un petit oiseau, ${pc(F.sizes.petit.rate, 1)}.`],
    },
    {
      id: "declarations",
      q: "Les impacts sont-ils de plus en plus fréquents ?",
      n: times(F.reportsRatio),
      lead: `plus de déclarations en ${F.last} qu'en ${F.first}.`,
      more: [
        `Mais les impacts avec dégâts n'ont été multipliés que par ${fmtNum(F.dmgRatio, 1)} : c'est d'abord la déclaration qui progresse.`,
      ],
    },
  ]);
}

export function writeQuand(F) {
  // ------------------------------------------------------------ chapter 1: the clock
  $("#h-horloge").textContent = "La nuit, deux saisons de pointe";
  $("#horloge-prose").replaceChildren(
    p([
      `Le jour, les impacts suivent les avions : nombreux le matin, l'été. La nuit, ils dessinent un autre calendrier. D'après les déclarations, `,
      { b: pc(F.nightLight) },
      ` des impacts ont lieu de nuit.`,
    ]),
  );
  $("#h-hours-fig").textContent = `La nuit s'anime ${inMonth(F.spring)} et ${inMonth(F.autumn)}`;
  $("#hours-note").textContent =
    `Impacts d'animaux déclarés à la FAA selon l'heure locale et le mois, ${F.p0}-${F.p1}, déclarations où l'heure est connue (${pc(F.timed)}).`;
  lecture(
    "#chart-hours",
    "chaque colonne est un mois, chaque ligne une heure, de 5 h en haut à 4 h du matin en bas ; plus la case fonce, plus d'impacts ont été déclarés. Le cadre marque la nuit, de 21 h à 5 h.",
  );
  $("#horloge-after").replaceChildren(
    p([
      `${cap(inMonth(F.spring))}, `,
      { b: pc(F.nightShare[F.spring]) },
      ` des impacts horodatés tombent entre 21 h et 5 h ; en juillet, ${pc(F.summerNight)}. ${cap(inMonth(F.autumn))}, ${pc(F.nightShare[F.autumn])}.`,
    ]),
    p([
      `L'heure la plus chargée de la nuit est ${n0(F.peak.h)} h ${inMonth(F.peak.k)}. Ce sont les mois et les heures des migrations : ${FACTS.migration.short}.`,
    ]),
  );
  $("#horloge-aside").replaceChildren(
    rich([
      `L'heure est celle de la déclaration, en heure locale, connue pour ${pc(F.timed)} des impacts. Le nombre de vols change aussi avec l'heure et le mois : la FAA ne dit pas combien d'avions volaient à chaque heure, et l'enquête compare des parts, pas des risques.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 2: the seasons
  $("#h-saisons").textContent = `${cap(inMonth(F.top))}, ${times(F.topOverLow)} plus qu'${inMonth(F.low)}`;
  $("#saisons-prose").replaceChildren(
    p([
      `De juillet à octobre, la FAA reçoit `,
      { b: pc(F.jasO) },
      ` des déclarations de l'année, quand les avions croisent les oiseaux de l'été puis ceux qui repartent vers le sud.`,
    ]),
  );
  $("#h-species-fig").textContent = "Chaque espèce a sa saison";
  $("#species-note").textContent =
    `Impacts déclarés chaque mois, ${F.p0}-${F.p1}, pour les espèces les plus déclarées et les plus dangereuses ; chaque vignette a sa propre échelle.`;
  lecture(
    "#chart-species",
    "chaque vignette est une espèce, de janvier à décembre ; le point marque son mois le plus chargé. En magenta, les grandes espèces.",
  );
  const named = ["Mourning dove", "Barn swallow", "Canada goose"].map((k) =>
    F.species.find((s) => s.key === k),
  );
  const peakOf = (s) => s.months.indexOf(Math.max(...s.months));
  $("#saisons-after").replaceChildren(
    p([
      `${cap(the(named[0]))}, l'espèce la plus déclarée, culmine ${inMonth(peakOf(named[0]))}. ${cap(the(named[1]))}, oiseau d'été, disparaît presque des déclarations de novembre à mars.`,
    ]),
    p([
      `${cap(the(named[2]))}, l'oiseau du vol de l'Hudson, est déclarée toute l'année, avec un pic ${inMonth(peakOf(named[2]))}.`,
    ]),
  );
}

export function writeOu(F) {
  // ------------------------------------------------------------ chapter 3: the height
  $("#h-hauteur").textContent = "Près du sol, et plus grave en hauteur";
  $("#hauteur-prose").replaceChildren(
    p([
      `Les oiseaux volent bas. Parmi les impacts dont la hauteur est connue, `,
      { b: pc(F.ground.share) },
      ` ont lieu au sol, et ${pc(F.low500)} à moins de 500 pieds, 150 mètres.`,
    ]),
  );
  $("#h-height-fig").textContent = "Moins d'impacts en altitude, mais plus de dégâts";
  $("#height-note").textContent =
    `Impacts déclarés selon la hauteur au-dessus du sol, en pieds (un pied = 30,5 cm), ${F.p0}-${F.p1}, et part de ceux qui ont abîmé l'avion.`;
  lecture(
    "#chart-height",
    "chaque ligne est une tranche de hauteur, du sol en bas au ciel en haut ; chaque point compte 400 impacts, en magenta ceux qui ont abîmé l'avion. À droite, la part avec dégâts.",
  );
  $("#hauteur-after").replaceChildren(
    p([
      `Au sol, `,
      { b: pc(F.groundRate) },
      ` des impacts abîment l'avion. Au-dessus de 10 000 pieds, 3 000 mètres, ${pc(F.high.rate)} : ${times(F.highOverGround)} plus.`,
    ]),
    p([
      `Plus haut, l'avion vole plus vite : ${FACTS.speed.short}. Le vol de l'Hudson a heurté ses bernaches à ${n0(F.hudson.height)} pieds, environ ${metres(F.hudson.height)}, en montée.`,
    ]),
  );
  $("#hauteur-aside").replaceChildren(
    rich([
      `La hauteur n'est indiquée que dans ${pc(F.knownHeight)} des déclarations. « Au sol » veut dire hauteur nulle : l'avion roule sur la piste, au décollage ou à l'atterrissage.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 4: the phases
  const [first] = F.byShare;
  const cruise = F.phases.find((x) => x.key === "croisière");
  $("#h-phases").textContent =
    first.key === "approche" ? "L'approche, près de la moitié des impacts" : `${cap(first.key)} en tête`;
  $("#phases-prose").replaceChildren(
    p([
      `Au décollage, en montée, en approche ou à l'atterrissage : `,
      { b: pc(F.nearGround) },
      ` des impacts dont la phase est connue ont lieu près d'un aéroport.`,
    ]),
  );
  $("#h-phase-fig").textContent = "Le long d'un vol, l'approche en tête";
  $("#phase-note").textContent =
    `Impacts déclarés selon la phase du vol, ${F.p0}-${F.p1}, et part de ceux qui ont abîmé l'avion.`;
  lecture(
    "#chart-phase",
    "le profil d'un vol, de la course au décollage à gauche à l'atterrissage à droite ; la surface du disque bleu compte les impacts, le disque magenta ceux qui ont abîmé l'avion.",
  );
  $("#phases-after").replaceChildren(
    p([
      `L'approche concentre `,
      { b: pc(first.share) },
      ` des impacts : l'avion y passe plusieurs minutes à basse hauteur.`,
    ]),
    p([
      `La croisière et la descente n'en comptent que ${pc(cruise.share)}, mais ${pc(cruise.rate)} y abîment l'avion, plus que dans toute autre phase.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 5: the parts
  const S = F.mostStruck;
  const E = F.engines;
  $("#h-pieces").textContent =
    S.key === F.mostDamaged.key
      ? `Les ${S.key}, les plus touchées et les plus abîmées`
      : `Les ${S.key}, les plus touchées`;
  $("#pieces-prose").replaceChildren(
    p([
      `Un oiseau frappe ce qui avance face à lui : le nez, le pare-brise, les ailes, les moteurs. Les ${S.key} reçoivent le plus d'impacts déclarés, `,
      { b: n0(S.s) },
      ` en onze ans.`,
    ]),
  );
  $("#h-parts-fig").textContent = "Les moteurs, moins touchés, plus souvent abîmés";
  $("#parts-note").textContent =
    `Impacts déclarés sur chaque pièce de l'avion, ${F.p0}-${F.p1}, et part de ceux qui l'ont abîmée. Un impact peut toucher plusieurs pièces.`;
  lecture(
    "#chart-parts",
    "un avion vu de dessus ; la surface de chaque disque compte les impacts sur la pièce, sa couleur dit la part qui l'a abîmée, du bleu (rarement) au magenta (souvent). Les disques sont placés sur la pièce, pas à l'endroit exact du choc.",
  );
  $("#pieces-after").replaceChildren(
    p([
      `Les moteurs ont été touchés ${n0(E.s)} fois ; `,
      { b: `un impact sur ${n0(Math.round(1 / E.rate))}` },
      ` a abîmé un moteur.`,
    ]),
    p([
      `En onze ans, les déclarations mentionnent ${n0(F.effects.landing)} atterrissages de précaution, ${n0(F.effects.aborted)} décollages interrompus et ${n0(F.effects.shutdown)} moteurs coupés.`,
    ]),
  );
}

export function writeGravite(F) {
  // ------------------------------------------------------------ chapter 6: the species
  const U = F.mostDamaging;
  const R = F.highRate;
  $("#h-especes").textContent = "Les petits sont nombreux, les grands font les dégâts";
  $("#especes-prose").replaceChildren(
    p([
      `Les petits oiseaux font `,
      { b: pc(F.sizes.petit.n / F.sized) },
      ` des impacts dont la taille est connue. Mais ${oneIn(F.sizes.petit.rate)} seulement abîme l'avion, contre ${oneIn(F.sizes.grand.rate)} pour un gros animal.`,
    ]),
  );
  $("#h-scatter-fig").textContent = "Peu d'impacts, beaucoup de dégâts : les grandes espèces";
  $("#scatter-note").textContent =
    `Espèces les plus déclarées et les plus dangereuses, ${F.p0}-${F.p1} : impacts déclarés et part de ceux qui ont abîmé l'avion.`;
  lecture(
    "#chart-scatter",
    "plus une espèce est à droite, plus elle est déclarée ; plus elle est haut, plus ses impacts abîment l'avion (l'axe horizontal est logarithmique : chaque graduation multiplie). La surface du disque compte les impacts avec dégâts.",
  );
  $("#especes-after").replaceChildren(
    p([
      `L'espèce qui a fait le plus de dégâts est ${the(U)} : `,
      { b: n0(U.dmg) },
      ` impacts avec dégâts, ${pc(U.rate)} de ses impacts.`,
    ]),
    p([
      `${cap(the(R))}, heurté sur les pistes, abîme l'avion dans ${pc(R.rate)} des cas. ${cap(the(F.mostReported))}, la plus déclarée de toutes, dans ${pc(F.mostReported.rate, 1)}.`,
    ]),
  );
  $("#especes-aside").replaceChildren(
    rich([
      `L'espèce est identifiée dans ${pc(F.identified)} des déclarations, souvent par un laboratoire à partir de plumes ou de restes. Le reste est noté « oiseau inconnu », parfois avec sa taille.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 7: the reports
  $("#h-declarations").textContent =
    `${cap(times(F.reportsRatio))} plus de déclarations, pas ${times(F.reportsRatio)} plus de dégâts`;
  $("#declarations-prose").replaceChildren(
    p([
      `En ${F.first}, la FAA a reçu ${n0(F.reports0)} déclarations ; en ${F.last}, `,
      { b: n0(F.reports1) },
      `. Les impacts avec dégâts sont passés de ${n0(F.dmg0)} à ${n0(F.dmg1)}.`,
    ]),
  );
  $("#h-lines-fig").textContent = "Les déclarations s'envolent, les dégâts beaucoup moins";
  $("#lines-note").textContent =
    `Impacts déclarés et impacts avec dégâts chaque année, en multiple de ${F.first}, ${F.first}-${F.last}.`;
  lecture(
    "#chart-lines",
    `chaque ligne part de 1 en ${F.first} ; à 10, il y a dix fois plus de déclarations qu'en ${F.first}.`,
  );
  $("#declarations-after").replaceChildren(
    p([
      `En ${F.first}, `,
      { b: pc(F.share0) },
      ` des déclarations faisaient état de dégâts ; en ${F.last}, ${pc(F.share1, 1)}. Les petits impacts sans conséquence sont bien plus souvent déclarés qu'avant.`,
    ]),
    p([
      "Le nombre de vols a aussi changé sur la période : sans lui, la base ne dit pas si le risque a monté ou baissé, seulement qu'on déclare beaucoup plus.",
    ]),
  );
  $("#declarations-aside").replaceChildren(
    rich([
      FACTS.voluntary.text,
      " ",
      FACTS.public2009.text,
    ]),
  );
}

export function writeReponse(F) {
  $("#reponse-prose").replaceChildren(
    p([
      `Près du sol, l'été et l'automne, et souvent la nuit en mai et en octobre. `,
      { b: `${n0(Math.round(F.low500 * 10))} impacts déclarés sur 10` },
      ` ont lieu à moins de 150 mètres, et l'approche en concentre ${pc(F.byShare[0].share)}.`,
    ]),
    p([
      `La plupart sont sans conséquence : un petit oiseau abîme l'avion ${onceIn(F.sizes.petit.rate)}. Les grands oiseaux, rares, et les impacts en hauteur font la plus grande part des dégâts.`,
    ]),
    p([
      `Les déclarations ont été multipliées par ${fmtNum(F.reportsRatio, 1)} depuis ${F.first}, les dégâts par ${fmtNum(F.dmgRatio, 1)} : la base dit d'abord qu'on déclare mieux.`,
    ]),
  );
}

export function writeSources(F) {
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(WSOURCES.nwsd, WSOURCES.nwsd.label),
        ` : chaque impact d'animal déclaré par un avion ou un hélicoptère civil depuis ${F.first}, en grande majorité aux États-Unis. Profils (heure, mois, hauteur, phase, pièces, espèces) sur les onze dernières années pleines, ${F.p0}-${F.p1} ; séries de ${F.first} à ${F.last}. L'année en cours est encore incomplète.`,
      ]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      li([
        "Impact avec dégâts : la déclaration classe les dommages de l'avion en mineurs, incertains, importants ou destruction ; sans dommage sinon. Un impact « avec dégâts » est un impact des quatre premières classes.",
      ]),
      li([
        "Nuit : de 21 h à 4 h 59, heure locale de la déclaration. La part de nuit du premier chapitre est celle que déclarent les pilotes (jour, nuit, aube, crépuscule).",
      ]),
      li([
        "Phases : décollage = course au décollage ; montée = montée et départ ; croisière = croisière et descente ; approche = approche et arrivée ; atterrissage = roulage à l'atterrissage. Le roulage au sol, le stationnement et les vols locaux sont écartés.",
      ]),
      li([
        "Taille de l'animal : petit, moyen ou grand, telle que la déclaration l'indique ; la taille d'une espèce est la plus fréquente parmi ses déclarations.",
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Un risque par vol. La base ne compte pas les vols : les parts comparent des déclarations entre elles. Une heure ou un mois plus chargé en impacts peut l'être aussi en avions.",
      ]),
      li(["Tous les impacts. ", FACTS.voluntary.text]),
      li([
        "Les aéroports. Certains déclarent beaucoup mieux que d'autres : la base ne permet pas de les classer, et l'enquête ne le fait pas.",
      ]),
    ]),
    el("h3", { text: "Les faits cités" }),
    el("ul", {}, [
      li([link(FACTS.hudson, "NTSB, AAR-10/03"), ` : ${FACTS.hudson.text}`]),
      li([link(FACTS.public2009, FACTS.public2009.source), ` : ${FACTS.public2009.text}`]),
      li([link(FACTS.migration, FACTS.migration.source), ` : ${FACTS.migration.text}`]),
      li([link(FACTS.speed, FACTS.speed.source), ` : ${FACTS.speed.text}`]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=birds", text: "la page des données" }),
      ".",
    ]),
  );
}
