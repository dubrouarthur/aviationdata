// The words of the fourth investigation. Every number comes from facts.js; web/scripts/check_eu.py
// recomputes each of them from eu.json and compares with the page.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { monthLabel, mio, pct } from "./charts.js";
import { km } from "./facts.js";

/** 1 093 600 000 -> "1,09 milliard" ; 172 000 000 -> "172,0 millions" */
export const big = (v) =>
  v >= 1e9 ? `${fmtNum(v / 1e9, 2)} milliard${v >= 2e9 ? "s" : ""}` : `${fmtNum(v / 1e6, 1)} millions`;
const up = (v, d = 0) => `${fmtNum(Math.abs(v), d)} %`;
const kmTxt = (v) => `${fmtNum(Math.round(v))} km`;
/** 550 000 -> "550 000 passagers" ; 12 000 000 -> "12,0 M de passagers" */
const paxWords = (v) => (v >= 1e6 ? `${mio(v)} de passagers` : `${mio(v)} passagers`);

function prose(sel, paragraphs) {
  const node = $(sel);
  if (!node) return;
  node.replaceChildren(...paragraphs.map((p) => el("p", {}, rich(p))));
}

function after(sel, paragraphs, aside) {
  prose(sel, paragraphs);
  if (!aside) return;
  const node = $(sel);
  node.append(
    el("aside", { class: "story-aside" }, [
      el("b", { text: "À savoir" }),
      rich(Array.isArray(aside) ? aside : [aside]),
    ]),
  );
}

export function writeOpening(F) {
  const U = F.union;
  prose("#open-dek", [
    [
      `En ${F.last}, les avions ont transporté `,
      { b: `${big(U.now)} de passagers` },
      " dans l'Union européenne, un record. Mais la reprise d'après-Covid n'a pas eu lieu partout : la plupart des pays du Sud et de l'Est dépassent nettement 2019, l'Allemagne, la Finlande et la Suède restent en dessous. Vingt ans de données d'Eurostat, pays par pays et aéroport par aéroport.",
    ],
  ]);
}

export function writeEssentiel(F) {
  const U = F.union;
  const fi = F.vs.find((c) => c.code === "FI");
  const de = F.vs.find((c) => c.code === "DE");
  const natDE = F.nat.find((n) => n.code === "DE");
  const natSE = F.nat.find((n) => n.code === "SE");
  const items = [
    [
      "record",
      `${fmtNum(U.now / 1e9, 2)} Md`,
      "Le Covid est-il effacé ?",
      [
        `Oui. En ${F.last}, l'Union compte `,
        { b: `${big(U.now)} de passagers aériens` },
        ` (un aller-retour compte deux fois), ${up(U.vs2019, 1)} de plus qu'en 2019. Elle avait retrouvé son niveau d'avant-Covid dès ${U.back}.`,
      ],
    ],
    [
      "sud",
      `${F.above.length} sur ${F.vs.length}`,
      "Partout ?",
      [
        `Non : ${F.below.length} pays restent sous 2019, dont la Finlande (`,
        { b: pct(fi.change) },
        ") et l'Allemagne (",
        { b: pct(de.change) },
        "). Malte et la Pologne dépassent 2019 de plus d'un tiers.",
      ],
    ],
    [
      "interieur",
      pct(natDE.change),
      "Et les vols intérieurs ?",
      [
        `Ils reculent dans ${F.natDown.length} pays sur ${F.nat.length}. L'Allemagne en a perdu près de la moitié depuis 2019, la Suède `,
        { b: up(natSE.change) },
        ". Ils progressent en Espagne, en Italie, en Grèce et au Portugal.",
      ],
    ],
    [
      "gravite",
      kmTxt(F.bary.since2019),
      "Le ciel a-t-il bougé ?",
      [
        "Le centre de gravité des passagers des aéroports européens a glissé de ",
        { b: kmTxt(F.bary.since2019) },
        " vers le sud depuis 2019.",
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

/** The opening map's caption and its line under the year slider. */
export function openNote(data) {
  $("#open-note").textContent =
    `Chaque cercle est un aéroport de l'Union ou de l'AELE, à la taille de ses passagers de l'année ; après 2019, en orangé s'il en compte plus qu'en 2019, en bleu s'il en compte moins. Le trait blanc suit le centre de gravité de ces passagers depuis ${data.airportYears[0]}.`;
}

export function yearReadout(F, data) {
  const z = F.eu;
  return (y) => {
    const i = data.years.indexOf(y);
    const node = document.getElementById("ey-read");
    if (!node) return;
    const v = z.total[i];
    node.replaceChildren(
      rich([
        "Union européenne, ",
        String(y),
        " : ",
        { b: `${big(v)} de passagers` },
        y > 2019 ? `, ${pct(100 * (v / z.total[data.years.indexOf(2019)] - 1), 1)} par rapport à 2019.` : ".",
      ]),
    );
  };
}

/* ------------------------------------------------------------------ the dashboard */
export const KEYS = [
  ["total", "Tous les vols"],
  ["nat", "Vols intérieurs"],
  ["intl", "Vols internationaux"],
];
const keyWords = { total: "tous vols", nat: "vols intérieurs", intl: "vols internationaux" };

export function writeTableau(F) {
  prose("#tableau-prose", [
    [
      "Chaque pays a vécu sa propre reprise. Ses passagers, mois par mois depuis 2004, la saison qui les remplit, la part de ses vols intérieurs et de ses voisins de l'Union, et ses aéroports, d'après les déclarations des aéroports à Eurostat.",
    ],
  ]);
}

/** The readout over the dashboard and the titles of its figures, for a zone and a kind of flight. */
export function writeBoard(data, zone, key, Z) {
  const name = zone.name;
  const kw = keyWords[key];
  const parts = [{ b: name }, `, ${kw}, ${Z.last} : `, { b: `${mio(Z.now)} de passagers` }];
  if (Z.vs2019 != null) parts.push(", ", { b: pct(Z.vs2019, 1) }, " par rapport à 2019");
  parts.push(`. Record mensuel : ${monthLabel(Z.recordMonth)} (${mio(Z.recordValue)}).`);
  $("#board-readout").replaceChildren(el("p", {}, rich(parts)));

  $("#h-board-month").textContent = `${name} : le record date de ${monthLabel(Z.recordMonth)}`;
  $("#board-month-note").textContent =
    `Passagers transportés chaque mois, ${kw}, de ${monthLabel(zone.monthStart)} à ${monthLabel(zone.monthLast)}. Un passager compte une fois par vol.`;
  lecture(
    "#chart-board-month",
    "survolez la courbe pour lire chaque mois ; les deux points marquent le record et le mois le plus creux.",
  );

  // summer against winter, in the last complete year: July and August against January and February
  const at = (m) => Z.series[Z.months.indexOf(m)];
  const y = Z.last;
  const summer = (at(`${y}-07`) + at(`${y}-08`)) / 2;
  const winter = (at(`${y}-01`) + at(`${y}-02`)) / 2;
  $("#h-board-heat").textContent = `En ${y}, un mois d'été vaut ${fmtNum(summer / winter, 1)} mois d'hiver`;
  $("#board-heat-note").textContent =
    `Passagers transportés chaque mois (${kw}), une ligne par année ; juillet et août rapportés à janvier et février.`;
  lecture(
    "#chart-board-heat",
    "plus la case est foncée, plus le mois a compté de passagers ; une case vide est un mois sans donnée.",
  );

  const iL = data.years.indexOf(Z.last);
  const nat = zone.nat[iL];
  const tot = zone.total[iL];
  $("#h-board-parts").textContent =
    `${name} : ${fmtNum((100 * nat) / tot, 0)} % de passagers intérieurs en ${Z.last}`;
  $("#board-parts-note").textContent =
    "Passagers transportés par an : vols intérieurs, vers un autre pays de l'Union, et hors de l'Union.";
}

export function writeAirports(zone, rows, last, years) {
  const i19 = years.indexOf(2019);
  const iL = years.indexOf(last);
  const n = rows.filter((a) => a.pax[i19] && a.pax[iL] > a.pax[i19]).length;
  const withBoth = rows.filter((a) => a.pax[i19] && a.pax[iL]).length;
  $("#h-board-apt").textContent =
    zone.code === "EU27_2020"
      ? `Les ${rows.length} premiers aéroports : ${n} sur ${withBoth} au-dessus de 2019`
      : `${zone.name} : ${n} aéroport${n > 1 ? "s" : ""} sur ${withBoth} au-dessus de 2019`;
  $("#board-apt-note").textContent =
    `Passagers transportés par aéroport (départs et arrivées, correspondances comprises), les ${rows.length} premiers en ${last}${zone.code === "EU27_2020" ? " dans l'Union et l'AELE" : ""}.`;
}

/* ------------------------------------------------------------------ chapters */
export function writeRecord(F) {
  const U = F.union;
  $("#h-record").textContent = "Le Covid effacé, le record battu";
  prose("#record-prose", [
    [
      "En 2020, l'Union a perdu ",
      { b: up(U.drop2020) },
      ` de ses passagers aériens. En ${monthLabel(U.low)}, le pire mois, elle comptait `,
      { b: up(U.lowDrop) },
      ` de passagers en moins qu'un an plus tôt.`,
    ],
  ]);
  const p19 = U.parts(2019);
  const pL = U.parts(F.last);
  const ch = (k) => 100 * (pL[k] / p19[k] - 1);
  $("#h-union").textContent = "Les vols entre pays de l'Union portent la reprise";
  $("#union-note").textContent =
    "Passagers transportés par an dans l'Union européenne (27 pays), selon le type de vol. Un passager entre deux pays de l'Union compte une fois.";
  lecture("#chart-union", "chaque barre est une année ; survolez-la pour lire ses trois parts.");
  after(
    "#record-after",
    [
      [
        `Le trafic repasse au-dessus de 2019 en ${U.back}, avec `,
        { b: `${big(U.backValue)} de passagers` },
        `. Il bat un nouveau record en ${F.last} : `,
        { b: big(U.now) },
        ".",
      ],
      [
        "Depuis 2019, les passagers des vols entre pays de l'Union ont augmenté de ",
        { b: up(ch("ieu")) },
        ", ceux des vols vers le reste du monde de ",
        { b: up(ch("xeu")) },
        `. Ceux des vols intérieurs ont reculé de ${up(ch("nat"))}.`,
      ],
      [
        `Les premiers mois de ${U.lastMonth.slice(0, 4)} poursuivent la hausse : de janvier à ${monthLabel(U.lastMonth).split(" ")[0]}, `,
        { b: pct(U.partial.change, 1) },
        " par rapport aux mêmes mois de l'année précédente.",
      ],
    ],
    "Ces chiffres comptent des passagers à chaque vol : un aller-retour compte deux fois, un voyage avec correspondance aussi. Ils ne disent pas combien de personnes ont pris l'avion.",
  );
}

export function writeSud(F) {
  const get = (c) => F.vs.find((x) => x.code === c);
  const [mt, pl] = [get("MT"), get("PL")];
  const [fi, se, de, nl] = [get("FI"), get("SE"), get("DE"), get("NL")];
  const Z = F.Z;
  const ratio = (c) => Z[c].total.at(-1) / Z[c].total[F.yearsIdx(2008)];
  $("#h-sud").textContent = `${F.above.length} pays au-dessus de 2019, l'Allemagne et le Nord en dessous`;
  prose("#sud-prose", [
    [
      `${F.above.length} pays sur ${F.vs.length} dépassent leur niveau de 2019 en ${F.last}. Les plus fortes hausses sont à Malte (`,
      { b: pct(mt.change) },
      ") et en Pologne (",
      { b: pct(pl.change) },
      ").",
    ],
  ]);
  $("#h-choro").textContent = `${F.below.length} pays sous leur niveau de 2019`;
  $("#choro-note").textContent = `Passagers transportés en ${F.last} par rapport à 2019, par pays.`;
  lecture(
    "#chart-choro",
    "les pays en orangé dépassent 2019, ceux en bleu restent en dessous ; un clic ouvre le pays dans le tableau de bord.",
  );
  $("#h-rank").textContent = "Malte et la Pologne en tête, la Finlande et la Suède en queue";
  $("#rank-note").textContent = `Évolution des passagers transportés entre 2019 et ${F.last}, en %.`;
  after(
    "#sud-after",
    [
      [
        "En bas du classement, la Finlande (",
        { b: pct(fi.change) },
        ") et la Suède (",
        { b: pct(se.change) },
        ") ont perdu près d'un passager sur cinq.",
      ],
      [
        "Sous 2019 aussi : l'Allemagne (",
        { b: pct(de.change) },
        ") et les Pays-Bas (",
        { b: pct(nl.change) },
        ").",
      ],
      ["Trois pays moins peuplés complètent la liste : la Lettonie, la Slovénie et la Norvège."],
      [
        "Sur un temps plus long, la Pologne a multiplié ses passagers par ",
        { b: fmtNum(ratio("PL"), 1) },
        " depuis 2008, la Roumanie par ",
        { b: fmtNum(ratio("RO"), 1) },
        ".",
      ],
    ],
    "Ces écarts décrivent la reprise de chaque pays, ils ne l'expliquent pas : Eurostat compte des passagers, pas les raisons de leur voyage ni celles des compagnies qui ouvrent ou ferment des lignes.",
  );
}

export function writeInterieur(F) {
  const get = (c) => F.nat.find((x) => x.code === c);
  const [de, se, fi, fr, at] = [get("DE"), get("SE"), get("FI"), get("FR"), get("AT")];
  const U = F.union;
  $("#h-interieur").textContent = "Les vols intérieurs reculent presque partout";
  prose("#interieur-prose", [
    [
      "En Allemagne, les passagers des vols intérieurs sont passés de ",
      { b: mio(de.y2019) },
      ` en 2019 à `,
      { b: mio(de.now) },
      ` en ${F.last}.`,
    ],
    [
      `Seule l'Autriche, aux vols intérieurs bien plus rares (${paxWords(at.y2019)} en 2019), recule davantage.`,
    ],
  ]);
  $("#h-nat").textContent =
    `Moins de passagers intérieurs qu'en 2019 dans ${F.natDown.length} pays sur ${F.nat.length}`;
  $("#nat-note").textContent =
    `Passagers des vols intérieurs, 2019 et ${F.last}, pays d'au moins 500 000 passagers intérieurs en 2019.`;
  lecture(
    "#chart-nat",
    "le point creux marque 2019, le point plein la dernière année ; en bleu les baisses, en orangé les hausses.",
  );
  after(
    "#interieur-after",
    [
      ["La Suède (", { b: pct(se.change) }, ") et la Finlande (", { b: pct(fi.change) }, ") suivent."],
      [
        "La France perd ",
        { b: up(fr.change) },
        " de ses passagers intérieurs. À l'inverse, l'Espagne, l'Italie, la Grèce et le Portugal en comptent plus qu'en 2019.",
      ],
      [
        "Dans l'Union, les vols intérieurs ne font plus que ",
        { b: `${fmtNum(U.natShare(F.last), 1)} %` },
        " des passagers, contre ",
        { b: `${fmtNum(U.natShare(2008), 1)} %` },
        " en 2008.",
      ],
    ],
    "Un vol intérieur relie deux aéroports d'un même pays : pour la France, cela comprend les liaisons avec l'outre-mer ; pour l'Espagne, l'Italie, la Grèce et le Portugal, celles avec leurs îles.",
  );
}

export function writeAeroports(F) {
  const L = F.last;
  const mad = F.apt("LEMD", L);
  const fra = F.apt("EDDF", L);
  const cdg = F.apt("LFPG", L);
  const cdg19 = F.apt("LFPG", 2019);
  const ath = F.apt("LGAV", L);
  const ath19 = F.apt("LGAV", 2019);
  const fra19 = F.apt("EDDF", 2019);
  const fraFirst = F.rank(2008).find((a) => a.code === "EDDF");
  const lastSecond = F.airportYears.filter((y) => F.apt("EDDF", y).rank === 2).at(-1);
  const madAhead = F.airportYears.find((y) => F.apt("LEMD", y).rank < F.apt("EDDF", y).rank && y > 2008);
  const ch = (a, b) => 100 * (a.pax / b.pax - 1);
  const rom = F.apt("LIRF", L);
  const rom19 = F.apt("LIRF", 2019);
  $("#h-aeroports").textContent = "Francfort recule, Madrid et Rome montent";
  prose("#aeroports-prose", [
    [
      `Francfort était le ${fraFirst.rank}e aéroport de l'Union et de l'AELE jusqu'en ${lastSecond}. Il est ${fra.rank}e depuis ${madAhead}, derrière Madrid-Barajas.`,
    ],
    [`En ${L}, Madrid compte `, { b: mio(mad.pax) }, " de passagers, Francfort ", { b: mio(fra.pax) }, "."],
  ]);
  $("#h-bump").textContent = "Le classement des aéroports depuis 2008";
  $("#bump-note").textContent =
    `Rang de chaque aéroport par ses passagers transportés, ${F.airportYears[0]}-${L}, les douze premiers de chaque année.`;
  lecture(
    "#chart-bump",
    "chaque ligne est un aéroport ; plus elle est haute, mieux il est classé ; survolez un point pour lire ses passagers.",
  );
  after(
    "#aeroports-after",
    [
      [
        "Paris-Charles-de-Gaulle reste premier, avec ",
        { b: mio(cdg.pax) },
        ", mais sous son niveau de 2019 (",
        { b: mio(cdg19.pax) },
        ").",
      ],
      [
        "Francfort a perdu ",
        { b: up(ch(fra, fra19)) },
        " de ses passagers depuis 2019, Rome-Fiumicino en a gagné ",
        { b: up(ch(rom, rom19)) },
        ".",
      ],
      [
        `Athènes passe de la ${ath19.rank}e place en 2019 à la ${ath.rank}e en ${L}, avec `,
        { b: pct(ch(ath, ath19)) },
        " de passagers.",
      ],
    ],
    "Un aéroport compte ses départs et ses arrivées, et deux fois un passager en correspondance : à fréquentation égale, un aéroport où l'on change d'avion pèse plus lourd dans ce classement qu'un aéroport où l'on arrive et d'où l'on part.",
  );
}

export function writeGravite(F) {
  const B = F.bary;
  $("#h-gravite").textContent = `Le centre de gravité a glissé de ${kmTxt(B.since2019)} vers le sud`;
  prose("#gravite-prose", [
    [
      "Chaque année, on peut placer le centre de gravité des passagers des aéroports européens : la moyenne de leurs positions, pondérée par leur trafic. Depuis 2019, il est descendu de ",
      { b: kmTxt(B.since2019) },
      ".",
    ],
  ]);
  $("#h-bary").textContent = `Au nord jusqu'en ${B.north.y}, puis cap au sud`;
  $("#bary-note").textContent =
    `Centre de gravité des passagers des aéroports de l'Union et de l'AELE, chaque année de ${F.airportYears[0]} à ${F.last}, avec les aéroports voisins comme repères.`;
  lecture(
    "#chart-bary",
    "chaque point est une année ; le trait orangé part de 2019 ; survolez un point pour lire sa position.",
  );
  const share = (y) => F.bary.byYear(y).south45;

  after(
    "#gravite-after",
    [
      [
        `Jusqu'en ${B.north.y}, il remontait vers le nord-est. Depuis, il redescend, et le Covid l'a envoyé au plus bas en 2021 : cette année-là, les aéroports du Sud ont perdu moins de passagers que ceux du Nord.`,
      ],
      [
        "Les aéroports situés au sud du 45e parallèle, qui passe près de Bordeaux et de Turin, accueillent ",
        { b: `${fmtNum(share(F.last), 1)} %` },
        ` des passagers en ${F.last}, contre `,
        { b: `${fmtNum(share(2019), 1)} %` },
        " en 2019.",
      ],
    ],
    "Le centre de gravité ne bouge que si la répartition des passagers change : une hausse égale partout le laisserait en place. Les aéroports d'outre-mer et du Svalbard ne comptent pas dans ce calcul ; les Canaries, les Açores et Madère y sont.",
  );
}

export function writeReponse(F) {
  const U = F.union;
  prose("#reponse-prose", [
    [
      "Oui, le transport aérien européen a effacé le Covid : ",
      { b: `${big(U.now)} de passagers` },
      ` dans l'Union en ${F.last}, un record. Mais la reprise a déplacé le ciel européen.`,
    ],
    [
      `La plupart des pays du Sud et de l'Est dépassent nettement 2019 ; ${F.below.length} pays restent en dessous, dont l'Allemagne, la Finlande et la Suède. Les vols intérieurs reculent presque partout, sauf en Espagne, en Italie, en Grèce et au Portugal.`,
    ],
    [
      "Le centre de gravité des passagers a glissé de ",
      { b: kmTxt(F.bary.since2019) },
      " vers le sud depuis 2019. Les données disent où les passagers volent, pas pourquoi : ce sera l'objet d'autres enquêtes.",
    ],
  ]);
}

export { km };
