// The money side of the routes (cost.json): a flight's fuel from the DGAC long-haul CO2 factor and the
// load of a Paris-New York flight, its price from the EIA jet fuel price and the ECB rate.
// One conversion runs through the whole story: a minute of cruise at flight level 340, in kilos of fuel
// and in euros. web/scripts/check_site.py recomputes the same figures in Python.
import { haversine } from "./route.js";
import { soundKmh } from "./sim.js";

// the airports of the explorer and the simulator (winds.json, OurAirports), so the box and the page
// show the same distance; the conversion per minute does not depend on it (distance cancels out)
export const CDG = [49.009, 2.5541];
export const JFK = [40.6394, -73.7793];
export const ISA_FL340 = 220.8; // K
export const MACH_B77W = 0.84;

/** The last complete year of Paris-CDG <-> New York-JFK (DGAC): movements and passenger-equivalents. */
export const lastPair = (cost) => cost.pair.at(-1);

/** Passenger-equivalents per movement (passengers + 100 kg of freight each). */
export const peqPerFlight = (cost) => {
  const p = lastPair(cost);
  return p.peq / p.mvt;
};

/** Tonnes of fuel for a flight that emits `kgPerPeq` kg of CO2 per passenger-equivalent. */
export const fuelTonnes = (cost, kgPerPeq) =>
  (kgPerPeq * peqPerFlight(cost)) / cost.factors.co2_per_fuel / 1000;

/** Minutes of a Paris-New York flight without wind at flight level 340, Mach 0.84. */
export const minutesWithoutWind = (km = haversine(...CDG, ...JFK), mach = MACH_B77W) =>
  (km / (mach * soundKmh(ISA_FL340))) * 60;

/**
 * Kilos of fuel per minute of cruise: the flight's fuel (DGAC factor x distance x load / 3.16) spread
 * over its minutes without wind.
 */
export function kgPerMinute(cost) {
  const km = haversine(...CDG, ...JFK);
  return (fuelTonnes(cost, (cost.factors.g_peqkm * km) / 1000) * 1000) / minutesWithoutWind(km);
}

/** Euros per minute of cruise at the reference price (mean of the last twelve months). */
export const eurosPerMinute = (cost, price = cost.recent.eur_t) => (kgPerMinute(cost) / 1000) * price;

/** Euros per tonne of fuel in a month ("2026-09"), or the reference price. */
export const priceOf = (cost, month) =>
  month ? cost.prices.find((p) => p[0] === month)?.[1] : cost.recent.eur_t;

/**
 * What the best route at flight level 340 saves on Paris-New York, from sim_stats (2019-2022): minutes
 * per flight each way, and tonnes of fuel in a year with the last complete year's movements.
 */
export function routeSavings(stats, cost) {
  const kg = kgPerMinute(cost);
  const west = stats.west.gain_gc_l1;
  const east = stats.east.gain_gc_l1;
  const half = lastPair(cost).mvt / 2;
  return { west, east, kgWest: west * kg, kgEast: east * kg, tonnesYear: (half * (west + east) * kg) / 1000 };
}

/**
 * The conversion, step by step, for the box "D'où viennent ces kilos et ces euros" (text.js): every
 * number the reader can redo with a calculator, from the public sources to the euros of a minute.
 */
export function costSteps(cost) {
  const km = haversine(...CDG, ...JFK);
  const p = lastPair(cost);
  const f = cost.factors;
  const kgPerPeq = (f.g_peqkm * km) / 1000; // kg of CO2 per passenger-equivalent, without wind
  const peq = peqPerFlight(cost);
  const co2Flight = (kgPerPeq * peq) / 1000; // tonnes of CO2 per flight
  const fuelFlight = co2Flight / f.co2_per_fuel; // tonnes of fuel per flight
  const min = minutesWithoutWind(km);
  return {
    km,
    gPeqKm: f.g_peqkm,
    factorYear: f.g_peqkm_year,
    kgPerPeq,
    year: p.y,
    flights: p.mvt,
    pax: p.pax,
    peqYear: p.peq,
    peq,
    paxPerFlight: p.pax / p.mvt,
    co2Flight,
    co2PerFuel: f.co2_per_fuel,
    fuelFlight,
    mach: MACH_B77W,
    kelvin: ISA_FL340,
    tas: MACH_B77W * soundKmh(ISA_FL340),
    minutes: min,
    kgPerMinute: (fuelFlight * 1000) / min,
    kgPerLitre: f.kg_per_litre,
    price: cost.recent.eur_t,
    from: cost.recent.from,
    to: cost.recent.to,
    eurPerMinute: ((fuelFlight * 1000) / min / 1000) * cost.recent.eur_t,
  };
}

/**
 * The yearly value of the best route, step by step, for the box of the bilan chapter (text.js): the gain per
 * flight (sim_stats: a Boeing 777-300ER at Mach 0.84, best route at FL340 against the straight line, every day
 * of 2019-2022), its fuel, the flights of the last complete year, the tonnes and euros, and the share of the
 * line's fuel bill if every flight flew the straight line.
 */
export function routeLedger(stats, cost) {
  const kg = kgPerMinute(cost);
  const p = lastPair(cost);
  const perDir = p.mvt / 2;
  const mean = (dir, i) => stats[dir].daily.reduce((s, r) => s + r[i], 0) / stats[dir].daily.length;
  const S = routeSavings(stats, cost);
  const billTonnes = (perDir * (mean("west", 0) + mean("east", 0)) * kg) / 1000;
  return {
    ...S,
    kg,
    aircraft: stats.aircraft,
    mach: stats.mach,
    days: stats.days.length,
    hourWest: stats.west.hour,
    hourEast: stats.east.hour,
    flights: p.mvt,
    year: p.y,
    perDir,
    gcWest: mean("west", 0),
    gcEast: mean("east", 0),
    billTonnes,
    share: (100 * S.tonnesYear) / billTonnes,
    hoursYear: (perDir * (S.west + S.east)) / 60,
  };
}
