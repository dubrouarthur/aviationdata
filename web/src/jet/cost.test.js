import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  costSteps,
  eurosPerMinute,
  fuelTonnes,
  kgPerMinute,
  minutesWithoutWind,
  peqPerFlight,
  priceOf,
  routeSavings,
} from "./cost.js";
import { euros as eurosFr } from "./fmt.js";

const euros = (v) => eurosFr(v).replace(/ /g, " ");
const pub = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data/jet", p), "utf8"));
const cost = pub("cost.json");
const stats = pub("sim_stats.json");

describe("the money side of the routes", () => {
  it("a Paris-New York flight carries a few hundred passenger-equivalents", () => {
    expect(peqPerFlight(cost)).toBeGreaterThan(200);
    expect(peqPerFlight(cost)).toBeLessThan(450);
  });
  it("fuel follows CO2: 3.16 t of CO2 per t of fuel", () => {
    expect(fuelTonnes(cost, 400)).toBeCloseTo((400 * peqPerFlight(cost)) / 3.16 / 1000, 9);
  });
  it("a minute of cruise burns about a hundred kilos", () => {
    expect(minutesWithoutWind()).toBeGreaterThan(360);
    expect(minutesWithoutWind()).toBeLessThan(420);
    expect(kgPerMinute(cost)).toBeGreaterThan(60);
    expect(kgPerMinute(cost)).toBeLessThan(160);
    expect(eurosPerMinute(cost)).toBeCloseTo((kgPerMinute(cost) * cost.recent.eur_t) / 1000, 9);
  });
  it("prices: monthly, and a twelve-month reference", () => {
    expect(priceOf(cost)).toBe(cost.recent.eur_t);
    expect(cost.prices.every(([, p]) => p > 100 && p < 2500)).toBe(true);
    const last12 = cost.prices.slice(-12).map((p) => p[1]);
    expect(cost.recent.eur_t).toBeCloseTo(last12.reduce((a, b) => a + b) / 12, 1);
  });
  it("the best route saves more towards New York than towards Paris", () => {
    const r = routeSavings(stats, cost);
    expect(r.west).toBeGreaterThan(r.east);
    expect(r.kgWest).toBeCloseTo(r.west * kgPerMinute(cost), 9);
    expect(r.tonnesYear).toBeCloseTo(((cost.pair.at(-1).mvt / 2) * (r.kgWest + r.kgEast)) / 1000, 6);
  });
  it("euros are rounded to what the model supports", () => {
    expect(euros(48612)).toBe("48 600 €");
    expect(euros(1234)).toBe("1 230 €");
    expect(euros(2_712_345)).toBe("2,7 millions d'euros");
    expect(euros(1_349_000)).toBe("1,3 million d'euros");
  });
  it("the step-by-step box lands on the same kilos and euros per minute", () => {
    const S = costSteps(cost);
    expect(S.kgPerPeq).toBeCloseTo((S.gPeqKm * S.km) / 1000, 9);
    expect(S.fuelFlight).toBeCloseTo(fuelTonnes(cost, S.kgPerPeq), 9);
    expect(S.minutes).toBeCloseTo(minutesWithoutWind(), 9);
    expect(S.kgPerMinute).toBeCloseTo(kgPerMinute(cost), 9);
    expect(S.eurPerMinute).toBeCloseTo(eurosPerMinute(cost), 9);
    expect(S.tas).toBeGreaterThan(880);
    expect(S.tas).toBeLessThan(920);
  });
});
