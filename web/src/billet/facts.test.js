import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { billetFacts, yearMean } from "./facts.js";

const read = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data", p), "utf8"));
const F = billetFacts(read("prix.json"), read("billet/hicp.json"));

describe("le billet d'avion", () => {
  it("averages only complete years", () => {
    expect(yearMean(["2025-01", "2025-02"], [1, 2], 2025)).toBeNull();
    const m = Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, "0")}`);
    expect(yearMean(m, m.map((_, i) => i + 1), 2024)).toBe(6.5);
  });

  it("indexes both lines from 100 in the first year", () => {
    expect(F.fare[0]).toBe(100);
    expect(F.cpi[0]).toBe(100);
    expect(F.fare.length).toBe(F.years.length);
  });

  it("splits the change into inflation and a real change that compound back", () => {
    expect((1 + F.real / 100) * (1 + F.inflation / 100)).toBeCloseTo(1 + F.total / 100, 10);
  });

  it("has twelve months around the year's mean", () => {
    expect(F.season).toHaveLength(12);
    expect(F.season.reduce((a, s) => a + s.value, 0)).toBeCloseTo(0, 8);
  });

  it("sorts the kinds of flight from the largest rise", () => {
    const v = F.segments.map((s) => s.value);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
});
