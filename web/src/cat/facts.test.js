import { describe, expect, it } from "vitest";
import { catFacts, bytes } from "./facts.js";

/** A tiny cat.json: two regions growing, the hemispheres flat. */
function sample() {
  const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011];
  const ramp = (a, b) => years.map((_, i) => a + ((b - a) * i) / (years.length - 1));
  const region = (key, label, a, b) => ({
    label,
    annual: ramp(a, b),
    annualSev: ramp(a / 10, b / 10),
    seasons: {
      DJF: [null, ...ramp(2 * a, 2 * b).slice(1)],
      MAM: ramp(a, b),
      JJA: ramp(a / 2, b / 2),
      SON: ramp(a, b),
    },
    monthly: years.map(() => Array(12).fill(a)),
    clim: [3, 3, 2, 2, 1, 1, 1, 1, 2, 2, 3, 4].map((x) => x * a),
    levels: { 200: a / 2, 250: a, 300: a * 0.9 },
    decades: { change: b / a - 1 },
    decadesSev: { change: b / a - 1 },
    decadesSeasons: { DJF: { change: 0.1 }, MAM: { change: 0.2 }, JJA: { change: 0 }, SON: { change: 0.05 } },
    trendVws: { change: 0.1 },
    trendWs: { change: 0 },
  });
  return {
    meta: {
      years,
      levels: [200, 250, 300],
      fl: { 200: 390, 250: 340, 300: 300 },
      lat0: -1.5,
      step: 1.5,
      pctMod: 0.008,
      pctSev: 0.0006,
      thrMod: 1e-6,
      analyses: 100,
    },
    zonal: { all: Array.from({ length: 12 }, (_, m) => [0.01, 0.02, m === 1 ? 0.05 : 0.03]) },
    regions: {
      atlantique: region("atlantique", "Atlantique Nord", 0.02, 0.03),
      pacifique: region("pacifique", "Pacifique Nord", 0.03, 0.033),
      europe: region("europe", "Europe", 0.01, 0.0095),
      amerique: region("amerique", "États-Unis", 0.015, 0.016),
      asie: region("asie", "Asie de l'Est", 0.018, 0.019),
      nord: region("nord", "Hémisphère nord", 0.012, 0.012),
      sud: region("sud", "Hémisphère sud", 0.012, 0.012),
    },
    routes: [
      { key: "CDG-JFK", label: "Paris – New York", annual: 0.02, seasons: { DJF: 0.03, JJA: 0.01 } },
      { key: "CDG-NRT", label: "Paris – Tokyo", annual: 0.01, seasons: { DJF: 0.008, JJA: 0.015 } },
    ],
    change: { first: [2000, 2005], last: [2006, 2011], values: "AIGC/w==" },
  };
}

describe("catFacts", () => {
  const F = catFacts(sample());
  it("ranks the regions and counts the growing ones", () => {
    expect(F.byClim[0].key).toBe("pacifique");
    expect(F.up.map((r) => r.key).sort()).toEqual(["amerique", "asie", "atlantique", "pacifique"]);
  });
  it("skips the first winter, which has no December", () => {
    expect(F.atl.seasonClim.DJF).toBeCloseTo(2 * F.atl.seasonClim.MAM, 2);
    expect(F.atlWinterOverSummer).toBeGreaterThan(3.5);
  });
  it("finds the peak of the zonal band and the busiest level", () => {
    expect(F.north).toEqual({ freq: 0.05, lat: 1.5, month: 1 });
    expect(F.topLevel.fl).toBe(340);
  });
  it("reads Paris – New York", () => expect(F.pnyWinterOverSummer).toBeCloseTo(3));
  it("counts the cells that gained, the hidden ones aside", () => expect(F.changeUp).toBeCloseTo(2 / 3));
  it("decodes the base64 maps", () => expect([...bytes("AAEC/w==")]).toEqual([0, 1, 2, 255]));
});
