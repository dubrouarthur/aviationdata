// Every number of « Le ciel, modèle par modèle », from two files: avions/monde.json (OpenSky Network
// flight lists, 2019 and 2022, etl/avions/build_world.py) and avions/us.json (BTS on-time flights of
// 2025, etl/avions/build_us.py). Recomputed in Python by web/scripts/check_avions.py.
import { groupOf, GROUPS } from "./charts.js";

const sum = (a) => a.reduce((x, y) => x + y, 0);
const wmean = (rows, key, w = "flights") => sum(rows.map((r) => r[key] * r[w])) / sum(rows.map((r) => r[w]));

export function worldFacts(W) {
  const years = W.years.map((y) => y.year);
  const last = years.at(-1);
  const first = years[0];
  const model = (code, year) => ({
    code,
    ...W.types[code],
    group: groupOf(W.types[code]),
    ...W.models[year][code],
  });
  const list = (year) =>
    Object.keys(W.models[year])
      .map((c) => model(c, year))
      .sort((a, b) => b.flights - a.flights);
  const now = list(last);
  const before = list(first);
  const total = (rows) => sum(rows.map((r) => r.flights));
  const T = total(now);
  const T0 = total(before);
  const groupShare = (rows, t) =>
    Object.fromEntries(
      GROUPS.map((g) => [g.key, sum(rows.filter((r) => r.group === g.key).map((r) => r.flights)) / t]),
    );
  const groups = groupShare(now, T);
  const groups0 = groupShare(before, T0);
  // families: the A320 and the 737 each gather their generations; the rest by family name
  const famKey = (r) =>
    r.group === "a320"
      ? "Airbus A320"
      : r.group === "b737"
        ? "Boeing 737"
        : r.family === r.maker
          ? r.family
          : `${r.maker} ${r.family}`;
  const famOf = (rows, t) => {
    const m = new Map();
    for (const r of rows) {
      const k = famKey(r);
      const x = m.get(k) ?? { label: k, group: r.group, flights: 0 };
      x.flights += r.flights;
      m.set(k, x);
    }
    return [...m.values()].map((x) => ({ ...x, share: x.flights / t })).sort((a, b) => b.share - a.share);
  };
  const families = famOf(now, T);
  const families0 = new Map(famOf(before, T0).map((f) => [f.label, f.share]));

  // change of share from the first to the last year, by model (both years seen)
  const share0 = new Map(before.map((r) => [r.code, r.flights / T0]));
  const change = now
    .filter((r) => share0.has(r.code))
    .map((r) => ({
      ...r,
      share: r.flights / T,
      share0: share0.get(r.code),
      pp: (r.flights / T - share0.get(r.code)) * 100,
    }))
    .sort((a, b) => b.pp - a.pp);
  const gone = before.filter((r) => !W.models[last][r.code]).map((r) => r.code);

  // distances and usage, models followed on at least 5 000 flights with both airports
  const solid = now.filter((r) => r.complete >= 5000);
  const byKm = [...solid].sort((a, b) => a.kmMedian - b.kmMedian);
  // usage: the models that make at least one flight in a hundred, from the busiest aircraft to the least
  const byUse = solid
    .filter((r) => r.flightsPerDay != null && r.flights / T >= 0.01)
    .sort((a, b) => b.flightsPerDay - a.flightsPerDay);

  // countries of departure: the models' flights summed by country, then shared by group
  const byCountry = new Map();
  for (const r of now)
    for (const [cc, n] of r.countries) {
      const c = byCountry.get(cc) ?? {
        cc,
        total: 0,
        groups: Object.fromEntries(GROUPS.map((g) => [g.key, 0])),
      };
      c.total += n;
      c.groups[r.group] += n;
      byCountry.set(cc, c);
    }
  const countries = [...byCountry.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 16)
    .map((c) => ({
      ...c,
      name: W.countryNames[c.cc] ?? c.cc,
      shares: Object.fromEntries(GROUPS.map((g) => [g.key, c.groups[g.key] / c.total])),
    }));
  const complete = sum(now.map((r) => r.complete));
  return {
    years,
    first,
    last,
    now,
    before,
    total: T,
    total0: T0,
    rows: W.years.find((y) => y.year === last).rows,
    complete,
    completeShare: complete / T,
    groups,
    groups0,
    families,
    families0,
    top2: groups.a320 + groups.b737,
    change,
    gone,
    // the extremes among models that make at least one flight in two hundred: known models, not rarities
    shortest: byKm.find((r) => r.flights / T >= 0.005),
    longest: byKm.findLast((r) => r.flights / T >= 0.005),
    byKm,
    byUse,
    countries,
    model: (code) => now.find((r) => r.code === code),
  };
}

export function usFacts(U) {
  const models = U.models.map((m) => ({ ...m, group: groupOf(m) }));
  const big = models.filter((m) => m.operated >= 50000);
  const byOntime = [...big].sort((a, b) => b.ontime - a.ontime);
  const gap = (m) => (m.ontime - m.ontimeExpected) * 100;
  const byGap = [...big].sort((a, b) => gap(b) - gap(a));
  // airlines: their own on-time share, and their models' (cells of at least 3 000 operated flights)
  const cells = U.cells.map(([a, code, flights, ontime]) => ({ a, code, flights, ontime }));
  const air = Object.entries(U.airlines)
    .map(([a, v]) => ({ a, ...v }))
    .filter((v) => v.flights >= 100000)
    .sort((x, y) => y.ontime - x.ontime);
  const spreadRows = air
    .map((v) => ({
      a: v.a,
      label: v.name,
      airline: v.ontime,
      models: cells
        .filter((c) => c.a === v.a)
        .map((c) => {
          const m = models.find((x) => x.code === c.code);
          return { code: c.code, label: m.name, value: c.ontime, group: m.group };
        }),
    }))
    .filter((r) => r.models.length >= 2);
  const within = spreadRows.map(
    (r) => Math.max(...r.models.map((m) => m.value)) - Math.min(...r.models.map((m) => m.value)),
  );
  const across = air.length ? air[0].ontime - air.at(-1).ontime : 0;
  // cancellations, on the airlines that give their cancelled flights a tail number
  const cm = models.filter((m) => m.cancelRate != null && m.cancelBase >= 20000);
  const regional = cm.filter((m) => m.kind === "regional");
  const mainline = cm.filter((m) => m.kind !== "regional");
  const crate = (rows) => sum(rows.map((r) => r.cancelled)) / sum(rows.map((r) => r.cancelBase));
  const cexp = (rows) => wmean(rows, "cancelExpected", "cancelBase");
  // aircraft use, on models flown mostly at home (an aircraft followed on 200 days of the year at least)
  const home = models
    .filter((m) => m.daysFlown >= 200 && m.flightsPerDay != null)
    .sort((a, b) => b.flightsPerDay - a.flightsPerDay);
  return {
    year: U.year,
    flightsAll: U.flightsAll,
    modelledShare: U.modelledShare,
    flightsModelled: U.flightsModelled,
    untailedCancelShare: U.untailedCancelShare,
    models,
    big,
    byOntime,
    best: byOntime[0],
    worst: byOntime.at(-1),
    gap,
    byGap,
    air,
    spreadRows,
    withinMean: sum(within) / within.length,
    withinMax: Math.max(...within),
    across,
    cm,
    regionalCancel: crate(regional),
    mainlineCancel: crate(mainline),
    regionalExpected: cexp(regional),
    home,
    model: (code) => models.find((m) => m.code === code),
  };
}
