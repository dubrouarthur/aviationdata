// The words of the jet-stream story. Every number comes from the data files, so the text follows
// the data when it is rebuilt; web/scripts/check_site.py recomputes them independently.
import * as d3 from "d3";
import { $, el, rich, keyFigures } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { hm, kmh, longDate, minutes, monthName, pct, thousands, winter } from "./fmt.js";

// "vers Newark", or "entre Orly et Newark" when the French end is not Paris-CDG
const toward = (r) => (r.fr === "LFPG" ? `vers ${r.to}` : `entre ${r.from.replace("Paris-", "")} et ${r.to}`);
const prose = (id, paragraphs) => $(id).replaceChildren(...paragraphs.map((p) => el("p", {}, rich(p))));
const WEST_COAST = ["KLAX", "KSFO", "KSEA", "CYVR"];

export function storyFacts({ flights, routing, hero, climate, trappes }) {
  const p = flights.pair;
  const e = flights.routes.find((r) => r.fr === p.fr && r.na === p.na);
  const routes = flights.routes;
  const gap = (r) => r.west.med - r.east.med;
  const inGrid = routes.filter((r) => !WEST_COAST.includes(r.na));
  const coast = routes.filter((r) => WEST_COAST.includes(r.na) && r.fr === "LFPG");
  const season = (months) => {
    const rows = p.monthly.filter((d) => d.e !== null && d.w !== null && months.includes(+d.m.slice(5, 7)));
    return d3.mean(rows, (d) => d.w - d.e);
  };
  const tail = (m) => p.monthly.find((d) => d.m === m)?.te;
  const naive = (p.km / routing.tas ** 2) * 60 * 10; // minutes per 10 km/h on the great circle
  const days = Object.fromEntries(routing.days.map((d) => [d[0], d]));
  return {
    n: flights.n_valid,
    pairN: e.east.n + e.west.n,
    medW: e.west.med,
    medE: e.east.med,
    gap: p.gap,
    minGap: d3.least(inGrid, gap),
    maxGap: d3.greatest(inGrid, gap),
    coast,
    gapDJF: season([12, 1, 2]),
    gapJJA: season([6, 7, 8]),
    tailJan19: tail("2019-01"),
    tailJul19: tail("2019-07"),
    fit: p.fit,
    naive,
    ciara: days["2020-02-08"],
    hero,
    routing,
    climate,
    trappes,
  };
}

export function writeStory(data, F) {
  const { routing, hero, climate, trappes } = data;
  const s = routing.summary;
  const r = hero.route;

  $("#open-dek").replaceChildren(
    rich([
      "Paris–New York dure en médiane ",
      { b: hm(F.gap) },
      " de plus que New York–Paris. En cause, un fleuve d'air qui coule d'ouest en est à dix kilomètres d'altitude, à la hauteur exacte où volent les avions de ligne. Où placer l'avion pour en profiter, ou pour l'éviter : quelle route, quelle altitude, quelle heure ? Enquête sur ",
      { b: thousands(F.n) },
      " vols entre la France et l'Amérique du Nord et soixante-quinze ans de vents, avec un simulateur pour essayer soi-même.",
    ]),
  );

  prose("#nuit-prose", [
    [
      "Le 8 février 2020, la tempête Ciara fonce vers les îles Britanniques. Sur l'image du satellite Suomi NPP, sa bande de nuages barre l'Atlantique de la Floride à l'Irlande. Au-dessus, vers 10 km d'altitude, la réanalyse ERA5 estime le vent à ",
      { b: kmh(hero.max.kmh) },
      ` au cœur du courant-jet, en plein océan par ${fmtNum(hero.max.lat, 0)}° nord, au début de la nuit suivante.`,
    ],
    [
      "Pour un avion qui part de New York vers Paris cette nuit-là, c'est un tapis roulant : le long de la route la plus courte, le vent pousse en moyenne à ",
      { b: kmh(r.tail) },
      ". Un avion de ligne simulé, volant à 900 km/h par rapport à l'air, boucle le trajet en ",
      { b: hm(r.t_fast) },
      " par la route la plus rapide, contre ",
      { b: hm(r.nowind) },
      " sans vent.",
    ],
    [
      "La même nuit, le vol BA112 de British Airways relie New York à Londres en 4 h 56, record du vol commercial subsonique le plus rapide entre les deux villes selon le Guinness World Records. Ce que le jet donne vers l'est, il le reprend vers l'ouest : c'est l'objet de cette enquête.",
    ],
  ]);
  keyFigures($("#kf-nuit"), [
    { value: kmh(hero.max.kmh), label: "vent maximal sur la carte (ERA5)", color: "var(--speed-core)" },
    {
      value: hm(r.t_fast),
      label: "New York–Paris par la route la plus rapide (modèle)",
      color: "var(--east)",
    },
    { value: hm(r.nowind), label: "le même trajet sans vent", color: "var(--muted)" },
  ]);

  const coastTxt = F.coast
    .sort((a, b) => a.west.med - a.east.med - (b.west.med - b.east.med))
    .map((c) => `${hm(c.west.med - c.east.med)} vers ${c.to}`);
  prose("#ecart-prose", [
    [
      "Entre 2019 et 2022, les récepteurs du réseau OpenSky ont suivi ",
      { b: thousands(F.n) },
      " vols entre la France et l'Amérique du Nord, de leur premier à leur dernier signal. Sur Paris-CDG–New York-JFK, la ligne la plus suivie (",
      { b: fmtNum(F.pairN) },
      " vols), le vol vers New York dure en médiane ",
      { b: hm(F.medW) },
      ", le retour ",
      { b: hm(F.medE) },
      " : ",
      { b: hm(F.gap) },
      " d'écart.",
    ],
    [
      "Ces durées, du premier au dernier signal capté près des aéroports, comprennent une partie du roulage : ce ne sont pas les horaires des compagnies. Mais la distance est la même dans les deux sens. L'écart se joue dans l'air.",
    ],
    [
      "On le retrouve sur toutes les autres lignes, de ",
      { b: hm(F.minGap.west.med - F.minGap.east.med) },
      ` ${toward(F.minGap)} à `,
      { b: hm(F.maxGap.west.med - F.maxGap.east.med) },
      ` ${toward(F.maxGap)}. Les lignes de la côte Ouest y échappent en partie (${coastTxt.join(", ")}) : leur route la plus courte remonte vers le Groenland et le Grand Nord canadien, loin au nord du cœur habituel du jet.`,
    ],
  ]);
  $("#h-hist").textContent = `Paris-CDG–New York-JFK : ${hm(F.gap)} d'écart en médiane`;
  $("#routes-note").textContent =
    `Durée médiane vers l'Amérique (rose) et vers la France (bleu), lignes d'au moins 300 vols dans chaque sens, 2019-2022, de la plus courte à la plus longue.`;

  prose("#saisons-prose", [
    [
      "Le jet n'a pas la même force toute l'année. L'hiver, quand le contraste de température entre l'Arctique et les tropiques est le plus fort, il souffle plus vite et plus au sud ; l'été, il faiblit et remonte vers le nord. Les vols suivent : sur Paris–New York, l'écart entre l'aller et le retour atteint en moyenne ",
      { b: hm(F.gapDJF) },
      " de décembre à février, contre ",
      { b: hm(F.gapJJA) },
      " de juin à août.",
    ],
    [
      "Le vent mesuré le long de la route suit la même pente : ",
      { b: kmh(F.tailJan19) },
      " de vent arrière en moyenne pour les vols vers Paris en janvier 2019, ",
      { b: kmh(F.tailJul19) },
      " en juillet.",
    ],
  ]);
  $("#h-monthly").textContent = "Paris–New York, mois par mois";

  const r2 = (r) => pct(100 * r * r);
  prose("#vent-prose", [
    [
      "Chaque point est une journée : la durée médiane des vols du jour, et le vent moyen que donne ERA5 le long de la route au milieu du vol. Vers Paris, chaque tranche de 10 km/h de vent arrière en plus retire ",
      { b: minutes(-F.fit.e.slope, 1) },
      " au vol ; vers New York, chaque tranche de 10 km/h de vent de face en plus en ajoute ",
      { b: minutes(-F.fit.w.slope, 1) },
      ". Le vent explique à lui seul ",
      { b: r2(F.fit.e.r) },
      " des écarts de durée d'un jour à l'autre vers Paris, et ",
      { b: r2(F.fit.w.r) },
      " vers New York.",
    ],
    [
      "C'est moins que ne le voudrait un calcul sur la ligne droite, ",
      { b: minutes(F.naive, 1) },
      " par tranche de 10 km/h. Rien d'étonnant : les avions ne suivent pas la ligne droite. Ils vont chercher le vent arrière, ou contournent le vent de face.",
    ],
    recordsParagraph(data.flights.pair.records),
  ]);
  $("#h-scatter").textContent = "Une journée, un point : la durée suit le vent";
  $("#scatter-note").textContent =
    "Paris-CDG–New York-JFK, 2019-2022, journées d'au moins deux vols dans le sens indiqué. Vent : composante moyenne le long du grand cercle à 250 hPa (environ 10 400 m), ERA5, au pas de 6 heures le plus proche du milieu du vol.";

  const [cd, , , cgw, cow] = F.ciara;
  prose("#route-prose", [
    [
      "Le simulateur refait le calcul pour quelques journées choisies. Pour mesurer l'enjeu tous les jours, nous avons cherché la route la plus rapide de chaque jour de 2019 à 2022 pour un avion à 900 km/h dans les vents ERA5 de midi, à 250 hPa, parmi tous les trajets qui s'écartent jusqu'à 1 800 km du grand cercle. Vers Paris, elle ne fait gagner que ",
      { b: minutes(s.gain_e, 1) },
      " en moyenne : le jet souffle déjà le long de la ligne droite. Vers New York, elle fait gagner ",
      { b: minutes(s.gain_w, 1) },
      ", et plus de 10 minutes ",
      { b: pct(s.share_w_10) },
      " des jours.",
    ],
    [
      `Le ${longDate(cd)}, veille de l'arrivée de Ciara en Europe, la ligne droite aurait demandé `,
      { b: hm(cgw) },
      " contre le vent, la route la plus rapide, qui passe très au nord, ",
      { b: hm(cow) },
      ". Choisissez un jour, une destination : la carte et la bande de jours ci-dessous les montrent tous.",
    ],
  ]);
  $("#strip-note").textContent =
    "Chaque trait est un jour : plus il est foncé, plus la meilleure route vers New York fait gagner de temps sur la ligne droite. Cliquez pour afficher ce jour.";

  const m = routing.model;
  prose("#model-prose", [
    [
      "Ce modèle ignore la montée, la descente, les changements d'altitude, les couloirs imposés par le contrôle et l'évolution du vent pendant le vol. Il colle pourtant aux vols réels. D'un vol à l'autre, la durée de sa meilleure route suit la durée observée avec une corrélation de ",
      { b: fmtNum(m.w.r_opt, 2) },
      " vers New York, contre ",
      { b: fmtNum(m.w.r_gc, 2) },
      " pour la ligne droite ; vers Paris, ",
      { b: fmtNum(m.e.r_opt, 2) },
      " contre ",
      { b: fmtNum(m.e.r_gc, 2) },
      ".",
    ],
    [
      "L'avantage de la route optimisée vers l'ouest est cohérent avec des avions qui contournent le vent de face. La différence restante entre le modèle et l'observation, ",
      { b: `${fmtNum(Math.min(m.w.offset, m.e.offset), 0)} à ${minutes(Math.max(m.w.offset, m.e.offset))}` },
      " en médiane, correspond au roulage, à la montée et à l'approche.",
    ],
  ]);
  $("#gains-note").textContent =
    "Minutes gagnées en moyenne par la meilleure route sur la ligne droite, par mois de l'année, Paris–New York, 2019-2022 (modèle, vents de midi).";

  prose("#ar-prose", [
    [
      "On pourrait croire que le temps gagné au retour compense celui perdu à l'aller. Ce n'est pas le cas : contre le vent, l'avion passe plus de temps à le subir qu'il n'en passe à en profiter dans l'autre sens. Sur la ligne droite, un aller-retour Paris–New York dure en moyenne ",
      { b: minutes(s.rt_gc) },
      " de plus que sans vent (",
      { b: hm(2 * routing.nowind) },
      "). En choisissant chaque jour la route la plus rapide, le surcoût tombe à ",
      { b: minutes(s.rt_opt) },
      ".",
    ],
  ]);
}

/* ------------------------------------------------------------------ the jet, at the altitude of airliners */
export function writeJet({ trappes, climate }) {
  const djf = trappes.profile.djf;
  const jja = trappes.profile.jja;
  const peak = d3.greatest(djf, (d) => d.p50);
  const peakS = d3.greatest(jja, (d) => d.p50);
  const ground = djf[0];
  prose("#jet-prose", [
    [
      "Le courant-jet ne se lit pas que dans les modèles. Deux fois par jour, Météo-France lâche un ballon-sonde depuis Trappes, dans les Yvelines, et la NOAA archive ses mesures. En hiver, le vent médian y passe de ",
      { b: kmh(ground.p50) },
      ` vers ${fmtNum(ground.km, 1)} km d'altitude à `,
      { b: kmh(peak.p50) },
      ` vers ${fmtNum(peak.km, 1)} km, au niveau de ${peak.hpa} hPa, puis faiblit plus haut. L'été, le maximum, `,
      { b: kmh(peakS.p50) },
      `, se tient à ${fmtNum(peakS.km, 1)} km.`,
    ],
    [
      "C'est précisément l'altitude de croisière des long-courriers, entre 9 et 12 km (niveaux de vol 300 à 390). Un avion de ligne ne peut donc pas ignorer le jet : il le traverse, le suit ou le contourne, en latitude comme en altitude.",
    ],
    [
      `Le ${longDate(trappes.ciara.date)} à midi, au passage de Ciara, le ballon de Trappes a mesuré `,
      { b: kmh(trappes.ciara.kmh) },
      " à 250 hPa : il fallait remonter au ",
      { b: longDate(trappes.ciara.stronger_before) },
      " pour trouver plus fort. Ces mesures servent aussi de juge de paix : interpolée à Trappes, la réanalyse ERA5 utilisée dans cette enquête suit les ballons avec une corrélation de ",
      { b: fmtNum(trappes.check.r, 3) },
      " et un écart moyen de ",
      { b: kmh(trappes.check.mae) },
      ` (2019-2022, ${fmtNum(trappes.check.n)} sondages).`,
    ],
  ]);
  keyFigures($("#kf-jet"), [
    {
      value: `${fmtNum(peak.km, 1)} km`,
      label: "altitude du vent le plus fort au-dessus de Paris en hiver",
      color: "var(--east)",
    },
    {
      value: kmh(peak.p50),
      label: "vent médian à cette altitude, de décembre à février",
      color: "var(--east)",
    },
  ]);
  $("#profile-note").textContent =
    "Vent médian et vent dépassé une fois sur dix à chaque niveau standard, sondages de 00 h et 12 h UTC, 1991-2020. Bande grise : altitudes de croisière des long-courriers.";
  void climate;
}

/* ------------------------------------------------------------------ the simulator chapter */
export function writePlacer({ sim, stats }) {
  const c = sim.ciara;
  const plane = sim.aircraft.find((a) => a.code === c.aircraft);
  const cells = c.west.flatMap((r) => r.best.slice(0, 3).map((v, lv) => ({ v, h: r.hour, lv })));
  const fast = d3.least(cells, (d) => d.v);
  const slow = d3.greatest(cells, (d) => d.v);
  const fl = (lv) => `FL${sim.levels[lv].fl}`;
  const hh = (h) => `${String(h).padStart(2, "0")} h`;
  const paras = [
    [
      "Sur une sphère, le chemin le plus court entre deux villes est un arc de grand cercle : c'est pour cela que Paris–New York passe au-dessus de l'Irlande et de Terre-Neuve. Mais le plus court n'est pas le plus rapide quand le vent souffle à 300 km/h. Deux fois par jour, les centres de contrôle de Shanwick (Royaume-Uni et Irlande) et de Gander (Canada) publient les North Atlantic Tracks, des couloirs placés pour profiter du jet vers l'Europe et l'éviter vers l'Amérique.",
    ],
    [
      "Placer un avion dans le jet, c'est choisir trois choses : la route, l'altitude et l'heure. Le simulateur ci-dessous les fait varier avec les vents ERA5 de journées réelles, à trois niveaux de vol et heure par heure, pour un avion volant à son nombre de Mach de croisière (modèle ouvert OpenAP). Il cherche la meilleure route parmi des milliers et vous laisse tracer la vôtre.",
    ],
    [
      `Le 8 février 2020, veille de Ciara, un ${plane.name} parti de Paris pour New York aurait mis `,
      { b: hm(fast.v) },
      ` par la meilleure route en partant à ${hh(fast.h)} UTC à ${fl(fast.lv)}, et `,
      { b: hm(slow.v) },
      ` en partant à ${hh(slow.h)} UTC à ${fl(slow.lv)} : `,
      { b: minutes(slow.v - fast.v) },
      " d'écart pour le même avion, le même jour, sans compter la ligne droite.",
    ],
  ];
  prose("#placer-prose", paras);
  keyFigures($("#kf-placer"), [
    {
      value: minutes(slow.v - fast.v),
      label: "d'écart vers New York le 8 février 2020, selon l'heure et l'altitude",
      color: "var(--west)",
    },
  ]);
  if (stats) writeBilan(stats, sim);
}

export function writeBilan(stats, sim) {
  const w = stats.west;
  const e = stats.east;
  const fl = (i) => `FL${sim.levels[i].fl}`;
  const top = (x) => d3.maxIndex(x.share);
  prose("#bilan-prose", [
    [
      `Le même calcul, refait pour chacun des ${fmtNum(stats.days.length)} jours de 2019 à 2022 avec un avion à Mach ${fmtNum(stats.mach, 2)}, chiffre chaque choix. Vers New York, départ à midi UTC : la meilleure route à FL340 fait gagner `,
      { b: minutes(w.gain_gc_l1, 1) },
      " en moyenne sur la ligne droite, choisir chaque jour la meilleure altitude ",
      { b: minutes(w.gain_level, 1) },
      " de plus, et pouvoir en changer en vol encore ",
      { b: minutes(w.gain_free, 1) },
      ".",
    ],
    [
      "Vers Paris, départ à minuit UTC, les gains sont plus minces : ",
      { b: minutes(e.gain_gc_l1, 1) },
      ", ",
      { b: minutes(e.gain_level, 1) },
      " et ",
      { b: minutes(e.gain_free, 1) },
      `. La meilleure altitude change d'un jour à l'autre : vers New York, ${fl(top(w))} l'emporte ${pct(w.share[top(w)])} des jours ; vers Paris, ${fl(top(e))} ${pct(e.share[top(e)])} des jours.`,
    ],
  ]);
  $("#levels-note").textContent =
    "Minutes gagnées en moyenne par jour, 2019-2022 : d'abord en suivant la meilleure route à FL340, puis en choisissant l'altitude du jour, puis en changeant d'altitude en vol.";
}

/* ------------------------------------------------------------------ seventy-five years */
export function writeHistoire({ climate, history }) {
  const [hiY, hiV] = climate.top[0];
  const [loY, loV] = climate.bottom[0];
  const t = climate.trend79;
  const top = history.top[0];
  const rev = history.reversed[0];
  const tr = history.strong_trend79;
  prose("#histoire-prose", [
    [
      `La réanalyse NCEP/NCAR de la NOAA permet de remonter jusqu'en ${history.start.slice(0, 4)}. Chaque jour, le vent moyen le long de New York–Paris à 250 hPa y est connu : il a dépassé ${kmh(history.strong)} dans le dos `,
      { b: pct(history.share_strong, 1) },
      " des jours, et soufflé de face vers Paris ",
      { b: pct(history.share_reversed, 1) },
      ` des jours. Le record de la série date du ${longDate(top[0])}, avec `,
      { b: kmh(top[1]) },
      ` ; le vent le plus contraire, du ${longDate(rev[0])} : `,
      { b: kmh(Math.abs(rev[1])) },
      " de face vers Paris.",
    ],
    [
      "D'un hiver à l'autre, le vent arrière moyen de décembre à février va de ",
      { b: kmh(loV) },
      ` en ${winter(loY)} à `,
      { b: kmh(hiV) },
      ` en ${winter(hiY)}, pour une moyenne de `,
      { b: kmh(climate.mean) },
      " sur 1991-2020. Ces écarts suivent l'oscillation nord-atlantique (NAO), la balance de pression entre l'anticyclone des Açores et la dépression d'Islande : corrélation de ",
      { b: fmtNum(climate.nao.r, 2) },
      ` sur ${climate.nao.n} hivers.`,
    ],
    [
      `Depuis ${t.from} et les premières observations par satellite, la série ne montre pas de tendance nette : `,
      { b: `${t.slope >= 0 ? "+" : "−"}${kmh(Math.abs(t.slope), 1)}` },
      " par décennie pour le vent moyen de l'hiver, avec une marge de plus ou moins ",
      { b: kmh(t.ci, 1) },
      `, et ${tr.slope >= 0 ? "+" : "−"}${fmtNum(Math.abs(tr.slope), 1)} jour par décennie au-dessus de ${kmh(history.strong)}, à plus ou moins ${fmtNum(tr.ci, 1)} près. Des chercheurs projettent un jet d'hiver plus fort avec le réchauffement (Williams, 2016, pour un doublement du CO2) et relèvent une hausse de la turbulence en air clair au-dessus de l'Atlantique Nord depuis 1979 (Prosser et al., 2023). Ces séries, trop variables, ne permettent ni de confirmer ni d'infirmer la première projection.`,
    ],
  ]);
  keyFigures($("#kf-histoire"), [
    {
      value: kmh(top[1]),
      label: `de vent arrière moyen sur New York–Paris le ${longDate(top[0])}, record depuis ${history.start.slice(0, 4)}`,
      color: "var(--east)",
    },
  ]);
  $("#winters-note").textContent =
    "Composante moyenne du vent le long du grand cercle New York–Paris à 250 hPa, de décembre à février (l'hiver 2014 va de décembre 2013 à février 2014). En dessous, l'indice NAO moyen du même hiver. Avant 1979, sans satellites, la réanalyse est moins fiable (barres claires).";
  $("#stripes-note").textContent =
    `Une ligne par année, un point par jour : vent moyen le long du grand cercle New York–Paris à 250 hPa (réanalyse NCEP/NCAR, grille de 2,5°). Bleu : dans le dos vers Paris ; orange : de face. Survolez pour lire un jour.`;
  $("#records-note").textContent =
    "Vent moyen de la journée le long de New York–Paris, un jour par épisode. Les jours marqués d'un avion s'ouvrent dans le simulateur.";
}

/* ------------------------------------------------------------------ the extremes of the period */
function recordsParagraph(R) {
  const out = [
    `Les extrêmes de la période vont dans le même sens. Le ${longDate(R.fast_e.day)}, les vols New York–Paris ont mis `,
    { b: hm(R.fast_e.dur) },
    " en médiane, poussés par ",
    { b: kmh(R.fast_e.w) },
    ` de vent. Le ${longDate(R.slow_w.day)}, il a fallu `,
    { b: hm(R.slow_w.dur) },
    " pour rejoindre New York, contre ",
    { b: kmh(-R.slow_w.w) },
    " de vent de face.",
  ];
  if (R.fast_w.w > 0)
    out.push(
      ` Il arrive même que le vent tourne : le ${longDate(R.fast_w.day)}, les vols vers New York ont eu `,
      { b: kmh(R.fast_w.w) },
      " de vent dans le dos et n'ont mis que ",
      { b: hm(R.fast_w.dur) },
      ".",
    );
  return out;
}

/** The record days, marked on the scatter. */
export function recordMarks(R) {
  const marks = [
    { ...R.fast_e, label: `${longDate(R.fast_e.day)} : ${hm(R.fast_e.dur)}` },
    { ...R.slow_w, label: `${longDate(R.slow_w.day)} : ${hm(R.slow_w.dur)}`, below: false },
  ];
  if (R.fast_w.w > 0)
    marks.push({ ...R.fast_w, label: `${longDate(R.fast_w.day)} : ${hm(R.fast_w.dur)}`, below: true });
  return marks;
}

/* ------------------------------------------------------------------ at equal wind, the aircraft */
export function avionFacts(aircraft) {
  const mean = (t) => (t.e + t.w) / 2;
  const fast = aircraft.types.filter((t) => mean(t) <= -4);
  const slow = aircraft.types.filter((t) => mean(t) >= 4);
  const fastest = aircraft.types[0];
  const slowest = aircraft.types.at(-1);
  const range = (ts) => d3.extent(ts, (t) => Math.round(Math.abs(mean(t))));
  return { mean, fast, slow, fastest, slowest, spread: mean(slowest) - mean(fastest), range };
}

const listNames = (ts) => {
  const names = ts.map((t) => t.name.replace(/^(Airbus|Boeing) /, ""));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1)}` : names[0];
};

export function writeAvion(flights) {
  const A = avionFacts(flights.aircraft);
  const [f0, f1] = A.range(A.fast);
  const [s0, s1] = A.range(A.slow);
  const al = flights.aircraft.airlines;
  const best = al[0];
  const worst = al.at(-1);
  const afr = flights.aircraft.afr;
  const a380 = afr.find((t) => t.code === "A388");
  const b77w = afr.find((t) => t.code === "B77W");
  const fleet = (r) => flights.aircraft.types.find((t) => t.code === r.fleet[0])?.name ?? r.fleet[0];
  const paras = [
    [
      "Une fois retiré l'effet du vent, ligne par ligne et sens par sens, il reste un écart qui tient à l'avion. Les ",
      listNames(A.fast),
      " bouclent leur traversée ",
      { b: `${f0 === f1 ? f1 : `${f0} à ${f1}`} minutes plus vite` },
      " que la moyenne ; les ",
      listNames(A.slow),
      ", ",
      { b: `${s0 === s1 ? s1 : `${s0} à ${s1}`} minutes plus lentement` },
      ". Entre le plus rapide et le plus lent, le même jour sur la même ligne, il y a ",
      { b: minutes(A.spread) },
      ".",
    ],
    [
      `Sur Paris–New York, ${worst.name}, qui y fait surtout voler des ${fleet(worst)}, perd `,
      { b: minutes(A.mean(worst)) },
      ` par vol sur la moyenne de la ligne à vent égal ; ${best.name}, avec ses ${fleet(best)}, en gagne `,
      { b: fmtNum(-A.mean(best), 0) },
      ". L'écart entre compagnies tient d'abord à leur flotte",
    ],
    [
      "Ces durées comprennent une partie du roulage au sol : une part de l'écart peut tenir aux procédures de chaque compagnie. Mais il se retrouve dans les deux sens, et au sein d'une même flotte.",
    ],
  ];
  if (a380 && b77w)
    paras[1].push(
      " : chez Air France seule, l'A380 gagnait ",
      { b: minutes(-A.mean(a380)) },
      " sur la moyenne, le 777-300ER ",
      { b: minutes(-A.mean(b77w)) },
      ".",
    );
  else paras[1].push(".");
  prose("#avion-prose", paras);
  keyFigures($("#kf-avion"), [
    {
      value: minutes(A.spread),
      label: "entre l'avion le plus rapide et le plus lent, à vent égal",
      color: "var(--ink)",
    },
  ]);
  $("#types-note").textContent =
    "Écart médian à la durée prévue par le vent sur la même ligne et dans le même sens, toutes lignes de la grille de vent, 2019-2022. Bleu : vers la France ; rose : vers l'Amérique. Avions d'au moins 150 vols dans chaque sens.";
}

/* ------------------------------------------------------------------ the round-trip simulator */
export function initSim(sim, { km, tas }) {
  const input = $("#sim-wind");
  const out = $("#sim-out");
  const update = () => {
    const w = +input.value;
    const go = (km / (tas - w)) * 60;
    const back = (km / (tas + w)) * 60;
    out.textContent = kmh(w);
    input.setAttribute("aria-valuetext", kmh(w));
    sim.set(w);
    $("#sim-read").replaceChildren(
      el("p", { class: "sr-row west" }, [
        el("small", { text: "Paris → New York, vent de face" }),
        el("b", { text: hm(go) }),
      ]),
      el("p", { class: "sr-row east" }, [
        el("small", { text: "New York → Paris, vent dans le dos" }),
        el("b", { text: hm(back) }),
      ]),
      el("p", { class: "sr-row total" }, [
        el("small", { text: "aller-retour, par rapport à l'air calme" }),
        el("b", { text: w === 0 ? "0 min" : `+${minutes(sim.penalty(w))}` }),
      ]),
    );
  };
  input.addEventListener("input", update);
  update();
}

/* ------------------------------------------------------------------ your flight */
export function initVol(flights, chart) {
  const select = $("#vol-route");
  const routes = flights.routes;
  const label = (r) => `${r.from} – ${r.to}`;
  select.replaceChildren(
    ...routes.map((r, i) =>
      el("option", { value: String(i), text: `${label(r)} (${fmtNum(r.east.n + r.west.n)} vols)` }),
    ),
  );
  const pick = (i) => {
    const r = routes[i];
    const gap = r.west.med - r.east.med;
    $("#vol-figs").replaceChildren(
      el("div", { class: "vf west" }, [
        el("small", { text: `Vers ${r.to}` }),
        el("b", { text: hm(r.west.med) }),
      ]),
      el("div", { class: "vf east" }, [
        el("small", { text: `Vers ${r.from}` }),
        el("b", { text: hm(r.east.med) }),
      ]),
      el("div", { class: "vf" }, [el("small", { text: "Écart" }), el("b", { text: hm(gap) })]),
    );
    const months = (k) => r.months[k].map((v, m) => [m + 1, v]).filter((d) => d[1] !== null);
    const longW = d3.greatest(months("w"), (d) => d[1]);
    const shortE = d3.least(months("e"), (d) => d[1]);
    const parts = [
      `En médiane sur 2019-2022, ${fmtNum(r.km)} km. Le mois le plus long vers ${r.to} : ${monthName(longW[0])} (${hm(longW[1])}). Le plus court vers ${r.from} : ${monthName(shortE[0])} (${hm(shortE[1])}).`,
    ];
    if (r.west.slope !== undefined)
      parts.push(
        ` Sur cette ligne, chaque tranche de 10 km/h de vent de face ajoute ${minutes(-r.west.slope, 1)} vers ${r.to}, et chaque tranche de vent arrière en retire ${minutes(-r.east.slope, 1)} vers ${r.from}.`,
      );
    else
      parts.push(
        " Cette ligne passe hors de la grille de vent de l'enquête : pas de calcul de l'effet du vent.",
      );
    $("#vol-note").textContent = parts.join("");
    chart.set(r);
  };
  select.addEventListener("change", () => pick(+select.value));
  pick(0);
  prose("#vol-prose", [
    [
      `Les ${routes.length} lignes suivies plus de 300 fois dans chaque sens entre 2019 et 2022, de la plus fréquentée à la plus rare. Choisissez la vôtre : la durée médiane dans chaque sens, mois par mois, et ce que le vent y change.`,
    ],
  ]);
}

/* ------------------------------------------------------------------ in short */
export function writeBref(data, F) {
  const { routing, hero, climate, trappes, flights } = data;
  const A = avionFacts(flights.aircraft);
  const cards = [
    [
      "nuit",
      "La nuit de Ciara",
      kmh(hero.max.kmh),
      "de vent au cœur du jet, au-dessus de l'Atlantique",
      "var(--speed-core)",
    ],
    [
      "ecart",
      "L'aller et le retour",
      hm(F.gap),
      "de plus vers New York que vers Paris, en médiane",
      "var(--west)",
    ],
    [
      "vent",
      "Le vent",
      minutes(-F.fit.w.slope, 1),
      "de plus vers New York par tranche de 10 km/h de vent de face",
      "var(--west)",
    ],
    [
      "avion",
      "L'avion",
      minutes(A.spread),
      "entre l'avion le plus rapide et le plus lent, à vent égal",
      "var(--ink)",
    ],
    [
      "route",
      "La route",
      minutes(routing.summary.gain_w, 1),
      "gagnées en moyenne vers New York par la route la plus rapide",
      "var(--east)",
    ],
    [
      "aller-retour",
      "L'aller-retour",
      `+${minutes(routing.summary.rt_gc)}`,
      "sur un aller-retour en ligne droite, à cause du vent",
      "var(--west)",
    ],
    [
      "histoire",
      "L'histoire",
      fmtNum(climate.nao.r, 2),
      "de corrélation entre le vent de l'hiver et l'oscillation nord-atlantique",
      "var(--east)",
    ],
    [
      "jet",
      "Les ballons",
      kmh(trappes.ciara.kmh),
      "mesurés au-dessus de Trappes au passage de Ciara",
      "var(--east)",
    ],
  ];
  $("#bref-grid").replaceChildren(
    ...cards.map(([id, title, value, text, color]) =>
      el("a", { class: "resume-card", href: `#${id}` }, [
        el("span", { class: "rc-title" }, [el("i", { style: `--c:${color}` }), title]),
        el("b", { text: value }),
        el("span", { class: "rc-label", text }),
        el("span", { class: "rc-go", text: "Revoir le chapitre" }),
      ]),
    ),
  );
}
