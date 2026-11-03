import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flightFacts, segmentOf, greatCircle, LONG_HAUL_KM } from "./calc.js";

const read = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data", p), "utf8"));
const L = read("co2/liaisons.json");
const co2 = read("co2.json");

describe("the CO2 calculator", () => {
  it("classes flights as the DGAC does", () => {
    const met = { zone: "MET" };
    const om = { zone: "OM" };
    const int = { zone: "INT" };
    expect(segmentOf(met, met, 600)).toBe("MET_INTERIEUR");
    expect(segmentOf(met, om, 6700)).toBe("MET-OM_ET_OM-OM");
    expect(segmentOf(met, int, LONG_HAUL_KM - 1)).toBe("INTL_MC");
    expect(segmentOf(met, int, LONG_HAUL_KM + 1)).toBe("INTL_LC");
  });

  it("finds Paris-CDG – New York-JFK at the jet story's distance, in either direction", () => {
    const a = flightFacts(L, co2, "LFPG", "KJFK", 6, true);
    const b = flightFacts(L, co2, "KJFK", "LFPG", 6, true);
    expect(Math.round(a.km)).toBe(5834);
    expect(a.status).toBe("route");
    expect(b.perFlight).toBe(a.perFlight);
    expect(a.kg).toBeCloseTo((2 * a.km * a.g) / 1000, 9);
    expect(a.load).toBeGreaterThan(0.5);
    expect(a.load).toBeLessThan(1);
  });

  it("says when Eurostat keeps a route secret", () => {
    expect(flightFacts(L, co2, "LFPO", "LFMN", 0).status).toBe("secret");
  });

  it("measures distances on the sphere", () => {
    expect(greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo((Math.PI / 2) * 6371, 6);
  });
});

describe("the airport search", () => {
  it("puts the exact code first, ignores accents and case", async () => {
    const { searchAirports, destinations } = await import("./calc.js");
    expect(searchAirports(L, "jfk")[0].code).toBe("KJFK");
    expect(searchAirports(L, "geneve")[0].code).toBe("LSGG");
    expect(searchAirports(L, "lis").map((a) => a.code)).toContain("LPPT");
    expect(searchAirports(L, "lis").map((a) => a.code)).not.toContain("EGPH"); // Ingliston, Edinburgh
    expect(searchAirports(L, "")).toEqual([]);
    const d = destinations(L, "LFMN");
    expect(d[0].pax).toBeGreaterThanOrEqual(d.at(-1).pax);
  });
});
