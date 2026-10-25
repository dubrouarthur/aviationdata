// The words of the jet-stream story. The question it answers: can using the jet stream, and forecasting
// it, lower the operating cost of some flights? Every number comes from the data files, so the text
// follows the data when it is rebuilt; web/scripts/check_site.py recomputes them independently.
// One conversion runs through the story: a minute of cruise in kilos of fuel and in euros (cost.js).
import * as d3 from "d3";
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import {
  euros,
  hm,
  kmh,
  longDate,
  minutes,
  monthName,
  monthYear,
  pct,
  perTonne,
  thousands,
  tonnes,
  winter,
} from "./fmt.js";
import { haversine } from "./route.js";
import { soundKmh } from "./sim.js";
import {
  CDG,
  JFK,
  costSteps,
  fuelTonnes,
  kgPerMinute,
  lastPair,
  peqPerFlight,
  routeSavings,
} from "./cost.js";
import { JSOURCES } from "./sources.js";

// "vers Newark", or "entre Orly et Newark" when the French end is not Paris-CDG
const toward = (r) => (r.fr === "LFPG" ? `vers ${r.to}` : `entre ${r.from.replace("Paris-", "")} et ${r.to}`);
const prose = (id, paragraphs) => $(id).replaceChildren(...paragraphs.map((p) => el("p", {}, rich(p))));
/** "d'octobre 2025", "de septembre 2026": the month after "de", elided before a vowel. */
const deMonth = (m) => (/^[aeiouéo]/.test(monthYear(m)) ? `d'${monthYear(m)}` : `de ${monthYear(m)}`);
/** A link to a source of sources.js, by key, with its short name or the given text. */
const src = (k, text) => ({ a: text ?? JSOURCES[k].short, href: JSOURCES[k].url });
/** The box that explains the kilos and the euros, linked from every cost. */
export const TO_COSTS = { a: "D'où viennent ces kilos et ces euros", href: "#couts" };
/** A chapter's prose after its figure, and an optional "À savoir" aside for the method. */
function after(id, paragraphs, aside) {
  const box = $(id);
  if (!box) return;
  box.replaceChildren(
    ...paragraphs.map((p) => el("p", {}, rich(p))),
    ...(aside ? [el("aside", { class: "story-aside" }, [el("b", { text: "À savoir" }), rich(aside)])] : []),
  );
}
const WEST_COAST = ["KLAX", "KSFO", "KSEA", "CYVR"];
const r10 = (v) => Math.round(v / 10) * 10;
/** 12 -> "12 heures", 108 -> "4 jours et demi", 48 -> "2 jours" */
export const leadText = (h) =>
  h < 24 ? `${h} heures` : h % 24 === 12 ? `${(h - 12) / 24} jours et demi` : `${h / 24} jours`;
const kg = (v) => `${fmtNum(v < 200 ? Math.round(v) : r10(v))} kg`;

/**
 * The money of the story, from cost.json and sim_stats.json: kilos and euros per minute of cruise at the
 * reference price (mean of the last twelve months), the best route's savings, and per-day route gains.
 */
export function costFacts({ cost, sim_stats: stats }) {
  const KG = kgPerMinute(cost);
  const price = cost.recent.eur_t;
  const EUR = (KG / 1000) * price;
  const facts = {
    KG,
    EUR,
    price,
    cost,
    pair: lastPair(cost),
    peq: peqPerFlight(cost),
    kgOf: (min) => min * KG,
    eurOf: (min, p = price) => (min * KG * p) / 1000,
  };
  if (!stats) return facts;
  const route = routeSavings(stats, cost);
  // per day, what the best route at FL340 gains on the great circle: daily rows are [gc, l0, l1, l2, free]
  const gains = (dir) => stats[dir].daily.map((r) => r[0] - r[2]);
  const byMonth = (dir) => {
    const g = gains(dir);
    return d3.range(12).map((m) => d3.mean(g.filter((_, i) => +stats.days[i].slice(5, 7) === m + 1)));
  };
  const deciles = (dir) => {
    const g = gains(dir)
      .slice()
      .sort((a, b) => a - b);
    const n = g.length;
    return d3
      .range(10)
      .map((k) => d3.mean(g.slice(Math.floor((k * n) / 10), Math.floor(((k + 1) * n) / 10))));
  };
  const topShare = (dir) => {
    const g = gains(dir)
      .slice()
      .sort((a, b) => b - a);
    const top = g.slice(0, Math.round(g.length / 10));
    return (100 * d3.sum(top)) / d3.sum(g);
  };
  // flying high (least fuel) or low (fastest): FL390 against FL300 towards New York, every day of 2019-2022
  const km = haversine(...CDG, ...JFK);
  const tref = (km / (stats.mach * soundKmh(220.8))) * 60;
  const kgPerMin = (stats.g_pkm * km) / 1000 / tref; // kg of CO2 per passenger-equivalent per fuel-minute
  return {
    ...facts,
    route,
    gains,
    byMonth,
    deciles,
    topShare,
    trade(fuelRatios, dir = "west") {
      const d = stats[dir].daily;
      const t = (i) => d3.mean(d, (r) => r[i + 1]);
      const f = (i) => fuelTonnes(cost, d3.mean(d, (r) => r[i + 1] * fuelRatios[i]) * kgPerMin);
      const minutesMore = t(2) - t(0);
      const tonnesLess = f(0) - f(2);
      return {
        minutesMore,
        tonnesLess,
        breakEven: (p) => (tonnesLess * p) / minutesMore,
      };
    },
  };
}

/** Forecast experiment (forecast.json): minutes gained on the great circle by each plan, and its share. */
export function forecastFacts(fc) {
  const dir = (k) => {
    const m = fc[k].mean;
    const gain = (p) => m.gc - m[p];
    const best = gain("perfect");
    return {
      mean: m,
      gain,
      best,
      share: (p) => (100 * gain(p)) / best,
      err: fc[k].wind_error,
    };
  };
  return {
    west: dir("west"),
    east: dir("east"),
    leads: fc.leads,
    models: fc.models,
    year: fc.year,
  };
}

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

export function writeStory(data, F, C) {
  const { routing, hero } = data;
  const s = routing.summary;
  const r = hero.route;

  $("#open-dek").replaceChildren(
    rich([
      "Vers New York, le même avion met en médiane ",
      { b: hm(F.gap) },
      " de plus que vers Paris, et brûle environ ",
      { b: tonnes(C.kgOf(F.gap) / 1000) },
      " de kérosène de plus. En cause, le courant-jet, un fleuve d'air qui souffle d'ouest en est à l'altitude des avions de ligne. Les compagnies peuvent-elles réduire ce coût en jouant avec le vent, et en le prévoyant ? Enquête sur ",
      { b: thousands(F.n) },
      " vols, quatre ans de vents, deux systèmes de prévision et le prix du kérosène.",
    ]),
  );

  prose("#nuit-prose", [
    [
      "Le 8 février 2020, la tempête Ciara fonce vers les îles Britanniques. Sur l'image du satellite Suomi NPP, sa bande de nuages barre l'Atlantique de la Floride à l'Irlande. Au-dessus, vers 10 km d'altitude, la réanalyse ERA5 estime le vent à ",
      { b: kmh(hero.max.kmh) },
      ` au cœur du courant-jet, en plein océan par ${fmtNum(hero.max.lat, 0)}° nord.`,
    ],
    [
      "Pour un avion qui part de New York vers Paris cette nuit-là, c'est un tapis roulant : un avion de ligne simulé boucle le trajet en ",
      { b: hm(r.t_fast) },
      " par la route la plus rapide, contre ",
      { b: hm(r.nowind) },
      " sans vent. La même nuit, le vol BA112 de British Airways relie New York à Londres en 4 h 56, record du vol commercial subsonique le plus rapide selon le Guinness World Records.",
    ],
    [
      "Ce que le jet donne vers l'est, il le reprend vers l'ouest, et cela se paie en kérosène. Cette enquête mesure combien, et ce que les compagnies peuvent y gagner en suivant le vent et en le prévoyant.",
    ],
  ]);

  const coastTxt = F.coast
    .sort((a, b) => a.west.med - a.east.med - (b.west.med - b.east.med))
    .map((c) => `${hm(c.west.med - c.east.med)} vers ${c.to}`);
  $("#h-ecart").textContent =
    `Une heure et ${fmtNum(C.kgOf(F.gap) / 1000, 1)} tonnes de kérosène de plus vers l'ouest`;
  prose("#ecart-prose", [
    [
      "Entre 2019 et 2022, les récepteurs du réseau OpenSky ont suivi ",
      { b: thousands(F.n) },
      " vols entre la France et l'Amérique du Nord. Sur Paris-CDG–New York-JFK, la ligne la plus suivie, le vol vers New York dure en médiane ",
      { b: hm(F.medW) },
      ", le retour ",
      { b: hm(F.medE) },
      ". Soit ",
      { b: hm(F.gap) },
      " d'écart pour la même distance.",
    ],
  ]);
  $("#hist-note").textContent =
    `Nombre de vols par durée, tranches de 5 minutes, 2019-2022 (${fmtNum(F.pairN)} vols).`;
  after("#ecart-after", [
    [
      "Cet écart se paie en kérosène. En croisière, une minute de vol sur Paris–New York en brûle environ ",
      { b: kg(C.KG) },
      ", soit ",
      { b: euros(C.EUR) },
      ". L'heure d'écart pèse ainsi environ ",
      { b: tonnes(C.kgOf(F.gap) / 1000) },
      " de kérosène et ",
      { b: euros(C.eurOf(F.gap)) },
      " par vol vers New York. Ces chiffres viennent de données publiques, la DGAC pour la consommation et l'agence américaine de l'énergie pour le prix ; l'encadré ci-dessous refait le calcul pas à pas.",
    ],
    [
      "On retrouve l'écart sur les autres lignes, de ",
      { b: hm(F.minGap.west.med - F.minGap.east.med) },
      ` ${toward(F.minGap)} à `,
      { b: hm(F.maxGap.west.med - F.maxGap.east.med) },
      ` ${toward(F.maxGap)}. Les lignes de la côte Ouest y échappent en partie (${coastTxt.join(", ")}) : leur route la plus courte remonte vers le Grand Nord, loin du cœur habituel du jet.`,
    ],
  ]);
  writeCouts(C.cost);
  $("#h-hist").textContent = `Paris-CDG–New York-JFK : ${hm(F.gap)} d'écart en médiane`;
  $("#routes-note").textContent =
    "Durée médiane vers l'Amérique (rose) et vers la France (bleu), lignes d'au moins 300 vols dans chaque sens, 2019-2022.";
  lecture("#chart-routes", "plus le trait est long, plus l'aller coûte de minutes de plus que le retour.");

  prose("#saisons-prose", [
    [
      "L'écart suit les saisons. L'hiver, quand le contraste de température entre l'Arctique et les tropiques est le plus fort, le jet souffle plus vite et plus au sud ; l'été, il faiblit et remonte vers le nord. Sur Paris–New York, l'écart entre l'aller et le retour atteint ",
      { b: hm(F.gapDJF) },
      " de décembre à février, contre ",
      { b: hm(F.gapJJA) },
      ` de juin à août. En kérosène, il se creuse d'environ ${tonnes(C.kgOf(F.gapDJF - F.gapJJA) / 1000)} l'hiver.`,
    ],
  ]);
  $("#h-monthly").textContent = "L'écart suit le vent, mois après mois";

  const r2 = (r) => pct(100 * r * r);
  $("#h-vent").textContent =
    `10 km/h de vent de face : ${minutes(-F.fit.w.slope, 1)} et ${kg(C.kgOf(-F.fit.w.slope))} de plus`;
  prose("#vent-prose", [
    [
      "D'un jour à l'autre, la durée du vol se joue presque entièrement dans le vent. Vers New York, chaque tranche de 10 km/h de vent de face ajoute ",
      { b: minutes(-F.fit.w.slope, 1) },
      " et environ ",
      { b: kg(C.kgOf(-F.fit.w.slope)) },
      " de kérosène. Vers Paris, chaque tranche de 10 km/h de vent arrière retire ",
      { b: minutes(-F.fit.e.slope, 1) },
      ".",
    ],
  ]);
  after("#vent-after", [
    [
      "Le vent explique à lui seul ",
      { b: r2(F.fit.w.r) },
      " des écarts de durée vers New York, et ",
      { b: r2(F.fit.e.r) },
      " vers Paris. C'est moins que ne le voudrait un calcul sur la ligne droite, ",
      { b: minutes(F.naive, 1) },
      " par tranche de 10 km/h. Premier indice : les avions ne subissent pas le vent passivement. Ils vont chercher le vent arrière, ou contournent le vent de face.",
    ],
    recordsParagraph(data.flights.pair.records),
  ]);
  $("#h-scatter").textContent = "Plus de vent de face, plus de minutes";
  $("#scatter-note").textContent =
    "Durée médiane des vols Paris-CDG–New York-JFK de chaque journée, selon le vent, 2019-2022.";
  lecture(
    "#chart-scatter",
    "chaque point est une journée d'au moins deux vols dans le sens indiqué ; à gauche, le vent de face (vers New York), à droite, le vent arrière (vers Paris). La pente de chaque droite donne les minutes par tranche de 10 km/h. Vent : composante moyenne le long du grand cercle à 250 hPa (ERA5), au pas de 6 heures le plus proche du milieu du vol.",
  );

  const [cd, , , cgw, cow] = F.ciara;
  prose("#route-prose", [
    [
      "Sur quatre ans, de 2019 à 2022, la même asymétrie revient jour après jour, même dans un modèle plus simple (le vent de midi, figé, à 250 hPa, et un avion à 900 km/h). Vers Paris, la meilleure route ne fait gagner que ",
      { b: minutes(s.gain_e, 1) },
      " en moyenne : le jet souffle déjà le long de la ligne droite. Vers New York, elle fait gagner ",
      { b: minutes(s.gain_w, 1) },
      ", et plus de dix minutes ",
      { b: pct(s.share_w_10) },
      " des jours.",
    ],
    [
      `Le ${longDate(cd)}, veille de l'arrivée de Ciara en Europe, la ligne droite aurait demandé `,
      { b: hm(cgw) },
      " contre le vent, et la route la plus rapide, qui passe très au nord, ",
      { b: hm(cow) },
      `. Soit environ ${euros(C.eurOf(cgw - cow))} de kérosène en moins.`,
    ],
  ]);
  $("#strip-note").textContent =
    "Chaque trait est un jour : plus il est foncé, plus la meilleure route vers New York fait gagner de temps sur la ligne droite. Cliquez pour afficher ce jour.";

  const m = routing.model;
  prose("#model-prose", [
    [
      "Ce modèle simple ignore la montée, la descente, les changements d'altitude, les couloirs imposés et l'évolution du vent pendant le vol. Il colle pourtant aux vols réels. Vers New York, la durée de sa meilleure route suit celle des vols avec une corrélation de ",
      { b: fmtNum(m.w.r_opt, 2) },
      ", contre ",
      { b: fmtNum(m.w.r_gc, 2) },
      " pour la ligne droite. Vers Paris, ",
      { b: fmtNum(m.e.r_opt, 2) },
      " contre ",
      { b: fmtNum(m.e.r_gc, 2) },
      ". Les vols réels se comportent donc comme des avions qui cherchent déjà la meilleure route. La différence restante, ",
      {
        b: `${fmtNum(Math.min(m.w.offset, m.e.offset), 0)} à ${minutes(Math.max(m.w.offset, m.e.offset))}`,
      },
      " en médiane, correspond au roulage, à la montée et à l'approche.",
    ],
  ]);

  prose("#ar-prose", [
    [
      "On pourrait croire que le temps gagné au retour compense celui perdu à l'aller. Ce n'est pas le cas : contre le vent, l'avion passe plus de temps à le subir qu'il n'en passe à en profiter dans l'autre sens. Sur la ligne droite, un aller-retour Paris–New York dure en moyenne ",
      { b: minutes(s.rt_gc) },
      " de plus que sans vent (",
      { b: hm(2 * routing.nowind) },
      "). Ce surcoût vaut environ ",
      { b: euros(C.eurOf(s.rt_gc)) },
      " de kérosène. En choisissant chaque jour la route la plus rapide, il tombe à ",
      { b: minutes(s.rt_opt) },
      `, environ ${euros(C.eurOf(s.rt_opt))}.`,
    ],
  ]);
}
/* ------------------------------------------------------------------ where the kilos and euros come from */
/**
 * The box "D'où viennent ces kilos et ces euros": the one conversion of the story, in five steps a reader
 * can redo with a calculator, each with its public source (cost.js costSteps; check_site.py redoes it).
 */
export function writeCouts(cost) {
  const S = costSteps(cost);
  const n0 = (v) => fmtNum(v, 0);
  $("#couts-dek").replaceChildren(
    rich([
      "Aucune compagnie ne publie ce que brûle chacun de ses vols. Les kilos et les euros de cette enquête sont calculés à partir de données publiques, en cinq étapes que chacun peut refaire.",
    ]),
  );
  const steps = [
    {
      value: `${n0(S.kgPerPeq)} kg de CO2`,
      what: "par passager-équivalent, pour un Paris–New York sans vent",
      text: [
        "La DGAC publie les émissions moyennes des vols long-courriers au départ de la France : ",
        { b: `${fmtNum(S.gPeqKm, 1)} g` },
        ` de CO2 par passager-équivalent (un passager, ou 100 kg de fret) et par kilomètre en ${S.factorYear}. Sur les `,
        { b: `${n0(S.km)} km` },
        ` qui séparent Paris-CDG de New York-JFK, cela fait ${n0(S.kgPerPeq)} kg.`,
      ],
      sources: [src("dgac", "DGAC, émissions de CO2 du trafic aérien")],
    },
    {
      value: n0(S.peq),
      what: "passagers-équivalents par vol",
      text: [
        `En ${S.year}, `,
        { b: n0(S.flights) },
        " vols ont relié Paris-CDG et New York-JFK, dans les deux sens, avec ",
        { b: n0(S.pax) },
        ` passagers et du fret : ${n0(S.peqYear)} passagers-équivalents, soit ${n0(S.peq)} par vol, dont ${n0(S.paxPerFlight)} passagers.`,
      ],
      sources: [src("dgacpap", "DGAC, trafic par paire d'aéroports")],
    },
    {
      value: tonnes(S.fuelFlight),
      what: "de kérosène par vol, sans vent",
      text: [
        `${n0(S.kgPerPeq)} kg × ${n0(S.peq)} = `,
        { b: tonnes(S.co2Flight, 0) },
        " de CO2 par vol. Brûler une tonne de kérosène en émet ",
        { b: `${fmtNum(S.co2PerFuel, 2)} t` },
        ` : il en faut donc ${tonnes(S.fuelFlight)}.`,
      ],
      sources: [src("icao", "OACI, calculateur d'émissions")],
    },
    {
      value: kg(S.kgPerMinute),
      what: "de kérosène par minute de croisière",
      text: [
        "Un Boeing 777-300ER croise à Mach ",
        { b: fmtNum(S.mach, 2) },
        `. À 10 400 m d'altitude (FL340), où l'atmosphère type compte ${fmtNum(S.kelvin - 273.15, 0)} °C, cela fait ${n0(S.tas)} km/h : `,
        { b: hm(S.minutes) },
        ` de croisière sans vent. ${tonnes(S.fuelFlight)} sur ${n0(S.minutes)} minutes : ${kg(S.kgPerMinute)} par minute. Dans ce calcul, un vol qui dure 10 % de plus brûle 10 % de kérosène de plus.`,
      ],
      sources: [src("openap", "OpenAP (vitesse de croisière)"), src("isa", "AMS (atmosphère type)")],
    },
    {
      value: euros(S.eurPerMinute),
      what: "de kérosène par minute de croisière",
      text: [
        "L'agence américaine de l'énergie (EIA) publie chaque mois le prix du kérosène sur la côte du golfe du Mexique, en dollars par gallon. Converti en euros au taux de la BCE, à ",
        `${fmtNum(S.kgPerLitre, 1)} kg par litre (un litre de kérosène pèse de 775 à 840 g), il revient à `,
        { b: perTonne(S.price) },
        ` en moyenne ${deMonth(S.from)} à ${monthYear(S.to)}. ${kg(S.kgPerMinute)} à ${perTonne(S.price)} : ${euros(S.eurPerMinute)}.`,
      ],
      sources: [src("eia", "EIA, prix du kérosène"), src("ecb", "BCE, taux de change"), src("density")],
    },
  ];
  $("#couts-steps").replaceChildren(
    ...steps.map((st) =>
      el("li", { class: "cb-step" }, [
        el("p", { class: "cb-result" }, [el("b", { text: st.value }), el("span", { text: st.what })]),
        el("div", { class: "cb-body" }, [
          el("p", {}, rich(st.text)),
          el("p", { class: "cb-src" }, [
            "Source : ",
            ...st.sources.flatMap((x, i) => [
              i ? (i === st.sources.length - 1 ? " et " : ", ") : "",
              ...rich([x]).childNodes,
            ]),
          ]),
        ]),
      ]),
    ),
  );
  $("#couts-limits").replaceChildren(
    el("h4", { text: "Ce que ce calcul ne dit pas" }),
    el("ul", {}, [
      el("li", {}, [
        "C'est un avion moyen : le facteur de la DGAC mêle tous les long-courriers partis de France. Dans le simulateur, les quatre avions proposés brûlent donc la même quantité de kérosène sans vent ; seuls changent leur vitesse et l'écart de consommation entre les altitudes.",
      ]),
      el("li", {}, [
        "C'est un prix de marché américain. Ce que paie une compagnie dépend de ses contrats, de ses couvertures et de l'aéroport où elle fait le plein.",
      ]),
      el("li", {}, [
        "Seul le kérosène est compté. Le temps de vol a aussi un coût, l'équipage, l'entretien, les correspondances, qui n'entre pas dans ces euros.",
      ]),
    ]),
    el("p", { text: "Ce sont des ordres de grandeur, pas la facture d'une compagnie." }),
  );
}
/* ------------------------------------------------------------------ the jet, at the altitude of airliners */
export function writeJet({ trappes }) {
  const djf = trappes.profile.djf;
  const jja = trappes.profile.jja;
  const peak = d3.greatest(djf, (d) => d.p50);
  const peakS = d3.greatest(jja, (d) => d.p50);
  prose("#jet-prose", [
    [
      "Deux fois par jour, Météo-France lâche un ballon-sonde depuis Trappes, dans les Yvelines. En hiver, le vent médian qu'il mesure culmine à ",
      { b: kmh(peak.p50) },
      " vers ",
      { b: `${fmtNum(peak.km, 1)} km` },
      ` d'altitude (niveau de ${peak.hpa} hPa). L'été, il plafonne à ${kmh(peakS.p50)} vers ${fmtNum(peakS.km, 1)} km. C'est l'altitude de croisière des long-courriers, de 9 à 12 km : un avion de ligne ne peut pas ignorer le jet. Il le traverse, le suit ou le contourne.`,
    ],
  ]);
  after("#jet-after", [
    [
      `Le ${longDate(trappes.ciara.date)} à midi, au passage de Ciara, le ballon a mesuré `,
      { b: kmh(trappes.ciara.kmh) },
      " à 250 hPa : il fallait remonter au ",
      { b: longDate(trappes.ciara.stronger_before) },
      " pour trouver plus fort.",
    ],
    [
      "Ces ballons servent aussi de juge de paix. À Trappes, la réanalyse ERA5 utilisée dans cette enquête les suit de près : corrélation de ",
      { b: fmtNum(trappes.check.r, 3) },
      ", écart moyen de ",
      { b: kmh(trappes.check.mae) },
      `. La comparaison porte sur ${fmtNum(trappes.check.n)} sondages, de 2019 à 2022.`,
    ],
  ]);
  $("#profile-note").textContent =
    "Vent au-dessus de Trappes à chaque niveau standard, ballons-sondes de 00 h et 12 h UTC, 1991-2020.";
  lecture(
    "#chart-profile",
    "le trait donne le vent médian, la zone claire le vent dépassé une fois sur dix ; la bande grise marque les altitudes de croisière.",
  );
}

/* ------------------------------------------------------------------ the simulator chapter */
export function writePlacer({ sim }) {
  const c = sim.ciara;
  const plane = sim.aircraft.find((a) => a.code === c.aircraft);
  const cells = c.west.flatMap((r) => r.best.slice(0, 3).map((v, lv) => ({ v, h: r.hour, lv })));
  const fast = d3.least(cells, (d) => d.v);
  const slow = d3.greatest(cells, (d) => d.v);
  const fl = (lv) => `FL${sim.levels[lv].fl}`;
  const hh = (h) => `${String(h).padStart(2, "0")} h`;
  prose("#placer-prose", [
    [
      "Sur une sphère, le chemin le plus court entre deux villes est un arc de grand cercle : c'est pour cela que Paris–New York passe au-dessus de l'Irlande et de Terre-Neuve. Mais le plus court n'est pas le plus rapide quand le vent souffle à 300 km/h. Deux fois par jour, les centres de contrôle de Shanwick (Royaume-Uni et Irlande) et de Gander (Canada) publient déjà les North Atlantic Tracks, des couloirs placés pour profiter du jet vers l'Europe et l'éviter vers l'Amérique.",
    ],
    [
      "Avant chaque vol, une compagnie tranche donc trois questions : par où passer, à quelle altitude voler, à quelle heure partir. Le vent change d'un niveau à l'autre et d'heure en heure, si bien que la bonne réponse change aussi, et l'écart entre un bon et un mauvais choix se compte en dizaines de minutes.",
    ],
    [
      `Le 8 février 2020, veille de Ciara, un ${plane.name} parti de Paris pour New York aurait mis `,
      { b: hm(fast.v) },
      ` par la meilleure route en partant à ${hh(fast.h)} UTC à ${fl(fast.lv)}. Parti à ${hh(slow.h)} UTC à ${fl(slow.lv)}, il aurait mis `,
      { b: hm(slow.v) },
      `. Soit `,
      { b: minutes(slow.v - fast.v) },
      " d'écart pour le même avion, le même jour.",
    ],
  ]);
}

/* ------------------------------------------------------------------ what the best route is worth */
export function writeBilan({ stats, sim, cost }, C) {
  const R = C.route;
  const fuel = sim.aircraft.find((a) => a.name === stats.aircraft).fuel;
  const T = C.trade(fuel);
  const fl = (i) => `FL${sim.levels[i].fl}`;
  const y = cost.year;
  const last = cost.last;
  prose("#bilan-prose", [
    [
      "Sur quatre ans, le bénéfice se concentre vers l'ouest : la meilleure route fait gagner ",
      { b: minutes(R.west, 1) },
      " par vol vers New York, soit environ ",
      { b: euros(C.eurOf(R.west)) },
      " de kérosène. Sur une année de vols entre Paris-CDG et New York-JFK, cela représente de l'ordre de ",
      { b: euros(R.tonnesYear * C.price) },
      ".",
    ],
  ]);
  after(
    "#bilan-after",
    [
      [
        `Le calcul rejoue chacun des ${fmtNum(stats.days.length)} jours de 2019 à 2022, avec un ${stats.aircraft} parti de Paris à midi UTC et de New York à minuit UTC, et compare la meilleure route à ${fl(1)} à la ligne droite. Vers New York, le gain moyen de `,
        { b: minutes(R.west, 1) },
        " vaut environ ",
        { b: kg(R.kgWest) },
        ` de kérosène. Vers Paris, où le jet souffle déjà le long de la ligne droite, il tombe à ${minutes(R.east, 1)}, soit ${euros(C.eurOf(R.east))}.`,
      ],
      [
        `Sur les ${fmtNum(C.pair.mvt)} vols entre Paris-CDG et New York-JFK en ${C.pair.y}, moitié dans chaque sens, cela fait environ `,
        { b: tonnes(r10(R.tonnesYear), 0) },
        " de kérosène par an. Soit ",
        { b: tonnes(r10(R.tonnesYear * cost.factors.co2_per_fuel), 0) },
        ` de CO2. Le prix du kérosène fait varier la note : ${euros(R.tonnesYear * y.eur_t)} au prix moyen de ${y.y}, ${euros(R.tonnesYear * last.eur_t)} à celui de ${monthYear(last.m)}. Et ce n'est qu'une ligne, à une seule heure de départ.`,
      ],
      [
        `L'altitude, elle, oppose le temps au carburant. Vers New York, voler à ${fl(2)} plutôt qu'à ${fl(0)} rallonge le vol de `,
        { b: minutes(T.minutesMore, 1) },
        " en moyenne, mais économise ",
        { b: tonnes(T.tonnesLess) },
        " de kérosène. L'air plus froid du niveau bas fait aller l'avion plus vite ; l'air plus mince du niveau haut le fait moins consommer.",
      ],
      [
        "Rester bas ne se justifie donc que si une minute de vol coûte à la compagnie plus de ",
        { b: euros(T.breakEven(C.price)) },
        ` (équipage, entretien, correspondances), un coût que ce calcul ne connaît pas. Au prix de ${monthYear(last.m)}, le seuil passe à ${euros(T.breakEven(last.eur_t))} : plus le kérosène est cher, plus il vaut la peine de voler haut.`,
      ],
    ],
    [
      "Ces chiffres mesurent ce que vaut la donnée face à un vol qui l'ignorerait, pas une économie qui resterait à faire : les routes de l'Atlantique Nord sont déjà tracées chaque jour selon les vents. Le modèle ignore le poids de l'avion, qui l'empêche, lourd au départ, de monter tout de suite au niveau le plus économe. Ce sont des ordres de grandeur ; les kilos et les euros suivent le calcul de l'encadré « ",
      TO_COSTS,
      " ».",
    ],
  );
  $("#value-note").textContent =
    `Valeur du kérosène économisé en un an sur Paris-CDG–New York-JFK par la meilleure route (${tonnes(r10(R.tonnesYear), 0)}, trafic de ${C.pair.y}, vents de 2019-2022), au prix de chaque mois.`;
  lecture(
    "#chart-value",
    `la courbe suit le prix du kérosène ; le trait pointillé marque la moyenne de ${y.y}.`,
  );
}

/* ------------------------------------------------------------------ forecasting the wind */
export function writePrevoir(fc, C) {
  const P = forecastFacts(fc);
  const w = P.west;
  const e = P.east;
  const [short, long] = [Math.min(...P.leads), Math.max(...P.leads)];
  const lead = leadText;
  prose("#prevoir-prose", [
    [
      "Une route se décide avant le départ, sur une prévision du vent, pas sur le vent qui soufflera vraiment. Pour mesurer ce que cela coûte, chaque Paris–New York de ",
      String(fc.year),
      " a été rejoué : la route est tracée sur ce que l'on savait au départ, puis volée dans le vent réel (ERA5). Vers New York, la prévision émise ",
      lead(short),
      " avant le départ capte ",
      { b: pct(w.share(`hres${short}`)) },
      " du gain possible.",
    ],
  ]);
  const gainEur = (p) => C.eurOf(w.gain(p));
  after(
    "#prevoir-after",
    [
      [
        "Connaître parfaitement le vent ferait gagner ",
        { b: minutes(w.best, 1) },
        ` sur la ligne droite en ${fc.year}. À ${lead(long)}, il en reste `,
        { b: pct(w.share(`hres${long}`)) },
        " avec le modèle du Centre européen (ECMWF) et ",
        { b: pct(w.share(`pangu${long}`)) },
        " avec Pangu-Weather, un modèle d'intelligence artificielle. Le seul vent moyen du mois n'en rapporte que ",
        { b: pct(w.share("clim")) },
        `. Vers Paris, où le gain possible est plus petit (${minutes(e.best, 1)}), la prévision émise ${lead(short)} avant en capte ${pct(e.share(`hres${short}`))}.`,
      ],
      [
        "La raison tient dans l'erreur sur le vent. Le long de la route, la prévision à ",
        lead(short),
        " se trompe en moyenne de ",
        { b: kmh(w.err[`hres${short}`], 1) },
        ", celle à ",
        lead(long),
        " de ",
        { b: kmh(w.err[`hres${long}`], 0) },
        ". Le vent moyen du mois, lui, s'écarte de ",
        { b: kmh(w.err.clim, 0) },
        ".",
      ],
      [
        `En euros, sur un vol vers New York en ${fc.year}, la prévision émise ${lead(short)} avant rapporte environ `,
        { b: euros(gainEur(`hres${short}`)) },
        " par vol sur la ligne droite, celle à ",
        lead(long),
        " ",
        { b: euros(gainEur(`hres${long}`)) },
        ". Le vent moyen du mois n'en rapporte que ",
        { b: euros(gainEur("clim")) },
        ". Pour une route, une bonne prévision vaut donc plus que la moyenne des saisons, et la plus récente vaut le plus.",
      ],
    ],
    [
      `Les deux systèmes font jeu égal à ${lead(short)}. À ${lead(long)}, l'intelligence artificielle prend un léger avantage dans une comparaison qui la favorise : Pangu-Weather a été entraîné sur ERA5, la référence utilisée ici pour juger. Le calcul ne tient compte que du vent à 250 hPa et d'un départ par jour dans chaque sens.`,
    ],
  );
  $("#forecast-note").textContent =
    `Minutes gagnées par vol sur la ligne droite en ${fc.year}, selon l'information utilisée pour tracer la route ; à droite, l'erreur de cette information sur le vent le long de la route.`;
  lecture(
    "#chart-forecast",
    `chaque route est tracée sur l'information de sa ligne (aucune prévision, prévision émise ${lead(long)} ou ${lead(short)} avant le départ), puis volée dans le vent réel (ERA5) à FL340 ; la dernière barre, le vent connu d'avance, est le maximum possible.`,
  );
  return P;
}

/** The forecast chart's rows for one direction: label, minutes gained, share, error. */
export function forecastRows(fc, dir) {
  const P = forecastFacts(fc)[dir];
  const [short, long] = [Math.min(...fc.leads), Math.max(...fc.leads)];
  const days = (h) => (h < 24 ? `${h} h` : `${fmtNum(h / 24, 1)} jours`);
  const row = (key, label, group) => ({
    key,
    label,
    group,
    minutes: P.gain(key),
    share: P.share(key),
    err: P.err[key],
  });
  return [
    row("clim", "Vent moyen du mois", "Sans prévision"),
    row(`hres${long}`, `ECMWF, émise ${days(long)} avant`, "Prévision à long délai"),
    row(`pangu${long}`, `Pangu-Weather (IA), ${days(long)} avant`, "Prévision à long délai"),
    row(`hres${short}`, `ECMWF, émise ${days(short)} avant`, "Prévision de la veille"),
    row(`pangu${short}`, `Pangu-Weather (IA), ${days(short)} avant`, "Prévision de la veille"),
    { ...row("perfect", "Le vent réel, connu d'avance", "Le maximum"), err: 0 },
  ];
}

/* ------------------------------------------------------------------ which flights gain */
export function writeQuels(C) {
  const mw = C.byMonth("west");
  const me = C.byMonth("east");
  const hi = d3.maxIndex(mw);
  const lo = d3.minIndex(mw);
  const top = C.topShare("west");
  const dw = C.deciles("west");
  const median = d3.median(C.gains("west"));
  prose("#quels-prose", [
    [
      "Le gain dépend d'abord du sens : ",
      { b: minutes(C.route.west, 1) },
      " par vol vers New York, ",
      { b: minutes(C.route.east, 1) },
      " vers Paris. Il dépend ensuite de la saison : vers New York, la meilleure route rapporte en moyenne ",
      { b: euros(C.eurOf(mw[hi])) },
      ` par vol en ${monthName(hi + 1)}, `,
      { b: euros(C.eurOf(mw[lo])) },
      ` en ${monthName(lo + 1)}.`,
    ],
  ]);
  after("#quels-after", [
    [
      "Il dépend surtout du jour. Les 10 % de journées où la meilleure route rapporte le plus font ",
      { b: pct(top) },
      " du gain de l'année vers New York. Ces jours-là, elle fait gagner ",
      { b: minutes(dw[9], 0) },
      " et ",
      { b: euros(C.eurOf(dw[9])) },
      ` par vol en moyenne. La moitié des jours, le gain reste sous ${minutes(median, 1)}.`,
    ],
    [
      "Pour une compagnie, l'enjeu se concentre donc sur certains vols : ceux qui partent vers l'ouest, l'hiver, les jours de jet fort. C'est là qu'une bonne prévision et une route souple paient le plus.",
    ],
  ]);
  $("#months-note").textContent =
    `Euros de kérosène économisés en moyenne par vol par la meilleure route à FL340 plutôt que la ligne droite, par mois, 2019-2022, au prix des douze derniers mois (${perTonne(C.price)}).`;
  $("#h-months").textContent = `Vers New York, le gain culmine en ${monthName(hi + 1)}`;
  $("#deciles-note").textContent =
    "Gain moyen par vol de la meilleure route, par dixième des 1 461 jours de 2019-2022.";
  lecture(
    "#chart-deciles",
    "les jours sont rangés du gain le plus faible au plus fort ; la dernière barre regroupe les 10 % de jours où la meilleure route rapporte le plus.",
  );
  return { mw, me, dw, de: C.deciles("east") };
}

/* ------------------------------------------------------------------ tomorrow */
export function writeHistoire({ climate, history }) {
  const [hiY, hiV] = climate.top[0];
  const [loY, loV] = climate.bottom[0];
  const t = climate.trend79;
  const top = history.top[0];
  prose("#histoire-prose", [
    [
      "D'un hiver à l'autre, le vent arrière moyen sur New York–Paris, de décembre à février, va de ",
      { b: kmh(loV) },
      ` en ${winter(loY)} à `,
      { b: kmh(hiV) },
      ` en ${winter(hiY)}. La moyenne de 1991 à 2020 est de ${kmh(climate.mean)}. Ces écarts suivent l'oscillation nord-atlantique (NAO), la balance de pression entre l'anticyclone des Açores et la dépression d'Islande : corrélation de `,
      { b: fmtNum(climate.nao.r, 2) },
      ` sur ${climate.nao.n} hivers. Un hiver de NAO forte coûte donc plus cher aux vols vers l'ouest, et rapporte plus à ceux qui savent contourner le vent.`,
    ],
  ]);
  after("#histoire-after", [
    [
      `Depuis ${t.from} et les premières observations par satellite, la réanalyse de la NOAA ne montre pas de tendance nette : `,
      { b: `${t.slope >= 0 ? "+" : "−"}${kmh(Math.abs(t.slope), 1)}` },
      " par décennie pour le vent moyen de l'hiver, avec une marge de plus ou moins ",
      { b: kmh(t.ci, 1) },
      ".",
    ],
    [
      "Des chercheurs projettent pourtant un jet d'hiver plus fort avec le réchauffement (Williams, 2016, pour un doublement du CO2), qui allongerait les vols vers l'ouest. D'autres relèvent une hausse de la turbulence en air clair au-dessus de l'Atlantique Nord depuis 1979 (Prosser et al., 2023). Ces séries, trop variables, ne permettent ni de confirmer ni d'infirmer la première projection.",
    ],
    [
      `Le record de la série, depuis ${history.start.slice(0, 4)}, date du ${longDate(top[0])} : `,
      { b: kmh(top[1]) },
      " de vent arrière en moyenne sur New York–Paris.",
    ],
  ]);
  $("#winters-note").textContent =
    "Vent arrière moyen le long du grand cercle New York–Paris à 250 hPa, de décembre à février ; en dessous, l'indice NAO du même hiver.";
  lecture(
    "#chart-winters",
    "les barres hautes sont les hivers coûteux vers l'ouest ; avant 1979, sans satellites, la réanalyse est moins fiable (barres claires). L'hiver 2014 va de décembre 2013 à février 2014.",
  );
  $("#records-note").textContent =
    "Vent moyen de la journée le long de New York–Paris, un jour par épisode. Les jours marqués d'un avion s'ouvrent dans le simulateur.";
}

/* ------------------------------------------------------------------ the essentials, at the top */
export function writeEssentiel(F, C, P) {
  // each answer under its number: [chapter, number, question, answer]
  const items = [
    [
      "ecart",
      tonnes(C.kgOf(F.gap) / 1000),
      "Combien coûte le vent ?",
      [
        "Vers New York, le vent ajoute en médiane ",
        { b: hm(F.gap) },
        ` de vol et environ ${tonnes(C.kgOf(F.gap) / 1000)} de kérosène. Une minute de croisière brûle environ `,
        { b: kg(C.KG) },
        ", ",
        { b: euros(C.EUR) },
        ".",
      ],
    ],
  ];
  if (C.route)
    items.push([
      "bilan",
      euros(C.eurOf(C.route.west)),
      "Jouer avec le vent rapporte-t-il ?",
      [
        "Oui, surtout vers l'ouest : la meilleure route fait gagner ",
        { b: euros(C.eurOf(C.route.west)) },
        " par vol vers New York, et environ ",
        { b: `${fmtNum((C.route.tonnesYear * C.price) / 1e6, 1)} millions d'euros` },
        " par an sur la seule ligne Paris-CDG–New York-JFK.",
      ],
    ]);
  if (P) {
    const short = Math.min(...P.leads);
    items.push([
      "prevoir",
      pct(P.west.share(`hres${short}`)),
      "Faut-il une prévision parfaite ?",
      [
        `Non : calculée sur la prévision émise ${leadText(short)} avant le départ, la route capte `,
        { b: pct(P.west.share(`hres${short}`)) },
        " du gain possible. Avec le seul vent moyen du mois, ",
        { b: pct(P.west.share("clim")) },
        ".",
      ],
    ]);
  }
  if (C.route)
    items.push([
      "quels-vols",
      pct(C.topShare("west")),
      "Quels vols y gagnent ?",
      [
        "Les vols vers l'ouest, l'hiver, les jours de jet fort : un jour sur dix fait ",
        { b: pct(C.topShare("west")) },
        " du gain annuel vers New York.",
      ],
    ]);
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

/* ------------------------------------------------------------------ the answer */
export function writeBref(data, F, C, P) {
  const paras = [
    [
      "Oui, pour certains vols. Le courant-jet coûte cher aux vols vers l'ouest : sur Paris–New York, ",
      { b: hm(F.gap) },
      " et environ ",
      { b: tonnes(C.kgOf(F.gap) / 1000) },
      " de kérosène de plus que le retour.",
    ],
  ];
  if (C.route)
    paras[0].push(
      " Le contourner en choisissant chaque jour la meilleure route rapporte en moyenne ",
      { b: euros(C.eurOf(C.route.west)) },
      " par vol vers New York, et environ ",
      {
        b: `${fmtNum((C.route.tonnesYear * C.price) / 1e6, 1)} millions d'euros`,
      },
      " par an sur cette seule ligne.",
    );
  if (P)
    paras.push([
      "Nul besoin d'une prévision parfaite : celle émise la veille capte presque tout le gain, que le modèle soit physique ou d'intelligence artificielle. Le gain se concentre sur les vols vers l'ouest, l'hiver et les jours de jet fort, et grandit avec le prix du kérosène.",
    ]);
  paras.push([
    "Ce gain est déjà en grande partie empoché : les routes de l'Atlantique Nord sont tracées chaque jour selon les vents, et les vols réels se comportent comme des avions qui cherchent la meilleure route. Ce que cette enquête mesure, c'est ce que coûterait de s'en passer.",
  ]);
  prose("#reponse-prose", paras);

  const A = avionFacts(data.flights.aircraft);
  const cards = [
    ["ecart", "L'écart", hm(F.gap), "de plus vers New York que vers Paris, en médiane", "var(--west)"],
    ["ecart", "Une minute", kg(C.KG), `de kérosène par minute de croisière, ${euros(C.EUR)}`, "var(--ink)"],
    [
      "vent",
      "Le vent",
      minutes(-F.fit.w.slope, 1),
      "de plus vers New York par tranche de 10 km/h de vent de face",
      "var(--west)",
    ],
  ];
  if (C.route)
    cards.push(
      [
        "bilan",
        "La route",
        euros(C.eurOf(C.route.west)),
        "gagnés par vol vers New York par la meilleure route",
        "var(--east)",
      ],
      [
        "bilan",
        "Une année",
        `${fmtNum((C.route.tonnesYear * C.price) / 1e6, 1)} M€`,
        "par an sur Paris-CDG–New York-JFK",
        "var(--east)",
      ],
    );
  if (P)
    cards.push([
      "prevoir",
      "La prévision",
      pct(P.west.share(`hres${Math.min(...P.leads)}`)),
      "du gain capté avec la prévision de la veille",
      "var(--east)",
    ]);
  if (C.route)
    cards.push([
      "quels-vols",
      "Les jours de jet",
      pct(C.topShare("west")),
      "du gain annuel fait par un jour sur dix",
      "var(--west)",
    ]);
  cards.push([
    "avion",
    "L'avion",
    minutes(A.spread),
    "entre l'avion le plus rapide et le plus lent, à vent égal",
    "var(--ink)",
  ]);
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
      " que la moyenne. Les ",
      listNames(A.slow),
      " mettent ",
      { b: `${s0 === s1 ? s1 : `${s0} à ${s1}`} minutes de plus` },
      ". Entre le plus rapide et le plus lent, le même jour sur la même ligne, il y a ",
      { b: minutes(A.spread) },
      ".",
    ],
    [
      `Sur Paris–New York, ${worst.name}, qui y fait surtout voler des ${fleet(worst)}, perd `,
      { b: minutes(A.mean(worst)) },
      ` par vol sur la moyenne de la ligne à vent égal. ${best.name}, avec ses ${fleet(best)}, en gagne `,
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
  prose("#avion-prose", paras.slice(0, 1));
  after("#avion-after", paras.slice(1));
  $("#h-types").textContent =
    `Les ${listNames(A.fast.slice(0, 2))} devant, les ${listNames(A.slow.slice(-2))} derrière`;
  $("#types-note").textContent =
    "Écart médian à la durée prévue par le vent sur la même ligne et dans le même sens, toutes lignes de la grille de vent, 2019-2022. Bleu : vers la France ; rose : vers l'Amérique. Avions d'au moins 150 vols dans chaque sens.";
}

/* ------------------------------------------------------------------ the round-trip simulator */
export function initSim(sim, { km, tas }) {
  const input = $("#rt-wind");
  const out = $("#rt-out");
  const update = () => {
    const w = +input.value;
    const go = (km / (tas - w)) * 60;
    const back = (km / (tas + w)) * 60;
    out.textContent = kmh(w);
    input.setAttribute("aria-valuetext", kmh(w));
    sim.set(w);
    $("#rt-read").replaceChildren(
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
  const longest = (r) =>
    d3.greatest(
      r.months.w.map((v, m) => [m + 1, v]).filter((d) => d[1] !== null),
      (d) => d[1],
    )[0];
  const longer = routes.filter((r) => r.west.med > r.east.med).length;
  const winterPeak = routes.filter((r) => [12, 1, 2, 3].includes(longest(r))).length;
  prose("#vol-prose", [
    [
      "Paris–New York n'est pas une exception. Sur les ",
      { b: String(routes.length) },
      ` lignes entre la France et l'Amérique du Nord suivies plus de 300 fois dans chaque sens de 2019 à 2022, le vol vers l'Amérique dure plus longtemps que le retour ${longer === routes.length ? "sur toutes" : `sur ${longer}`}, et sur `,
      { b: String(winterPeak) },
      ", son mois le plus long tombe entre décembre et mars, quand le jet est au plus fort.",
    ],
  ]);
}
