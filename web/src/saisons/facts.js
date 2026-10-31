// Every number of the fifth investigation, the seasons of Europe's air passengers, from eu.json
// (etl/eu/build_eu.py, Eurostat avia_paoc by month). The text, the charts and
// web/scripts/check_saisons.py read the same values.
import { YEAR_2019, monthList } from "../eu/facts.js";

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
  // every zone's months, for all flights, national flights and international flights
  const byZone = new Map(
    data.zones.flatMap((z) => {
      const months = monthList(z.monthStart, z.monthLast);
      return ["total", "nat", "intl"].map((k) => [
        `${z.code}:${k}`,
        new Map(months.map((m, i) => [m, z.monthly[k]?.[i] ?? null])),
      ]);
    }),
  );
  const cache = new Map();
  /** A zone's year (all flights unless kind says "nat" or "intl"), or null when a month is missing or empty. */
  const at = (code, y, kind = "total") => {
    const key = `${code}:${kind}:${y}`;
    if (cache.has(key)) return cache.get(key);
    const series = byZone.get(`${code}:${kind}`);
    const vals = [];
    for (let m = 1; m <= 12; m++) vals.push(series?.get(`${y}-${String(m).padStart(2, "0")}`) ?? null);
    let out = null;
    if (!vals.some((v) => v == null || v <= 0)) {
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
    countries.map((z) => ({
      code: z.code,
      name: z.name,
      iso: z.iso,
      lat: latitude(z.code, y),
      ...at(z.code, y),
    }));
  const names = new Map(
    data.zones.map((z) => [z.code, z.code === "EU27_2020" ? "Union européenne" : z.name]),
  );
  const first = years[0];
  const change = countries
    .map((z) => ({ code: z.code, name: z.name, from: at(z.code, first).gap, to: at(z.code, last).gap }))
    .map((r) => ({ ...r, ratio: r.to / r.from }));
  const eu = data.zones[0];
  const euSeries = byZone.get(`${eu.code}:total`);
  // national against international flights, where national flights carry at least 5 % of the passengers
  const iL = data.years.indexOf(last);
  const kinds = data.zones
    .filter((z) => z.nat[iL] / z.total[iL] >= 0.05)
    .map((z) => ({
      code: z.code,
      name: z.name,
      share: (100 * z.nat[iL]) / z.total[iL],
      nat: at(z.code, last, "nat"),
      intl: at(z.code, last, "intl"),
    }))
    .filter((r) => r.nat && r.intl)
    .sort((a, b) => b.intl.gap - a.intl.gap);
  const fiPeaks = years.map((y) => ({ y, peak: at("FI", y).peak }));
  // passengers per day of one month, as published
  const perDay = (code, y, m) =>
    byZone.get(`${code}:total`).get(`${y}-${String(m).padStart(2, "0")}`) / daysIn(y, m);
  return {
    last,
    first,
    years,
    at,
    perDay,
    rows,
    name: (code) => names.get(code),
    latitude,
    change,
    kinds,
    smoother: kinds.filter((r) => r.nat.gap < r.intl.gap),
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
