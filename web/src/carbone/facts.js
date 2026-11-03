// Every number of « Combien de CO2 pour un vol en avion ? », from co2.json (DGAC: CO2 of commercial air
// traffic in France, tonnes and grams per passenger-equivalent-kilometre, by segment, written by
// etl/build.py) and co2/trajets.json (great-circle distances, etl/co2/build_trips.py).
// Recomputed in Python by web/scripts/check_carbone.py.

export const SEGMENTS = [
  { key: "MET_INTERIEUR", label: "Vol intérieur", note: "entre deux villes de métropole" },
  { key: "INTL_MC", label: "Moyen-courrier", note: "Europe et bassin méditerranéen" },
  { key: "INTL_LC", label: "Long-courrier", note: "au-delà, plus de 4 h 30 de vol" },
  { key: "MET-OM_ET_OM-OM", label: "Outre-mer", note: "métropole–outre-mer et entre outre-mers" },
];

const pct = (a, b) => (a / b - 1) * 100;

export function carboneFacts(co2, trajets) {
  const years = co2.years;
  const L = years.length - 1;
  const last = years[L];
  const first = years[0];
  const g = (key, i = L) => co2.g_peqkm[key][i];

  // 1. grams per passenger-kilometre, by kind of flight
  const segments = SEGMENTS.map((s) => ({ ...s, value: g(s.key) })).sort((a, b) => b.value - a.value);
  const dom = g("MET_INTERIEUR");
  const lc = g("INTL_LC");
  const domVsLc = pct(dom, lc);
  const all = g("FRANCE_TOT");

  // 2. a few trips from Paris: distance × the segment's grams, one way and return, in kg
  const trips = trajets.trips
    .map((t) => {
      const oneWay = (t.km * g(t.segment)) / 1000;
      return { ...t, g: g(t.segment), oneWay, ret: 2 * oneWay };
    })
    .sort((a, b) => a.ret - b.ret);
  const trip = (to) => trips.find((t) => t.toName === to);

  // 3. per passenger-kilometre since 2000
  const intensity = co2.g_peqkm.FRANCE_TOT;
  const intensityChange = pct(intensity[L], intensity[0]);

  // 4. the total, and what made it move (LMDI, written by etl/build.py)
  const total = co2.mt.FRANCE_TOT;
  const peak = years[total.indexOf(Math.max(...total))];
  const totalChange = pct(total[L], total[0]);
  const d = co2.decomp.periods.find((p) => p.from === first && p.to === last);

  return {
    first,
    last,
    years,
    segments,
    dom,
    lc,
    domVsLc,
    all,
    trips,
    ny: trip("New York"),
    toulouse: trip("Toulouse"),
    nice: trip("Nice"),
    rome: trip("Rome"),
    intensity,
    intensityChange,
    intensityFirst: intensity[0],
    total,
    totalFirst: total[0],
    totalLast: total[L],
    totalChange,
    peak,
    peakValue: Math.max(...total),
    traffic: d.trafic,
    efficiency: d.intensite,
    trafficPct: d.trafic_pct,
    efficiencyPct: d.intensite_pct,
  };
}
