// Every number of the fourth investigation, from eu.json (etl/eu/build_eu.py). The text, the charts and
// web/scripts/check_eu.py read the same values: a figure written in the story is computed here once.

export const YEAR_2019 = 2019;

/** Index helpers on a zone's yearly arrays. */
export const yearIndex = (data, y) => data.years.indexOf(y);
export const value = (data, zone, key, y) => zone[key][yearIndex(data, y)] ?? null;

/** "2026-03" -> list of months from a zone's monthly start, as "YYYY-MM". */
export function monthList(start, last) {
  const out = [];
  let [y, m] = start.split("-").map(Number);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > last) return out;
    out.push(k);
    m === 12 ? ((y += 1), (m = 1)) : (m += 1);
  }
}

/** Kilometres in a degree of latitude (mean Earth radius): north-south offsets of the barycentre. */
export const KM_DEG = (6371.0088 * Math.PI) / 180;

/** Great-circle distance in km (mean Earth radius). */
export function km(a, b) {
  const r = Math.PI / 180;
  const [la1, lo1, la2, lo2] = [a.lat * r, a.lon * r, b.lat * r, b.lon * r];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

/** A zone's figures for the dashboard: last year, change on 2019 and on its first year, record month. */
export function zoneFacts(data, zone, key = "total") {
  const last = data.meta.last;
  const first = Math.max(zone.first, data.meta.first);
  const v = (y) => value(data, zone, key, y);
  const months = monthList(zone.monthStart, zone.monthLast);
  const series = zone.monthly[key] ?? [];
  let rec = -1;
  series.forEach((x, i) => {
    if (x != null && (rec < 0 || x > series[rec])) rec = i;
  });
  const annual = data.years
    .map((y, i) => ({ y, v: zone[key][i] }))
    .filter((d) => d.v != null && d.y >= first);
  const best = annual.reduce((a, b) => (b.v > a.v ? b : a), annual[0]);
  return {
    last,
    first,
    now: v(last),
    y2019: v(YEAR_2019),
    vs2019: v(YEAR_2019) ? 100 * (v(last) / v(YEAR_2019) - 1) : null,
    vsFirst: v(first) ? 100 * (v(last) / v(first) - 1) : null,
    ratioFirst: v(first) ? v(last) / v(first) : null,
    bestYear: best?.y,
    recordMonth: rec >= 0 ? months[rec] : null,
    recordValue: rec >= 0 ? series[rec] : null,
    months,
    series,
  };
}

/** The story's facts: the Union, the countries against 2019, national flights, airports, the barycentre. */
export function storyFacts(data) {
  const Z = Object.fromEntries(data.zones.map((z) => [z.code, z]));
  const eu = Z.EU27_2020;
  const countries = data.zones.filter((z) => z.code !== "EU27_2020");
  const last = data.meta.last;
  const v = (z, y, key = "total") => value(data, z, key, y);
  const E = zoneFacts(data, eu);

  // the Union: the hole of 2020, the year it passed 2019 again, the month of the record
  const months = E.months;
  const at = (m) => E.series[months.indexOf(m)];
  const low = months.reduce((a, m) => (at(m) != null && at(m) < at(a) ? m : a), months[0]);
  const sameMonth2019 = `2019-${low.slice(5)}`;
  const back = data.years.find((y) => y > 2020 && v(eu, y) > v(eu, YEAR_2019));
  // the last months published, against the same months a year before
  const lastMonth = eu.monthLast;
  const lastYearMonths = months.filter((m) => m.slice(0, 4) === lastMonth.slice(0, 4));
  const prevMonths = lastYearMonths.map((m) => `${+m.slice(0, 4) - 1}${m.slice(4)}`);
  const sum = (ms) => ms.reduce((s, m) => s + at(m), 0);

  const union = {
    y2008: v(eu, 2008),
    y2019: v(eu, YEAR_2019),
    y2020: v(eu, 2020),
    now: v(eu, last),
    vs2019: E.vs2019,
    vs2008: 100 * (v(eu, last) / v(eu, 2008) - 1),
    drop2020: 100 * (1 - v(eu, 2020) / v(eu, YEAR_2019)),
    back,
    backValue: v(eu, back),
    low,
    lowValue: at(low),
    lowSame2019: at(sameMonth2019),
    lowDrop: 100 * (1 - at(low) / at(sameMonth2019)),
    recordMonth: E.recordMonth,
    recordValue: E.recordValue,
    lastMonth,
    partial: { months: lastYearMonths, now: sum(lastYearMonths), before: sum(prevMonths) },
    natShare: (y) => (100 * v(eu, y, "nat")) / v(eu, y),
    parts: (y) => ({ nat: v(eu, y, "nat"), ieu: v(eu, y, "ieu"), xeu: v(eu, y, "xeu") }),
  };
  union.partial.change = 100 * (union.partial.now / union.partial.before - 1);

  // the countries in the last year against 2019
  const vs = countries
    .map((z) => ({
      code: z.code,
      name: z.name,
      iso: z.iso,
      eu: z.eu,
      change: 100 * (v(z, last) / v(z, YEAR_2019) - 1),
    }))
    .sort((a, b) => b.change - a.change);
  const above = vs.filter((c) => c.change > 0);
  const below = vs.filter((c) => c.change < 0);

  // national flights, countries with at least 500 000 national passengers in 2019
  const nat = countries
    .filter((z) => v(z, YEAR_2019, "nat") >= 500_000)
    .map((z) => ({
      code: z.code,
      name: z.name,
      y2019: v(z, YEAR_2019, "nat"),
      now: v(z, last, "nat"),
      change: 100 * (v(z, last, "nat") / v(z, YEAR_2019, "nat") - 1),
    }))
    .sort((a, b) => a.change - b.change);

  // airports: the ranking each year
  const AY = data.airportYears;
  const rank = (y) => {
    const i = AY.indexOf(y);
    return data.airports
      .filter((a) => a.pax[i] != null)
      .sort((a, b) => b.pax[i] - a.pax[i])
      .map((a, r) => ({ code: a.code, name: a.name, pax: a.pax[i], rank: r + 1 }));
  };
  const apt = (code, y) => rank(y).find((a) => a.code === code);

  // the barycentre
  const B = data.barycentre;
  const by = (y) => B.find((b) => b.y === y);
  const north = B.reduce((a, b) => (b.lat > a.lat ? b : a), B[0]);
  const lowest = B.reduce((a, b) => (b.lat < a.lat ? b : a), B[0]);
  // north (+) or south (-) of the 2019 position, in km along the meridian
  const offsets = B.map((b) => ({ y: b.y, km: (b.lat - by(YEAR_2019).lat) * KM_DEG }));
  const plateau = offsets.filter((o) => o.y > lowest.y);
  const bary = {
    from: by(2008),
    y2019: by(YEAR_2019),
    now: by(last),
    north,
    lowest,
    offsets,
    northKm: (north.lat - by(YEAR_2019).lat) * KM_DEG,
    lowestKm: (by(YEAR_2019).lat - lowest.lat) * KM_DEG,
    climb: (north.lat - B[0].lat) * KM_DEG,
    plateau: {
      from: plateau[0]?.y,
      min: Math.min(...plateau.map((o) => -o.km)),
      max: Math.max(...plateau.map((o) => -o.km)),
    },
    south2019: (by(YEAR_2019).lat - by(last).lat) * KM_DEG,
    byYear: by,
  };

  return {
    last,
    Z,
    eu,
    countries,
    union,
    vs,
    above,
    below,
    nat,
    natDown: nat.filter((n) => n.change < 0),
    rank,
    apt,
    bary,
    E,
    airportYears: AY,
    airports: data.airports,
    yearsIdx: (y) => data.years.indexOf(y),
  };
}

/**
 * Passengers gained and lost since 2019, south and north of the 45th parallel: the totals and the bands
 * of latitude come from the ETL (every airport inside the box); the spikes of the map are the airports the
 * page draws, Berlin's two airports together.
 */
export function shiftFacts(data) {
  const S = data.shift;
  const AY = data.airportYears;
  const [i0, i1] = [AY.indexOf(S.from), AY.indexOf(S.to)];
  const per = new Map();
  for (const a of data.airports) {
    if (!a.box) continue;
    const code = S.merged[a.code] ?? a.code;
    if (!per.has(code)) per.set(code, { code, before: 0, after: 0 });
    const r = per.get(code);
    r.before += a.pax[i0] ?? 0;
    r.after += a.pax[i1] ?? 0;
    if (a.code === code) Object.assign(r, { name: S.names[code] ?? a.name, lat: a.lat, lon: a.lon });
  }
  const rows = [...per.values()]
    .filter((r) => r.before || r.after)
    .map((r) => ({ ...r, change: r.after - r.before, south: r.lat < S.split }));
  const byChange = [...rows].sort((a, b) => b.change - a.change);
  const side = (south) => {
    const these = rows.filter((r) => r.south === south);
    return { airports: these.length, gaining: these.filter((r) => r.change > 0).length };
  };
  const net = (x) => x.after - x.before;
  return {
    from: S.from,
    to: S.to,
    split: S.split,
    south: { ...S.south, change: net(S.south), ...side(true) },
    north: { ...S.north, change: net(S.north), ...side(false) },
    bands: S.bands,
    rows,
    winners: byChange.slice(0, 10),
    losers: byChange.slice(-10).reverse(),
    get: (code) => rows.find((r) => r.code === code),
  };
}

/** Days in a month (m from 1 to 12). */
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** The years whose low month is not a season's: 2020 to 2022 (the Union's January 2022 is still far below 2019). */
export const PANDEMIC = [2020, 2021, 2022];

/**
 * The seasons of each zone: in a complete year, the passengers per day of each month (a 31-day month is
 * not a busier month for its length), as an index of the year's daily mean, its busiest and quietest
 * months, and the seasonal gap, the busiest month's passengers per day over the quietest's.
 */
export function seasonFacts(data) {
  const last = data.meta.last;
  const byZone = new Map(
    data.zones.map((z) => {
      const months = monthList(z.monthStart, z.monthLast);
      return [z.code, new Map(months.map((m, i) => [m, z.monthly.total[i]]))];
    }),
  );
  const cache = new Map();
  const at = (code, y) => {
    const key = `${code}${y}`;
    if (cache.has(key)) return cache.get(key);
    const series = byZone.get(code);
    const vals = [];
    for (let m = 1; m <= 12; m++) vals.push(series?.get(`${y}-${String(m).padStart(2, "0")}`) ?? null);
    let out = null;
    if (!vals.includes(null)) {
      const days = vals.map((_, i) => daysIn(y, i + 1));
      const perDay = vals.map((v, i) => v / days[i]);
      const mean = vals.reduce((s, v) => s + v, 0) / days.reduce((s, d) => s + d, 0);
      const peak = perDay.indexOf(Math.max(...perDay));
      const low = perDay.indexOf(Math.min(...perDay));
      out = {
        y,
        index: perDay.map((p) => p / mean),
        peak: peak + 1,
        low: low + 1,
        gap: perDay[peak] / perDay[low],
      };
    }
    cache.set(key, out);
    return out;
  };
  const zones = data.zones;
  const years = data.years.filter((y) => !PANDEMIC.includes(y) && zones.every((z) => at(z.code, y)));
  // a country's latitude: the mean latitude of its airports' passengers that year
  const latitude = (code, y) => {
    const i = data.airportYears.indexOf(y);
    let w = 0;
    let s = 0;
    for (const a of data.airports)
      if (a.country === code && a.box && a.pax[i]) {
        w += a.pax[i];
        s += a.pax[i] * a.lat;
      }
    return w ? s / w : null;
  };
  const countries = zones.filter((z) => z.code !== "EU27_2020");
  const rows = (y) =>
    countries.map((z) => ({ code: z.code, name: z.name, lat: latitude(z.code, y), ...at(z.code, y) }));
  const first = years[0];
  const change = countries
    .map((z) => ({ code: z.code, name: z.name, from: at(z.code, first).gap, to: at(z.code, last).gap }))
    .map((r) => ({ ...r, ratio: r.to / r.from }));
  const eu = data.zones[0];
  const euSeries = byZone.get(eu.code);
  const fiPeaks = years.map((y) => ({ y, peak: at("FI", y).peak }));
  // passengers per day of one month, as published
  const perDay = (code, y, m) => byZone.get(code).get(`${y}-${String(m).padStart(2, "0")}`) / daysIn(y, m);
  return {
    last,
    first,
    years,
    at,
    perDay,
    rows,
    latitude,
    change,
    narrower: change.filter((r) => r.ratio < 1),
    wider: change.filter((r) => r.ratio > 1),
    euGaps: years.map((y) => at(eu.code, y).gap),
    jan2022: 100 * (1 - euSeries.get("2022-01") / euSeries.get("2019-01")),
    fi: {
      juneUntil: Math.max(...fiPeaks.filter((p) => p.y <= YEAR_2019 && p.peak === 6).map((p) => p.y)),
      juneAlways: fiPeaks.filter((p) => p.y <= YEAR_2019).every((p) => p.peak === 6),
      decSince: (() => {
        let y = last;
        while (years.includes(y - 1) && at("FI", y - 1).peak === 12) y -= 1;
        return at("FI", last).peak === 12 ? y : null;
      })(),
    },
  };
}
