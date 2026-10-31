import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seasonFacts, PANDEMIC } from "./facts.js";

const data = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data/eu/eu.json"), "utf8"));

describe("the seasons", () => {
  it("reads a season per day, without the pandemic years", () => {
    const Q = seasonFacts(data);
    expect(Q.years.some((y) => PANDEMIC.includes(y))).toBe(false);
    const eu = Q.at("EU27_2020", data.meta.last);
    // the daily index averages to 1 over the year, weighted by the days of each month
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (data.meta.last % 4 === 0) days[1] = 29;
    const mean = eu.index.reduce((s, v, k) => s + v * days[k], 0) / days.reduce((s, d) => s + d, 0);
    expect(mean).toBeCloseTo(1, 10);
    expect(eu.gap).toBeCloseTo(Math.max(...eu.index) / Math.min(...eu.index), 10);
  });

  it("compares national and international flights where national flights count", () => {
    const Q = seasonFacts(data);
    expect(Q.kinds.length).toBeGreaterThan(5);
    for (const r of Q.kinds) {
      expect(r.share).toBeGreaterThanOrEqual(5);
      expect(r.nat.gap).toBeGreaterThan(1);
      expect(r.intl.gap).toBeGreaterThan(1);
    }
  });
});
