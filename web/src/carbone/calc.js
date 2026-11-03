// « Calculez votre vol »: the CO2 of a flight between two airports, and what Eurostat says of that route
// (passengers, seats, flights per quarter). Pure computation in flightFacts(), recomputed in Python by
// web/scripts/check_carbone.py; the interface in calc-ui.js.
import { SEGMENTS } from "./facts.js";

const R_KM = 6371.0;
/** Beyond this distance an international flight takes more than about 4 h 30: long-haul for the DGAC. */
export const LONG_HAUL_KM = 3600;
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

export function greatCircle(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** The DGAC's kind of flight: both ends in metropolitan France, overseas France, or abroad by distance. */
export function segmentOf(a, b, km) {
  if (a.zone === "MET" && b.zone === "MET") return "MET_INTERIEUR";
  if (a.zone !== "INT" && b.zone !== "INT") return "MET-OM_ET_OM-OM";
  return km > LONG_HAUL_KM ? "INTL_LC" : "INTL_MC";
}

const pairOf = (L, a, b) => L.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));

/** Seats filled on all published routes of a kind of flight, in one quarter (the average to compare with). */
export function segmentLoad(L, segment, qi) {
  const byCode = new Map(L.airports.map((x) => [x.code, x]));
  let pax = 0;
  let seats = 0;
  for (const r of L.routes) {
    const a = byCode.get(r.a);
    const b = byCode.get(r.b);
    if (segmentOf(a, b, greatCircle(a, b)) !== segment) continue;
    if (r.pax[qi] == null || r.seats[qi] == null) continue;
    pax += r.pax[qi];
    seats += r.seats[qi];
  }
  return seats ? pax / seats : null;
}

/**
 * Everything the calculator says of a flight from airport code a to b in a month (0-11), one way or return.
 * co2: co2.json; L: co2/liaisons.json.
 */
export const SEASONS = ["hiver", "printemps", "été", "automne"];
export const SEASON_MONTHS = ["janvier à mars", "avril à juin", "juillet à septembre", "octobre à décembre"];
export const CLASSES = [
  { key: "economy", label: "Économie" },
  { key: "premium", label: "Premium" },
  { key: "business", label: "Affaires" },
  { key: "first", label: "Première" },
];
/** France's carbon footprint, 2024 provisional (SDES, 16 October 2025): all greenhouse gases, per person. */
export const FOOTPRINT = { t: 8.2, year: 2024 };

/** DESNZ's band for a kind of flight: short for domestic and medium-haul, long beyond. */
export const haulOf = (segment) => (segment === "MET_INTERIEUR" || segment === "INTL_MC" ? "short" : "long");
/** The classes DESNZ prices for a band (short-haul: economy and business only). */
export const classesOf = (C, haul) => CLASSES.filter((c) => C[haul].without_rf[c.key] != null);

/**
 * Everything the calculator says of a flight between two airport codes in a season (0-3).
 * opts: { back, cls, rf } ; co2: co2.json (DGAC) ; L: co2/liaisons.json (Eurostat) ; C: co2/classes.json (DESNZ).
 * The CO2 per passenger is built in steps the page shows: the DGAC's average grams for the kind of flight,
 * times the weight of the seat's class (DESNZ), times how full this route flies in that season against
 * the average of its kind (Eurostat), times the effects other than CO2 if asked (DESNZ).
 */
export function flightFacts(L, co2, C, from, to, season, { back = true, cls = "economy", rf = false } = {}) {
  const A = L.airports.find((x) => x.code === from);
  const B = L.airports.find((x) => x.code === to);
  const km = greatCircle(A, B);
  const segment = segmentOf(A, B, km);
  const g = co2.g_peqkm[segment].at(-1);
  const trips = back ? 2 : 1;
  const base = (km * g * trips) / 1000;
  const haul = haulOf(segment);
  const offered = classesOf(C, haul);
  const klass = offered.find((c) => c.key === cls) ?? offered[0];
  const classRatio = C[haul].without_rf[klass.key] / C[haul].without_rf.average;
  const rfRatio = C[haul].with_rf.average / C[haul].without_rf.average;
  const year = L.years.at(-1);
  const qi = (L.years.length - 1) * 4 + season;
  const out = {
    A,
    B,
    km,
    segment,
    segmentLabel: SEGMENTS.find((s) => s.key === segment).label,
    g,
    co2Year: co2.years.at(-1),
    base,
    trips,
    haul,
    offered,
    klass,
    classRatio,
    rf,
    rfRatio,
    season: SEASONS[season],
    quarter: SEASON_MONTHS[season],
    year,
    status: "none",
    loadRatio: 1,
  };
  const r = pairOf(L, from, to);
  if (!r) {
    out.status = L.confidential.some(([x, y]) => (x === from && y === to) || (x === to && y === from))
      ? "secret"
      : "none";
  } else if (r.pax[qi] == null || r.seats[qi] == null || r.flights[qi] == null) {
    out.status = "gap";
  } else {
    const load = r.pax[qi] / r.seats[qi];
    const segLoad = segmentLoad(L, segment, qi);
    const prev = qi - 4 >= 0 && r.pax[qi - 4] != null && r.seats[qi - 4] ? r.pax[qi - 4] / r.seats[qi - 4] : null;
    Object.assign(out, {
      status: "route",
      pax: r.pax[qi],
      seats: r.seats[qi],
      flights: r.flights[qi],
      perFlight: r.pax[qi] / r.flights[qi],
      seatsPerFlight: r.seats[qi] / r.flights[qi],
      // both directions over a quarter of 13 weeks: flights a week in each direction
      perWeek: r.flights[qi] / 13 / 2,
      load,
      loadPrev: prev,
      segLoad,
      // the DGAC's grams are an average over its kind of flight: this route, fuller or emptier
      loadRatio: segLoad ? segLoad / load : 1,
      loads: [0, 1, 2, 3].map((k) => {
        const i = (L.years.length - 1) * 4 + k;
        return r.pax[i] != null && r.seats[i] ? r.pax[i] / r.seats[i] : null;
      }),
    });
  }
  const steps = [
    { key: "base", factor: 1, kg: base },
    { key: "class", factor: classRatio, kg: base * classRatio },
    { key: "load", factor: out.loadRatio, kg: base * classRatio * out.loadRatio },
  ];
  if (rf) steps.push({ key: "rf", factor: rfRatio, kg: steps.at(-1).kg * rfRatio });
  out.steps = steps;
  out.kg = steps.at(-1).kg;
  // the same trip in every class offered, with the rest unchanged
  out.byClass = offered.map((c) => ({
    ...c,
    kg: (out.kg / classRatio) * (C[haul].without_rf[c.key] / C[haul].without_rf.average),
  }));
  out.days = (out.kg / (FOOTPRINT.t * 1000)) * 365;
  return out;
}

/** Direct destinations from an airport, busiest first over the last complete year. */
export function destinations(L, code) {
  const last = (L.years.length - 1) * 4;
  const sum = (r) => r.pax.slice(last, last + 4).reduce((a, v) => a + (v ?? 0), 0);
  return L.routes
    .filter((r) => r.a === code || r.b === code)
    .map((r) => ({ code: r.a === code ? r.b : r.a, pax: sum(r) }))
    .filter((d) => d.pax > 0)
    .sort((x, y) => y.pax - x.pax);
}

/** Normalised text for the airport search: no accents, no case, no punctuation. */
export const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Airports matching what the reader typed: IATA code first, then names and cities starting with it. */
export function searchAirports(L, q, max = 8) {
  const f = fold(q);
  if (!f) return [];
  const scored = [];
  for (const a of L.airports) {
    const words = fold(`${a.label} ${a.name} ${a.city} ${a.country}`);
    let s = -1;
    if (a.iata && fold(a.iata) === f) s = 0;
    else if (fold(a.code) === f) s = 1;
    else if (words.startsWith(f)) s = 2;
    else if (` ${words}`.includes(` ${f}`)) s = 3;
    else if (words.includes(f)) s = 4;
    if (s >= 0) scored.push([s, a]);
  }
  // a word inside another ("lis" in "Ingliston") only when nothing starts with what was typed
  const best = scored.some(([sc]) => sc <= 3) ? scored.filter(([sc]) => sc <= 3) : scored;
  return best
    .sort((x, y) => x[0] - y[0] || x[1].label.localeCompare(y[1].label, "fr"))
    .slice(0, max)
    .map((x) => x[1]);
}

