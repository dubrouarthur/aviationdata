import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fuelTonnes, ladderSteps, peqPerFlight, priceOf, yearlyTonnes } from "./cost.js";
import { euros as eurosFr } from "./fmt.js";

const euros = (v) => eurosFr(v).replace(/\u202f/g, " ");

const pub = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data/jet", p), "utf8"));
const cost = pub("cost.json");
const stats = pub("sim_stats.json");

describe("the money side of the routes", () => {
  it("a Paris-New York flight carries a few hundred passenger-equivalents", () => {
    expect(peqPerFlight(cost)).toBeGreaterThan(200);
    expect(peqPerFlight(cost)).toBeLessThan(450);
  });
  it("fuel follows CO2: 3.16 t of CO2 per t of fuel", () => {
    const kg = 400; // kg of CO2 per passenger-equivalent
    expect(fuelTonnes(cost, kg)).toBeCloseTo((kg * peqPerFlight(cost)) / 3.16 / 1000, 9);
  });
  it("a long-haul flight burns tens of tonnes, priced in hundreds of euros a tonne", () => {
    const t = fuelTonnes(cost, stats.west.ladder.co2[0]);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(80);
    expect(priceOf(cost)).toBe(cost.last.eur_t);
    expect(cost.prices.every(([, p]) => p > 100 && p < 2500)).toBe(true);
  });
  it("each layer of data saves something, and the steps add up to the whole", () => {
    for (const dir of [stats.west, stats.east]) {
      const L = ladderSteps(dir, cost);
      L.minutes.forEach((v) => expect(v).toBeGreaterThanOrEqual(-1e-9));
      L.tonnes.forEach((v) => expect(v).toBeGreaterThanOrEqual(-1e-9));
      expect(L.minutes.reduce((a, b) => a + b)).toBeCloseTo(L.totalMinutes, 9);
      expect(L.tonnes.reduce((a, b) => a + b)).toBeCloseTo(L.totalTonnes, 9);
    }
    const half = cost.pair.at(-1).mvt / 2;
    expect(yearlyTonnes(stats, cost)).toBeCloseTo(
      half * (ladderSteps(stats.west, cost).totalTonnes + ladderSteps(stats.east, cost).totalTonnes),
      6,
    );
  });
  it("euros are rounded to what the model supports", () => {
    expect(euros(48612)).toBe("48 600 €");
    expect(euros(1234)).toBe("1 230 €");
    expect(euros(2_712_345)).toBe("2,7 millions d'euros");
    expect(euros(1_349_000)).toBe("1,3 million d'euros");
  });
});
