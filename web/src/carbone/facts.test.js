import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { carboneFacts } from "./facts.js";

const read = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data", p), "utf8"));
const F = carboneFacts(read("co2.json"), read("co2/trajets.json"));

describe("le CO2 d'un vol", () => {
  it("prices a trip as distance times its segment's grams, both ways", () => {
    for (const t of F.trips) expect(t.ret).toBeCloseTo((2 * t.km * t.g) / 1000, 9);
    expect(F.ny.km).toBe(5834); // the jet story's Paris-CDG – New York-JFK
  });

  it("sorts the trips from the lightest", () => {
    const v = F.trips.map((t) => t.ret);
    expect(v).toEqual([...v].sort((a, b) => a - b));
  });

  it("explains the whole change of the total by traffic and efficiency", () => {
    expect(F.traffic + F.efficiency).toBeCloseTo(F.totalLast - F.totalFirst, 1);
  });
});
