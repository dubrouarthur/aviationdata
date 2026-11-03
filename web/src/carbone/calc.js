// « Calculez votre vol »: the CO2 of a flight between two airports, and what Eurostat says of that route
// (passengers, seats, flights per quarter). Pure computation in flightFacts(), recomputed in Python by
// web/scripts/check_carbone.py; the form in calculator().
import { $, el } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { SEGMENTS } from "./facts.js";

const R_KM = 6371.0;
/** Beyond this distance an international flight takes more than about 4 h 30: long-haul for the DGAC. */
export const LONG_HAUL_KM = 3600;
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const QUARTER_NAMES = ["janvier à mars", "avril à juin", "juillet à septembre", "octobre à décembre"];

export function greatCircle(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** The DGAC's kind of flight: both ends in metropolitan France, overseas France, or abroad by distance. */
export function segmentOf(a, b, km) {
  if (a.zone === "MET" && b.zone === "MET") return "MET_INTERIEUR";
  if (a.zone !== "INT" && b.zone !== "INT") return "MET-OM_ET_OM-OM";
  return km > LONG_HAUL_KM ? "INTL_LC" : "INTL_MC";
}

const pairOf = (L, a, b) => L.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));

/** Seats filled on all published routes of a kind of flight, in one quarter (the average to compare with). */
export function segmentLoad(L, segment, qi) {
  const byCode = new Map(L.airports.map((x) => [x.code, x]));
  let pax = 0;
  let seats = 0;
  for (const r of L.routes) {
    const a = byCode.get(r.a);
    const b = byCode.get(r.b);
    if (segmentOf(a, b, greatCircle(a, b)) !== segment) continue;
    if (r.pax[qi] == null || r.seats[qi] == null) continue;
    pax += r.pax[qi];
    seats += r.seats[qi];
  }
  return seats ? pax / seats : null;
}

/**
 * Everything the calculator says of a flight from airport code a to b in a month (0-11), one way or return.
 * co2: co2.json; L: co2/liaisons.json.
 */
export function flightFacts(L, co2, from, to, month, back = false) {
  const A = L.airports.find((x) => x.code === from);
  const B = L.airports.find((x) => x.code === to);
  const km = greatCircle(A, B);
  const segment = segmentOf(A, B, km);
  const g = co2.g_peqkm[segment].at(-1);
  const trips = back ? 2 : 1;
  const kg = (km * g * trips) / 1000;
  const q = Math.floor(month / 3);
  const year = L.years.at(-1);
  const qi = (L.years.length - 1) * 4 + q;
  const out = {
    A,
    B,
    km,
    segment,
    segmentLabel: SEGMENTS.find((s) => s.key === segment).label,
    g,
    co2Year: co2.years.at(-1),
    kg,
    trips,
    month: MONTHS[month],
    quarter: QUARTER_NAMES[q],
    year,
    status: "none",
  };
  const r = pairOf(L, from, to);
  if (!r) {
    out.status = L.confidential.some(([x, y]) => (x === from && y === to) || (x === to && y === from))
      ? "secret"
      : "none";
    return out;
  }
  const at = (k) => r[k][qi];
  if (at("pax") == null || at("seats") == null || at("flights") == null) return { ...out, status: "gap" };
  const load = at("pax") / at("seats");
  const segLoad = segmentLoad(L, segment, qi);
  const prev =
    qi - 4 >= 0 && r.pax[qi - 4] != null && r.seats[qi - 4] ? r.pax[qi - 4] / r.seats[qi - 4] : null;
  return {
    ...out,
    status: "route",
    pax: at("pax"),
    seats: at("seats"),
    flights: at("flights"),
    perFlight: at("pax") / at("flights"),
    seatsPerFlight: at("seats") / at("flights"),
    // both directions over a quarter of 13 weeks: flights a week in each direction
    perWeek: at("flights") / 13 / 2,
    load,
    loadPrev: prev,
    segLoad,
    // the DGAC's grams are an average over its kind of flight: the same flight, fuller or emptier
    kgAdjusted: segLoad ? (kg * segLoad) / load : null,
    loads: [0, 1, 2, 3].map((k) => {
      const i = (L.years.length - 1) * 4 + k;
      return r.pax[i] != null && r.seats[i] ? r.pax[i] / r.seats[i] : null;
    }),
  };
}

const kg10 = (v) => `${fmtNum(Math.round(v / 10) * 10, 0)} kg`;
const pct = (v) => `${fmtNum(v * 100, 0)} %`;
const label = (a) => `${a.name} (${a.iata || a.code}), ${a.country}`;

/** The form and its answer. */
export function calculator(node, L, co2) {
  const byLabel = new Map(L.airports.map((a) => [label(a).toLowerCase(), a]));
  const byCode = new Map(L.airports.flatMap((a) => [[a.code, a], ...(a.iata ? [[a.iata, a]] : [])]));
  const find = (v) => {
    const s = v.trim();
    if (!s) return null;
    return (
      byLabel.get(s.toLowerCase()) ??
      byCode.get(s.toUpperCase()) ??
      L.airports.find((a) => `${a.name} ${a.city}`.toLowerCase().includes(s.toLowerCase())) ??
      null
    );
  };
  const list = el(
    "datalist",
    { id: "calc-airports" },
    L.airports.map((a) => el("option", { value: label(a) })),
  );
  const field = (id, text, value) =>
    el("p", { class: "calc-field" }, [
      el("label", { for: id, text }),
      el("input", {
        id,
        type: "text",
        list: "calc-airports",
        autocomplete: "off",
        value,
        spellcheck: "false",
      }),
    ]);
  const monthSel = el(
    "select",
    { id: "calc-month" },
    MONTHS.map((m, i) =>
      el("option", { value: String(i), text: m[0].toUpperCase() + m.slice(1), selected: i === 6 }),
    ),
  );
  const tripSel = el("select", { id: "calc-trip" }, [
    el("option", { value: "1", text: "Aller-retour", selected: true }),
    el("option", { value: "0", text: "Aller simple" }),
  ]);
  const ny = L.airports.find((a) => a.code === "KJFK");
  const cdg = L.airports.find((a) => a.code === "LFPG");
  const form = el("form", { class: "calc-form", "aria-label": "Votre vol" }, [
    list,
    field("calc-from", "Départ", cdg ? label(cdg) : ""),
    field("calc-to", "Arrivée", ny ? label(ny) : ""),
    el("p", { class: "calc-field" }, [el("label", { for: "calc-month", text: "Mois du voyage" }), monthSel]),
    el("p", { class: "calc-field" }, [el("label", { for: "calc-trip", text: "Trajet" }), tripSel]),
    el("p", {
      class: "calc-hint",
      text: "Tapez une ville, un aéroport ou son code (CDG, NCE…) et choisissez dans la liste.",
    }),
  ]);
  const result = el("div", { class: "calc-result", id: "calc-result", "aria-live": "polite" });
  node.replaceChildren(form, result);

  const show = () => {
    const a = find($("#calc-from").value);
    const b = find($("#calc-to").value);
    if (!a || !b || a === b) {
      result.replaceChildren(
        el("p", {
          class: "calc-msg",
          text:
            !a || !b
              ? "Choisissez deux aéroports de la liste : ceux que relient des vols au départ ou à l'arrivée de la France."
              : "Le départ et l'arrivée sont le même aéroport.",
        }),
      );
      return;
    }
    const F = flightFacts(L, co2, a.code, b.code, +monthSel.value, tripSel.value === "1");
    const head = [
      el("p", { class: "calc-big" }, [
        el("b", { id: "calc-kg", text: kg10(F.kg) }),
        el("span", { text: ` de CO2 par passager, ${F.trips === 2 ? "aller-retour" : "aller simple"}` }),
      ]),
      el("p", { class: "calc-line", id: "calc-basis" }, [
        `${fmtNum(F.km, 0)} km à vol d'oiseau, ${F.segmentLabel.toLowerCase()} : ${fmtNum(F.g, 0)} g de CO2 par passager et par kilomètre en moyenne (DGAC, ${F.co2Year}).`,
      ]),
    ];
    let route;
    if (F.status === "route") {
      const trend =
        F.loadPrev == null
          ? ""
          : Math.round(F.load * 100) === Math.round(F.loadPrev * 100)
            ? `, comme un an plus tôt`
            : `, contre ${pct(F.loadPrev)} un an plus tôt`;
      route = [
        el("h4", { text: `Votre vol, d'après ${F.quarter} ${F.year}` }),
        el("ul", { class: "calc-stats", id: "calc-stats" }, [
          el("li", {}, [
            el("b", { text: fmtNum(Math.round(F.perFlight), 0) }),
            ` passagers par vol en moyenne, pour ${fmtNum(Math.round(F.seatsPerFlight), 0)} sièges`,
          ]),
          el("li", {}, [el("b", { text: pct(F.load) }), ` des sièges occupés${trend}`]),
          el("li", {}, [
            el("b", { text: fmtNum(Math.round(F.perWeek), 0) }),
            " vols par semaine dans chaque sens, toutes compagnies",
          ]),
        ]),
        el(
          "div",
          { class: "calc-q", role: "img", "aria-label": `Sièges occupés par trimestre en ${F.year}` },
          F.loads.map((v, k) =>
            el("span", { class: `calc-qbar${k === Math.floor(+monthSel.value / 3) ? " on" : ""}` }, [
              el("i", { style: `height:${v == null ? 0 : (v * 100).toFixed(1)}%` }),
              el("b", { text: v == null ? "–" : pct(v) }),
              el("small", { text: `T${k + 1}` }),
            ]),
          ),
        ),
        F.kgAdjusted
          ? el("p", { class: "calc-line", id: "calc-adjusted" }, [
              `Les ${F.segmentLabel.toLowerCase() === "vol intérieur" ? "vols intérieurs" : `vols de ce type`} sont remplis à ${pct(F.segLoad)} en moyenne ce trimestre-là. Rapporté au remplissage de cette liaison, votre part serait d'environ `,
              el("b", { text: kg10(F.kgAdjusted) }),
              ".",
            ])
          : null,
      ];
    } else {
      route = [
        el("p", {
          class: "calc-msg",
          id: "calc-noroute",
          text:
            F.status === "secret"
              ? `Eurostat ne publie pas les chiffres de cette liaison : ils révéleraient ceux d'une seule compagnie (secret statistique). Le CO2 ci-dessus reste une moyenne.`
              : `Eurostat ne compte pas de vol direct entre ces deux aéroports en ${F.year}. Avec une escale, la distance et le CO2 augmentent.`,
        }),
      ];
    }
    result.replaceChildren(...head, ...route);
  };
  form.addEventListener("input", show);
  form.addEventListener("change", show);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    show();
  });
  show();
}
