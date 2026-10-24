import { fmtNum } from "../lib/format.js";

const NNBSP = " ";

/** 452.0 -> "7 h 32"; under an hour, "47 min". */
export function hm(min) {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}${NNBSP}h${NNBSP}${String(r).padStart(2, "0")}` : `${r}${NNBSP}min`;
}

export const minutes = (v, d = 0) => `${fmtNum(v, d)}${NNBSP}min`;
export const kmh = (v, d = 0) => `${fmtNum(v, d)}${NNBSP}km/h`;
export const pct = (v, d = 0) => `${fmtNum(v, d)}${NNBSP}%`;
export const thousands = (n) => fmtNum(Math.round(n / 1000) * 1000);

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
const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
export const monthName = (m) => MONTHS[m - 1];
export const monthShort = (m) => MONTHS_SHORT[m - 1];

/** "2020-02-08" -> "8 février 2020" ("1er" for the first of the month). */
export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

/** Winter labelled by its January: 2014 -> "2013-2014". */
export const winter = (y) => `${y - 1}-${y}`;

/** "2020-02-08" -> "8 févr. 2020". */
export function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

const POINTS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
/** Where a wind (u east, v north) blows from, in words: "venu de l'ouest". */
export function compass(u, v) {
  const from = (Math.atan2(-u, -v) * 180) / Math.PI;
  const p = POINTS[Math.round((((from % 360) + 360) % 360) / 45) % 8];
  return `venu ${/^[aeiou]/.test(p) ? "de l'" : "du "}${p}`;
}
