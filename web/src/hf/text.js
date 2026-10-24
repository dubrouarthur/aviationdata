// The words of the human-factor story. Its question: is the human factor the first cause of aviation
// accidents? Every number comes from facts.js (web/public/data/hf/*.json); web/scripts/check_hf.py
// recomputes them. The text says what the data shows, never what a chart looks like.
import { $, el, rich, keyFigures, lecture } from "../lib/ui.js";
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
      "Aux États-Unis, chaque accident aérien, du monomoteur de tourisme à l'avion de ligne en passant par l'hélicoptère, fait l'objet d'une enquête du National Transportation Safety Board (NTSB), qui se conclut par une cause probable. ",
      `De ${F.period[0]} à ${F.period[1]}, sur `,
      { b: num(F.n) },
      " accidents, une personne y est citée ",
      { b: num(F.person) },
      " fois : un pilote le plus souvent, parfois un mécanicien, un contrôleur, un passager. Le facteur humain est-il vraiment la première cause des accidents ? Les grands modèles du risque aérien, de Heinrich à Reason, aident à lire ces verdicts, et à en voir les angles morts.",
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

/* ------------------------------------------------------------------ part 1: the verdict */
export function writeVerdict(F) {
  prose("#verdict-prose", [
    [
      "Le chiffre circule depuis longtemps. Dans un rapport publié par l'administration fédérale de l'aviation américaine (FAA) en 2000, Scott Shappell et Douglas Wiegmann écrivaient que l'erreur humaine est en cause dans 70 à 80 % des accidents de l'aviation civile et militaire. Les verdicts des enquêteurs permettent de le vérifier, accident par accident.",
    ],
    [
      "Le NTSB enquête sur chaque accident aérien civil survenu aux États-Unis, c'est-à-dire chaque fois qu'une personne est tuée ou gravement blessée, ou que l'appareil est sérieusement endommagé. Chaque enquête se conclut par une cause probable, codée constat par constat : ce qui a lâché, ce qui a été mal fait, dans quelles conditions. Ses quatre familles, l'appareil, les personnes, l'environnement et l'organisation, recoupent presque terme à terme celles du modèle SHELL (Edwards, 1972 ; Hawkins, 1975), qui place l'humain au centre de la machine, de l'environnement et des procédures.",
    ],
    [
      `Sur les ${num(F.n)} accidents de ${F.period[0]} à ${F.period[1]}, une personne est citée dans `,
      { b: num(F.person) },
      ", soit ",
      { b: pct(F.share.person, 1) },
      ". Viennent loin derrière l'environnement (vent, relief, oiseaux, nuit : ",
      { b: pct(F.share.env) },
      ") et une panne ou un défaut de l'appareil (",
      { b: pct(F.share.machine) },
      `). Le NTSB range en outre du côté de l'appareil certains gestes humains, un carburant mal géré, une pièce mal montée, un train non sorti, cités dans ${pct(F.share.handling)} des accidents : en les comptant, le facteur humain monte à ${pct(F.humanBroad)}.`,
    ],
    [
      `Un accident peut avoir plusieurs causes, et les parts ne s'additionnent pas. Mais la hiérarchie tient pour tous les types de vol, à une exception près, les compagnies aériennes, sur laquelle cette enquête reviendra.`,
    ],
  ]);
  keyFigures($("#kf-verdict"), [
    { value: pct(F.share.person), label: "des accidents citent une personne", color: "var(--human)" },
    { value: pct(F.share.machine), label: "une panne de l'appareil", color: "var(--machine)" },
  ]);
  $("#layers-note").textContent =
    `Part des accidents dont la cause probable cite au moins un constat de chaque famille, États-Unis, ${F.period[0]}-${F.period[1]}.`;
  lecture("#chart-layers", "un accident peut citer plusieurs familles : les barres ne s'additionnent pas.");
}

export function writeGravite(F) {
  const [fat, sers, minr, none] = F.severity;
  const others = F.severity.slice(1).map((s) => s.share);
  prose("#gravite-prose", [
    [
      "En 1931, l'ingénieur américain Herbert Heinrich tire de dossiers d'assurance une pyramide restée célèbre : pour un accident grave, 29 accidents légers et 300 sans blessure, et 88 % des accidents dus à « l'homme ». Ses chiffres n'ont jamais pu être vérifiés, ses dossiers ont disparu, mais l'idée d'une base large d'événements bénins sous chaque drame a marqué toute la sécurité industrielle.",
    ],
    [
      "La pyramide du NTSB a une autre forme : pour 10 accidents mortels, ",
      { b: num(perTen(sers.n, fat.n)) },
      " avec des blessés graves, ",
      { b: num(perTen(minr.n, fat.n)) },
      " avec des blessés légers et ",
      { b: num(perTen(none.n, fat.n)) },
      " sans blessé. Elle ne compte que des accidents, pas les incidents sans dommage qui en formeraient la base. Mais la part de l'humain y grimpe vers le sommet : une personne est citée dans ",
      { b: `${fmtNum(Math.min(...others), 0)} à ${pct(Math.max(...others))}` },
      " des accidents sans mort, et dans ",
      { b: pct(fat.share) },
      " des accidents mortels.",
    ],
    [
      `Ces ${num(F.fatal.n)} accidents mortels ont fait ${num(F.deaths.n)} morts ; ceux dont la cause probable cite une personne en comptent `,
      { b: num(F.deaths.person) },
      ", soit ",
      { b: pct(ratio(F.deaths.person, F.deaths.n)) },
      ".",
    ],
  ]);
  keyFigures($("#kf-gravite"), [
    { value: pct(fat.share), label: "des accidents mortels citent une personne", color: "var(--human)" },
    { value: pct(ratio(F.deaths.person, F.deaths.n)), label: "des morts", color: "var(--human)" },
  ]);
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
  const restNew = H.neu.person.slice(1);
  prose("#histoire-prose", [
    [
      `Le NTSB a changé de grille de codage en ${F.history.break}. Avant, chaque cause était un sujet (le moteur, la décision, le vent), complété du nom d'une personne quand il y en avait une ; depuis, une taxonomie de constats sépare l'appareil, les personnes, l'environnement et l'organisation. Les niveaux ne se comparent donc pas d'une grille à l'autre ; la hiérarchie, si.`,
    ],
    [
      `De ${H.old.years[0]} à ${H.old.years.at(-1)}, une personne est citée dans `,
      { b: range(H.old.person) },
      " des accidents selon les années, une panne de l'appareil dans ",
      { b: range(H.old.machine) },
      `, une part qui recule : ${pct(H.old.machine[0])} en ${H.old.years[0]}, ${pct(H.old.machine.at(-1))} en ${H.old.years.at(-1)}. Depuis ${F.history.break}, une personne est citée dans `,
      { b: range(restNew) },
      ` des accidents (${pct(H.neu.person[0])} en ${H.neu.years[0]}, première année de la nouvelle grille), une panne dans `,
      { b: range(H.neu.machine) },
      ".",
    ],
    [
      "En quarante ans, quelle que soit la grille, une personne est citée au moins ",
      { b: `${TIMES[Math.min(10, times(H.minTimes, 1))]} fois` },
      " plus souvent qu'une panne de l'appareil, chaque année.",
    ],
  ]);
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
  const ga = F.seg.ga;
  prose("#qui-prose", [
    [
      "Quand une personne est citée, c'est presque toujours celle qui tient les commandes. Le pilote est nommé dans ",
      { b: num(R.pilot) },
      " accidents, un instructeur ou un élève pilote dans ",
      { b: num(R.training) },
      " : l'un ou l'autre figure dans ",
      { b: pct(ratio(g.controls, g.person)) },
      " des accidents où une personne est citée.",
    ],
    [
      "Les autres maillons humains pèsent peu dans les verdicts : un mécanicien ou un constructeur amateur dans ",
      { b: num(R.maintenance) },
      ` accidents (${pct(ratio(R.maintenance, F.n), 1)}), le pilote d'un autre appareil dans ${num(R.other_pilot)}, un passager ou l'équipage de cabine dans ${num(R.cabin)}, le personnel au sol ou d'aéroport dans ${num(R.ground)}, un contrôleur aérien ou un agent d'information de vol dans `,
      { b: num(R.atc) },
      ".",
    ],
    [
      "L'aviation générale, avions de tourisme, d'école ou d'affaires, explique cette concentration : ",
      { b: pct(ratio(ga.n, F.n)) },
      " des accidents y surviennent, souvent avec un seul pilote à bord, sans équipage pour rattraper une erreur ni compagnie dont on examinerait les procédures.",
    ],
  ]);
  keyFigures($("#kf-qui"), [
    {
      value: pct(ratio(g.controls, g.person)),
      label: "des accidents à cause humaine nomment le pilote, l'instructeur ou l'élève",
      color: "var(--human)",
    },
  ]);
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
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const fatal = group(people, "all", "FATL");
  const disor = "2-20-25";
  const top = rows.slice(1, 5);
  prose("#erreurs-prose", [
    [
      "Le constat le plus fréquent de toute la base revient accident après accident : le contrôle de l'appareil, perdu ou mal tenu par la personne aux commandes. Il figure dans ",
      { b: num(rows[0].n) },
      " accidents, ",
      { b: pct(ratio(rows[0].n, F.n)) },
      " du total. Suivent ",
      ...top.flatMap((r, i) => [
        i ? (i === top.length - 1 ? " et " : ", ") : "",
        `${r.label.toLowerCase()} (`,
        { b: num(r.n) },
        ")",
      ]),
      ".",
    ],
    [
      "Lus avec la grille HFACS de Shappell et Wiegmann, construite pour l'aviation à partir du modèle de Reason, ces constats sont surtout des erreurs d'exécution : un geste raté, une attention qui décroche. Les erreurs de décision, comme un vol entrepris par mauvais temps ou un carburant mal préparé, viennent ensuite. Les erreurs de perception sont plus rares, mais elles tuent : la désorientation spatiale est citée dans ",
      { b: num(by[disor]?.n ?? 0) },
      " accidents, dont ",
      { b: num(fatal.errors[disor] ?? 0) },
      " mortels.",
    ],
  ]);
  $("#errors-note").textContent =
    `Accidents citant chaque constat sur une personne, les ${rows.length} plus fréquents, États-Unis, ${F.period[0]}-${F.period[1]}. Couleur : famille d'erreur selon HFACS, rapprochement fait par l'auteur.`;
}

export function writeHfacs(F, people) {
  const L = F.levels;
  const base = F.hfacsBase;
  const fatal = group(people, "all", "FATL");
  prose("#hfacs-prose", [
    [
      "HFACS range les causes humaines sur quatre étages, du geste à l'organisation : les actes dangereux, leurs conditions préalables (fatigue, alcool, expérience, communication dans l'équipage), la supervision, puis les influences de l'organisation. C'est la traduction pratique du « fromage suisse » de James Reason : derrière l'erreur active, des conditions latentes, posées plus haut, parfois des années avant.",
    ],
    [
      "Dans les verdicts du NTSB, l'édifice est presque vide au-dessus du rez-de-chaussée. Sur les ",
      { b: num(base) },
      " accidents qui citent une personne ou une organisation, un acte dangereux figure dans ",
      { b: pct(ratio(L[1], base)) },
      ", une condition préalable dans ",
      { b: pct(ratio(L[2], base)) },
      ", la supervision dans ",
      { b: pct(ratio(L[3], base), 1) },
      ", l'organisation dans ",
      { b: pct(ratio(L[4], base), 1) },
      ".",
    ],
    [
      "Les accidents mortels, examinés plus à fond (autopsie, analyses toxicologiques), descendent un peu plus bas : une condition préalable y figure dans ",
      { b: pct(ratio(fatal.levels[2] ?? 0, F.fatalHfacsBase)) },
      " des cas. Mais l'aviation générale, qui fait l'essentiel des accidents, n'a souvent ni employeur ni encadrement à examiner, et l'enquête s'arrête au pilote. Pour le chercheur Sidney Dekker, s'arrêter à l'erreur d'un individu revient à croire le système sûr, à quelques personnes peu fiables près.",
    ],
  ]);
  keyFigures($("#kf-hfacs"), [
    { value: pct(ratio(L[1], base)), label: "citent un acte dangereux", color: "var(--human)" },
    { value: pct(ratio(L[4], base), 1), label: "une organisation", color: "var(--org)" },
  ]);
  $("#levels-note").textContent =
    `Part des accidents citant une personne ou une organisation qui atteignent chaque étage et chaque famille de HFACS, États-Unis, ${F.period[0]}-${F.period[1]}. Rapprochement des constats du NTSB et de la grille HFACS fait par l'auteur.`;
  lecture("#chart-levels", "un accident peut atteindre plusieurs étages et plusieurs familles.");
}

/* ------------------------------------------------------------------ part 3: the models */
export function writeTem(F) {
  const c = F.chain;
  prose("#tem-prose", [
    [
      "Le modèle de gestion des menaces et des erreurs (TEM), né dans les années 1990 des audits de vols de ligne de l'université du Texas avec des compagnies américaines, découpe un accident en trois temps : des menaces extérieures à l'équipage, comme la météo ou une panne ; des erreurs de l'équipage ; puis un état indésirable de l'appareil, une vitesse, une altitude ou une trajectoire qui échappe, dernière marche avant l'accident.",
    ],
    [
      "Le NTSB code justement ces états indésirables, sous la forme d'un paramètre de vol « non maintenu ». Il en cite un dans ",
      { b: num(c.state) },
      " accidents, ",
      { b: pct(ratio(c.state, c.n)) },
      " du total. Dans ",
      { b: pct(ratio(c.stateError, c.state)) },
      " de ces cas, une erreur d'une personne est citée aussi ; une menace, dans ",
      { b: pct(ratio(c.stateThreat, c.state)) },
      ".",
    ],
    [
      "Les menaces mènent rarement seules à l'accident : quand le NTSB cite le vent, le relief ou une panne, il cite le plus souvent aussi une personne. Une menace est citée sans aucune personne dans ",
      { b: num(c.threatOnly) },
      " accidents, ",
      { b: pct(ratio(c.threatOnly, c.n)) },
      " du total.",
    ],
  ]);
  keyFigures($("#kf-tem"), [
    {
      value: pct(ratio(c.stateError, c.state)),
      label: "des états indésirables s'accompagnent d'une erreur citée",
      color: "var(--human)",
    },
  ]);
  $("#chain-note").textContent =
    `Accidents citant chaque étape du modèle TEM dans leur cause probable, États-Unis, ${F.period[0]}-${F.period[1]}. Menace : environnement ou panne de l'appareil ; erreur : une personne ; état indésirable : un paramètre de vol non maintenu.`;
}

export function writeFromage(F) {
  const { rows, layers } = F.cheese;
  const find = (mask) => rows.find((r) => r.mask === mask)?.share ?? 0;
  const three = layers[3] + layers[4];
  prose("#fromage-prose", [
    [
      "Pour James Reason, psychologue à l'université de Manchester, un accident survient quand les trous de plusieurs barrières s'alignent : l'opérateur, la machine, l'environnement, l'organisation. Son modèle, publié en 1990, est devenu une référence de la sécurité aérienne, précisément parce qu'il interdit de s'arrêter à la dernière erreur.",
    ],
    [
      "Les causes probables du NTSB alignent rarement plus de deux trous. ",
      { b: pct(find(BIT.person)) },
      " des accidents ne citent qu'une personne, sans environnement, panne ni organisation. Une personne et l'environnement ensemble : ",
      { b: pct(find(BIT.person | BIT.env)) },
      ". Une panne seule : ",
      { b: pct(find(BIT.machine)) },
      ". Trois couches ou plus : ",
      { b: pct(ratio(three, F.n), 1) },
      ".",
    ],
    [
      "Cela ne prouve pas que les accidents n'ont qu'une cause, mais que le verdict en retient peu, et que la couche la plus souvent percée, de loin, est la personne.",
    ],
  ]);
  keyFigures($("#kf-fromage"), [
    { value: pct(find(BIT.person)), label: "des accidents ne citent qu'une personne", color: "var(--human)" },
    { value: pct(ratio(three, F.n), 1), label: "trois couches ou plus", color: "var(--ink)" },
  ]);
  $("#cheese-note").textContent =
    `Accidents par combinaison des quatre couches citées dans leur cause probable, États-Unis, ${F.period[0]}-${F.period[1]}.`;
  lecture(
    "#chart-cheese",
    "chaque ligne est une combinaison ; les pastilles pleines désignent les couches citées.",
  );
}

export function writeEvenements(F) {
  const E = Object.fromEntries(F.events.map((e) => [e.key, e]));
  const s = (k) => pct(E[k]?.share ?? 0);
  const loc = E["Loss of control in flight"];
  prose("#evenements-prose", [
    [
      "Pour chaque accident, le NTSB désigne aussi l'événement déterminant, celui qui fait basculer le vol : une perte de contrôle, une perte de puissance, un impact avec le relief. La part de l'humain en dépend entièrement.",
    ],
    [
      "Une personne est citée dans ",
      { b: s("Loss of control in flight") },
      " des pertes de contrôle en vol, ",
      { b: s("Aerodynamic stall/spin") },
      " des décrochages, ",
      { b: s("Controlled flight into terr/obj (CFIT)") },
      " des impacts sans perte de contrôle et ",
      { b: s("VFR encounter with IMC") },
      " des vols à vue entrés dans les nuages. Elle ne l'est que dans ",
      { b: s("Loss of engine power (total)") },
      " des pertes totales de puissance et ",
      { b: s("Sys/Comp malf/fail (non-power)") },
      " des pannes de système, où la machine prend le relais.",
    ],
    [
      "Or les événements les plus humains sont aussi les plus meurtriers : les pertes de contrôle en vol comptent à elles seules ",
      { b: num(loc.fatal) },
      " accidents mortels, ",
      { b: pct(ratio(loc.fatal, F.fatal.n)) },
      " du total.",
    ],
  ]);
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
  const ga = F.seg.ga;
  const taxi = F.seg.taxi;
  prose("#compagnies-prose", [
    [
      "Les compagnies aériennes, dont les vols relèvent de la partie 121 de la réglementation américaine, ne comptent que ",
      { b: num(air.n) },
      ` accidents en ${F.years} ans, ${pct(ratio(air.n, F.n), 1)} du total, dont ${num(air.fatal)} mortels. Chez elles, une personne n'est citée que dans `,
      { b: pct(air.person) },
      " des accidents, l'environnement dans ",
      { b: pct(air.env) },
      ".",
    ],
    [
      "La turbulence fait la différence : ",
      { b: num(F.airline.turbulence) },
      ` accidents de compagnie, ${pct(ratio(F.airline.turbulence, air.n))}, sont des rencontres avec la turbulence, qui blessent des passagers ou des membres d'équipage en cabine, et une personne n'est citée que dans ${num(F.airline.turbulencePerson)} d'entre elles. Les verdicts y citent aussi plus souvent une organisation : `,
      { b: pct(air.org, 1) },
      " des accidents, contre ",
      { b: pct(ga.org, 1) },
      " en aviation générale.",
    ],
    [
      `Le taxi aérien et les vols à la demande, entre les deux, restent dominés par l'humain (${pct(taxi.person)}), mais citent l'environnement (${pct(taxi.env)}) et une organisation (${pct(taxi.org, 1)}) plus souvent que l'aviation générale.`,
    ],
  ]);
  keyFigures($("#kf-compagnies"), [
    {
      value: pct(air.person),
      label: "des accidents de compagnie citent une personne",
      color: "var(--human)",
    },
    { value: pct(air.env), label: "l'environnement", color: "var(--env)" },
  ]);
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
  const air = F.seg.airline;
  prose("#reponse-prose", [
    [
      "Oui. Dans les causes probables du NTSB, le facteur humain est de loin le premier : une personne est citée dans ",
      { b: pct(F.share.person) },
      ` des accidents aériens de ${F.period[0]} à ${F.period[1]}, ${TIMES[Math.min(10, times(F.share.person, F.share.machine))]} fois plus souvent qu'une panne (${pct(F.share.machine)}) et ${TIMES[Math.min(10, times(F.share.person, F.share.env))]} fois plus que l'environnement (${pct(F.share.env)}). La hiérarchie tient depuis quarante ans et se renforce avec la gravité : `,
      { b: pct(F.fatal.share) },
      " des accidents mortels.",
    ],
    [
      `Deux nuances. Dans les compagnies aériennes, l'environnement, la turbulence surtout, fait jeu égal avec l'humain (${pct(air.env)} contre ${pct(air.person)}). Et « l'erreur humaine » des verdicts est presque toujours celle du dernier geste : la grille de Reason et de HFACS cherche aussi des conditions latentes, que les causes probables citent rarement (une organisation dans ${pct(F.share.org, 1)} des accidents).`,
    ],
    [
      `Le facteur humain est la première cause citée, et l'a été chaque année depuis ${H.old.years[0]}. C'est aussi, comme le rappellent Reason et Dekker, l'endroit où l'enquête s'arrête le plus souvent.`,
    ],
  ]);
}
