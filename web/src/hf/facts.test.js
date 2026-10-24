import { describe, expect, it } from "vitest";
import { BIT, cheese, chain, view, storyFacts } from "./facts.js";

// a tiny accidents.json: two years, two segments, the four severities
const acc = {
  period: [2010, 2011],
  segments: [
    ["ga", "Aviation générale"],
    ["airline", "Compagnies aériennes"],
  ],
  severities: [
    ["FATL", "Mortel"],
    ["SERS", "Blessés graves"],
    ["MINR", "Blessés légers"],
    ["NONE", "Sans blessé"],
  ],
  // [year, segment, severity, mask, accidents, deaths]
  cells: [
    [2010, 0, 0, BIT.person | BIT.state, 6, 9],
    [2010, 0, 3, BIT.person, 10, 0],
    [2010, 0, 3, BIT.machine, 4, 0],
    [2011, 1, 1, BIT.env, 3, 0],
    [2011, 1, 3, BIT.person | BIT.env, 2, 0],
    [2011, 0, 3, BIT.state | BIT.env, 5, 0],
  ],
};

describe("view", () => {
  it("counts accidents and the share citing a layer", () => {
    const v = view(acc);
    expect(v.n).toBe(30);
    expect(v.has(BIT.person)).toBe(18);
    expect(v.share(BIT.person)).toBeCloseTo(60);
    expect(v.deaths).toBe(9);
    expect(v.deathsWith(BIT.person)).toBe(9);
  });

  it("filters by segment, severity and years", () => {
    expect(view(acc, { seg: "airline" }).n).toBe(5);
    expect(view(acc, { sev: "FATL" }).n).toBe(6);
    expect(view(acc, { from: 2011, to: 2011 }).n).toBe(10);
    expect(view(acc, { seg: "airline", sev: "FATL" }).n).toBe(0);
  });
});

describe("the models", () => {
  it("TEM: undesired states, the errors and threats that come with them", () => {
    const c = chain(view(acc));
    expect(c.state).toBe(11);
    expect(c.stateError).toBe(6);
    expect(c.stateThreat).toBe(5);
    expect(c.threatOnly).toBe(12); // machine 4 + env 3 + state and env 5
  });

  it("Swiss cheese: combinations of the four layers and layers pierced", () => {
    const { rows, layers } = cheese(view(acc));
    const of = (mask) => rows.find((r) => r.mask === mask)?.n ?? 0;
    expect(of(BIT.person)).toBe(16);
    expect(of(BIT.env)).toBe(8);
    expect(of(BIT.person | BIT.env)).toBe(2);
    expect(layers).toEqual([0, 28, 2, 0, 0]);
  });
});

describe("storyFacts", () => {
  it("airlines: turbulence counted from the defining events", () => {
    const people = {
      roles: [["pilot", "Pilote"]],
      levels: { 1: "Actes", 2: "Conditions", 3: "Supervision", 4: "Organisation" },
      by: {
        "all|all": { n: 30, person: 18, roles: { pilot: 15 }, errors: {}, hfacs: {}, levels: { 1: 18 } },
      },
    };
    const events = {
      events: [["Turbulence encounter", "Turbulence"]],
      by: {
        "all|all": [["Turbulence encounter", 3, 0, 0]],
        "airline|all": [["Turbulence encounter", 3, 0, 0]],
      },
    };
    const F = storyFacts({ accidents: acc, people, events, history: { old: [], new: [], break: 2008 } });
    expect(F.n).toBe(30);
    expect(F.fatal.share).toBeCloseTo(100);
    expect(F.airline.turbulence).toBe(3);
    expect(F.seg.airline.person).toBeCloseTo(40);
  });
});
