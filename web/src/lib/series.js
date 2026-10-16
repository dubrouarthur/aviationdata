// Pure series helpers. Monthly series are arrays aligned on a "YYYY-MM" month axis;
// null always means "no data" (never zero).

export const toDate = (v) =>
  typeof v === "number"
    ? new Date(Date.UTC(v, 0, 1))
    : new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, 1));

export const isNum = (v) => v !== null && v !== undefined && Number.isFinite(v);

export function rolling12(values) {
  return values.map((_, i) => {
    if (i < 11) return null;
    let s = 0;
    for (let j = i - 11; j <= i; j++) {
      if (!isNum(values[j])) return null;
      s += values[j];
    }
    return s;
  });
}

export const rebase = (values, base) => values.map((v) => (isNum(v) && base ? (v / base) * 100 : null));

export const yoy = (values, lag = 12) =>
  values.map((v, i) =>
    i >= lag && isNum(v) && isNum(values[i - lag]) && values[i - lag]
      ? (v / values[i - lag] - 1) * 100
      : null,
  );

export function yearSum(months, values, year) {
  const prefix = String(year);
  let s = 0;
  let n = 0;
  months.forEach((m, i) => {
    if (m.startsWith(prefix) && isNum(values[i])) {
      s += values[i];
      n++;
    }
  });
  return n ? s : null;
}

export function annualFromMonthly(months, values) {
  const acc = new Map();
  months.forEach((m, i) => {
    const y = +m.slice(0, 4);
    const a = acc.get(y) ?? { n: 0, s: 0 };
    if (isNum(values[i])) {
      a.n++;
      a.s += values[i];
    }
    acc.set(y, a);
  });
  const years = [...acc].filter(([, a]) => a.n === 12).map(([y]) => y);
  return { years, values: years.map((y) => acc.get(y).s) };
}

export function seasonality(months, values, year) {
  const out = Array(12).fill(null);
  months.forEach((m, i) => {
    if (+m.slice(0, 4) === year && isNum(values[i])) out[+m.slice(5, 7) - 1] = values[i];
  });
  return out;
}

export const pctChange = (from, to) => (isNum(from) && isNum(to) && from ? (to / from - 1) * 100 : null);

export function sumSeries(arrays) {
  const n = Math.max(...arrays.map((a) => a.length));
  return Array.from({ length: n }, (_, i) => {
    let s = 0;
    let any = false;
    for (const a of arrays) {
      if (isNum(a[i])) {
        s += a[i];
        any = true;
      }
    }
    return any ? s : null;
  });
}

/** Map name -> rank per year (1 = biggest). Zero/missing traffic is not ranked. */
export function ranksByYear(items) {
  const n = Math.max(...items.map((d) => d.pax.length));
  const out = new Map(items.map((d) => [d.nom, Array(n).fill(null)]));
  for (let i = 0; i < n; i++) {
    const ranked = items
      .filter((d) => isNum(d.pax[i]) && d.pax[i] > 0)
      .sort((a, b) => b.pax[i] - a.pax[i] || a.nom.localeCompare(b.nom));
    ranked.forEach((d, r) => (out.get(d.nom)[i] = r + 1));
  }
  return out;
}

export const last = (arr) => arr[arr.length - 1];
