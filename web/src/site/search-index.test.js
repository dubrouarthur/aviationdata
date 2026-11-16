import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildIndex, fold, search, topnavLinks } from "./search-index.js";
import { ISSUES, TOOLS } from "./issues.js";

const WEB = join(import.meta.dirname, "..", "..");
const read = (slug) => {
  const f = join(WEB, slug, "index.html");
  return existsSync(f) ? readFileSync(f, "utf8") : null;
};

describe("search index", () => {
  const index = buildIndex(read);

  it("lists every investigation and every tool", () => {
    for (const i of ISSUES) expect(index.some((e) => e.h === i.slug && e.t === i.title)).toBe(true);
    for (const t of TOOLS)
      expect(index.some((e) => e.k === "Outil" && e.h.endsWith(`#${t.hash}`))).toBe(true);
  });

  it("reads the chapters in each page's chapter bar", () => {
    expect(topnavLinks('<nav class="topnav" aria-label="x"><a href="#a">Un <b>deux</b></a></nav>')).toEqual([
      { hash: "a", text: "Un deux" },
    ]);
    const chapters = index.filter((e) => e.k === "Chapitre");
    expect(chapters.length).toBeGreaterThan(20);
    for (const c of chapters) {
      const [slug, hash] = c.h.split("#");
      expect(read(slug)).toContain(`id="${hash}"`);
    }
  });

  it("finds without accents or case, title first", () => {
    expect(fold("Écart  Saisonnier")).toBe("ecart saisonnier");
    const hits = search(index, "facteur humain");
    expect(hits[0].h).toBe("facteur-humain");
    expect(search(index, "calendrier")[0].t).toMatch(/calendrier/i);
    expect(search(index, "zzzz introuvable")).toEqual([]);
  });

  it("offers the publications when the query is empty", () => {
    const hits = search(index, "");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.k === "Enquête" || e.k === "En 5 minutes")).toBe(true);
  });
});
