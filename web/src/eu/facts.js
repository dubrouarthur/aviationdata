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
  const bary = {
    from: by(2008),
    y2019: by(YEAR_2019),
    now: by(last),
    north,
    since2019: km(by(YEAR_2019), by(last)),
    sinceNorth: km(north, by(last)),
    south2019: (by(YEAR_2019).lat - by(last).lat) * 111.2,
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
