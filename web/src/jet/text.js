// The words of the jet-stream story. Every number comes from the data files, so the text follows
// the data when it is rebuilt; web/scripts/audit_numbers.py recomputes them independently.
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
      " de plus que New York–Paris. En cause, un fleuve d'air qui coule d'ouest en est à dix kilomètres d'altitude, et avec lequel les compagnies négocient chaque jour leur route. Enquête sur ",
      { b: thousands(F.n) },
      " vols entre la France et l'Amérique du Nord.",
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
  ]);
  $("#h-scatter").textContent = "Une journée, un point : la durée suit le vent";
  $("#scatter-note").textContent =
    "Paris-CDG–New York-JFK, 2019-2022, journées d'au moins deux vols dans le sens indiqué. Vent : composante moyenne le long du grand cercle à 250 hPa (environ 10 400 m), ERA5, au pas de 6 heures le plus proche du milieu du vol.";

  const [cd, , , cgw, cow] = F.ciara;
  prose("#route-prose", [
    [
      "Sur une sphère, le chemin le plus court entre deux villes est un arc de grand cercle : c'est pour cela que Paris–New York passe au-dessus de l'Irlande et de Terre-Neuve. Mais le plus court n'est pas le plus rapide quand le vent souffle à 300 km/h. Deux fois par jour, les centres de contrôle de Shanwick (Royaume-Uni et Irlande) et de Gander (Canada) publient les North Atlantic Tracks, des couloirs placés pour profiter du jet vers l'Europe et l'éviter vers l'Amérique.",
    ],
    [
      "Pour mesurer l'enjeu, nous avons cherché chaque jour de 2019 à 2022 la route la plus rapide d'un avion à 900 km/h dans les vents ERA5 de midi, parmi tous les trajets qui s'écartent jusqu'à 1 800 km du grand cercle. Vers Paris, elle ne fait gagner que ",
      { b: minutes(s.gain_e, 1) },
      " en moyenne : le jet souffle déjà le long de la ligne droite. Vers New York, elle fait gagner ",
      { b: minutes(s.gain_w, 1) },
      ", et plus de 10 minutes ",
      { b: pct(s.share_w_10) },
      " des jours.",
    ],
    [
      `Le ${longDate(cd)}, veille de l'arrivée de Ciara en Europe, l'écart devient spectaculaire : la ligne droite aurait demandé `,
      { b: hm(cgw) },
      " contre le vent, la route la plus rapide, qui passe très au nord, ",
      { b: hm(cow) },
      ".",
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

  const [hiY, hiV] = climate.top[0];
  const [loY, loV] = climate.bottom[0];
  const t = climate.trend79;
  prose("#climat-prose", [
    [
      "Le jet change aussi d'un hiver à l'autre. Calculé avec la réanalyse NCEP/NCAR de la NOAA, le vent arrière moyen de décembre à février le long de New York–Paris va de ",
      { b: kmh(loV) },
      ` en ${winter(loY)} à `,
      { b: kmh(hiV) },
      ` en ${winter(hiY)}, pour une moyenne de `,
      { b: kmh(climate.mean) },
      " sur 1991-2020.",
    ],
    [
      "Ces écarts suivent l'oscillation nord-atlantique (NAO), la balance de pression entre l'anticyclone des Açores et la dépression d'Islande : corrélation de ",
      { b: fmtNum(climate.nao.r, 2) },
      ` sur ${climate.nao.n} hivers, soit environ `,
      { b: kmh(climate.nao.slope) },
      " de vent arrière en plus par point d'indice.",
    ],
    [
      `Depuis ${t.from} et les premières observations par satellite, la série ne montre pas de tendance nette : `,
      { b: `${t.slope >= 0 ? "+" : "−"}${kmh(Math.abs(t.slope), 1)}` },
      " par décennie, avec une marge de plus ou moins ",
      { b: kmh(t.ci, 1) },
      ". Des chercheurs projettent un jet d'hiver plus fort avec le réchauffement (Williams, 2016, pour un doublement du CO2) et relèvent une hausse de la turbulence en air clair au-dessus de l'Atlantique Nord depuis 1979 (Prosser et al., 2023). Ces moyennes d'hiver, trop variables, ne permettent ni de confirmer ni d'infirmer la première projection.",
    ],
  ]);
  $("#winters-note").textContent =
    "Composante moyenne du vent le long du grand cercle New York–Paris à 250 hPa, de décembre à février (l'hiver 2014 va de décembre 2013 à février 2014). En dessous, l'indice NAO moyen du même hiver. Avant 1979, sans satellites, la réanalyse est moins fiable (barres claires).";

  const jan = trappes.months[0];
  const low = d3.least(trappes.months, (d) => d.p50);
  prose("#trappes-prose", [
    [
      "Le courant-jet ne se lit pas que dans les modèles. Deux fois par jour, Météo-France lâche un ballon-sonde depuis Trappes, dans les Yvelines. Depuis ",
      `${trappes.from}, `,
      { b: fmtNum(trappes.n) },
      " sondages de 00 h et 12 h UTC ont mesuré le vent à 250 hPa ; la NOAA les archive.",
    ],
    [
      "En janvier, la moitié dépassent ",
      { b: kmh(jan.p50) },
      " et un sur dix ",
      { b: kmh(jan.p90) },
      ` ; en ${monthName(low.m)}, le vent médian retombe à `,
      { b: kmh(low.p50) },
      `. Le ${longDate(trappes.ciara.date)} à midi, au passage de Ciara, le ballon a mesuré `,
      { b: kmh(trappes.ciara.kmh) },
      " : il fallait remonter au ",
      { b: longDate(trappes.ciara.stronger_before) },
      " pour trouver plus fort. Le maximum de la série, ",
      { b: kmh(trappes.top[0][2]) },
      `, date du ${longDate(trappes.top[0][0])}.`,
    ],
    [
      "Ces mesures servent de juge de paix : interpolée à Trappes, la réanalyse ERA5 utilisée dans cette enquête suit les ballons avec une corrélation de ",
      { b: fmtNum(trappes.check.r, 3) },
      " et un écart moyen de ",
      { b: kmh(trappes.check.mae) },
      ` (2019-2022, ${fmtNum(trappes.check.n)} sondages).`,
    ],
  ]);
  $("#tmonths-note").textContent =
    "Sondages de 00 h et 12 h UTC, 1991-2020. Trait : vent médian ; bandes : la moitié et les quatre cinquièmes centraux des sondages.";
  $("#tyears-note").textContent =
    "Part des sondages de 00 h et 12 h UTC où le vent à 250 hPa atteint 200 km/h. Années d'au moins 300 sondages.";
}
