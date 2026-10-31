import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DATASETS, FACTS, REFERENCES, MODELS, TABLES, placed, sourceOf } from "./data-registry.js";

describe("the data registry", () => {
  it("places every source of every story", () => {
    const here = placed();
    const missing = Object.entries(TABLES).flatMap(([issue, table]) =>
      Object.keys(table)
        .map((k) => `${issue}:${k}`)
        .filter((k) => !here.has(k)),
    );
    expect(missing).toEqual([]);
  });

  it("gives every entry a name and an https address", () => {
    for (const e of [...DATASETS, ...REFERENCES, ...MODELS]) {
      const s = sourceOf(e);
      expect(s?.label, JSON.stringify(e.refs)).toBeTruthy();
      expect(s.url).toMatch(/^https:\/\//);
    }
    for (const f of FACTS.flatMap((g) => g.facts)) expect(f.url).toMatch(/^https:\/\//);
  });

  // checked here and not at build time: Vercel builds without etl/ and tests/ (.vercelignore)
  it("names code that exists", () => {
    const repo = resolve(import.meta.dirname, "../../..");
    const missing = DATASETS.flatMap((d) =>
      [...d.etl, ...d.checks].filter((p) => !existsSync(resolve(repo, p))),
    );
    expect(missing).toEqual([]);
  });

  it("names its files and its code", () => {
    const ids = DATASETS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DATASETS) {
      expect(d.files.length, d.id).toBeGreaterThan(0);
      expect(d.terms?.text, d.id).toBeTruthy();
    }
  });
});
