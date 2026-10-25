// The words of the human-factor story. Its question: is the human factor the first cause of aviation
// accidents? Every number comes from facts.js (web/public/data/hf/*.json); web/scripts/check_hf.py
// recomputes them. The text says what the data shows, never what a chart looks like.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { BIT, group } from "./facts.js";

export const pct = (v, d = 0) => `${fmtNum(v, d)} %`;
export const num = (v) => fmtNum(v);
const ratio = (a, b) => (100 * a) / b;
const prose = (id, paragraphs) => $(id).replaceChildren(...paragraphs.map((p) => el("p", {}, rich(p))));
/** 0.7 -> "7 pour 10" style: how many per ten fatal accidents */
const perTen = (n, ref) => Math.round((10 * n) / ref);
const times = (a, b) => Math.floor(a / b);
const TIMES = ["", "", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

/* ------------------------------------------------------------------ the opening */
export function writeOpening(F) {
  $("#open-dek").replaceChildren(
    rich([
      "Aux États-Unis, chaque accident aérien, du petit avion de tourisme à l'avion de ligne, se conclut par une cause probable établie par le National Transportation Safety Board (NTSB). ",
      `De ${F.period[0]} à ${F.period[1]}, une personne y est citée dans `,
      { b: num(F.person) },
      " accidents sur ",
      { b: num(F.n) },
      ". Le facteur humain est-il pour autant la première cause des accidents ? Les grands modèles du risque aérien aident à lire ces verdicts, et à voir ce qu'ils laissent de côté.",
    ]),
  );
  $("#hf-mosaic-cap").textContent =
    `Les ${num(F.n)} accidents aériens survenus aux États-Unis de ${F.period[0]} à ${F.period[1]} et clos par une cause probable du NTSB, année par année. En orange, ceux dont la cause probable cite une personne.`;
  $("#mosaic").setAttribute(
    "aria-label",
    `${num(F.person)} accidents sur ${num(F.n)} citent une personne dans leur cause probable, de ${F.period[0]} à ${F.period[1]}.`,
  );
}

/* ------------------------------------------------------------------ the essentials */
export function writeEssentiel(F) {
  const air = F.seg.airline;
  const items = [
    [
      "verdict",
      pct(F.share.person),
      "Le facteur humain est-il le premier ?",
      [
        "Oui, de loin. Une personne est citée dans ",
        { b: pct(F.share.person) },
        ` des accidents, l'environnement dans ${pct(F.share.env)}, une panne de l'appareil dans ${pct(F.share.machine)}.`,
      ],
    ],
    [
      "gravite",
      pct(F.fatal.share),
      "Et quand l'accident tue ?",
      [
        "Plus encore : une personne est citée dans ",
        { b: pct(F.fatal.share) },
        " des accidents mortels, qui comptent ",
        { b: pct(ratio(F.deaths.person, F.deaths.n)) },
        " des morts.",
      ],
    ],
    [
      "compagnies",
      pct(air.person),
      "Partout ?",
      [
        "Non. Dans les compagnies aériennes, une personne n'est citée que dans ",
        { b: pct(air.person) },
        ` des accidents, l'environnement dans ${pct(air.env)} : ${pct(ratio(F.airline.turbulence, F.airline.n))} de leurs accidents sont des turbulences.`,
      ],
    ],
    [
      "hfacs",
      pct(F.share.org),
      "Que cache « l'erreur humaine » ?",
      [
        "Des enquêtes qui s'arrêtent au geste : une organisation n'est citée que dans ",
        { b: pct(F.share.org) },
        ` des accidents, un acte dangereux dans ${pct(ratio(F.levels[1], F.n))}.`,
      ],
    ],
  ];
  $("#essentiel-list").replaceChildren(
    ...items.map(([id, n, q, a]) =>
      el("li", {}, [
        el("a", { href: `#${id}` }, [
          el("span", { class: "es-n", text: n }),
          el("b", { class: "es-q", text: q }),
          el("span", { class: "es-a" }, rich(a)),
        ]),
      ]),
    ),
  );
}

/* ------------------------------------------------------------------ a chapter */
// Every chapter reads the same way: the finding in the title, one short opening paragraph with one or two
// numbers, the figure, then two or three short paragraphs, and the caveats of method in an "À savoir" box.
function chapter(prefix, { lede, after = [], aside }) {
  prose(`#${prefix}-prose`, [lede]);
  const box = $(`#${prefix}-after`);
  if (!box) return;
  box.replaceChildren(
    ...after.map((p) => el("p", {}, rich(p))),
    ...(aside
      ? [
          el("aside", { class: "story-aside" }, [
            el("b", { text: "À savoir" }),
            " ",
            ...rich(aside).childNodes,
          ]),
        ]
      : []),
  );
}

/* ------------------------------------------------------------------ part 1: the verdict */
export function writeVerdict(F) {
  chapter("verdict", {
    lede: [
      "Une personne est citée dans la cause probable de ",
      { b: pct(F.share.person, 1) },
      " des accidents. L'environnement l'est dans ",
      { b: pct(F.share.env) },
      ", une panne de l'appareil dans ",
      { b: pct(F.share.machine) },
      ".",
    ],
    after: [
      [
        "Le chiffre confirme une estimation ancienne. En 2000, dans un rapport publié par l'administration fédérale de l'aviation américaine (FAA), Scott Shappell et Douglas Wiegmann situaient l'erreur humaine dans 70 à 80 % des accidents.",
      ],
      [
        "Chaque enquête du NTSB se conclut par une cause probable, codée constat par constat : ce qui a lâché, ce qui a été mal fait, dans quelles conditions. Ses quatre familles, l'appareil, les personnes, l'environnement et l'organisation, recoupent celles du modèle SHELL (Edwards, 1972 ; Hawkins, 1975), qui place l'humain au centre.",
      ],
      [
        "Le NTSB range aussi côté appareil certains gestes humains : un carburant mal géré, une pièce mal montée, un train non sorti. En les comptant, le facteur humain monte à ",
        { b: pct(F.humanBroad) },
        ".",
      ],
    ],
    aside: [
      "Un accident peut avoir plusieurs causes : les parts ne s'additionnent pas. Elles comparent des causes, pas des risques, car le nombre de vols de l'aviation générale n'est pas connu.",
    ],
  });
  $("#layers-note").textContent =
    `Part des accidents dont la cause probable cite chaque famille, États-Unis, ${F.period[0]}-${F.period[1]}.`;
  lecture("#chart-layers", "un accident peut citer plusieurs familles : les barres ne s'additionnent pas.");
}

export function writeGravite(F) {
  const [fat, , , none] = F.severity;
  const others = F.severity.slice(1).map((s) => s.share);
  chapter("gravite", {
    lede: [
      "Une personne est citée dans ",
      { b: pct(fat.share) },
      " des accidents mortels, contre ",
      { b: `${fmtNum(Math.min(...others), 0)} à ${pct(Math.max(...others))}` },
      " pour les autres. Les accidents mortels qui citent une personne comptent ",
      { b: pct(ratio(F.deaths.person, F.deaths.n)) },
      " des morts.",
    ],
    after: [
      [
        "En 1931, l'ingénieur américain Herbert Heinrich décrivait une pyramide : pour un accident grave, 29 accidents légers et 300 sans blessure. Ses chiffres n'ont jamais pu être vérifiés, mais l'image d'une base large d'événements bénins sous chaque drame a marqué la sécurité industrielle.",
      ],
      [
        "La pyramide du NTSB a une autre forme : pour 10 accidents mortels, ",
        { b: num(perTen(none.n, fat.n)) },
        " sans blessé. Elle ne compte que des accidents, pas les incidents sans dommage qui en formeraient la base.",
      ],
    ],
  });
  $("#pyramid-note").textContent =
    `Accidents selon la blessure la plus grave, États-Unis, ${F.period[0]}-${F.period[1]}, et part de ceux qui citent une personne.`;
  lecture(
    "#chart-pyramid",
    "la largeur de chaque étage suit le nombre d'accidents ; la partie orange, ceux qui citent une personne.",
  );
}

export function historyFacts(history) {
  const s = (rows, i) => rows.map((r) => ratio(r[i], r[1]));
  const old = { person: s(history.old, 2), machine: s(history.old, 3), years: history.old.map((r) => r[0]) };
  const neu = { person: s(history.new, 2), machine: s(history.new, 3), years: history.new.map((r) => r[0]) };
  const all = [...history.old, ...history.new];
  const minTimes = Math.min(...all.map((r) => r[2] / r[3]));
  return { old, neu, minTimes };
}

export function writeHistoire(F) {
  const H = historyFacts(F.history);
  const range = (xs) => `${fmtNum(Math.min(...xs), 0)} à ${pct(Math.max(...xs))}`;
  chapter("histoire", {
    lede: [
      `Depuis ${H.old.years[0]}, une personne est citée au moins `,
      { b: `${TIMES[Math.min(10, times(H.minTimes, 1))]} fois` },
      " plus souvent qu'une panne de l'appareil, chaque année.",
    ],
    after: [
      [
        `Le NTSB a changé de grille de codage en ${F.history.break}. Les niveaux ne se comparent donc pas d'une grille à l'autre, mais la hiérarchie ne bouge pas.`,
      ],
      [
        `Avec l'ancienne grille, de ${H.old.years[0]} à ${H.old.years.at(-1)}, une personne est citée dans `,
        { b: range(H.old.person) },
        " des accidents. La panne de l'appareil recule, de ",
        { b: pct(H.old.machine[0]) },
        " à ",
        { b: pct(H.old.machine.at(-1)) },
        ".",
      ],
      [
        "Avec la nouvelle, une personne est citée dans ",
        { b: range(H.neu.person.slice(1)) },
        " des accidents, une panne dans ",
        { b: range(H.neu.machine) },
        `. Seule ${H.neu.years[0]}, année de transition, descend à ${pct(H.neu.person[0])}.`,
      ],
    ],
  });
  $("#history-note").textContent =
    "Part des accidents dont les causes ou facteurs cités désignent une personne ou une panne de l'appareil, États-Unis, par année.";
  lecture(
    "#chart-history",
    `en ${F.history.break}, le NTSB passe d'une grille de codage à une autre : les courbes changent de niveau sans que les accidents aient changé.`,
  );
}

/* ------------------------------------------------------------------ part 2: who, which errors */
export function writeQui(F, people) {
  const g = group(people);
  const R = F.roles;
  chapter("qui", {
    lede: [
      "Quand une personne est citée, c'est presque toujours celle qui tient les commandes : le pilote, l'instructeur ou l'élève, dans ",
      { b: pct(ratio(g.controls, g.person)) },
      " des cas.",
    ],
    after: [
      [
        "Les autres maillons humains pèsent peu dans les verdicts. Un mécanicien ou un constructeur amateur est nommé dans ",
        { b: num(R.maintenance) },
        " accidents, un contrôleur aérien dans ",
        { b: num(R.atc) },
        ".",
      ],
      [
        "L'aviation générale explique cette concentration. Avions de tourisme, d'école ou d'affaires, elle fait ",
        { b: pct(ratio(F.seg.ga.n, F.n)) },
        " des accidents, souvent avec un seul pilote à bord, sans équipage pour rattraper une erreur.",
      ],
    ],
  });
  $("#roles-note").textContent =
    `Accidents dont la cause probable nomme chaque type de personne, États-Unis, ${F.period[0]}-${F.period[1]} ; un accident peut en nommer plusieurs.`;
}

export function errorRows(people, g, n = 14) {
  const label = Object.fromEntries(people.errors.map(([k, l, fam]) => [k, { l, fam }]));
  return Object.entries(g.errors)
    .filter(([k]) => label[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, label: label[k].l, family: label[k].fam, n: v }));
}

export function writeErreurs(F, people) {
  const rows = errorRows(people, group(people));
  const fatal = group(people, "all", "FATL");
  const disor = "2-20-25";
  chapter("erreurs", {
    lede: [
      "Le constat le plus fréquent de toute la base est la perte de contrôle de l'appareil par la personne aux commandes : ",
      { b: num(rows[0].n) },
      " accidents, ",
      { b: pct(ratio(rows[0].n, F.n)) },
      " du total.",
    ],
    after: [
      [
        "Lus avec la grille HFACS de Shappell et Wiegmann, ces constats sont surtout des erreurs d'exécution : un geste raté, une attention qui décroche. Les erreurs de décision, comme un vol entrepris par mauvais temps, viennent ensuite.",
      ],
      [
        "Les erreurs de perception sont plus rares, mais elles tuent. La désorientation spatiale est citée dans ",
        { b: num(group(people).errors[disor] ?? 0) },
        " accidents, dont ",
        { b: num(fatal.errors[disor] ?? 0) },
        " mortels.",
      ],
    ],
  });
  $("#errors-note").textContent =
    `Accidents citant chaque constat sur une personne, les ${rows.length} plus fréquents, États-Unis, ${F.period[0]}-${F.period[1]}. Couleur : famille d'erreur selon HFACS.`;
}

export function writeHfacs(F, people) {
  const L = F.levels;
  const base = F.hfacsBase;
  const fatal = group(people, "all", "FATL");
  chapter("hfacs", {
    lede: [
      "Quand les enquêteurs citent une personne ou une organisation, ils retiennent un acte dangereux dans ",
      { b: pct(ratio(L[1], base)) },
      " des cas, et l'organisation dans ",
      { b: pct(ratio(L[4], base), 1) },
      ".",
    ],
    after: [
      [
        "HFACS range les causes humaines sur quatre étages : les actes dangereux, leurs conditions préalables (fatigue, alcool, expérience), la supervision, puis l'organisation. C'est la traduction pratique du « fromage suisse » de James Reason : derrière l'erreur active, des conditions latentes, posées plus haut.",
      ],
      [
        "Les accidents mortels, examinés plus à fond, descendent un peu plus bas : une condition préalable y figure dans ",
        { b: pct(ratio(fatal.levels[2] ?? 0, F.fatalHfacsBase)) },
        " des cas, contre ",
        { b: pct(ratio(L[2], base)) },
        " en moyenne.",
      ],
      [
        "L'aviation générale n'a souvent ni employeur ni encadrement à examiner, et l'enquête s'arrête au pilote. Pour le chercheur Sidney Dekker, s'arrêter à l'erreur d'un individu revient à croire le système sûr, à quelques personnes peu fiables près.",
      ],
    ],
    aside: [
      "Le rapprochement des constats du NTSB avec les familles de HFACS est celui de l'auteur. Le NTSB ne code pas les violations en tant que telles.",
    ],
  });
  $("#levels-note").textContent =
    `Part des accidents citant une personne ou une organisation qui atteignent chaque étage et chaque famille de HFACS, États-Unis, ${F.period[0]}-${F.period[1]}.`;
  lecture("#chart-levels", "un accident peut atteindre plusieurs étages et plusieurs familles.");
}

/* ------------------------------------------------------------------ part 3: the models */
export function writeTem(F) {
  const c = F.chain;
  chapter("tem", {
    lede: [
      "Quand l'appareil échappe à son pilote, une erreur d'une personne est presque toujours citée : dans ",
      { b: pct(ratio(c.stateError, c.state)) },
      " des cas.",
    ],
    after: [
      [
        "Le modèle de gestion des menaces et des erreurs (TEM), né dans les années 1990 des audits de vols de ligne, découpe un accident en trois temps : des menaces extérieures à l'équipage, comme la météo ou une panne ; des erreurs de l'équipage ; puis un état indésirable de l'appareil, une vitesse ou une trajectoire qui échappe.",
      ],
      [
        "Le NTSB code justement ces états indésirables, sous la forme d'un paramètre de vol « non maintenu ». Il en cite un dans ",
        { b: pct(ratio(c.state, c.n)) },
        " des accidents.",
      ],
      [
        "Les menaces mènent rarement seules à l'accident : une menace est citée sans aucune personne dans ",
        { b: pct(ratio(c.threatOnly, c.n)) },
        " des accidents seulement.",
      ],
    ],
  });
  $("#chain-note").textContent =
    `Accidents citant chaque étape du modèle TEM dans leur cause probable, États-Unis, ${F.period[0]}-${F.period[1]}. Menace : environnement ou panne ; erreur : une personne ; état indésirable : un paramètre de vol non maintenu.`;
}

export function writeFromage(F) {
  const { rows, layers } = F.cheese;
  const find = (mask) => rows.find((r) => r.mask === mask)?.share ?? 0;
  const three = layers[3] + layers[4];
  chapter("fromage", {
    lede: [
      "La moitié des accidents (",
      { b: pct(find(BIT.person)) },
      ") ne citent qu'une couche, la personne : ni environnement, ni panne, ni organisation.",
    ],
    after: [
      [
        "Pour James Reason, psychologue à l'université de Manchester, un accident survient quand les trous de plusieurs barrières s'alignent. Son modèle, publié en 1990, interdit de s'arrêter à la dernière erreur.",
      ],
      [
        "Les verdicts alignent rarement plus de deux trous. Une personne et l'environnement ensemble : ",
        { b: pct(find(BIT.person | BIT.env)) },
        " des accidents. Trois couches ou plus : ",
        { b: pct(ratio(three, F.n), 1) },
        ".",
      ],
      [
        "Cela ne prouve pas que les accidents n'ont qu'une cause, mais que le verdict en retient peu, et que la couche la plus souvent percée est la personne.",
      ],
    ],
  });
  $("#cheese-note").textContent =
    `Accidents par combinaison des quatre couches citées dans leur cause probable, États-Unis, ${F.period[0]}-${F.period[1]}.`;
  lecture(
    "#chart-cheese",
    "chaque ligne est une combinaison ; les pastilles pleines désignent les couches citées.",
  );
}

export function writeEvenements(F) {
  const E = Object.fromEntries(F.events.map((e) => [e.key, e]));
  const share = (k) => E[k]?.share ?? 0;
  const loc = E["Loss of control in flight"];
  const human = [
    "Aerodynamic stall/spin",
    "Controlled flight into terr/obj (CFIT)",
    "VFR encounter with IMC",
  ].map(share);
  const least = Math.min(...human);
  chapter("evenements", {
    lede: [
      "La part de l'humain dépend de ce qui s'est passé : une personne est citée dans ",
      { b: pct(share("Loss of control in flight")) },
      " des pertes de contrôle en vol, mais dans ",
      { b: pct(share("Loss of engine power (total)")) },
      " des pertes totales de puissance.",
    ],
    after: [
      [
        `Pour chaque accident, le NTSB désigne l'événement déterminant, celui qui fait basculer le vol. Les décrochages, les impacts sans perte de contrôle et les vols à vue entrés dans les nuages citent une personne ${least >= 90 ? "plus de neuf fois sur dix" : `dans au moins ${pct(least)} des cas`}.`,
      ],
      [
        "Or les événements les plus humains sont aussi les plus meurtriers : les pertes de contrôle en vol font à elles seules ",
        { b: pct(ratio(loc.fatal, F.fatal.n)) },
        " des accidents mortels.",
      ],
    ],
  });
  $("#events-note").textContent =
    `Accidents par événement déterminant, les 16 plus fréquents, États-Unis, ${F.period[0]}-${F.period[1]}, et part de ceux qui citent une personne.`;
  lecture(
    "#chart-events",
    "la barre donne le nombre d'accidents, sa partie orange ceux qui citent une personne.",
  );
}

/* ------------------------------------------------------------------ part 4: airlines */
export function writeCompagnies(F) {
  const air = F.seg.airline;
  chapter("compagnies", {
    lede: [
      "Dans les compagnies aériennes, l'humain n'est plus seul en tête : une personne est citée dans ",
      { b: pct(air.person) },
      " des accidents, l'environnement dans ",
      { b: pct(air.env) },
      ".",
    ],
    after: [
      [
        "Les compagnies, dont les vols relèvent de la partie 121 de la réglementation américaine, ne comptent que ",
        { b: num(air.n) },
        ` accidents en ${F.years} ans, dont `,
        { b: num(air.fatal) },
        " mortels.",
      ],
      [
        "La turbulence fait la différence. Elle est l'événement déterminant de ",
        { b: pct(ratio(F.airline.turbulence, air.n)) },
        " de leurs accidents, souvent des passagers ou des membres d'équipage blessés en cabine, et une personne n'est citée que dans ",
        { b: num(F.airline.turbulencePerson) },
        " d'entre eux.",
      ],
      [
        "Les verdicts y citent aussi plus souvent une organisation : ",
        { b: pct(air.org, 1) },
        " des accidents, contre ",
        { b: pct(F.seg.ga.org, 1) },
        " en aviation générale.",
      ],
    ],
  });
  $("#segments-note").textContent =
    `Part des accidents citant une personne, l'environnement ou une panne de l'appareil, par type de vol, États-Unis, ${F.period[0]}-${F.period[1]}.`;
}

export function writeExplorer() {
  prose("#explorer-prose", [
    [
      "Le facteur humain ne pèse pas pareil dans un vol d'épandage, un taxi aérien ou un vol de ligne, ni dans un accident mortel ou sans blessé. Le détail par type de vol et par gravité, sur les mêmes seize ans de causes probables.",
    ],
  ]);
}

/** The tool's one-sentence reading of the current filter. */
export function toolSentence(v, seg, sev, acc) {
  const segLabel =
    seg === "all" ? "tous types de vol" : acc.segments.find(([k]) => k === seg)[1].toLowerCase();
  const sevLabel = sev === "all" ? "" : `, ${acc.severities.find(([k]) => k === sev)[1].toLowerCase()}`;
  if (!v.n) return [`Aucun accident pour ce choix (${segLabel}${sevLabel}).`];
  return [
    { b: num(v.n) },
    ` accidents (${segLabel}${sevLabel}). Une personne est citée dans `,
    { b: pct(v.share(BIT.person)) },
    `, l'environnement dans ${pct(v.share(BIT.env))}, une panne de l'appareil dans ${pct(v.share(BIT.machine))}.`,
  ];
}

/* ------------------------------------------------------------------ the answer */
export function writeReponse(F) {
  const H = historyFacts(F.history);
  prose("#reponse-prose", [
    [
      "Oui. Dans les causes probables du NTSB, le facteur humain est de loin le premier : une personne est citée dans ",
      { b: pct(F.share.person) },
      ` des accidents, ${TIMES[Math.min(10, times(F.share.person, F.share.machine))]} fois plus souvent qu'une panne. La hiérarchie tient depuis ${H.old.years[0]} et se renforce avec la gravité.`,
    ],
    [
      "Deux nuances. Dans les compagnies aériennes, la turbulence fait jeu égal avec l'humain. Et « l'erreur humaine » des verdicts est presque toujours celle du dernier geste : l'organisation n'est citée que dans ",
      { b: pct(F.share.org, 1) },
      " des accidents.",
    ],
    [
      "Le facteur humain est la première cause citée. C'est aussi, comme le rappellent Reason et Dekker, l'endroit où l'enquête s'arrête le plus souvent.",
    ],
  ]);
}
