// @ts-check
// Every number of « Le ciel des jets privés », from one file: jets/jets.json (OpenSky Network flight lists,
// 2019-2022, etl/jets/build_jets.py). Recomputed in Python by web/scripts/check_jets.py.
//
// Three biases of the source, and how the numbers avoid them:
// - the network grew between 2019 and 2022 (more receivers, more airports seen), and many business jets
//   began to broadcast their position (ADS-B) only around the European deadline of December 2020: the
//   shares and the indices over time are taken on the fleet panel, the aircraft it already followed
//   over Europe in 2019, counted on all their flights seen over Europe, airports seen or not. Even so its
//   business jets drift up (index 130 in February 2020, before the Covid) and its aircraft leave it when
//   sold abroad: the figures stop at the end of 2020 (PANEL_TO) and the text compares no later level;
// - it names an airport only when it saw the aircraft near it: distances, routes and seasons are those
//   of the flights it placed, and the text says so;
// - an airport it began to see better within a year gets a false season: seasons are kept only for
//   airports busy enough in both years whose two profiles agree (SEASON_AGREE).

const sum = (/** @type {number[]} */ a) => a.reduce((x, y) => x + y, 0);
const argmax = (/** @type {number[]} */ a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

export const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
export const DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** "2020-06" → "juin 2020" */
export const monthLabel = (/** @type {string} */ m) => `${MONTHS_FR[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

/** The last month of the fleet panel's figures: after 2020 its levels no longer compare with 2019. */
export const PANEL_TO = "2020-12";

/** The season figure: the busiest airports, then the most seasonal of the others. */
export const SEASON_BIG = 12;
export const SEASON_EXTRA = 10;
/** Business-jet movements an airport needs in each compared year, and the agreement of its two profiles. */
export const SEASON_MIN = 300;
export const SEASON_AGREE = 0.7;
export const SEASON_STRONG = 1.9;

/** Pearson correlation of two series. */
export function corr(a, b) {
  const ma = sum(a) / a.length;
  const mb = sum(b) / b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  a.forEach((x, i) => {
    num += (x - ma) * (b[i] - mb);
    da += (x - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return num / Math.sqrt(da * db);
}

/** London's business airports (a city with several in the routes). */
export const LONDON = ["EGLF", "EGGW", "EGKB", "EGLC", "EGSS", "EGWU", "EGLL", "EGKK"];

/** The distance classes of the figure, in km (the last one open). */
export const KM_CLASSES = [0, 250, 500, 1000, 2000, 4000];

/** An airport's name for the reader: the French label of the ETL, else its city. */
export const placeName = (J, /** @type {string} */ ident) => J.airports[ident]?.label ?? ident;

/** Shares of flights by distance class, from the 50 km histogram. */
export function kmClasses(hist, width) {
  const n = sum(hist);
  return KM_CLASSES.map((lo, k) => {
    const hi = KM_CLASSES[k + 1] ?? Infinity;
    const v = sum(hist.filter((_, i) => i * width >= lo && i * width < hi));
    return { lo, hi, share: n ? v / n : 0 };
  });
}

/**
 * Seasonal profile of an airport: each month's business-jet movements over the year's monthly mean, in
 * each compared year; kept when both years have SEASON_MIN movements or more and their profiles agree
 * (correlation SEASON_AGREE or more), then averaged. `peak` is the busiest month, `weight` its value
 * (2 = twice an average month). null otherwise.
 */
export function profile(J, /** @type {string} */ ident) {
  const a = J.airports[ident];
  if (!a?.jets) return null;
  const year = (y) => {
    const i0 = J.months.indexOf(`${y}-01`);
    return a.jets.slice(i0, i0 + 12);
  };
  const ys = J.compare.map(year);
  if (ys.some((m) => sum(m) < SEASON_MIN)) return null;
  const profs = ys.map((m) => m.map((v) => v / (sum(m) / 12)));
  const agree = corr(profs[0], profs.at(-1));
  if (!(agree >= SEASON_AGREE)) return null;
  const prof = profs[0].map((_, k) => sum(profs.map((p) => p[k])) / profs.length);
  const peak = argmax(prof);
  const low = prof.indexOf(Math.min(...prof));
  return { ident, label: a.label, cc: a.cc, prof, peak, low, weight: prof[peak], agree, movements: sum(a.jets) };
}

export function jetFacts(J) {
  const M = J.months;
  const [first, last] = [J.compare[0], J.compare.at(-1)];
  const yi = (y) => M.flatMap((m, i) => (m.startsWith(String(y)) ? [i] : []));
  const P = J.fleet;

  // ---------------------------------------------------------------- share of the flights, fleet panel
  const share = P.jets.map((j, i) => j / (j + P.liners[i]));
  const yearShare = (y) => sum(yi(y).map((i) => P.jets[i])) / sum(yi(y).map((i) => P.jets[i] + P.liners[i]));
  // the peak within the months the figures show (to PANEL_TO)
  const peakI = argmax(share.slice(0, M.indexOf(PANEL_TO) + 1));

  // ---------------------------------------------------------------- the Covid: index vs the same month of 2019
  const index = (arr) => arr.map((v, i) => (i < 12 ? null : (v / arr[i % 12]) * 100));
  const ij = index(P.jets);
  const il = index(P.liners);
  const feb = M.indexOf("2020-02");
  const april = M.indexOf("2020-04");
  const july = M.indexOf("2020-07");
  const end = M.indexOf(PANEL_TO);

  // ---------------------------------------------------------------- distances (flights placed, both airports)
  const Yj = J.jets.year[last];
  const Yl = J.liners.year[last];
  const classesJ = kmClasses(Yj.kmEu, J.kmBin);
  const classesL = kmClasses(Yl.kmEu, J.kmBin);
  const shortJ = Yj.shortEu / Yj.placed;
  const shortL = Yl.shortEu / Yl.placed;
  const shortFr = Yj.shortFr / Yj.placedFr;

  // ---------------------------------------------------------------- routes touching France
  const routes = J.routesFr[last].slice(0, 10).map(([a, b, n, km]) => {
    // Paris first, then the French end, then the other
    const [x, y] =
      a === "LFPB" || (a.startsWith("LF") && b !== "LFPB" && !b.startsWith("LF")) ? [a, b] : [b, a];
    return { a: x, b: y, label: `${placeName(J, x)} – ${placeName(J, y)}`, flights: n, km };
  });
  const shortRoutes = routes.filter((r) => r.km < J.shortKm).length;
  const parisRoutes = routes.filter((r) => r.a === "LFPB" || r.b === "LFPB").length;
  const londonRoutes = routes.filter((r) => LONDON.includes(r.a) || LONDON.includes(r.b)).length;
  const londonAirports = [...new Set(routes.flatMap((r) => [r.a, r.b]).filter((a) => LONDON.includes(a)))];

  // ---------------------------------------------------------------- seasons
  // the busiest airports, and the most seasonal of the others: a row each, ordered by busiest month
  const pool = Object.keys(J.airports)
    .map((a) => profile(J, a))
    .filter(Boolean)
    .sort((x, y) => y.movements - x.movements || (x.ident < y.ident ? -1 : 1));
  const big = pool.slice(0, SEASON_BIG);
  const seasonal = pool
    .slice(SEASON_BIG)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, SEASON_EXTRA);
  const seasons = [...big, ...seasonal].sort((x, y) => x.peak - y.peak || y.weight - x.weight);
  // the text names only clearly seasonal airports: their busiest month at least SEASON_STRONG times an
  // average month, in winter (December to March) or in summer (June to August)
  const strong = seasons.filter((s) => s.weight >= SEASON_STRONG);
  const winter = strong.filter((s) => s.peak <= 2 || s.peak === 11);
  const summer = strong.filter((s) => s.peak >= 5 && s.peak <= 7);
  const mostSeasonal = [...seasons].sort((x, y) => y.weight - x.weight)[0];
  // the busiest airports that are not clearly seasonal (the text names two, never their rank)
  const steady = big.filter((s) => s.weight < SEASON_STRONG);

  // ---------------------------------------------------------------- the week
  const week = (w) => w.map((v) => v / (sum(w) / 7));
  const weekJ = week(Yj.weekday);
  const weekL = week(Yl.weekday);
  const busyDay = argmax(weekJ);
  const quietDay = weekJ.indexOf(Math.min(...weekJ));

  // ---------------------------------------------------------------- who flies them
  const shares = (c) => {
    const n = sum(Object.values(c));
    return { operator: c.operator / n, registration: c.registration / n, other: c.other / n };
  };
  const callsign = shares(Yj.callsign);
  // by size: light jets (ICAO wake category L, up to 7 t) and the others, in the last year
  const callsignL = shares(J.callsignWtc[last].L);
  const callsignM = shares(J.callsignWtc[last].M);
  const models = J.jets.models[last];
  const modelsN = sum(Yj.weekday);
  // light jets' share of the flights: every flight counted by wake category (callsignWtc), not only the
  // most common models
  const nL = sum(Object.values(J.callsignWtc[last].L));
  const light = nL / (nL + sum(Object.values(J.callsignWtc[last].M)));
  const topModels = models
    .slice(0, 8)
    .map(([c, n]) => ({ code: c, ...J.types[c], flights: n, share: n / modelsN }));

  return {
    first,
    last,
    months: M,
    fleetJets: P.jetsAircraft,
    fleetLiners: P.linersAircraft,
    fleetMin: P.min,
    seasonAirports: pool.length,
    seasonMin: SEASON_MIN,
    seasonStrong: SEASON_STRONG,
    niceInSeasons: pool.some((s) => s.ident === "LFMN"),
    panelTo: PANEL_TO,
    share,
    share0: yearShare(first),
    oneIn0: Math.round(1 / yearShare(first)),
    peak: {
      month: M[peakI],
      share: share[peakI],
      oneIn: Math.round(1 / share[peakI]),
      // against the same month of the panel's year, the least drifted comparison
      times: share[peakI] / share[peakI % 12],
    },
    ij,
    il,
    feb: { jets: ij[feb], liners: il[feb] },
    april: { jets: ij[april], liners: il[april] },
    july: { jets: ij[july], liners: il[july] },
    dec: { jets: ij[end], liners: il[end] },
    classesJ,
    classesL,
    shortJ,
    shortL,
    shortFr,
    medianKmJ: Yj.medianKm,
    medianKmL: Yl.medianKm,
    medianMinJ: Yj.medianMin,
    routes,
    shortRoutes,
    parisRoutes,
    londonRoutes,
    londonAirports: londonAirports.map((a) => placeName(J, a)),
    seasons,
    winter,
    summer,
    mostSeasonal,
    seasonShown: seasons.length,
    steady,
    weekJ,
    weekL,
    busyDay,
    quietDay,
    callsign,
    callsignL,
    callsignM,
    light,
    topModels,
    daysJ: Yj.medianDays,
    daysL: Yl.medianDays,
    daysQJ: Yj.daysQ,
    perDayJ: Yj.flightsPerDay,
    perDayL: Yl.flightsPerDay,
    fleet: Yj.fleet,
    aircraft: Yj.aircraft,
    flightsLast: Yj.eu,
    placedLast: Yj.placed,
    coverage: { origin: Yj.coverage.origin / Yj.coverage.seen, both: Yj.coverage.both / Yj.coverage.seen },
    coverageL: { both: Yl.coverage.both / Yl.coverage.seen },
  };
}
