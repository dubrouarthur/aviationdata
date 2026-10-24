// Every number of the human-factor story, computed from web/public/data/hf/*.json. The text, the charts
// and the tool read them from here; web/scripts/check_hf.py recomputes them in Python.
// A cell of accidents.json: [year, segment index, severity index, layer mask, accidents, deaths].

// short names of the types of flight, for buttons
export const SEG_SHORT = {
  ga: "Aviation générale",
  taxi: "Taxi aérien",
  airline: "Compagnies",
  work: "Travail aérien",
  other: "Autres",
};

export const BIT = { person: 1, machine: 2, env: 4, org: 8, state: 16, handling: 32, undet: 64 };
const FATAL = 0; // severity index of "FATL"

// what the investigators cite, in the order of the story, with their colours (hf.css)
export const LAYERS = [
  { key: "person", label: "Une personne (erreur humaine)", short: "Personne", color: "var(--human)" },
  {
    key: "env",
    label: "L'environnement (météo, terrain, faune)",
    short: "Environnement",
    color: "var(--env)",
  },
  {
    key: "handling",
    label: "L'appareil mal utilisé, mal entretenu ou à court de carburant",
    short: "Appareil mal utilisé",
    color: "var(--handling)",
  },
  { key: "machine", label: "Une panne ou un défaut de l'appareil", short: "Panne", color: "var(--machine)" },
  {
    key: "org",
    label: "Une organisation (exploitant, constructeur, autorité)",
    short: "Organisation",
    color: "var(--org)",
  },
  { key: "undet", label: "Cause indéterminée", short: "Indéterminée", color: "var(--undet)" },
];

/** A view on the cells: filter by segment key, severity key, years; count accidents, deaths, layers. */
export function view(acc, { seg = "all", sev = "all", from, to } = {}) {
  const si = seg === "all" ? -1 : acc.segments.findIndex(([k]) => k === seg);
  const vi = sev === "all" ? -1 : acc.severities.findIndex(([k]) => k === sev);
  const [y0, y1] = [from ?? acc.period[0], to ?? acc.period[1]];
  const cells = acc.cells.filter(
    (c) => (si < 0 || c[1] === si) && (vi < 0 || c[2] === vi) && c[0] >= y0 && c[0] <= y1,
  );
  const n = cells.reduce((s, c) => s + c[4], 0);
  const count = (test) => cells.reduce((s, c) => s + (test(c[3]) ? c[4] : 0), 0);
  const has = (bit) => count((m) => (m & bit) > 0);
  const deaths = cells.reduce((s, c) => s + c[5], 0);
  return {
    n,
    cells,
    count,
    has,
    share: (bit) => (n ? (100 * has(bit)) / n : 0),
    deaths,
    deathsWith: (bit) => cells.reduce((s, c) => s + (c[3] & bit ? c[5] : 0), 0),
  };
}

/** The four layers of the Swiss cheese a finding can pierce: person, aircraft (failure), environment, organization. */
export const CHEESE = [
  { key: "person", bit: BIT.person, label: "Personne" },
  { key: "machine", bit: BIT.machine, label: "Appareil" },
  { key: "env", bit: BIT.env, label: "Environnement" },
  { key: "org", bit: BIT.org, label: "Organisation" },
];
const CHEESE_MASK = CHEESE.reduce((m, l) => m | l.bit, 0);

/** Accidents per combination of the four layers, largest first, and per number of layers pierced. */
export function cheese(v) {
  const combos = new Map();
  const layers = [0, 0, 0, 0, 0];
  for (const c of v.cells) {
    const m = c[3] & CHEESE_MASK;
    combos.set(m, (combos.get(m) ?? 0) + c[4]);
    layers[CHEESE.filter((l) => m & l.bit).length] += c[4];
  }
  const rows = [...combos]
    .map(([mask, n]) => ({ mask, n, share: (100 * n) / v.n }))
    .sort((a, b) => b.n - a.n);
  return { rows, layers };
}

/** The chain of Threat and Error Management: threats (environment, failure), errors, undesired aircraft states. */
export function chain(v) {
  const threat = BIT.env | BIT.machine;
  const state = v.has(BIT.state);
  return {
    n: v.n,
    threat: v.count((m) => (m & threat) > 0),
    error: v.has(BIT.person),
    state,
    stateError: v.count((m) => m & BIT.state && m & BIT.person),
    stateThreat: v.count((m) => m & BIT.state && m & threat),
    stateNoError: v.count((m) => m & BIT.state && !(m & BIT.person)),
    threatOnly: v.count((m) => m & threat && !(m & BIT.person)),
  };
}

/** Share of accidents citing a person, per year. */
export const byYear = (acc, opts = {}) => {
  const out = [];
  for (let y = acc.period[0]; y <= acc.period[1]; y++) {
    const v = view(acc, { ...opts, from: y, to: y });
    out.push({ year: y, n: v.n, person: v.share(BIT.person), machine: v.share(BIT.machine) });
  }
  return out;
};

/** Accidents and the share citing a person, per severity, from fatal to no injury. */
export const bySeverity = (acc, seg = "all") =>
  acc.severities.map(([k, label]) => {
    const v = view(acc, { seg, sev: k });
    return { key: k, label, n: v.n, person: v.has(BIT.person), share: v.share(BIT.person) };
  });

/** Every segment's layer shares. */
export const bySegment = (acc) =>
  acc.segments.map(([k, label]) => {
    const v = view(acc, { seg: k });
    return {
      key: k,
      label,
      n: v.n,
      fatal: view(acc, { seg: k, sev: "FATL" }).n,
      ...Object.fromEntries(Object.entries(BIT).map(([b, bit]) => [b, v.share(bit)])),
    };
  });

/** The people.json group for a segment and a severity. */
export const group = (people, seg = "all", sev = "all") => people.by[`${seg}|${sev}`];

/** Events of a group, with labels: [{key, label, n, person, fatal, share}]. */
export function events(ev, seg = "all", sev = "all") {
  const label = Object.fromEntries(ev.events);
  return (ev.by[`${seg}|${sev}`] ?? []).map(([key, n, person, fatal]) => ({
    key,
    label: label[key] ?? key,
    n,
    person,
    fatal,
    share: n ? (100 * person) / n : 0,
  }));
}

/** The headline numbers of the story. */
export function storyFacts({ accidents: acc, people, events: ev, history }) {
  const all = view(acc);
  const fatal = view(acc, { sev: "FATL" });
  const segs = bySegment(acc);
  const seg = Object.fromEntries(segs.map((s) => [s.key, s]));
  const g = group(people);
  const withPerson = g.person;
  const hfacsBase = all.count((m) => (m & (BIT.person | BIT.org)) > 0);
  const fatalHfacsBase = fatal.count((m) => (m & (BIT.person | BIT.org)) > 0);
  const evAll = events(ev);
  const evAir = events(ev, "airline");
  const airline = view(acc, { seg: "airline" });
  const turb = evAir.filter((e) => /Turbulence|Clear air turbulence/.test(e.key));
  return {
    period: acc.period,
    years: acc.period[1] - acc.period[0] + 1,
    n: all.n,
    person: all.has(BIT.person),
    share: Object.fromEntries(Object.keys(BIT).map((b) => [b, all.share(BIT[b])])),
    humanBroad: all.share(BIT.person | BIT.handling | BIT.org),
    fatal: { n: fatal.n, person: fatal.has(BIT.person), share: fatal.share(BIT.person) },
    deaths: { n: all.deaths, person: all.deathsWith(BIT.person) },
    severity: bySeverity(acc),
    segs,
    seg,
    roles: Object.fromEntries(people.roles.map(([k]) => [k, g.roles[k] ?? 0])),
    withPerson,
    hfacsBase,
    fatalHfacsBase,
    levels: Object.fromEntries(Object.keys(people.levels).map((k) => [k, g.levels[k] ?? 0])),
    families: g.hfacs,
    errors: g.errors,
    events: evAll,
    airline: {
      n: airline.n,
      turbulence: turb.reduce((s, e) => s + e.n, 0),
      turbulencePerson: turb.reduce((s, e) => s + e.person, 0),
      fatal: view(acc, { seg: "airline", sev: "FATL" }).n,
    },
    chain: chain(all),
    cheese: cheese(all),
    history,
  };
}

export const FATAL_INDEX = FATAL;
