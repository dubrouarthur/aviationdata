// @ts-check
// Every number of « Le ciel clair est-il plus agité ? », computed from data/cat/cat.json (etl/cat/build_cat.py)
// and recomputed by web/scripts/check_cat.py without reading this file. A frequency is the share of the
// 6-hourly ERA5 analyses in which the Ellrod index crosses the threshold of the strongest situations of the
// globe: « des conditions propices à la turbulence en air clair », never turbulence that was felt.

export const SEASONS = ["DJF", "MAM", "JJA", "SON"];
export const SEASON_FR = {
  DJF: "de décembre à février",
  MAM: "de mars à mai",
  JJA: "de juin à août",
  SON: "de septembre à novembre",
};
/** the northern hemisphere's name of each season */
export const SEASON_NAME = { DJF: "l'hiver", MAM: "le printemps", JJA: "l'été", SON: "l'automne" };
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
/** the five regions of the cruise routes, the two hemispheres apart */
export const LOCAL = ["atlantique", "pacifique", "europe", "amerique", "asie"];

/** the cruise speed that turns a share of a route into minutes of flight (a round figure, said in the text) */
export const CRUISE_KMH = 900;
/** minutes of a great-circle route flown at CRUISE_KMH */
export const flightMinutes = (/** @type {{km: number}} */ r) => (r.km / CRUISE_KMH) * 60;
/** minutes of that flight spent in favourable conditions, on average, in a season */
export const routeMinutes = (/** @type {any} */ r, /** @type {string} */ season) =>
  r.seasons[season] * flightMinutes(r);

/** @param {string} s base64 of bytes */
export function bytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** mean of the non-null values */
const mean = (/** @type {(number|null)[]} */ v) => {
  const x = /** @type {number[]} */ (v.filter((d) => d !== null));
  return x.reduce((a, b) => a + b, 0) / x.length;
};

/** @param {any} C the parsed cat.json */
export function catFacts(C) {
  const years = C.meta.years;
  const first = years[0];
  const last = years.at(-1);
  const regions = Object.fromEntries(
    Object.entries(C.regions).map(([key, /** @type {any} */ r]) => {
      const seasonClim = Object.fromEntries(SEASONS.map((s) => [s, mean(r.seasons[s])]));
      const peakSeason = SEASONS.reduce((a, b) => (seasonClim[b] > seasonClim[a] ? b : a));
      const lowSeason = SEASONS.reduce((a, b) => (seasonClim[b] < seasonClim[a] ? b : a));
      const peakMonth = r.clim.indexOf(Math.max(...r.clim));
      const growing = SEASONS.filter((s) => r.decadesSeasons[s].change > 0);
      const fastest = SEASONS.reduce((a, b) =>
        r.decadesSeasons[b].change > r.decadesSeasons[a].change ? b : a,
      );
      return [
        key,
        {
          key,
          ...r,
          clim: mean(r.annual),
          climMonths: r.clim,
          seasonClim,
          peakSeason,
          lowSeason,
          seasonRatio: seasonClim[peakSeason] / seasonClim[lowSeason],
          peakMonth,
          change: r.decades.change,
          sevChange: r.decadesSev.change,
          growing,
          fastest,
          vwsChange: r.trendVws.change,
          wsChange: r.trendWs.change,
        },
      ];
    }),
  );
  const local = LOCAL.map((k) => regions[k]);
  const byClim = [...local].sort((a, b) => b.clim - a.clim);
  const byChange = [...local].sort((a, b) => b.change - a.change);
  const atl = regions.atlantique;
  const nh = regions.nord;
  const sh = regions.sud;
  // the zonal band: the latitude and month where the conditions are most frequent, north and south
  const lat = (/** @type {number} */ i) => C.meta.lat0 + i * C.meta.step;
  const zonalPeak = (/** @type {boolean} */ north) => {
    let best = { v: -1, i: 0, m: 0 };
    C.zonal.all.forEach((/** @type {number[]} */ row, /** @type {number} */ m) =>
      row.forEach((v, i) => {
        if (north === lat(i) > 0 && v > best.v) best = { v, i, m };
      }),
    );
    return { freq: best.v, lat: lat(best.i), month: best.m };
  };
  // in the north, the latitude where each month's conditions peak
  const northLat = C.zonal.all.map((/** @type {number[]} */ row) => {
    let best = { v: -1, la: 0 };
    row.forEach((v, i) => {
      if (lat(i) > 0 && v > best.v) best = { v, la: lat(i) };
    });
    return best.la;
  });
  const levels = C.meta.levels.map((/** @type {number} */ L) => ({
    L,
    fl: C.meta.fl[L],
    freq: nh.levels[L],
  }));
  const topLevel = levels.reduce((a, /** @type {any} */ b) => (b.freq > a.freq ? b : a));
  const routes = [...C.routes].sort((a, b) => b.annual - a.annual);
  const pny = C.routes.find((/** @type {any} */ r) => r.key === "CDG-JFK");
  const atlYears = atl.monthly.map((/** @type {number[]} */ row) => mean(row));
  return {
    first,
    last,
    years,
    nYears: years.length,
    analyses: C.meta.analyses,
    pctMod: C.meta.pctMod,
    pctSev: C.meta.pctSev,
    thrMod: C.meta.thrMod,
    regions,
    local,
    byClim,
    byChange,
    atl,
    nh,
    sh,
    north: zonalPeak(true),
    south: zonalPeak(false),
    levels,
    topLevel,
    routes,
    pny,
    pnyWinterOverSummer: pny.seasons.DJF / pny.seasons.JJA,
    up: local.filter((r) => r.change > 0),
    atlMax: Math.max(...atlYears),
    atlMaxYear: years[atlYears.indexOf(Math.max(...atlYears))],
    span: [C.change.first, C.change.last],
    northLat,
    // the change map: share of the cells compared that gained
    changeUp: (() => {
      const v = [...bytes(C.change.values)].filter((x) => x !== 255);
      return v.filter((x) => x > 128).length / v.length;
    })(),
    atlWinterOverSummer: atl.seasonClim.DJF / atl.seasonClim.JJA,
    hours: (/** @type {number} */ f) => f * 8766,
  };
}
