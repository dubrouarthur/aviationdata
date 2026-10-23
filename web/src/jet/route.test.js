import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fastestRoute, greatCircle, groundSpeed, haversine, routeWind } from "./route.js";
import { decodeDay } from "./wind.js";
import fixture from "./route.fixture.json";

const pub = (p) => resolve(import.meta.dirname, "../../public/data/jet", p);
const grid = JSON.parse(readFileSync(pub("winds.json"), "utf8"));
const buf = readFileSync(pub(`winds-${fixture.year}.bin`));
const field = decodeDay(new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength), grid, fixture.day);
const at = (code) => grid.airports[code];

describe("geometry", () => {
  it("Paris to New York is about 5,834 km and the great circle bows north", () => {
    expect(haversine(...at("LFPG"), ...at("KJFK"))).toBeCloseTo(5834, -1);
    const pts = greatCircle(at("LFPG"), at("KJFK"), 50);
    expect(Math.max(...pts.map((p) => p[0]))).toBeGreaterThan(51);
  });
  it("a tailwind adds to the airspeed, a crosswind costs a little", () => {
    expect(groundSpeed(100 / 3.6, 0, 90)).toBeCloseTo(1000);
    expect(groundSpeed(100 / 3.6, 0, 270)).toBeCloseTo(800);
    expect(groundSpeed(0, 100 / 3.6, 90)).toBeCloseTo(Math.sqrt(900 ** 2 - 100 ** 2));
  });
});

describe("the browser solves the routes exactly as the Python build", () => {
  for (const c of fixture.cases)
    it(`${c.from} -> ${c.to}`, () => {
      const r = fastestRoute(field, at(c.from), at(c.to));
      expect(r.gc).toBeCloseTo(c.gc, 6);
      expect(r.best).toBeCloseTo(c.best, 6);
      expect(r.index).toEqual(c.path);
    });
  it("the wind along the route flips sign with the direction", () => {
    const e = routeWind(field, at("KJFK"), at("LFPG"));
    const w = routeWind(field, at("LFPG"), at("KJFK"));
    expect(e).toBeCloseTo(-w, 6);
  });
});
