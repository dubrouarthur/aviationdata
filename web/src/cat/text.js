// The words of « Le ciel clair est-il plus agité ? ». Every number comes from catFacts() (facts.js) and is
// recomputed by web/scripts/check_cat.py. House rules (CLAUDE.md): a chapter title and a figure title state
// findings, a « Lecture » line says how to read a figure, at most two numbers in a sentence, no cause
// asserted. The data describe conditions favourable to clear-air turbulence in a reanalysis, never the
// turbulence felt on board: the text says « conditions propices ».
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { essentialSteps } from "../site/story.js";
import { TSOURCES, FACTS } from "./sources.js";
import { MONTHS_FR, SEASON_FR, SEASON_NAME, CRUISE_KMH, flightMinutes, routeMinutes } from "./facts.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(v, 0);
const pc = (v, d = 1) => `${fmtNum(v * 100, d)} %`;
/** a change, signed: +38 %, −4 % */
const chg = (r) => (Math.abs(r) < 0.005 ? "0 %" : `${r >= 0 ? "+" : "−"}${fmtNum(Math.abs(r) * 100, 0)} %`);
/** hours a year of a frequency, to the nearest five (to the hour under 50: 15 against 25 would overstate 17 against 24) */
const hrs = (f) => {
  const h = f * 8766;
  return `${n0(h < 50 ? Math.round(h) : Math.round(h / 5) * 5)} heures`;
};
/** a frequency as « une heure sur 37 » */
const oneIn = (f) => `une heure sur ${n0(Math.round(1 / f))}`;
/** minutes, whole */
const mins = (m) => `${n0(Math.round(m))} minutes`;
/** a flight time to the nearest five minutes: « 6 h 30 » */
const dur = (m) => {
  const t = Math.round(m / 5) * 5;
  return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")}`;
};
const WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** "près de deux fois", "trois fois", "1,6 fois" */
const times = (r) => {
  const n = Math.round(r);
  if (n >= 2 && n <= 10 && Math.abs(r - n) < 0.15) {
    const q = r < n - 0.03 ? "près de " : r > n + 0.03 ? "plus de " : "";
    return `${q}${WORDS[n]} fois`;
  }
  return `${fmtNum(r, 1)} fois`;
};
const lat = (la) => `${n0(Math.abs(la))}° ${la >= 0 ? "N" : "S"}`;
const decade = (F, end) => (end ? `${F.last - 9}-${F.last}` : `${F.first}-${F.first + 9}`);
export const fmt = { n0, pc, chg, hrs, times, lat, oneIn, mins, dur };
/** the article each region's name takes */
const NAMES = {
  atlantique: { le: "l'Atlantique Nord", de: "de l'Atlantique Nord" },
  pacifique: { le: "le Pacifique Nord", de: "du Pacifique Nord" },
  europe: { le: "l'Europe", de: "de l'Europe" },
  amerique: { le: "les États-Unis", de: "des États-Unis" },
  asie: { le: "l'Asie de l'Est", de: "de l'Asie de l'Est" },
};
const le = (r) => NAMES[r.key].le;
const de = (r) => NAMES[r.key].de;
const above = (r) => `au-dessus ${de(r)}`;

/** « a augmenté de 38 % », « a baissé de 4 % », « n'a presque pas changé » */
const moved = (r) =>
  Math.abs(r) < 0.03
    ? "n'a presque pas changé"
    : r > 0
      ? `a augmenté de ${pc(r, 0)}`
      : `a baissé de ${pc(-r, 0)}`;

export function writeOpening(F) {
  $("#tc-open-cap").textContent =
    `Part du temps où l'indice d'Ellrod dépasse, au niveau de vol 340 (environ 10 400 m), le seuil des situations les plus fortes du globe (${pc(F.pctSev, 2)} des analyses), en moyenne sur chaque décennie, même échelle pour les deux cartes. En pointillés, Paris – New York. Heures par an : le temps cumulé où l'air réunit ces conditions, en moyenne sur les points de l'Atlantique Nord (40-65° N, 70-10° O).`;
  const atl = F.atl;
  $("#open-dek").replaceChildren(
    rich([
      `Au-dessus de l'Atlantique Nord, à l'altitude de croisière des avions de ligne, le vent réunit les conditions de la turbulence en air clair environ `,
      { b: hrs(atl.clim) },
      ` par an, ${times(F.atlWinterOverSummer)} plus l'hiver que l'été. De la décennie ${decade(F, false)} à la décennie ${decade(F, true)}, leur fréquence y ${moved(atl.change)}. ${
        F.up.length === F.local.length
          ? "Elle augmente aussi sur les quatre autres grandes régions de vol."
          : `Elle augmente sur ${WORDS[F.up.length]} des cinq grandes régions de vol.`
      }`,
    ]),
  );
}

/** what is counted: the two thresholds and the hours, in plain words, before the essentials */
export function writeMeasure(F) {
  $("#tc-measure").replaceChildren(
    el("p", { class: "tc-measure-h", text: "Ce que l'on compte" }),
    el("dl", {}, [
      el("div", {}, [
        el("dt", { text: "Conditions propices" }),
        el("dd", {}, rich([
          `Le vent réunit les ingrédients de la turbulence en air clair à un niveau qu'il n'atteint que dans ${pc(F.pctMod, 1)} des situations du globe, `,
          { b: oneIn(F.pctMod) },
          ". C'est la mesure de toute l'enquête.",
        ])),
      ]),
      el("div", {}, [
        el("dt", { text: "Conditions les plus fortes" }),
        el("dd", {}, rich([
          `Un niveau ${F.pctMod / F.pctSev >= 10 ? "plus de dix fois" : times(F.pctMod / F.pctSev)} plus rare, ${pc(F.pctSev, 2)} des situations. C'est la mesure des deux cartes d'ouverture.`,
        ])),
      ]),
      el("div", {}, [
        el("dt", { text: "Des heures par an" }),
        el("dd", {}, rich([
          "Chaque fréquence devient un temps cumulé sur une année : ",
          { b: "1 % du temps, c'est 88 heures par an" },
          ". Ce sont des heures où l'air s'y prête, pas des heures de secousses.",
        ])),
      ]),
    ]),
  );
}

export function writeEssentiel(F) {
  const [top, second] = F.byClim;
  essentialSteps([
    {
      id: "carte",
      q: "Où le ciel clair est-il le plus agité ?",
      n: hrs(top.clim),
      lead: `par an de conditions propices à la turbulence ${above(top)}, la plus exposée des grandes régions de vol.`,
      more: [`Puis ${le(second)}, `, { b: hrs(second.clim) }, `. L'Europe, ${hrs(F.regions.europe.clim)}.`],
    },
    {
      id: "saisons",
      q: "À quelle saison ?",
      n: times(F.atlWinterOverSummer),
      lead: "plus de conditions propices l'hiver que l'été au-dessus de l'Atlantique Nord.",
      more: [
        `Dans l'hémisphère nord, la bande la plus agitée descend jusqu'à ${lat(F.north.lat)} en ${MONTHS_FR[F.north.month]}.`,
      ],
    },
    {
      id: "altitude",
      q: "À quelle altitude ?",
      n: `niveau ${n0(F.topLevel.fl)}`,
      lead: `(environ ${n0(Math.round((F.topLevel.fl * 30.48) / 100) * 100)} mètres) : c'est là que ces conditions sont les plus fréquentes, dans l'hémisphère nord.`,
      more: [`Au niveau 390, ${times(F.topLevel.freq / F.levels[0].freq)} moins.`],
    },
    {
      id: "routes",
      q: "Et sur un Paris – New York ?",
      n: mins(routeMinutes(F.pny, "DJF")),
      lead: `sur les ${dur(flightMinutes(F.pny))} du trajet traversent en moyenne des conditions propices, de décembre à février.`,
      more: ["L'été, ", { b: mins(routeMinutes(F.pny, "JJA")) }, "."],
    },
    {
      id: "tendance",
      q: "Ces conditions sont-elles plus fréquentes qu'avant ?",
      n: chg(F.atl.change),
      lead: `au-dessus de l'Atlantique Nord, de la décennie ${decade(F, false)} à la décennie ${decade(F, true)}.`,
      more: [
        `Les plus fortes, ${chg(F.atl.sevChange)}. `,
        F.up.length === F.local.length
          ? "Elles augmentent sur les cinq grandes régions de vol."
          : `Elles augmentent sur ${WORDS[F.up.length]} des cinq grandes régions de vol.`,
      ],
    },
  ]);
}

export function writeOu(F) {
  const [top, second, third] = F.byClim;
  // ------------------------------------------------------------ chapter 1: the map
  $("#h-carte").textContent = "Le ciel clair s'agite le long des courants-jets";
  $("#carte-prose").replaceChildren(
    p([
      "La turbulence en air clair secoue les avions loin de tout nuage, là où le vent change brutalement de force ou de direction. Les radars de bord ne la voient pas. À l'altitude de croisière, ses conditions se concentrent dans des couloirs : ceux des courants-jets, ces fleuves de vent d'ouest qui font le tour de la planète.",
    ]),
  );
  $("#h-map-fig").textContent = "Trois couloirs au nord, un au sud";
  $("#map-note").textContent =
    `Part des analyses où l'indice d'Ellrod dépasse le seuil des conditions propices (${pc(F.pctMod, 1)} des situations du globe), au niveau de vol 340 (250 hPa, environ 10 400 m), toutes saisons, ${F.first}-${F.last}, en %.`;
  lecture(
    "#chart-map",
    `chaque case fait 1,5° de côté. À 2 %, les conditions sont réunies 2 % du temps, environ 175 heures par an. Au-delà de 78° de latitude, la grille est trop serrée pour l'indice.`,
  );
  $("#carte-after").replaceChildren(
    p([
      `Parmi les grandes régions de vol, ${le(top)} ${top.key === "amerique" ? "sont" : "est"} la plus exposée : `,
      { b: hrs(top.clim) },
      ` par an. Viennent ensuite ${le(second)}, ${hrs(second.clim)}, et ${le(third)}, ${hrs(third.clim)}.`,
    ]),
    p([
      `L'Europe, plus au nord des courants-jets, en compte ${hrs(F.regions.europe.clim)}. Les États-Unis, ${hrs(F.regions.amerique.clim)}.`,
    ]),
  );
  $("#carte-aside").replaceChildren(
    rich([
      `L'indice mesure des conditions, pas les secousses vécues à bord. Il est calculé sur une grille d'un degré et demi, environ 165 km, qui adoucit le vent : les tourbillons qui secouent un avion font quelques centaines de mètres. C'est pourquoi l'enquête ne retient pas de valeur absolue, mais un niveau rare : celui que le vent ne dépasse que dans ${pc(F.pctMod, 1)} des situations du globe, comme le fait la recherche sur le sujet.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 2: the seasons
  const atl = F.atl;
  $("#h-saisons").textContent =
    `L'hiver, ${times(F.atlWinterOverSummer)} plus qu'en été sur l'Atlantique Nord`;
  $("#saisons-prose").replaceChildren(
    p([
      "L'hiver, l'écart de température entre le pôle et les tropiques se creuse, et le courant-jet se renforce. Les conditions de la turbulence en air clair suivent.",
    ]),
  );
  $("#h-seasons-fig").textContent = "Le nord s'agite de décembre à février, le sud de juin à août";
  $("#seasons-note").textContent =
    `Part des analyses aux conditions propices, au niveau de vol 340, pour chaque saison, ${F.first}-${F.last}, en %. Même échelle pour les quatre cartes.`;
  lecture(
    "#chart-seasons",
    "chaque carte est une saison ; plus la couleur va vers le magenta, plus les conditions sont fréquentes.",
  );
  const nWinter = F.local.filter((r) => r.peakSeason === "DJF").length;
  $("#saisons-after").replaceChildren(
    p([
      `Au-dessus de l'Atlantique Nord, ces conditions sont réunies `,
      { b: oneIn(atl.seasonClim.DJF) },
      ` ${SEASON_FR.DJF}, contre ${oneIn(atl.seasonClim.JJA)} ${SEASON_FR.JJA}.`,
    ]),
    p([
      nWinter === F.local.length
        ? "Les cinq grandes régions de vol du nord ont toutes leur saison la plus agitée en hiver."
        : `${cap(WORDS[nWinter])} des cinq grandes régions de vol du nord ont leur saison la plus agitée en hiver.`,
      ` L'écart est le plus fort au-dessus des États-Unis : ${times(F.regions.amerique.seasonClim.DJF / F.regions.amerique.seasonClim.JJA)} plus l'hiver que l'été.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 3: latitudes
  const nl = F.northLat;
  const summerLat = Math.max(...nl.slice(5, 8));
  $("#h-latitudes").textContent = "La bande agitée monte vers le pôle l'été";
  $("#latitudes-prose").replaceChildren(
    p([
      `Dans l'hémisphère nord, la bande la plus agitée passe à ${lat(F.north.lat)} en ${MONTHS_FR[F.north.month]}. L'été, elle remonte vers ${lat(summerLat)}.`,
    ]),
  );
  $("#h-lat-fig").textContent = "Deux bandes qui suivent les saisons";
  $("#lat-note").textContent =
    `Part des analyses aux conditions propices au niveau de vol 340, tout autour du globe, par latitude et par mois, ${F.first}-${F.last}, en %.`;
  lecture(
    "#chart-lat",
    "chaque ligne est une latitude, du pôle Nord en haut au pôle Sud en bas ; chaque colonne est un mois.",
  );
  $("#latitudes-after").replaceChildren(
    p([
      `L'hémisphère sud a sa propre bande : à ${lat(F.south.lat)} en ${MONTHS_FR[F.south.month]}, les conditions y sont réunies `,
      { b: oneIn(F.south.freq) },
      Math.round(1 / F.south.freq) === Math.round(1 / F.north.freq)
        ? ", autant qu'au plus fort du nord."
        : `, contre ${oneIn(F.north.freq)} au plus fort du nord.`,
    ]),
    p(["Beaucoup moins d'avions y passent : les grandes routes sont au nord."]),
  );
}

export function writeAltitude(F) {
  const [l200, l250, l300] = F.levels;
  $("#h-altitude").textContent =
    F.topLevel.fl === 390
      ? "Plus haut, plus de conditions propices"
      : `Au niveau ${n0(F.topLevel.fl)}, ${times(F.topLevel.freq / l200.freq)} plus qu'au niveau 390`;
  $("#altitude-prose").replaceChildren(
    p([
      "Un avion de ligne vole entre 9 000 et 12 000 mètres. Le courant-jet a son cœur vers 10 000 mètres : c'est autour de lui que le vent change le plus avec l'altitude.",
    ]),
  );
  $("#h-levels-fig").textContent = "Le cœur du courant-jet, le plus exposé";
  $("#levels-note").textContent =
    `Part des analyses aux conditions propices à trois niveaux de vol, par latitude, tout autour du globe, ${F.first}-${F.last}, en %. Les chiffres du texte sont ceux de l'hémisphère nord, entre 25° et 78° N.`;
  lecture(
    "#chart-levels",
    "une coupe de l'atmosphère, du pôle Sud à gauche au pôle Nord à droite : chaque bande est un niveau de vol, en centaines de pieds (340 veut dire 34 000 pieds). Plus la couleur fonce, plus les conditions sont fréquentes ; le cadre marque la latitude la plus agitée de chaque niveau et de chaque hémisphère.",
  );
  $("#altitude-after").replaceChildren(
    p([
      `Au niveau 340, ces conditions sont réunies `,
      { b: oneIn(l250.freq) },
      ` dans l'hémisphère nord ; au niveau 300, ${oneIn(l300.freq)}.`,
    ]),
    p([
      `Au niveau 390, au-dessus du cœur du courant-jet, ${oneIn(l200.freq)} seulement. Le seuil est le même aux trois niveaux.`,
    ]),
  );
}

export function writeRoutes(F) {
  const paris = F.routes.filter((r) => r.key.startsWith("CDG")).sort((a, b) => b.seasons.DJF - a.seasons.DJF);
  const [r1, r2] = paris;
  const low = paris.at(-1);
  const other = F.routes.find((r) => !r.key.startsWith("CDG"));
  const tokyo = F.routes.find((r) => r.key === "CDG-NRT");
  $("#h-routes").textContent = `Vers l'Amérique du Nord, les routes les plus agitées depuis Paris`;
  $("#routes-prose").replaceChildren(
    p([
      `Combien de minutes d'un vol passent dans des conditions propices ? On suit chaque route par le plus court chemin, à 10 400 mètres et ${n0(CRUISE_KMH)} km/h, et l'on compte, point par point, le temps passé là où l'air s'y prête, en moyenne sur ${F.nYears} ans.`,
    ]),
  );
  $("#h-routes-fig").textContent = "Les routes qui traversent les courants-jets";
  $("#routes-note").textContent =
    `Les routes depuis Paris en grand cercle, colorées point par point par la part des analyses aux conditions propices, au niveau de vol 340, ${F.first}-${F.last}. Au bout de chaque route, les minutes du trajet passées dans ces conditions, en moyenne, à ${n0(CRUISE_KMH)} km/h.`;
  lecture(
    "#chart-routes",
    "plus la route fonce, plus l'air s'y prête souvent à cet endroit ; en fond, la carte de la saison. Une route plus longue cumule plus de minutes : comparez aussi la couleur.",
  );
  $("#routes-after").replaceChildren(
    p([
      `Sur ${r1.label}, `,
      { b: mins(routeMinutes(r1, "DJF")) },
      ` des ${dur(flightMinutes(r1))} du trajet passent en moyenne dans des conditions propices, de décembre à février. Sur ${r2.label}, ${Math.round(routeMinutes(r2, "DJF")) === Math.round(routeMinutes(r1, "DJF")) ? "autant" : mins(routeMinutes(r2, "DJF"))}.`,
    ]),
    tokyo.seasons.JJA > tokyo.seasons.DJF
      ? p([
          `${tokyo.label} fait exception : sa route, très au nord, au-dessus de la Sibérie, en traverse davantage l'été, ${mins(routeMinutes(tokyo, "JJA"))} de juin à août, que l'hiver, ${mins(routeMinutes(tokyo, "DJF"))}.`,
        ])
      : null,
    p([
      `Vers le sud, ${low.label} n'en traverse pas plus de ${mins(Math.ceil(Math.max(routeMinutes(low, "DJF"), routeMinutes(low, "JJA"))))}, en toute saison, sur ${dur(flightMinutes(low))} de vol. Sur le Pacifique Nord, ${other.label} atteint ${mins(routeMinutes(other, "DJF"))} l'hiver.`,
    ]),
  );
}

export function writeTendance(F) {
  const atl = F.atl;
  // ------------------------------------------------------------ chapter 6: the North Atlantic, winter after winter
  $("#h-atlantique").textContent =
    atl.change > 0.03
      ? `Sur l'Atlantique Nord, ${chg(atl.change)} depuis les années 1980`
      : "Sur l'Atlantique Nord, peu de changement";
  $("#atlantique-prose").replaceChildren(
    p([
      `De la décennie ${decade(F, false)} à la décennie ${decade(F, true)}, la fréquence des conditions propices au-dessus de l'Atlantique Nord ${moved(atl.change)}. Elle passe de `,
      { b: hrs(atl.decades.first) },
      ` à ${hrs(atl.decades.last)} par an.`,
    ]),
  );
  $("#h-stripes-fig").textContent = "Des hivers plus agités, d'une année à l'autre";
  $("#stripes-note").textContent =
    `Part des analyses aux conditions propices au niveau de vol 340, au-dessus de l'Atlantique Nord (40-65° N, 70-10° O), chaque mois de ${F.first} à ${F.last}, en %.`;
  lecture(
    "#chart-stripes",
    "chaque ligne est une année, de haut en bas ; chaque case un mois. La couleur dit la fréquence, du papier au magenta.",
  );
  $("#atlantique-after").replaceChildren(
    p([
      `L'écart est grand d'un hiver à l'autre : l'année la plus agitée de la série est ${F.atlMaxYear}. La tendance se lit sur des décennies, pas d'une année sur l'autre.`,
    ]),
    p([
      `Pour les situations les plus fortes, les ${pc(F.pctSev, 2)} du globe, la hausse est de `,
      { b: chg(atl.sevChange) },
      `. ${cap(SEASON_NAME[atl.fastest])} est la saison qui change le plus : ${chg(atl.decadesSeasons[atl.fastest].change)}.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 7: every region
  const [hi] = F.byChange;
  const lo = F.byChange.at(-1);
  $("#h-tendance").textContent =
    F.up.length === F.local.length
      ? "Partout sur les grandes routes, plus de conditions propices"
      : `${cap(WORDS[F.up.length])} grandes régions de vol sur cinq plus agitées`;
  $("#tendance-prose").replaceChildren(
    p(
      F.up.length === F.local.length
        ? [
            "Les cinq grandes régions de vol du nord gagnent toutes d'une décennie à l'autre, de ",
            { b: chg(lo.change) },
            ` ${above(lo)} à `,
            { b: chg(hi.change) },
            ` ${above(hi)}.`,
          ]
        : [`La hausse la plus forte est celle ${de(hi)} : `, { b: chg(hi.change) }, " d'une décennie à l'autre."],
    ),
  );
  $("#h-trend-fig").textContent = "D'une décennie à l'autre";
  $("#trend-note").textContent =
    `Fréquence des conditions propices au niveau de vol 340, chaque année de ${F.first} à ${F.last}, comparée à la moyenne de la région sur toute la période ; à droite, l'évolution de ${decade(F, false)} à ${decade(F, true)}.`;
  lecture(
    "#chart-trend",
    "chaque ligne est une région, chaque bande une année : bleue, plus calme que la moyenne de la région ; magenta, plus agitée.",
  );
  $("#tendance-after").replaceChildren(
    p([
      `Sur tout l'hémisphère nord, la fréquence ${moved(F.nh.change)} ; sur l'hémisphère sud, elle ${moved(F.sh.change)}.`,
    ]),
  );
  $("#tendance-aside").replaceChildren(
    rich([
      `Une réanalyse change avec ses observations : avant les années 1990, moins d'avions et de satellites renseignaient le vent en altitude. Une partie de l'écart peut en venir. Avec une réanalyse moderne, de 1979 à 2020, et 21 indices de turbulence, Prosser et al. (2023) trouvent aussi une forte hausse aux latitudes moyennes, sur l'Atlantique Nord et les États-Unis ; Lee et al. (2019) retrouvent la hausse du cisaillement dans plusieurs réanalyses.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 8: the change map, and why
  $("#h-evolution").textContent =
    F.atl.vwsChange > 0.03
      ? "Plus de vent qui change avec l'altitude"
      : "Le vent moyen bouge peu, ses extrêmes gagnent";
  $("#evolution-prose").replaceChildren(
    p([
      `L'indice multiplie deux mesures du vent : sa variation avec l'altitude, le cisaillement, et son étirement à l'horizontale. Au-dessus de l'Atlantique Nord, le cisaillement moyen au niveau 340 ${moved(F.atl.vwsChange)} de ${F.first} à ${F.last}. ${Math.abs(F.atl.vwsChange) < 0.03 ? "Ce sont les situations rares, celles que compte l'indice, qui deviennent plus fréquentes." : ""}`,
    ]),
  );
  $("#h-change-fig").textContent = "Où les conditions propices ont gagné";
  $("#change-note").textContent =
    `Évolution de la part des analyses aux conditions propices au niveau de vol 340, de ${F.span[0][0]}-${F.span[0][1]} à ${F.span[1][0]}-${F.span[1][1]}, en %, sur une grille de 3°. En blanc, les régions où ces conditions sont trop rares pour être comparées (moins de 0,2 % du temps).`;
  lecture(
    "#chart-change",
    "en magenta, les conditions propices sont plus fréquentes qu'au début de la période ; en bleu, moins.",
  );
  $("#evolution-after").replaceChildren(
    p([
      `Sur ${pc(F.changeUp, 0)} des cases où ces conditions ne sont pas rares, elles sont plus fréquentes en ${F.span[1][0]}-${F.span[1][1]} qu'en ${F.span[0][0]}-${F.span[0][1]}. ${F.nh.change > 0 && F.sh.change > 0 ? ` Les deux hémisphères gagnent, ${F.sh.change > F.nh.change ? "le sud plus encore que le nord" : "le nord plus encore que le sud"}.` : ""}`,
    ]),
    p([
      `La vitesse moyenne du vent au-dessus de l'Atlantique Nord, elle, ${moved(F.atl.wsChange)}${
        F.atl.vwsChange > F.atl.wsChange + 0.02
          ? " : c'est le profil du vent, plus que sa force, qui change"
          : ""
      }.`,
    ]),
  );
  $("#evolution-aside").replaceChildren(
    rich([
      `Lee et al. (2019) mesurent une hausse de 15 % du cisaillement au cœur du courant-jet de l'Atlantique Nord, de 1979 à 2017, et la relient au réchauffement, plus rapide en altitude sous les tropiques. Notre moyenne porte sur toute la région, entre deux niveaux plus espacés : elle ${moved(F.atl.vwsChange)}. La hausse se lit dans les situations les plus fortes, ${chg(F.atl.sevChange)}. Cette enquête mesure le vent ; elle n'en établit pas la cause.`,
    ]),
  );
}

export function writeReponse(F) {
  const atl = F.atl;
  $("#reponse-prose").replaceChildren(
    p([
      `Oui, sur les grandes routes du nord. Au-dessus de l'Atlantique Nord, à l'altitude de croisière, les conditions de la turbulence en air clair sont plus fréquentes : `,
      { b: chg(atl.change) },
      ` de la décennie ${decade(F, false)} à la décennie ${decade(F, true)}, ${chg(atl.sevChange)} pour les plus fortes.`,
    ]),
    p([
      `Elles se concentrent le long des courants-jets, l'hiver, autour du niveau ${n0(F.topLevel.fl)}. Sur un Paris – New York, environ ${mins(routeMinutes(F.pny, "DJF"))} du trajet les traversent en moyenne de décembre à février.`,
    ]),
    p([
      "Ce sont des conditions, pas des secousses. Les avions s'en écartent quand elles sont annoncées, et la plupart des turbulences ne blessent personne : l'enquête dit où et quand le ciel clair est le plus souvent agité, pas combien de vols l'ont été.",
    ]),
  );
}

export function writeSources(C, F) {
  const li = (parts) => el("li", {}, parts);
  const P = C.meta.percentiles;
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(TSOURCES.era5, TSOURCES.era5.label),
        `, sur une grille de 1,5° toutes les 6 heures (`,
        link(TSOURCES.wb2, "WeatherBench 2"),
        `) : vent à 150, 200, 250, 300 et 400 hPa, de ${F.first} à ${F.last}, soit ${n0(F.analyses)} analyses du globe. Contient des informations modifiées du Copernicus Climate Change Service.`,
      ]),
      li([
        link(TSOURCES.naturalearth, TSOURCES.naturalearth.label),
        " : les contours des terres sur les cartes.",
      ]),
      li([
        link(TSOURCES.ourairports, TSOURCES.ourairports.label),
        " : la position des aéroports des routes.",
      ]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      li([
        link(TSOURCES.ellrod, "Indice d'Ellrod (TI1)"),
        " : cisaillement vertical du vent multiplié par la somme de la déformation et de la convergence horizontales. Le cisaillement d'un niveau est pris entre les niveaux voisins (200 et 300 hPa pour le niveau 250), sur les hauteurs de l'atmosphère type de l'OACI ; les dérivées horizontales sont des différences centrées sur la sphère, entre 78° S et 78° N.",
      ]),
      li([
        `Conditions propices : l'indice au-dessus de ${fmtNum(F.thrMod * 1e7, 0)} × 10⁻⁷ s⁻², le seuil que dépassent ${pc(F.pctMod, 2)} des analyses du globe au niveau 250 hPa, chaque case pesée par sa surface ; conditions les plus fortes : au-dessus de ${fmtNum(C.meta.thrSev * 1e7, 0)} × 10⁻⁷ s⁻², ${pc(F.pctSev, 2)} des analyses. Les mêmes seuils servent aux trois niveaux et à toutes les années. Centiles de l'indice à 250 hPa, en 10⁻⁷ s⁻² : médiane ${fmtNum(P[250][50], 2)}, 99e ${fmtNum(P[250][99], 1)}, 99,9e ${fmtNum(P[250][99.9], 1)}.`,
      ]),
      li([
        "Heures par an : la part des analyses multipliée par les 8 766 heures d'une année moyenne, arrondie à cinq heures (à l'heure sous 50 heures).",
      ]),
      li([
        `Régions de vol, en latitude et longitude : Atlantique Nord 40-65° N, 70-10° O ; Pacifique Nord 30-55° N, 150° E-150° O ; Europe 35-60° N, 10° O-30° E ; États-Unis 30-50° N, 125-70° O ; Asie de l'Est 25-45° N, 100-145° E. Moyennes pesées par la surface des cases.`,
      ]),
      li([
        `Décennies : moyenne des fréquences annuelles de ${decade(F, false)} contre celle de ${decade(F, true)}. Saisons : décembre de l'année précédente, janvier et février ; la première année n'a pas d'hiver complet. Carte d'évolution : ${F.span[0][0]}-${F.span[0][1]} contre ${F.span[1][0]}-${F.span[1][1]}, sur des cases de 3°.`,
      ]),
      li([
        `Routes : 200 points le long du grand cercle entre les deux aéroports, la fréquence de la case la plus proche de chacun, moyennée ; minutes = cette moyenne × la durée du trajet à ${n0(CRUISE_KMH)} km/h, une vitesse de croisière ronde (ni vent, ni montée, ni descente).`,
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Combien de vols ont été secoués. Aucune donnée publique ne compte les turbulences rencontrées vol par vol ; les compagnies et les autorités en gardent les relevés. L'indice décrit l'atmosphère, pas ce que les avions ont traversé.",
      ]),
      li([
        "La turbulence près des orages ou en montagne. Elle a d'autres causes, et l'indice d'Ellrod ne la voit pas. ",
        link(FACTS.singapore, "Le vol Londres-Singapour de mai 2024"),
        ", secoué au-dessus de la Birmanie, l'a été près d'une zone de convection, pas en air clair au sens strict.",
      ]),
      li([
        "Le détail fin du vent. Une grille de 1,5° et une analyse toutes les six heures lissent les tourbillons : les fréquences sont celles des situations les plus fortes de ce vent lissé, pas celles d'un vent mesuré à l'échelle d'un avion.",
      ]),
    ]),
    el("h3", { text: "Les travaux de référence" }),
    el("ul", {}, [
      li([link(FACTS.prosser, "Prosser et al., 2023"), ` : ${FACTS.prosser.text}`]),
      li([link(FACTS.storer, "Storer et al., 2017"), ` : ${FACTS.storer.text}`]),
      li([link(FACTS.lee, "Lee et al., 2019"), ` : ${FACTS.lee.text}`]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=cat", text: "la page des données" }),
      ".",
    ]),
  );
}
