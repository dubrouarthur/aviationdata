import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bestRoute, decodeSimDay, pathTime, sample, soundKmh } from "./sim.js";
import { greatCircle } from "./route.js";
import fixture from "./sim.fixture.json";

const pub = (p) => resolve(import.meta.dirname, "../../public/data/jet", p);
const meta = JSON.parse(readFileSync(pub("sim.json"), "utf8"));
const buf = readFileSync(pub(`sim/${fixture.day}.bin`));
const field = decodeSimDay(new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength), meta.grid);

describe("simulator fields", () => {
  it("decode six steps at three levels, temperatures around 215 K", () => {
    expect(field.u.length).toBe(6 * 3 * meta.grid.nx * meta.grid.ny);
    const [, , t] = sample(field, 50, -30, 12, 1);
    expect(t).toBeGreaterThan(200);
    expect(t).toBeLessThan(240);
  });
  it("Mach 0.84 at 220 K is about 900 km/h", () => {
    expect(0.84 * soundKmh(220)).toBeCloseTo(899, -1);
  });
  it("time interpolation sits between two steps", () => {
    const a = sample(field, 50, -30, 6, 1)[0];
    const b = sample(field, 50, -30, 12, 1)[0];
    const m = sample(field, 50, -30, 9, 1)[0];
    expect(m).toBeCloseTo((a + b) / 2, 9);
  });
});

describe("the browser flies the routes exactly as the Python build", () => {
  for (const c of fixture.cases)
    it(c.name, () => {
      const r = bestRoute(field, c.from, c.to, c.hour, fixture.mach, c.level, c.fuel);
      expect(r.minutes).toBeCloseTo(c.minutes, 6);
      expect(r.burn).toBeCloseTo(c.burn, 6);
      expect(r.path.map((p) => p[2])).toEqual(c.levels);
    });
  it("great circle at flight level 340, noon", () => {
    const pts = greatCircle(fixture.cases[0].from, fixture.cases[0].to, 64);
    const r = pathTime(field, pts, 12, 1, fixture.mach);
    expect(r.minutes).toBeCloseTo(fixture.gc.minutes, 6);
    r.winds.slice(0, 5).forEach((w, i) => expect(w).toBeCloseTo(fixture.gc.winds[i], 6));
  });
});
