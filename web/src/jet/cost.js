// The money side of the routes (cost.json): a flight's fuel from the DGAC long-haul CO2 factor and the
// load of a Paris-New York flight, its price from the EIA jet fuel price and the ECB rate.
// One conversion runs through the whole story: a minute of cruise at flight level 340, in kilos of fuel
// and in euros. web/scripts/check_site.py recomputes the same figures in Python.
import { haversine } from "./route.js";
import { soundKmh } from "./sim.js";

export const CDG = [49.0097, 2.5479]; // as in etl/jet/build_sim.py
export const JFK = [40.6413, -73.7781];
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
