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
const QUARTER_NAMES = ["janvier à mars", "avril à juin", "juillet à septembre", "octobre à décembre"];

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
export function flightFacts(L, co2, from, to, month, back = false) {
  const A = L.airports.find((x) => x.code === from);
  const B = L.airports.find((x) => x.code === to);
  const km = greatCircle(A, B);
  const segment = segmentOf(A, B, km);
  const g = co2.g_peqkm[segment].at(-1);
  const trips = back ? 2 : 1;
  const kg = (km * g * trips) / 1000;
  const q = Math.floor(month / 3);
  const year = L.years.at(-1);
  const qi = (L.years.length - 1) * 4 + q;
  const out = {
    A,
    B,
    km,
    segment,
    segmentLabel: SEGMENTS.find((s) => s.key === segment).label,
    g,
    co2Year: co2.years.at(-1),
    kg,
    trips,
    month: MONTHS[month],
    quarter: QUARTER_NAMES[q],
    year,
    status: "none",
  };
  const r = pairOf(L, from, to);
  if (!r) {
    out.status = L.confidential.some(([x, y]) => (x === from && y === to) || (x === to && y === from))
      ? "secret"
      : "none";
    return out;
  }
  const at = (k) => r[k][qi];
  if (at("pax") == null || at("seats") == null || at("flights") == null) return { ...out, status: "gap" };
  const load = at("pax") / at("seats");
  const segLoad = segmentLoad(L, segment, qi);
  const prev =
    qi - 4 >= 0 && r.pax[qi - 4] != null && r.seats[qi - 4] ? r.pax[qi - 4] / r.seats[qi - 4] : null;
  return {
    ...out,
    status: "route",
    pax: at("pax"),
    seats: at("seats"),
    flights: at("flights"),
    perFlight: at("pax") / at("flights"),
    seatsPerFlight: at("seats") / at("flights"),
    // both directions over a quarter of 13 weeks: flights a week in each direction
    perWeek: at("flights") / 13 / 2,
    load,
    loadPrev: prev,
    segLoad,
    // the DGAC's grams are an average over its kind of flight: the same flight, fuller or emptier
    kgAdjusted: segLoad ? (kg * segLoad) / load : null,
    loads: [0, 1, 2, 3].map((k) => {
      const i = (L.years.length - 1) * 4 + k;
      return r.pax[i] != null && r.seats[i] ? r.pax[i] / r.seats[i] : null;
    }),
  };
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

