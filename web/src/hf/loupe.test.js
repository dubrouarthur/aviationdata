import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { caseColumns, status } from "./loupe.js";
import { CASES } from "./cases.js";

const data = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../public/data/hf/cases.json"), "utf8"),
);
const byKey = Object.fromEntries(data.cases.map((c) => [c.key, c]));

describe("six accidents under the loupe", () => {
  it("every accident of the data has its summary, probable cause and sources", () => {
    for (const c of data.cases) {
      const m = CASES[c.key];
      expect(m, c.key).toBeTruthy();
      expect(m.cause.length).toBeGreaterThan(40);
      expect(m.report.url).toMatch(/^https:\/\/www\.ntsb\.gov\//);
      expect(m.followed.every((x) => /^https:\/\//.test(x.url))).toBe(true);
    }
  });
  it("reads which layers each accident pierced", () => {
    const sw = caseColumns(byKey.southwest, data.columns);
    expect(sw.aircraft).toBe("cited"); // a fan blade: the only accident with no person in the cause
    expect(sw.acts).toBe("other");
    expect(caseColumns(byKey.hudson, data.columns).env).toBe("cited");
    expect(caseColumns(byKey.colgan, data.columns).org).toBe("cited");
  });
  it("says what a finding's status is", () => {
    expect(status([true, "C"])).toMatch(/comme cause/);
    expect(status([true, "F"])).toMatch(/facteur contributif/);
    expect(status([true, ""])).toBe("Retenu dans la cause probable");
    expect(status([false, ""])).toMatch(/hors de la cause probable/);
  });
});
