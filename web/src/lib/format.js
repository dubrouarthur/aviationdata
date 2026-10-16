// French number and date formatting (narrow no-break spaces, true minus sign).
const NNBSP = " ";
const MINUS = "−";

const nf = (digits) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const clean = (s) => s.replace(/ /g, NNBSP).replace(/-/g, MINUS);

export const fmtNum = (v, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? "–" : clean(nf(digits).format(v));

export function fmtPct(v, digits = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  const sign = v > 0 ? "+" : v < 0 ? MINUS : "";
  return `${sign}${nf(digits).format(Math.abs(v))}${NNBSP}%`;
}

export function fmtPax(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e6) return `${fmtNum(v / 1e6, a >= 1e8 ? 1 : a >= 1e7 ? 1 : 2)}${NNBSP}M`;
  if (a >= 1e5) return `${fmtNum(v / 1e3, 0)}${NNBSP}k`;
  return fmtNum(v, 0);
}

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

export const monthName = (i) => MONTHS[i];
export const monthShort = (i) => MONTHS_SHORT[i];
export const fmtMonth = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const fmtMonthShort = (ym) => `${MONTHS_SHORT[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

/** Unsigned percentage, for sentences whose verb already carries the direction ("a perdu 29,9 %"). */
export const fmtPctAbs = (v, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "–" : `${nf(digits).format(Math.abs(v))}${NNBSP}%`;

/** Axis ticks: no forced decimals ("60 M", "2,5 M", "800 k"). */
export function fmtPaxAxis(v) {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  const trim = (x) => clean(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x));
  if (a >= 1e6) return `${trim(v / 1e6)}${NNBSP}M`;
  if (a >= 1e3) return `${trim(v / 1e3)}${NNBSP}k`;
  return trim(v);
}

/** French ordinal: 1er, 2e, 3e… */
export const ordinal = (n) => (n === 1 ? "1er" : `${n}e`);
