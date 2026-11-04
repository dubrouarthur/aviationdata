import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { worldFacts, usFacts } from "./facts.js";

const read = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/data", p), "utf8"));
const W = worldFacts(read("avions/monde.json"));
const U = usFacts(read("avions/us.json"));

describe("the world's models", () => {
  it("shares the flights out among groups that sum to one", () => {
    expect(Object.values(W.groups).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(W.families.reduce((a, f) => a + f.share, 0)).toBeCloseTo(1, 9);
  });
  it("gives every country's shares a total of one", () => {
    for (const c of W.countries) expect(Object.values(c.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it("orders the changes from the largest gain to the largest loss", () => {
    const v = W.change.map((m) => m.pp);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
});

describe("the United States", () => {
  it("compares each model with its airlines' own on-time share", () => {
    for (const m of U.big) expect(Math.abs(U.gap(m))).toBeLessThan(15);
    expect(U.best.ontime).toBeGreaterThanOrEqual(U.worst.ontime);
  });
  it("keeps cancellation rates to airlines that give their cancellations a tail number", () => {
    for (const m of U.cm) expect(m.cancelBase).toBeGreaterThanOrEqual(20000);
  });
});
