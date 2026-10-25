import { describe, expect, it } from "vitest";
import { waypointPath } from "./simulator.js";
import { greatCircle, haversine } from "./route.js";

const CDG = [49.0097, 2.5479];
const JFK = [40.6413, -73.7781];

describe("the reader's route", () => {
  it("joins its waypoints with 63 segments, from Paris to New York", () => {
    const pts = waypointPath([CDG, [55, -20], [52, -45], [47, -60], JFK]);
    expect(pts).toHaveLength(64);
    expect(pts[0]).toEqual(CDG);
    expect(pts.at(-1)[0]).toBeCloseTo(JFK[0], 9);
    for (const w of [
      [55, -20],
      [52, -45],
    ])
      expect(pts.some((p) => haversine(p[0], p[1], w[0], w[1]) < 1e-6)).toBe(true);
  });

  it("is the straight line when its points sit on it", () => {
    const on = greatCircle(CDG, JFK, 5);
    const pts = waypointPath(on);
    const line = greatCircle(CDG, JFK, 400);
    for (const p of pts) {
      const d = Math.min(...line.map((q) => haversine(p[0], p[1], q[0], q[1])));
      expect(d).toBeLessThan(10); // km, within the sampling of the reference line
    }
    const len = pts.slice(1).reduce((s, q, i) => s + haversine(pts[i][0], pts[i][1], q[0], q[1]), 0);
    expect(len).toBeCloseTo(haversine(...CDG, ...JFK), 0);
  });
});
