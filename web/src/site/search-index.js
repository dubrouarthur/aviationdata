// @ts-check
// The search of the magazine (⌘K, src/site/chrome.js) reads one index, written at build time into
// search.json by the partials plugin: every investigation, its parts and chapters (the chapter bar of its
// page, read in its HTML), every tool, every dataset of /donnees, the magazine's pages and the words of
// the glossary. Pure: no DOM, so that Node (vite.config.js) and the tests can call it.
import { ISSUES, TOOLS, PAGES, issueByKey, kind } from "./issues.js";
import { DATASETS } from "./data-registry.js";
import { TERMS } from "./glossary.js";

/**
 * @typedef {{ k: string, t: string, s?: string, d?: string, h: string, q?: string }} Entry
 * k: kind shown as a badge, t: title, s: second line, d: longer text searched (and shown for a word),
 * h: address relative to the site root, q: more words to match.
 */

/** Glossary keys that are not investigation keys. */
const TERM_ISSUE = { dgac: "ciel" };

/** "Qui fait le ciel" from `<a href="#partie-1">Qui fait le ciel</a>` in a page's chapter bar. */
export function topnavLinks(html) {
  const nav = html.match(/<nav class="topnav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!nav) return [];
  return [...nav[1].matchAll(/<a href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, hash, text]) => ({
    hash,
    text: text
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  }));
}

/**
 * @param {(slug: string) => string | null} readPage the HTML of a page by its folder, or null
 * @returns {Entry[]}
 */
export function buildIndex(readPage) {
  /** @type {Entry[]} */
  const out = [];
  for (const i of ISSUES) {
    out.push({
      k: kind(i),
      t: i.title,
      s: i.hook,
      d: i.dek,
      h: i.slug,
      q: `${i.topic} ${i.sources} n° ${i.no}`,
    });
    const html = readPage(i.slug);
    for (const { hash, text } of html ? topnavLinks(html) : []) {
      if (!text || /^la réponse$/i.test(text)) continue;
      out.push({ k: "Chapitre", t: text, s: i.title, h: `${i.slug}#${hash}`, q: i.topic });
    }
  }
  for (const t of TOOLS) {
    const i = issueByKey(t.issue);
    out.push({ k: "Outil", t: t.title, s: i.title, d: t.dek, h: `${i.slug}#${t.hash}` });
  }
  for (const p of PAGES.filter((p) => !p.noindex)) out.push({ k: "Page", t: p.title, h: p.slug });
  for (const d of DATASETS)
    out.push({ k: "Donnée", t: d.title, s: d.producer, d: d.what, h: `donnees#${d.id}` });
  const seen = new Set();
  for (const [key, terms] of Object.entries(TERMS)) {
    const i = issueByKey(TERM_ISSUE[key] ?? key);
    for (const term of terms) {
      if (!i || seen.has(term.t)) continue;
      seen.add(term.t);
      out.push({ k: "Mot", t: term.t, s: i.title, d: term.d, h: i.slug });
    }
  }
  return out;
}

/** Lower case, no accents, one space: what the query and the entries are compared on. */
export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s  '’-]+/g, " ")
    .trim();

/**
 * Entries holding every word of the query, best first: a word at the start of the title counts most,
 * then in the title, then in the second line, then anywhere. An empty query gives the investigations.
 * @param {Entry[]} index
 * @param {string} query
 * @param {number} [limit]
 * @returns {Entry[]}
 */
export function search(index, query, limit = 12) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return index.filter((e) => e.k === "Enquête" || e.k === "En 5 minutes").slice(0, limit);
  const scored = [];
  for (const [n, e] of index.entries()) {
    const t = fold(e.t);
    const s = fold(e.s);
    const all = `${t} ${s} ${fold(e.d)} ${fold(e.q)}`;
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (!all.includes(w)) {
        ok = false;
        break;
      }
      if (t.startsWith(w) || t.includes(` ${w}`)) score += 6;
      else if (t.includes(w)) score += 4;
      else if (s.includes(w)) score += 2;
      else score += 1;
    }
    if (ok) scored.push([score, -n, e]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || b[1] - a[1])
    .slice(0, limit)
    .map((x) => x[2]);
}
