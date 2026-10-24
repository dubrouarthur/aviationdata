// The money side of the routes (cost.json): a flight's fuel from the DGAC long-haul CO2 factor and the
// load of a Paris-New York flight, its price from the EIA jet fuel price and the ECB rate.
// web/scripts/check_site.py recomputes the same figures in Python.

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

/**
 * What each layer of weather data is worth for one direction of sim_stats (its `ladder`):
 * the savings of each step in minutes (aiming for time) and in tonnes of fuel per flight (aiming for fuel).
 */
export function ladderSteps(dir, cost) {
  const L = dir.ladder;
  const fuel = L.co2.map((k) => fuelTonnes(cost, k));
  return {
    minutes: [1, 2, 3].map((i) => L.time[i - 1] - L.time[i]),
    tonnes: [1, 2, 3].map((i) => fuel[i - 1] - fuel[i]),
    fuel,
    totalMinutes: L.time[0] - L.time[3],
    totalTonnes: fuel[0] - fuel[3],
  };
}

/** Tonnes of fuel saved in a year on Paris-New York: each direction's saving per flight, half the movements each. */
export function yearlyTonnes(stats, cost) {
  const half = lastPair(cost).mvt / 2;
  return half * (ladderSteps(stats.west, cost).totalTonnes + ladderSteps(stats.east, cost).totalTonnes);
}

/** Euros per tonne of fuel in a month ("2026-09"), or the last month published. */
export const priceOf = (cost, month) =>
  month ? cost.prices.find((p) => p[0] === month)?.[1] : cost.last.eur_t;
