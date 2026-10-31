import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { km, monthList, storyFacts, zoneFacts, shiftFacts } from "./facts.js";

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
    expect(F.bary.south2019).toBeGreaterThan(0);
  });

  it("counts the move south airport by airport, Berlin's two airports as one", () => {
    const H = shiftFacts(data);
    expect(H.rows.find((r) => r.code === "EDDT")).toBeUndefined();
    const ber = H.get("EDDB");
    const i = (y) => data.airportYears.indexOf(y);
    const sum = (y) =>
      ["EDDB", "EDDT"].reduce((s, c) => s + (data.airports.find((a) => a.code === c).pax[i(y)] ?? 0), 0);
    expect(ber.before).toBe(sum(2019));
    expect(ber.after).toBe(sum(data.meta.last));
    expect(H.south.change + H.north.change).toBe(H.bands.reduce((s, b) => s + b.change, 0));
  });
});
