// The words of the fifth investigation. Every number comes from facts.js; web/scripts/check_saisons.py
// recomputes each of them from eu.json and compares with the page.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { MONTHS, times } from "./charts.js";

const EU = "EU27_2020";
/** "d'août", "de janvier" */
const de = (w) => (/^[aeiouyéèêàâîôûh]/i.test(w) ? `d'${w}` : `de ${w}`);
const d1 = (v) => fmtNum(v, 1);
/** "un jour d'août compte 7,4 fois plus de passagers qu'un jour de janvier" */
export const dayWords = (r, d = 1) =>
  `un jour ${de(MONTHS[r.peak - 1])} compte ${fmtNum(r.gap, d)} fois plus de passagers qu'un jour ${de(MONTHS[r.low - 1])}`;
/** "le Portugal et la Finlande" */
const ARTICLE = {
  PT: "le Portugal",
  FI: "la Finlande",
  DE: "l'Allemagne",
  EL: "la Grèce",
  ES: "l'Espagne",
  FR: "la France",
  IT: "l'Italie",
  SE: "la Suède",
  NO: "la Norvège",
  DK: "le Danemark",
  NL: "les Pays-Bas",
  CH: "la Suisse",
  HU: "la Hongrie",
  AT: "l'Autriche",
  BE: "la Belgique",
};
const AU = {
  PT: "au Portugal",
  FI: "en Finlande",
  DE: "en Allemagne",
  EL: "en Grèce",
  ES: "en Espagne",
  FR: "en France",
  IT: "en Italie",
  SE: "en Suède",
  NO: "en Norvège",
  DK: "au Danemark",
};
const the = (r) => ARTICLE[r.code] ?? r.name;
const cap = (t) => t.replace(/^./, (c) => c.toUpperCase());
const and = (list) => list.join(", ").replace(/, ([^,]+)$/, " et $1");

function prose(sel, paragraphs) {
  const node = $(sel);
  if (node) node.replaceChildren(...paragraphs.map((p) => el("p", {}, rich(p))));
}

function after(sel, paragraphs, aside) {
  prose(sel, paragraphs);
  if (!aside) return;
  $(sel).append(
    el("div", { class: "story-aside", role: "note" }, [
      el("b", { text: "À savoir" }),
      rich(Array.isArray(aside) ? aside : [aside]),
    ]),
  );
}

export function writeOpening(Q) {
  const [hr, fi] = [Q.at("HR", Q.last), Q.at("FI", Q.last)];
  prose("#open-dek", [
    [
      "Partout en Europe, l'été remplit les avions et janvier les vide. Mais pas au même rythme : en Croatie, ",
      { b: dayWords(hr) },
      `. En Finlande, à peine ${d1(fi.gap)} fois plus. Quinze ans de données mensuelles d'Eurostat, pays par pays.`,
    ],
  ]);
}

export function writeEssentiel(Q) {
  const L = Q.last;
  const rows = Q.rows(L);
  const [hr, ue] = [Q.at("HR", L), Q.at(EU, L)];
  const euKinds = Q.kinds.find((r) => r.code === EU);
  const count = (f) => rows.filter(f).length;
  const items = [
    [
      "profils",
      "Août",
      "Quel est le mois le plus chargé ?",
      [
        `Août, dans ${count((r) => r.peak === 8)} pays sur ${rows.length} ; juillet dans ${count((r) => r.peak === 7)}. Par jour, janvier est ${count((r) => r.low === 1) === rows.length ? "partout" : "presque partout"} le plus creux.`,
      ],
    ],
    [
      "carte",
      times(hr.gap),
      "Où l'été pèse-t-il le plus ?",
      [`En Croatie : ${dayWords(hr)}. Dans l'Union, `, { b: `${d1(ue.gap)} fois` }, "."],
    ],
    [
      "interieurs",
      times(euKinds.nat.gap),
      "Et les vols intérieurs ?",
      [
        "Ils lissent l'année : dans l'Union, leur écart saisonnier est de ",
        { b: d1(euKinds.nat.gap) },
        `, contre ${d1(euKinds.intl.gap)} pour les vols internationaux.`,
      ],
    ],
    [
      "evolution",
      `${Q.narrower.length} sur ${Q.change.length}`,
      "La saison change-t-elle ?",
      [
        `Elle s'atténue dans ${Q.narrower.length} pays sur ${Q.change.length} depuis ${Q.first}, nettement en Bulgarie ; elle se creuse en Croatie et en Grèce.`,
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

/** The line under the calendar: the Union, or the country the reader picks. */
export function calendarReadout(Q) {
  return (row, year) => {
    const box = $("#cal-readout");
    if (!box) return;
    const ue = Q.at(EU, year);
    box.replaceChildren(
      el(
        "p",
        {},
        rich(
          row
            ? [{ b: row.name }, `, ${year} : ${dayWords(row)}, contre ${d1(ue.gap)} dans l'Union.`]
            : [{ b: "Union européenne" }, `, ${year} : ${dayWords(ue)}.`],
        ),
      ),
    );
  };
}

export function writeCalendar(Q) {
  $("#cal-note").textContent =
    "Passagers transportés par jour, chaque mois, rapportés à la moyenne de l'année : en bleu les mois creux, en orangé les mois chargés ; le mois le plus chargé est encadré. À droite, l'écart saisonnier, mois le plus chargé divisé par mois le plus creux.";
  lecture(
    "#cal-chart",
    "survolez ou touchez un pays pour le comparer à l'Union, faites défiler les années ou changez l'ordre au-dessus.",
  );
}

export function writeProfils(Q) {
  const L = Q.last;
  const [hr, ue, fi, el_] = [Q.at("HR", L), Q.at(EU, L), Q.at("FI", L), Q.at("EL", L)];
  const rows = Q.rows(L);
  const count = (f) => rows.filter(f).length;
  const nJan = count((r) => r.low === 1);
  $("#h-profils").textContent = `En Croatie, ${dayWords(hr, 0)}`;
  prose("#profils-prose", [
    [
      `Dans l'Union, un jour ${de(MONTHS[ue.peak - 1])} compte `,
      { b: `${d1(ue.gap)} fois` },
      ` plus de passagers qu'un jour ${de(MONTHS[ue.low - 1])}. Mais chaque pays a son calendrier : en Finlande, le mois le plus chargé ne compte que `,
      { b: `${d1(fi.gap)} fois` },
      " plus de passagers par jour que le plus creux.",
    ],
  ]);
  $("#h-pf").textContent = "La Croatie et la Grèce, les plus saisonnières";
  $("#pf-note").textContent =
    `Passagers transportés par jour, chaque mois de ${L}, rapportés à la moyenne de l'année (1 : un jour moyen).`;
  lecture(
    "#chart-pf",
    "le point marque le mois le plus chargé de chaque pays ; un pays choisi dans le calendrier s'ajoute en noir.",
  );
  after(
    "#profils-after",
    [
      [
        `En ${L}, janvier est, par jour, le mois le plus creux ${nJan === rows.length ? `dans les ${nJan} pays` : `dans ${nJan} pays sur ${rows.length}`}. Le pic tombe en août dans ${count((r) => r.peak === 8)} pays, en juillet dans ${count((r) => r.peak === 7)}.`,
      ],
      ["La Grèce suit la Croatie, avec un écart de ", { b: d1(el_.gap) }, "."],
      [
        `Jusqu'en ${Q.fi.juneUntil}, le mois le plus chargé de la Finlande, par jour, était juin. Depuis ${Q.fi.decSince}, c'est décembre.`,
      ],
    ],
    `Un mois de 31 jours n'est pas plus chargé pour sa longueur : chaque mois compte ici ses passagers par jour. Les années 2020 à 2022 sont écartées : en janvier 2022 encore, l'Union comptait ${fmtNum(Q.jan2022)} % de passagers de moins qu'en janvier 2019. Ces profils disent quand on vole, pas pourquoi.`,
  );
}

export function writeCarte(Q) {
  const L = Q.last;
  const get = (c) => Q.at(c, L);
  const bottom = Q.rows(L).sort((a, b) => a.gap - b.gap);
  $("#h-carte").textContent = "La saison ne suit pas la latitude";
  prose("#carte-prose", [
    [
      "Les pays les plus saisonniers ne sont pas tous au sud. La Slovaquie, avec un écart de ",
      { b: d1(get("SK").gap) },
      ", l'est davantage que Chypre, à ",
      { b: d1(get("CY").gap) },
      ".",
    ],
  ]);
  $("#h-gm").textContent = "Les plus saisonniers ne sont pas tous au sud";
  $("#gm-note").textContent =
    `Écart saisonnier par pays : passagers par jour du mois le plus chargé divisés par ceux du mois le plus creux, l'année choisie dans le calendrier (${L} au départ).`;
  lecture(
    "#chart-gm",
    "plus la couleur est foncée, plus l'été écrase l'hiver ; un clic choisit le pays dans le calendrier.",
  );
  after(
    "#carte-after",
    [
      [`En ${L}, l'Espagne varie moins que l'Allemagne, la Slovaquie plus que Chypre ou Malte.`],
      [`${cap(the(bottom[0]))} et ${the(bottom[1])} sont les moins saisonniers.`],
    ],
    "La carte suit l'année choisie dans le calendrier, en haut de la page.",
  );
}

export function writeInterieurs(Q) {
  const L = Q.last;
  const eu = Q.kinds.find((r) => r.code === EU);
  const el_ = Q.kinds.find((r) => r.code === "EL");
  const countries = Q.kinds.filter((r) => r.code !== EU);
  const odd = countries.filter((r) => r.nat.gap >= r.intl.gap);
  const julyLow = countries.filter((r) => r.nat.low === 7).map((r) => AU[r.code] ?? r.name);
  $("#h-interieurs").textContent = odd.length
    ? `Les vols intérieurs lissent l'année, sauf ${and(odd.map((r) => AU[r.code] ?? r.name))}`
    : "Les vols intérieurs lissent l'année";
  prose("#interieurs-prose", [
    [
      "Dans l'Union, l'écart saisonnier des vols intérieurs est de ",
      { b: d1(eu.nat.gap) },
      ", celui des vols internationaux de ",
      { b: d1(eu.intl.gap) },
      ".",
    ],
  ]);
  $("#h-kd").textContent = "La Grèce, saisonnière surtout à l'international";
  $("#kd-note").textContent =
    `Écart saisonnier des vols intérieurs et des vols internationaux en ${L}, dans les pays où les vols intérieurs font au moins 5 % des passagers (échelle logarithmique).`;
  lecture(
    "#chart-kd",
    "plus les deux points sont éloignés, plus les deux calendriers diffèrent ; survolez un pays pour lire ses mois.",
  );
  after(
    "#interieurs-after",
    [
      [
        "En Grèce, l'écart est de ",
        { b: d1(el_.nat.gap) },
        " pour les vols intérieurs et de ",
        { b: d1(el_.intl.gap) },
        " pour les vols internationaux.",
      ],
      ...(julyLow.length
        ? [[`${cap(and(julyLow))}, juillet est même le mois le plus creux des vols intérieurs.`]]
        : []),
      ...(odd.length
        ? [
            [
              `${cap(and(odd.map(the)))} ${odd.length > 1 ? "font" : "fait"} exception : ${odd.length > 1 ? "leurs" : "ses"} vols intérieurs varient davantage que ${odd.length > 1 ? "leurs" : "ses"} vols internationaux.`,
            ],
          ]
        : []),
    ],
    "Un vol intérieur reste dans le pays (pour la France, l'outre-mer compris) ; un vol international le quitte. Eurostat compte un passager par vol.",
  );
}

export function writeEvolution(Q) {
  const [F0, L] = [Q.first, Q.last];
  const get = (c) => Q.change.find((r) => r.code === c);
  const [bg, is, hr, gr] = [get("BG"), get("IS"), get("HR"), get("EL")];
  const x = (c, m) => Q.perDay(c, L, m) / Q.perDay(c, F0, m);
  $("#h-evolution").textContent = `La Bulgarie a presque divisé par deux son écart saisonnier depuis ${F0}`;
  prose("#evolution-prose", [
    [
      "Dans l'Union, l'écart saisonnier oscille entre ",
      { b: d1(Math.min(...Q.euGaps)) },
      " et ",
      { b: d1(Math.max(...Q.euGaps)) },
      ` depuis ${F0}. Il s'est resserré dans ${Q.narrower.length} pays sur ${Q.change.length}.`,
    ],
  ]);
  $("#h-gaps").textContent = "L'écart se resserre en Bulgarie, il se creuse en Croatie et en Grèce";
  $("#gaps-note").textContent =
    `Écart saisonnier de chaque pays, de ${F0} à ${L}, sur une échelle logarithmique : passagers par jour du mois le plus chargé divisés par ceux du mois le plus creux. Les années 2020 à 2022 sont écartées.`;
  lecture("#chart-gaps", "chaque ligne est un pays ; survolez une ligne grise pour lire son nom.");
  after(
    "#evolution-after",
    [
      [
        "En Bulgarie, il est passé de ",
        { b: d1(bg.from) },
        ` en ${F0} à `,
        { b: d1(bg.to) },
        ` en ${L}. En Islande, de ${d1(is.from)} à ${d1(is.to)}.`,
      ],
      [
        "En Bulgarie, un jour de janvier compte ",
        { b: `${d1(x("BG", 1))} fois` },
        ` plus de passagers qu'en ${F0}, un jour d'août `,
        { b: `${d1(x("BG", 8))} fois` },
        " : l'hiver s'est rempli plus vite que l'été.",
      ],
      [
        "À l'inverse, l'écart s'est creusé en Croatie, de ",
        { b: d1(hr.from) },
        " à ",
        { b: d1(hr.to) },
        `. En Grèce, de ${d1(gr.from)} à ${d1(gr.to)}.`,
      ],
      ["Jusqu'en 2019, l'Espagne était plus saisonnière que l'Allemagne. Depuis 2023, c'est l'inverse."],
    ],
    "Un écart qui se resserre peut venir d'un hiver qui se remplit ou d'un été qui se vide : il faut regarder les mois eux-mêmes, comme pour la Bulgarie. Les chiffres disent quand on vole, pas pourquoi.",
  );
}

export function writeReponse(Q) {
  const L = Q.last;
  const [hr, ue, fi] = [Q.at("HR", L), Q.at(EU, L), Q.at("FI", L)];
  prose("#reponse-prose", [
    [`Partout en Europe, l'été remplit les avions et janvier les vide : dans l'Union, ${dayWords(ue)}.`],
    [
      "Mais chaque pays a son calendrier, de la Croatie (",
      { b: times(hr.gap) },
      ") à la Finlande (",
      { b: times(fi.gap) },
      "), et les vols intérieurs lissent l'année presque partout.",
    ],
    [
      `Ce calendrier bouge : l'écart s'est resserré dans ${Q.narrower.length} pays sur ${Q.change.length} depuis ${Q.first}. Les données disent quand on vole, pas pourquoi.`,
    ],
  ]);
}
