// @ts-check
// Every number of « Quand les avions heurtent-ils des oiseaux ? », computed from data/birds/birds.json
// (etl/birds/build_birds.py) and recomputed by web/scripts/check_birds.py without reading this file. The FAA counts
// the strikes that were reported to it: a report is voluntary, so a count says how much is reported, a share says
// how reports are spread. « Avec dégâts » = the report says the aircraft was damaged (minor, uncertain, substantial
// or destroyed).

import { fmtNum } from "../lib/format.js";

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
export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** the night hours of the clock: 21 h to 4 h 59 */
export const NIGHT = [21, 22, 23, 0, 1, 2, 3, 4];
/** a foot in metres */
export const FT = 0.3048;
/** the phases, in the order of a flight */
export const PHASES = ["décollage", "montée", "croisière", "approche", "atterrissage"];

const sum = (/** @type {number[]} */ v) => v.reduce((a, b) => a + b, 0);

/** @param {any} B the parsed birds.json */
export function birdFacts(B) {
  const m = B.meta;
  const [p0, p1] = m.profile;
  const nYears = p1 - p0 + 1;
  const years = Object.keys(B.years).map(Number);
  const first = years[0];
  const last = m.lastFull;
  const y0 = B.years[first];
  const y1 = B.years[last];
  // the hour x month clock
  const night = Array.from({ length: 12 }, (_, k) => sum(NIGHT.map((h) => B.clock[h][k])));
  const day = Array.from({ length: 12 }, (_, k) => sum(B.clock.map((/** @type {number[]} */ r) => r[k])) - night[k]);
  const nightShare = night.map((v, k) => v / (v + day[k]));
  const spring = [2, 3, 4].reduce((a, b) => (nightShare[b] > nightShare[a] ? b : a));
  const autumn = [8, 9, 10].reduce((a, b) => (nightShare[b] > nightShare[a] ? b : a));
  const summerNight = nightShare[6];
  let peak = { v: -1, h: 0, k: 0 };
  B.clock.forEach((/** @type {number[]} */ row, /** @type {number} */ h) =>
    row.forEach((v, k) => {
      if (NIGHT.includes(h) && v > peak.v) peak = { v, h, k };
    }),
  );
  const L = B.light;
  const lit = L.jour + L.nuit + L.aube + L["crépuscule"];
  // months
  const months = B.months.map((/** @type {number} */ v) => v / m.reports);
  const top = months.indexOf(Math.max(...months));
  const low = months.indexOf(Math.min(...months));
  const jasO = sum([6, 7, 8, 9].map((k) => months[k]));
  // heights
  const H = B.heights.map((/** @type {number[]} */ [n, d], /** @type {number} */ i) => ({
    lo: B.bands[i][0],
    hi: B.bands[i][1],
    n,
    d,
    share: n / m.knownHeight,
    rate: d / n,
  }));
  const ground = H[0];
  const low500 = sum(H.slice(0, 3).map((h) => h.n)) / m.knownHeight;
  const above1000 = sum(H.slice(4).map((h) => h.n)) / m.knownHeight;
  const high = H.at(-1);
  // phases
  const knownGrouped = sum(PHASES.map((p) => B.phases[p][0]));
  const phases = PHASES.map((p) => ({
    key: p,
    n: B.phases[p][0],
    d: B.phases[p][1],
    share: B.phases[p][0] / knownGrouped,
    rate: B.phases[p][1] / B.phases[p][0],
  }));
  const byShare = [...phases].sort((a, b) => b.share - a.share);
  const byRate = [...phases].sort((a, b) => b.rate - a.rate);
  const nearGround =
    (B.phases["décollage"][0] + B.phases["atterrissage"][0] + B.phases.approche[0] + B.phases["montée"][0]) /
    knownGrouped;
  // parts
  const parts = Object.entries(B.parts).map(([k, [s, d]]) => ({ key: k, s, d, rate: d / s }));
  const mostStruck = [...parts].sort((a, b) => b.s - a.s)[0];
  const mostDamaged = [...parts].sort((a, b) => b.d - a.d)[0];
  const engines = parts.find((p) => p.key === "moteurs");
  // sizes
  const sizes = Object.fromEntries(
    Object.entries(B.sizes).map(([k, [n, d]]) => [k, { n, d, rate: d / n }]),
  );
  const sized = sizes.petit.n + sizes.moyen.n + sizes.grand.n;
  // species
  const species = B.species.map((/** @type {any} */ s) => ({ ...s, rate: s.dmg / s.n }));
  const mostReported = [...species].sort((a, b) => b.n - a.n)[0];
  const mostDamaging = [...species].sort((a, b) => b.dmg - a.dmg)[0];
  const highRate = [...species].filter((s) => s.n >= 300).sort((a, b) => b.rate - a.rate)[0];
  const large = species.filter((/** @type {any} */ s) => s.size === "grand");
  const largeDmg = sum(large.map((/** @type {any} */ s) => s.dmg));
  return {
    p0,
    p1,
    nYears,
    reports: m.reports,
    perYear: m.reports / nYears,
    perDay: m.reports / nYears / 365.25,
    damage: m.damage,
    damageShare: m.damage / m.reports,
    first,
    last,
    reports0: y0[0],
    reports1: y1[0],
    dmg0: y0[1],
    dmg1: y1[1],
    reportsRatio: y1[0] / y0[0],
    dmgRatio: y1[1] / y0[1],
    share0: y0[1] / y0[0],
    share1: y1[1] / y1[0],
    night,
    day,
    nightShare,
    spring,
    autumn,
    summerNight,
    peak,
    nightLight: L.nuit / lit,
    months,
    top,
    low,
    topOverLow: months[top] / months[low],
    jasO,
    heights: H,
    ground,
    low500,
    above1000,
    high,
    groundRate: ground.rate,
    highOverGround: high.rate / ground.rate,
    phases,
    byShare,
    byRate,
    nearGround,
    parts,
    mostStruck,
    mostDamaged,
    engines,
    sizes,
    sized,
    largeOverSmall: sizes.grand.rate / sizes.petit.rate,
    species,
    mostReported,
    mostDamaging,
    highRate,
    largeDmg,
    identified: m.identified / m.reports,
    timed: m.timed / m.reports,
    knownHeight: m.knownHeight / m.reports,
    hudson: B.hudson,
    effects: B.effects,
  };
}

/** The three numbers the story opens on, and the home page's lead repeats. @param {any} F birdFacts() */
export const openingNumbers = (F) => [
  { value: fmtNum(F.perDay, 0), label: `impacts d'animaux déclarés chaque jour aux États-Unis, ${F.p0}-${F.p1}` },
  { value: `${fmtNum(Math.round(F.low500 * 10), 0)} sur 10`, label: "des impacts ont lieu à moins de 150 mètres du sol" },
  {
    value: `1 sur ${fmtNum(Math.round(1 / F.sizes.grand.rate), 0)}`,
    label: "des chocs avec un gros oiseau abîme l'avion",
    hi: true,
  },
];
