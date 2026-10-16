import { describe, expect, it } from "vitest";
import {
  rolling12,
  rebase,
  yoy,
  yearSum,
  seasonality,
  pctChange,
  sumSeries,
  ranksByYear,
  toDate,
  annualFromMonthly,
} from "./series.js";
import { fmtPct, fmtPax, fmtMonth, fmtNum, fmtPctAbs, fmtPaxAxis, ordinal } from "./format.js";

const months = [
  "2019-01",
  "2019-02",
  "2019-03",
  "2019-04",
  "2019-05",
  "2019-06",
  "2019-07",
  "2019-08",
  "2019-09",
  "2019-10",
  "2019-11",
  "2019-12",
  "2020-01",
];

describe("series", () => {
  it("rolling12 sums the last 12 months and stays null until the window is full", () => {
    const v = months.map((_, i) => i + 1); // 1..13
    const r = rolling12(v);
    expect(r[10]).toBeNull();
    expect(r[11]).toBe(78); // 1..12
    expect(r[12]).toBe(90); // 2..13
  });

  it("rolling12 does not hide a missing month (gap => null)", () => {
    const v = months.map(() => 10);
    v[5] = null;
    expect(rolling12(v)[11]).toBeNull();
  });

  it("rebase divides by the base and keeps nulls", () => {
    expect(rebase([50, null, 200], 100)).toEqual([50, null, 200]);
    expect(rebase([50, 100], 50)).toEqual([100, 200]);
  });

  it("yoy compares with 12 months earlier, in percent", () => {
    const v = months.map((_, i) => (i === 12 ? 110 : 100));
    const y = yoy(v);
    expect(y[11]).toBeNull();
    expect(y[12]).toBeCloseTo(10, 10);
  });

  it("yearSum ignores gaps but returns null for an empty year", () => {
    const v = months.map(() => 1);
    v[0] = null;
    expect(yearSum(months, v, 2019)).toBe(11);
    expect(yearSum(months, v, 2018)).toBeNull();
  });

  it("annualFromMonthly only keeps complete years", () => {
    const { years, values } = annualFromMonthly(
      months,
      months.map(() => 2),
    );
    expect(years).toEqual([2019]);
    expect(values).toEqual([24]);
  });

  it("seasonality returns the 12 months of a year, null where missing", () => {
    const s = seasonality(
      months,
      months.map((_, i) => i),
      2020,
    );
    expect(s[0]).toBe(12);
    expect(s[1]).toBeNull();
  });

  it("pctChange and sumSeries", () => {
    expect(pctChange(100, 70)).toBeCloseTo(-30, 10);
    expect(pctChange(0, 70)).toBeNull();
    expect(
      sumSeries([
        [1, 2, null],
        [3, null, null],
      ]),
    ).toEqual([4, 2, null]);
  });

  it("ranksByYear ranks within each year, ties broken by name", () => {
    const r = ranksByYear([
      { nom: "A", pax: [10, 30] },
      { nom: "B", pax: [20, 30] },
      { nom: "C", pax: [0, 5] },
    ]);
    expect(r.get("B")).toEqual([1, 2]); // year 2: tie with A, A wins on name
    expect(r.get("A")).toEqual([2, 1]);
    expect(r.get("C")).toEqual([null, 3]); // zero traffic => not ranked
  });

  it("toDate parses YYYY-MM and plain years in UTC", () => {
    expect(toDate("2026-09").toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(toDate(2024).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("format (fr-FR)", () => {
  it("formats signed percentages with a true minus sign", () => {
    expect(fmtPct(7.26)).toBe("+7,3 %");
    expect(fmtPct(-29.94)).toBe("−29,9 %");
    expect(fmtPct(null)).toBe("–");
  });

  it("formats passenger counts compactly", () => {
    expect(fmtPax(183022025)).toBe("183,0 M");
    expect(fmtPax(245300)).toBe("245 k");
    expect(fmtPax(9800)).toBe("9 800");
  });

  it("formats months and numbers", () => {
    expect(fmtMonth("2026-09")).toBe("septembre 2026");
    expect(fmtNum(75.8, 1)).toBe("75,8");
  });

  it("formats unsigned percentages, axis ticks and ordinals", () => {
    expect(fmtPctAbs(-29.94)).toBe("29,9\u202f%");
    expect(fmtPaxAxis(60e6)).toBe("60\u202fM");
    expect(fmtPaxAxis(2.5e6)).toBe("2,5\u202fM");
    expect(fmtPaxAxis(800e3)).toBe("800\u202fk");
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(7)).toBe("7e");
  });
});
