// @ts-check
// Every number of « Qui retarde les avions en Europe ? », from data/atfm/atfm.json (etl/atfm/build_atfm.py),
// recomputed by web/scripts/check_atfm.py without reading this file. The delay is the en-route ATFM delay:
// minutes waited on the ground because a control centre on the route asked for a restriction.

export const GROUP_ORDER = ["capacite", "effectifs", "meteo", "greves", "autres"];
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
export const DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
/** "2024-07-20" -> "20 juillet 2024" */
export const dayLabel = (/** @type {string} */ d) =>
  `${+d.slice(8) === 1 ? "1er" : +d.slice(8)} ${MONTHS_FR[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

/** @param {any} A the parsed atfm.json */
export function atfmFacts(A) {
  const y = String(A.meta.lastFull);
  const Y = A.years[y];
  const years = Object.keys(A.years).filter((k) => +k <= A.meta.lastFull);
  const base = ["2014", "2015", "2016", "2017"];
  const basePer =
    base.reduce((s, k) => s + A.years[k].delay, 0) / base.reduce((s, k) => s + A.years[k].flights, 0);
  const peak = years.reduce((a, b) => (A.years[b].perFlight > A.years[a].perFlight ? b : a));
  const share = Object.fromEntries(GROUP_ORDER.map((g) => [g, Y.groups[g] / Y.delay]));
  const share0 = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, A.years[years[0]].groups[g] / A.years[years[0]].delay]),
  );
  // summer: June to August of the last full year
  const sm = ["06", "07", "08"].map((m) => A.months[`${y}-${m}`]);
  const summerDelay = sm.reduce((s, m) => s + m.delay, 0) / Y.delay;
  const summerFlights = sm.reduce((s, m) => s + m.flights, 0) / Y.flights;
  // providers, last full year
  const provs = Object.entries(A.providers)
    .map(([code, p]) => {
      const v = /** @type {any} */ (p).years[y];
      return v && v.flights > 0
        ? {
            code,
            country: /** @type {any} */ (p).country,
            name: /** @type {any} */ (p).name,
            delay: v.delay,
            flights: v.flights,
            perFlight: v.delay / v.flights,
            groups: v.groups,
          }
        : null;
    })
    .filter((p) => p !== null);
  const total = provs.reduce((s, p) => s + p.delay, 0);
  const byDelay = [...provs].sort((a, b) => b.delay - a.delay).map((p) => ({ ...p, share: p.delay / total }));
  const byPer = [...provs].filter((p) => p.flights > 300000).sort((a, b) => b.perFlight - a.perFlight);
  const calm = provs.filter((p) => p.perFlight < 0.1).length;
  const fr = byDelay.find((p) => p.code === "FR");
  const frTop = GROUP_ORDER.reduce((a, b) => (fr.groups[b] > fr.groups[a] ? b : a));
  const worst = A.worst[0];
  const worstYear = worst.date.slice(0, 4);
  const worstInYear = A.worst.filter((/** @type {any} */ w) => w.date.startsWith(worstYear)).length;
  const wHi = A.week.indexOf(Math.max(...A.week));
  const wLo = A.week.indexOf(Math.min(...A.week));
  const cur = Object.keys(A.years).at(-1);
  const hasYtd = +cur > A.meta.lastFull;
  return {
    A,
    year: +y,
    first: +years[0],
    years,
    perFlight: Y.perFlight,
    basePer,
    ratio: Y.perFlight / basePer,
    peak: +peak,
    peakPer: A.years[peak].perFlight,
    flights: Y.flights,
    delay: Y.delay,
    delayYears: Y.delay / 525600,
    delayed: Y.delayed / Y.flights,
    delayed15: Y.delayed15 / Y.flights,
    perDelayed: Y.delay / Y.delayed,
    share,
    share0,
    summerDelay,
    summerFlights,
    provs,
    byDelay,
    byPer,
    calm,
    nProv: provs.length,
    fr,
    frTop,
    top3: byDelay.slice(0, 3).reduce((s, p) => s + p.share, 0),
    worst,
    worstYear: +worstYear,
    worstInYear,
    nWorst: A.worst.length,
    wHi,
    wLo,
    weekRatio: A.week[wHi] / A.week[wLo],
    cur: +cur,
    hasYtd,
    ytd: hasYtd ? A.ytd[cur].perFlight : null,
    ytdPrev: hasYtd ? A.ytd[y].perFlight : null,
    ytdTo: A.meta.ytdTo,
    last: A.meta.last,
  };
}
