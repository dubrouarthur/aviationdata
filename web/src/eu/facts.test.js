import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { km, monthList, storyFacts, zoneFacts } from "./facts.js";

const data = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data/eu/eu.json"), "utf8"));

describe("the European facts", () => {
  it("lists months across a year end", () => {
    expect(monthList("2019-11", "2020-02")).toEqual(["2019-11", "2019-12", "2020-01", "2020-02"]);
  });

  it("measures great circles in km", () => {
    // Paris-CDG to Madrid-Barajas, about 1 060 km
    expect(km({ lat: 49.0097, lon: 2.5479 }, { lat: 40.4719, lon: -3.5626 })).toBeCloseTo(1064, -1);
  });

  it("reads a zone the way the dashboard does", () => {
    const eu = data.zones[0];
    const Z = zoneFacts(data, eu);
    const i = data.years.indexOf(data.meta.last);
    expect(Z.now).toBe(eu.total[i]);
    expect(Z.series.length).toBe(Z.months.length);
    expect(Z.recordValue).toBe(Math.max(...Z.series.filter((v) => v != null)));
  });

  it("splits the countries around 2019 and keeps their order", () => {
    const F = storyFacts(data);
    expect(F.above.length + F.below.length).toBe(F.vs.length);
    expect(F.vs.every((c, k) => k === 0 || F.vs[k - 1].change >= c.change)).toBe(true);
    expect(F.bary.since2019).toBeGreaterThan(0);
  });
});
