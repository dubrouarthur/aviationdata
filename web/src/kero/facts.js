// @ts-check
// Every number of « D'où vient le kérosène des avions européens ? », from data/kero/kero.json
// (etl/kero/build_kero.py), recomputed by web/scripts/check_kero.py without reading this file. Imports are those
// from outside the Union; « avant » and « après » are the same months a year apart (meta.before, meta.after).

export const GROUP_ORDER = ["golfe", "inde", "asie", "russie", "europe", "afrique", "ameriques", "autres"];
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
/** "2026-04" -> "avril 2026" */
export const monthLabel = (/** @type {string} */ m) => `${MONTHS_FR[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
/** a span of months: "avril-juillet 2026" */
export const spanLabel = (/** @type {string[]} */ [a, z]) =>
  a.slice(0, 4) === z.slice(0, 4)
    ? `${MONTHS_FR[+a.slice(5) - 1]}-${MONTHS_FR[+z.slice(5) - 1]} ${z.slice(0, 4)}`
    : `${monthLabel(a)}-${monthLabel(z)}`;

const sum = (/** @type {(number|null)[]} */ v) => v.reduce((/** @type {number} */ a, b) => a + (b ?? 0), 0);
const mean = (/** @type {(number|null)[]} */ v) => {
  const x = v.filter((d) => d !== null);
  return x.reduce((/** @type {number} */ a, b) => a + /** @type {number} */ (b), 0) / x.length;
};

/** @param {any} K the parsed kero.json */
export function keroFacts(K) {
  const months = K.months;
  const at = (/** @type {string} */ m) => months.indexOf(m);
  const span = (/** @type {string[]} */ [a, z]) =>
    months.map((_, i) => i).filter((i) => months[i] >= a && months[i] <= z);
  const before = span(K.meta.before);
  const after = span(K.meta.after);
  const take = (/** @type {(number|null)[]} */ v, /** @type {number[]} */ idx) => idx.map((i) => v[i]);
  const tot = K.eu.total;
  const totB = sum(take(tot, before));
  const totA = sum(take(tot, after));
  const share = (/** @type {(number|null)[]} */ v, /** @type {number[]} */ idx, /** @type {number} */ t) =>
    sum(take(v, idx)) / t;
  const groups = Object.fromEntries(
    GROUP_ORDER.map((g) => [
      g,
      {
        key: g,
        label: K.groups[g].label,
        before: share(K.eu.groups[g], before, totB),
        after: share(K.eu.groups[g], after, totA),
        tB: sum(take(K.eu.groups[g], before)) / before.length,
        tA: sum(take(K.eu.groups[g], after)) / after.length,
      },
    ]),
  );
  const partners = Object.entries(K.eu.partners).map(([p, v]) => ({
    key: p,
    label: K.partners[p]?.label ?? p,
    group: K.partners[p]?.group ?? "autres",
    before: share(/** @type {any} */ (v), before, totB),
    after: share(/** @type {any} */ (v), after, totA),
    tB: sum(take(/** @type {any} */ (v), before)) / before.length,
    tA: sum(take(/** @type {any} */ (v), after)) / after.length,
  }));
  const byBefore = [...partners].sort((a, b) => b.before - a.before);
  const byAfter = [...partners].sort((a, b) => b.after - a.after);
  // the year before the crisis, whole
  const y = span(["2025-01", "2025-12"]);
  const tot25 = sum(take(tot, y));
  const partners25 = partners
    .map((p) => ({ ...p, y25: sum(take(K.eu.partners[p.key], y)) / tot25 }))
    .sort((a, b) => b.y25 - a.y25);
  const golfe25 = sum(take(K.eu.groups.golfe, y)) / tot25;
  // the balance of 2025: what Europe refines, buys, sells, burns
  const B = K.balance.EU27_2020;
  const by = B.months
    .map((/** @type {string} */ m, /** @type {number} */ i) => (m.startsWith("2025") ? i : -1))
    .filter((/** @type {number} */ i) => i >= 0);
  const bsum = (/** @type {string} */ k) => sum(by.map((/** @type {number} */ i) => B[k][i]));
  const refinery = bsum("refinery");
  const deliveries = bsum("deliveries");
  const netImports = bsum("imports") - bsum("exports");
  // Russia, before the embargo on oil products (5 February 2023)
  const yr = (/** @type {string} */ year) => span([`${year}-01`, `${year}-12`]);
  // the Gulf's share, full years before the crisis
  const years = [...new Set(months.map((/** @type {string} */ m) => m.slice(0, 4)))].filter(
    (y) =>
      months.filter((/** @type {string} */ m) => m.startsWith(/** @type {string} */ (y))).length === 12 &&
      y < K.meta.closure.slice(0, 4),
  );
  const golfeYears = years.map((y) => {
    const c = span([`${y}-01`, `${y}-12`]);
    return { year: y, share: sum(take(K.eu.groups.golfe, c)) / sum(take(tot, c)) };
  });
  const gMin = golfeYears.reduce((a, b) => (b.share < a.share ? b : a));
  const gMax = golfeYears.reduce((a, b) => (b.share > a.share ? b : a));
  const russia = (/** @type {string} */ year) =>
    sum(take(K.eu.groups.russie, yr(year))) / sum(take(tot, yr(year)));
  // the month a supplier first fell to zero after the closure
  const kwAfter = take(K.eu.partners.KW, span([K.meta.closure, K.meta.last]));
  const kwZero = kwAfter.findIndex((v) => v === 0);
  // prices: EIA monthly means, the two months before the closure against the latest
  const P = K.prices.monthly;
  const pIdx = (/** @type {string} */ m) => P.months.indexOf(m);
  const pre = [pIdx("2026-01"), pIdx("2026-02")];
  const jetPre = mean(pre.map((i) => P.jet[i]));
  const brentPre = mean(pre.map((i) => P.brent[i]));
  const jetPeak = Math.max(...P.jet.slice(pIdx(K.meta.closure)));
  const jetPeakMonth = P.months[P.jet.indexOf(jetPeak)];
  const daily = K.prices.daily;
  // Comext: euros a tonne at the border, the same months a year apart
  const C = K.comext;
  const cspan = (/** @type {string[]} */ [a, z]) =>
    C.months.map((_, i) => i).filter((i) => C.months[i] >= a && C.months[i] <= z);
  const eurT = (/** @type {number[]} */ idx) =>
    idx.reduce((s, i) => s + C.eurPerT[i] * C.tonnes[i], 0) / idx.reduce((s, i) => s + C.tonnes[i], 0);
  const eurB = eurT(cspan(K.meta.before));
  const eurA = eurT(cspan(K.meta.after));
  return {
    K,
    first: months[0],
    last: K.meta.last,
    closure: K.meta.closure,
    before: K.meta.before,
    after: K.meta.after,
    totB: totB / before.length,
    totA: totA / after.length,
    totChange: totA / after.length / (totB / before.length) - 1,
    groups,
    partners,
    byBefore,
    byAfter,
    partners25,
    golfe25,
    tot25: tot25 / y.length,
    refinery,
    deliveries,
    netImports,
    refineryShare: refinery / deliveries,
    russia19: russia("2019"),
    russia23: russia("2023"),
    kwZero: kwZero >= 0 ? months[at(K.meta.closure) + kwZero] : null,
    jetPre,
    brentPre,
    jetLast: daily.jet.at(-1),
    jetLastDate: K.prices.last,
    brentLast: daily.brent[K.prices.last],
    jetPeak,
    jetPeakMonth,
    eurB,
    eurA,
    countries: K.countries,
    golfeYears,
    gMin,
    gMax,
  };
}
