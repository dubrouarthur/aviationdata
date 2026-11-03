// Every number of « Le billet d'avion est-il plus cher ? », from two files only: prix.json (DGAC, IPTAP,
// base 100 in 2023, prices of the trips of each month departing France) and billet/hicp.json (Eurostat,
// harmonised consumer prices in France, 2015 = 100). Recomputed in Python by web/scripts/check_billet.py.
import { monthShort } from "../lib/format.js";

export const SEGMENTS = [
  { key: "MET_INTER_MET", label: "Vols intérieurs", note: "entre deux villes de métropole" },
  { key: "MET_INTAL_MC", label: "Moyen-courrier", note: "Europe et Afrique du Nord" },
  { key: "MET_INTER_OM", label: "Métropole–outre-mer", note: "au départ de métropole" },
  { key: "DOM_ENS", label: "Départs d'outre-mer", note: "cinq départements" },
  { key: "MET_INTAL_LC", label: "Long-courrier", note: "au-delà" },
];

export const MONTHS = [
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

const pct = (a, b) => (a / b - 1) * 100;

/** Mean of a year's twelve months, null if one is missing. */
export function yearMean(months, values, year) {
  const v = months
    .map((m, i) => (m.startsWith(`${year}-`) ? values[i] : undefined))
    .filter((x) => x !== undefined);
  return v.length === 12 && v.every((x) => x !== null && Number.isFinite(x))
    ? v.reduce((a, b) => a + b, 0) / 12
    : null;
}

export function billetFacts(prix, hicp) {
  const fares = prix.series.FRA_ENS;
  const dg = (y, key = "FRA_ENS") => yearMean(prix.months, prix.series[key], y);
  const hi = (y, key = "all") => yearMean(hicp.months, hicp[key], y);
  const first = Number(prix.months[0].slice(0, 4));
  // the last year complete in both files
  let last = Math.min(Number(prix.months.at(-1).slice(0, 4)), Number(hicp.months.at(-1).slice(0, 4)));
  while (dg(last) === null || hi(last) === null) last--;
  const years = [];
  for (let y = first; y <= last; y++) years.push(y);

  // 1. ten flat years, then a jump: both indices from 100 in the first year
  const fare = years.map((y) => (dg(y) / dg(first)) * 100);
  const cpi = years.map((y) => (hi(y) / hi(first)) * 100);
  const total = pct(dg(last), dg(first));
  const inflation = pct(hi(last), hi(first));
  const real = ((1 + total / 100) / (1 + inflation / 100) - 1) * 100;
  const flatEnd = 2021;
  const flat = pct(dg(flatEnd), dg(first));
  const flatInflation = pct(hi(flatEnd), hi(first));
  const jump = pct(dg(2023), dg(flatEnd));
  const since = pct(dg(last), dg(2023));

  // 2. the season: each month of the last year against the year's mean
  const yearVals = prix.months
    .map((m, i) => (m.startsWith(`${last}-`) ? fares[i] : null))
    .filter((v) => v !== null);
  const mean = yearVals.reduce((a, b) => a + b, 0) / yearVals.length;
  const season = yearVals.map((v, i) => ({
    label: monthShort(i),
    full: MONTHS[i],
    value: pct(v, mean),
  }));
  const hiM = season.reduce((a, b, i) => (b.value > season[a].value ? i : a), 0);
  const loM = season.reduce((a, b, i) => (b.value < season[a].value ? i : a), 0);
  const peakVsLow = pct(yearVals[hiM], yearVals[loM]);

  // 3. by kind of flight, since 2019
  const ref = 2019;
  const segments = SEGMENTS.map((s) => ({ ...s, value: pct(dg(last, s.key), dg(ref, s.key)) })).sort(
    (a, b) => b.value - a.value,
  );
  const all2019 = pct(dg(last), dg(ref));

  // 4. plane and train in the consumer price index, since 2019
  const modes = [
    { key: "air", label: "Billets d'avion", color: "magenta" },
    { key: "all", label: "Ensemble des prix", color: "ink", strong: true },
    { key: "rail", label: "Billets de train", color: "blue" },
  ].map((m) => ({ ...m, value: pct(hi(last, m.key), hi(ref, m.key)) }));
  const air = modes[0].value;
  const rail = modes[2].value;

  // this year so far, against the same months of last year
  const lastMonth = prix.months.at(-1);
  const ly = Number(lastMonth.slice(0, 4));
  const n = Number(lastMonth.slice(5, 7));
  const sum = (y) =>
    prix.months.reduce(
      (a, m, i) => (m.startsWith(`${y}-`) && Number(m.slice(5, 7)) <= n ? a + fares[i] : a),
      0,
    );
  const ytd =
    ly > last ? { year: ly, months: n, month: MONTHS[n - 1], change: pct(sum(ly), sum(ly - 1)) } : null;

  return {
    first,
    last,
    years,
    fare,
    cpi,
    total,
    inflation,
    real,
    flatEnd,
    flat,
    flatInflation,
    jump,
    since,
    season,
    peak: MONTHS[hiM],
    low: MONTHS[loM],
    peakUp: season[hiM].value,
    lowDown: season[loM].value,
    peakVsLow,
    ref,
    segments,
    all2019,
    modes,
    air,
    rail,
    airVsRail: air / rail,
    ytd,
  };
}
