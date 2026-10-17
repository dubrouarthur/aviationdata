import { toDate } from "./series.js";

const FILES = ["meta", "fracture", "aeroports", "compagnies", "prix", "co2", "monde", "routes"];

export async function loadAll(base = "data/") {
  const entries = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`${base}${name}.json`);
      if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
      return [name, await res.json()];
    }),
  );
  return Object.fromEntries(entries);
}

// Dated events drawn as thin rules on every time chart whose range includes them.
export const EVENTS = [
  { date: "2001-09", label: "11-Septembre", short: "11/9" },
  { date: "2008-10", label: "Crise financière", short: "2008" },
  { date: "2020-03", label: "Covid-19", short: "Covid" },
  { date: "2023-05", label: "Interdiction de vols courts", short: "Vols courts" },
  { date: "2025-03", label: "Taxe sur les billets ×2,8", short: "TSBA" },
  { date: "2026-02", label: "Détroit d'Ormuz bloqué", short: "Ormuz" },
  { date: "2026-06", label: "TSBA réduite sur 26 lignes", short: "TSBA −" },
];

export const eventMarks = () => EVENTS.map((e) => ({ date: toDate(e.date), label: e.label, short: e.short }));

/** Shared state: the selected airport, mirrored in the URL hash as a plain anchor (#aeroport-LFBE). */
const listeners = new Set();
let selected = null;

export const selection = {
  get: () => selected,
  set(code, { scroll = false } = {}) {
    if (code === selected) return;
    selected = code;
    try {
      history.replaceState(null, "", code ? `#aeroport-${code}` : location.pathname + location.search);
    } catch {
      /* sandboxed frames may refuse history access */
    }
    listeners.forEach((fn) => fn(code, { scroll }));
  },
  on: (fn) => listeners.add(fn),
  fromHash() {
    const m = /aeroport[-=]([A-Z]{4})/.exec(location.hash || "");
    return m ? m[1] : null;
  },
};
