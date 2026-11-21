// @ts-check
// Figures of « Qui retarde les avions en Europe ? », drawn with the chart kit (lib/chartkit.js, site/figures.css):
// the calendar of every day since 2014, the yearly line with its turning points, the reasons month by month, every
// day as a dot, Europe as a grid of tiles, the providers as small multiples, the week as seven suns.
import * as d3 from "d3";
import { el, dataTable, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { frame, gridY, annotate, refX, legend, rampKey, SEQ, SEQ_NIGHT, INK, pct } from "../lib/chartkit.js";
import { GROUP_ORDER, DAYS_FR, MONTHS_FR, dayLabel } from "./facts.js";

/** one ink per declared reason */
export const GCOL = {
  capacite: "#1f5fa8",
  effectifs: "#6b4fa3",
  meteo: "#b5246e",
  greves: "#d98a1f",
  autres: "#b8c2cc",
};
const min1 = (/** @type {number} */ v) => `${fmtNum(v, 1)} min`;
const MS = 86400000;
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

/** the days of atfm.json as [{date, t (Date), per, top}] */
export function days(A) {
  const t0 = Date.parse(A.daily.start);
  return A.daily.delay.map((/** @type {number} */ d, /** @type {number} */ i) => {
    const t = new Date(t0 + i * MS);
    return {
      i,
      t,
      date: t.toISOString().slice(0, 10),
      delay: d,
      flights: A.daily.flights[i],
      per: d / A.daily.flights[i],
      top: A.daily.top[i],
    };
  });
}

/**
 * The calendar: one row per year, one cell per day, coloured by the minutes of delay per flight that day.
 * night: the opening's version (night ramp, no table).
 */
export function calendar(node, A, { label, max, night = false }) {
  const D = days(A);
  const years = [...new Set(D.map((d) => d.date.slice(0, 4)))];
  const ramp = night ? SEQ_NIGHT : SEQ;
  const groups = A.meta.groups;
  frame(node, {
    label,
    min: 320,
    height: (W) => 26 + years.length * (W < 560 ? 15 : 24) + 6,
    draw: (s, W, H, narrow) => {
      const M = { l: narrow ? 34 : 46, r: 4, t: 22 };
      const rh = narrow ? 15 : 24;
      const cw = (W - M.l - M.r) / 366;
      const doy = (/** @type {Date} */ t) =>
        Math.round(
          (Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) -
            Date.UTC(t.getUTCFullYear(), 0, 1)) /
            MS,
        );
      const g = s.append("g");
      for (const d of D) {
        const r = years.indexOf(d.date.slice(0, 4));
        g.append("rect")
          .attr("x", M.l + doy(d.t) * cw)
          .attr("y", M.t + r * rh)
          .attr("width", cw + 0.3)
          .attr("height", rh - (narrow ? 2 : 3))
          .attr("fill", ramp(Math.min(1, d.per / max) ** 0.7));
      }
      years.forEach((y, r) =>
        s
          .append("text")
          .attr("class", night ? "ck-tick ck-on-night" : "ck-tick")
          .attr("x", M.l - 6)
          .attr("y", M.t + r * rh + (rh - 3) / 2)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .text(narrow ? `’${y.slice(2)}` : y),
      );
      MONTHS_FR.forEach((m, k) => {
        if (narrow && k % 2) return;
        const x = M.l + ((Date.UTC(2023, k, 15) - Date.UTC(2023, 0, 1)) / MS) * cw;
        s.append("text")
          .attr("class", night ? "ck-tick ck-on-night" : "ck-tick")
          .attr("x", x)
          .attr("y", 12)
          .attr("text-anchor", "middle")
          .text(MONTHS_SHORT[k]);
      });
      // one transparent sheet catches the pointer
      s.append("rect")
        .attr("x", M.l)
        .attr("y", M.t)
        .attr("width", W - M.l - M.r)
        .attr("height", years.length * rh)
        .attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const [px, py] = d3.pointer(ev);
          const r = Math.floor((py - M.t) / rh);
          const k = Math.floor((px - M.l) / cw);
          const d = D.find((x) => x.date.startsWith(years[r]) && doy(x.t) === k);
          if (!d) return hideTip();
          showTip(ev, dayLabel(d.date), [
            { label: "Retard par vol", value: min1(d.per) },
            { label: "Vols", value: fmtNum(d.flights, 0) },
            ...(d.top >= 0
              ? [
                  {
                    label: "Premier motif",
                    value: groups[GROUP_ORDER[d.top]],
                    color: GCOL[GROUP_ORDER[d.top]],
                  },
                ]
              : []),
          ]);
        })
        .on("pointerleave", hideTip);
    },
  });
  if (!night) {
    node.after(
      rampKey({
        interp: (t) => SEQ(t ** 0.7),
        title: "Minutes de retard par vol, ce jour-là",
        low: "0",
        mid: fmtNum(max / 2, 0),
        high: `${fmtNum(max, 0)} et plus`,
      }),
    );
    const ms = Object.keys(A.months);
    dataTable(node.nextElementSibling, {
      head: ["Année", ...MONTHS_SHORT],
      rows: years.map((y) => [
        y,
        ...MONTHS_FR.map((_, k) => {
          const m = A.months[`${y}-${String(k + 1).padStart(2, "0")}`];
          return m ? fmtNum(m.delay / m.flights, 1) : "";
        }),
      ]),
      summary: `Voir les chiffres (minutes par vol, ${ms.length} mois)`,
    });
  }
}

/** The yearly line: minutes of delay per flight, each year a dot, the turning points annotated. */
export function yearLine(node, A, { label, notes, lastFull, ytd }) {
  const ys = Object.keys(A.years).filter((y) => +y <= lastFull);
  const v = ys.map((y) => A.years[y].perFlight);
  frame(node, {
    label,
    height: (W) => (W < 560 ? 300 : 380),
    draw: (s, W, H, narrow) => {
      const M = { l: 40, r: narrow ? 20 : 90, t: 46, b: 30 };
      const X = d3
        .scalePoint()
        .domain(ys)
        .range([M.l + 10, W - M.r]);
      const Y = d3
        .scaleLinear()
        .domain([0, Math.max(...v) * 1.12])
        .nice()
        .range([H - M.b, M.t]);
      gridY(s, Y, { x0: M.l, x1: W - M.r, ticks: 5, fmt: (t) => fmtNum(t, 1), unit: " min" });
      ys.forEach((y, i) => {
        if (narrow && i % 2) return;
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", X(y))
          .attr("y", H - 8)
          .attr("text-anchor", "middle")
          .text(y);
      });
      const line = d3
        .line()
        .x((_, i) => /** @type {number} */ (X(ys[i])))
        .y((_, i) => Y(v[i]))
        .curve(d3.curveMonotoneX);
      const area = d3
        .area()
        .x((_, i) => /** @type {number} */ (X(ys[i])))
        .y0(Y(0))
        .y1((_, i) => Y(v[i]))
        .curve(d3.curveMonotoneX);
      s.append("path")
        .attr("class", "ck-area")
        .attr("fill", INK.magenta)
        .attr("d", area(/** @type {any} */ (v)));
      s.append("path")
        .attr("class", "ck-line")
        .attr("stroke", INK.magenta)
        .attr("d", line(/** @type {any} */ (v)));
      ys.forEach((y, i) =>
        s
          .append("circle")
          .attr("cx", X(y))
          .attr("cy", Y(v[i]))
          .attr("r", 4.5)
          .attr("fill", INK.magenta)
          .attr("stroke", INK.paper)
          .attr("stroke-width", 1.5)
          .on("pointermove", (ev) =>
            showTip(ev, y, [
              { label: "Retard par vol", value: `${fmtNum(v[i], 2)} min` },
              { label: "Vols", value: `${fmtNum(A.years[y].flights / 1e6, 1)} M` },
            ]),
          )
          .on("pointerleave", hideTip),
      );
      for (const n of notes) {
        const i = ys.indexOf(String(n.year));
        if (i < 0) continue;
        annotate(s, {
          x: X(ys[i]),
          y: Y(v[i]),
          text: narrow ? (n.short ?? n.text) : n.text,
          dy: n.dy ?? -30,
          dx: n.dx ?? 0,
          anchor: n.anchor ?? "middle",
          dot: false,
        });
      }
      if (ytd && !narrow) {
        const i = ys.length - 1;
        s.append("text")
          .attr("class", "ck-label")
          .attr("x", /** @type {number} */ (X(ys[i])) + 12)
          .attr("y", Y(v[i]))
          .attr("dy", "0.32em")
          .attr("fill", INK.magenta)
          .text(`${fmtNum(v[i], 1)} min`);
      }
    },
  });
  dataTable(node, {
    head: ["Année", "Minutes par vol", "Vols (millions)", "Vols retardés de plus de 15 min"],
    rows: ys.map((y) => [
      y,
      fmtNum(A.years[y].perFlight, 2),
      fmtNum(A.years[y].flights / 1e6, 2),
      pct(A.years[y].delayed15 / A.years[y].flights, 1),
    ]),
  });
}

/** The reasons, month by month: stacked minutes of delay per flight. */
export function reasonsStream(node, A, { label, lastFull }) {
  const ms = Object.keys(A.months).filter((m) => +m.slice(0, 4) <= lastFull + 1);
  const groups = A.meta.groups;
  const per = (/** @type {string} */ m, /** @type {string} */ g) =>
    A.months[m].groups[g] / A.months[m].flights;
  node.before(legend(GROUP_ORDER.map((g) => ({ label: groups[g], color: GCOL[g] }))));
  frame(node, {
    label,
    height: (W) => (W < 560 ? 300 : 400),
    draw: (s, W, H, narrow) => {
      const M = { l: 40, r: 8, t: 14, b: 28 };
      const X = d3
        .scaleLinear()
        .domain([0, ms.length - 1])
        .range([M.l, W - M.r]);
      const tot = ms.map((m) => A.months[m].delay / A.months[m].flights);
      const Y = d3
        .scaleLinear()
        .domain([0, Math.max(...tot) * 1.05])
        .nice()
        .range([H - M.b, M.t]);
      gridY(s, Y, { x0: M.l, x1: W - M.r, ticks: 5, fmt: (t) => fmtNum(t, 0), unit: " min" });
      let acc = ms.map(() => 0);
      for (const g of GROUP_ORDER) {
        const lo = acc;
        const hi = acc.map((a, i) => a + per(ms[i], g));
        const area = d3
          .area()
          .x((_, i) => X(i))
          .y0((_, i) => Y(lo[i]))
          .y1((_, i) => Y(hi[i]))
          .curve(d3.curveStepAfter);
        s.append("path")
          .attr("d", area(/** @type {any} */ (ms)))
          .attr("fill", GCOL[g]);
        acc = hi;
      }
      ms.forEach((m, i) => {
        if (!m.endsWith("-01") || (narrow && +m.slice(0, 4) % 2)) return;
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", X(i + 6))
          .attr("y", H - 8)
          .attr("text-anchor", "middle")
          .text(m.slice(0, 4));
        s.append("line")
          .attr("class", "ck-grid")
          .attr("x1", X(i))
          .attr("x2", X(i))
          .attr("y1", M.t)
          .attr("y2", H - M.b);
      });
      s.append("rect")
        .attr("x", M.l)
        .attr("y", M.t)
        .attr("width", W - M.l - M.r)
        .attr("height", H - M.t - M.b)
        .attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const i = Math.max(0, Math.min(ms.length - 1, Math.floor(X.invert(d3.pointer(ev)[0]))));
          const m = ms[i];
          showTip(ev, `${MONTHS_FR[+m.slice(5) - 1]} ${m.slice(0, 4)}`, [
            { label: "Retard par vol", value: `${fmtNum(tot[i], 2)} min` },
            ...GROUP_ORDER.map((g) => ({
              label: groups[g],
              value: pct(A.months[m].delay ? A.months[m].groups[g] / A.months[m].delay : 0),
              color: GCOL[g],
            })),
          ]);
        })
        .on("pointerleave", hideTip);
    },
  });
  const ys = Object.keys(A.years).filter((y) => +y <= lastFull);
  dataTable(node, {
    head: ["Année", ...GROUP_ORDER.map((g) => groups[g])],
    rows: ys.map((y) => [y, ...GROUP_ORDER.map((g) => pct(A.years[y].groups[g] / A.years[y].delay))]),
  });
}

/** Every day as a dot: time across, minutes per flight up, coloured by the day's first reason; the worst named. */
export function dayDots(node, A, { label, named }) {
  const D = days(A);
  const groups = A.meta.groups;
  node.before(legend(GROUP_ORDER.map((g) => ({ label: groups[g], color: GCOL[g] }))));
  frame(node, {
    label,
    height: (W) => (W < 560 ? 340 : 440),
    draw: (s, W, H, narrow) => {
      const M = { l: 40, r: 10, t: 30, b: 28 };
      const X = d3
        .scaleTime()
        .domain([D[0].t, /** @type {Date} */ (D.at(-1)?.t)])
        .range([M.l, W - M.r]);
      const Y = d3
        .scaleLinear()
        .domain([0, Math.max(...D.map((d) => d.per)) * 1.08])
        .nice()
        .range([H - M.b, M.t]);
      gridY(s, Y, { x0: M.l, x1: W - M.r, ticks: 6, fmt: (t) => fmtNum(t, 0), unit: " min" });
      for (const t of X.ticks(narrow ? 6 : 13))
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", X(t))
          .attr("y", H - 8)
          .attr("text-anchor", "middle")
          .text(t.getUTCFullYear());
      const g = s.append("g");
      for (const d of D) {
        if (d.top < 0) continue;
        g.append("circle")
          .attr("cx", X(d.t))
          .attr("cy", Y(d.per))
          .attr("r", d.per > 4 ? 3 : 1.6)
          .attr("fill", GCOL[GROUP_ORDER[d.top]])
          .attr("opacity", d.per > 4 ? 0.95 : 0.55);
      }
      const used = [];
      for (const n of named) {
        const d = D.find((x) => x.date === n.date);
        if (!d) continue;
        const x = X(d.t);
        if (used.some((u) => Math.abs(u - x) < (narrow ? 70 : 110))) continue;
        used.push(x);
        annotate(s, {
          x,
          y: Y(d.per),
          text: n.text,
          dy: -16,
          anchor: x > W - 120 ? "end" : x < 120 ? "start" : "middle",
          dot: false,
        });
      }
      // nearest day under the pointer
      s.append("rect")
        .attr("x", M.l)
        .attr("y", M.t)
        .attr("width", W - M.l - M.r)
        .attr("height", H - M.t - M.b)
        .attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const [px, py] = d3.pointer(ev);
          const i0 = Math.round((X.invert(px).getTime() - D[0].t.getTime()) / MS);
          let best = null;
          for (let i = Math.max(0, i0 - 12); i <= Math.min(D.length - 1, i0 + 12); i++) {
            const dd = Math.hypot(X(D[i].t) - px, Y(D[i].per) - py);
            if (!best || dd < best.dd) best = { dd, d: D[i] };
          }
          if (!best) return hideTip();
          const d = best.d;
          showTip(ev, dayLabel(d.date), [
            { label: "Retard par vol", value: min1(d.per) },
            ...(d.top >= 0
              ? [
                  {
                    label: "Premier motif",
                    value: groups[GROUP_ORDER[d.top]],
                    color: GCOL[GROUP_ORDER[d.top]],
                  },
                ]
              : []),
          ]);
        })
        .on("pointerleave", hideTip);
    },
  });
  dataTable(node, {
    head: ["Jour", "Minutes par vol", "Premier motif", "Pays le plus cité"],
    rows: A.worst.map((/** @type {any} */ w) => [
      dayLabel(w.date),
      fmtNum(w.perFlight, 1),
      groups[w.group],
      A.providers[w.provider].country,
    ]),
    summary: `Voir les ${A.worst.length} pires jours`,
  });
}

/** Europe as a grid of tiles, one per provider's country: [column, row]. */
const TILES = {
  IE: [0, 2],
  UK: [1, 2],
  NO: [3, 0],
  SE: [4, 0],
  FI: [5, 0],
  EE: [6, 0],
  DK: [3, 1],
  LV: [6, 1],
  LT: [5, 1],
  NL: [2, 2],
  MU: [3, 2],
  DE: [4, 2],
  PL: [5, 2],
  UA: [7, 2],
  BE: [2, 3],
  LU: [3, 3],
  CZ: [4, 3],
  SK: [5, 3],
  MD: [7, 3],
  FR: [2, 4],
  CH: [3, 4],
  AT: [4, 4],
  HU: [5, 4],
  RO: [6, 4],
  PT: [0, 5],
  ES: [1, 5],
  IT: [3, 5],
  SI: [4, 5],
  HR: [5, 5],
  RS: [6, 5],
  BG: [7, 5],
  GE: [9, 5],
  MT: [3, 6],
  AL: [5, 6],
  MK: [6, 6],
  GR: [6, 7],
  TR: [8, 6],
  AM: [9, 6],
  CY: [8, 7],
};

/** The tile map: each country's control, coloured by its minutes of delay per flight handled. */
export function tileMap(node, F, { label, max }) {
  const by = Object.fromEntries(F.byDelay.map((p) => [p.code, p]));
  frame(node, {
    label,
    min: 320,
    height: (W) => Math.round((Math.min(W, 860) / 10) * 8 + 8),
    draw: (s, W) => {
      const size = Math.min(W, 860) / 10;
      const x0 = (W - size * 10) / 2;
      for (const [code, [c, r]] of Object.entries(TILES)) {
        const p = by[code];
        const g = s.append("g").attr("transform", `translate(${x0 + c * size},${r * size + 4})`);
        const v = p ? p.perFlight : null;
        const dark = v !== null && v / max > 0.42;
        g.append("rect")
          .attr("width", size - 4)
          .attr("height", size - 4)
          .attr("rx", 5)
          .attr("fill", v === null ? "#e3e8ec" : SEQ(Math.min(1, v / max) ** 0.6))
          .attr("stroke", code === "FR" ? INK.ink : "none")
          .attr("stroke-width", 2);
        g.append("text")
          .attr("class", "tk-code")
          .attr("x", 7)
          .attr("y", size > 60 ? 19 : 15)
          .attr("fill", dark ? "#fff" : INK.ink)
          .text(code === "MU" ? "MUAC" : code);
        if (p && size > 44)
          g.append("text")
            .attr("class", "tk-val")
            .attr("x", 7)
            .attr("y", size - 14)
            .attr("fill", dark ? "#fff" : INK.ink)
            .text(fmtNum(p.perFlight, p.perFlight < 0.1 ? 2 : 1));
        if (p)
          g.on("pointermove", (ev) =>
            showTip(ev, `${p.country} (${p.name})`, [
              { label: "Retard par vol contrôlé", value: `${fmtNum(p.perFlight, 2)} min` },
              { label: "Part des minutes d'Europe", value: pct(p.share, p.share < 0.01 ? 1 : 0) },
              { label: "Vols contrôlés", value: `${fmtNum(p.flights / 1e6, 2)} M` },
            ]),
          ).on("pointerleave", hideTip);
      }
    },
  });
  node.after(
    rampKey({
      interp: (t) => SEQ(t ** 0.6),
      title: "Minutes de retard par vol contrôlé",
      low: "0",
      mid: fmtNum(max / 2, 1),
      high: `${fmtNum(max, 1)} et plus`,
    }),
  );
  dataTable(node.nextElementSibling, {
    head: ["Pays (prestataire)", "Minutes par vol contrôlé", "Part des minutes", "Vols contrôlés (millions)"],
    rows: F.byDelay.map((p) => [
      `${p.country} (${p.name})`,
      fmtNum(p.perFlight, 2),
      pct(p.share, 1),
      fmtNum(p.flights / 1e6, 2),
    ]),
  });
}

/** Small multiples: each provider's minutes per flight handled, year after year, on one scale. */
export function providerMultiples(node, A, F, { label, codes, max }) {
  const ys = F.years;
  node.replaceChildren(
    el(
      "div",
      { class: "ck-multiples", role: "img", "aria-label": label },
      codes.map((code) => {
        const p = A.providers[code];
        const v = ys.map((y) => (p.years[y]?.flights ? p.years[y].delay / p.years[y].flights : null));
        const W = 170;
        const H = 86;
        const X = d3
          .scaleLinear()
          .domain([0, ys.length - 1])
          .range([2, W - 2]);
        const Y = d3
          .scaleLinear()
          .domain([0, max])
          .range([H - 14, 4]);
        const line = d3
          .line()
          .defined((d) => d !== null)
          .x((_, i) => X(i))
          .y((d) => Y(/** @type {any} */ (d)));
        const area = d3
          .area()
          .defined((d) => d !== null)
          .x((_, i) => X(i))
          .y0(Y(0))
          .y1((d) => Y(/** @type {any} */ (d)));
        const hi = code === "FR";
        const col = hi ? INK.magenta : INK.blue;
        const lastV = v.at(-1);
        const box = el("div", { class: `ck-multiple${hi ? " hi" : ""}` }, [
          el("h4", { text: p.country.split(" (")[0] }),
          el("p", { text: `${fmtNum(lastV ?? 0, 2)} min par vol en ${ys.at(-1)}` }),
        ]);
        const svg = d3
          .select(box)
          .append("svg")
          .attr("viewBox", `0 0 ${W} ${H}`)
          .attr("width", "100%")
          .attr("aria-hidden", "true");
        svg
          .append("line")
          .attr("class", "ck-axis")
          .attr("x1", 2)
          .attr("x2", W - 2)
          .attr("y1", Y(0))
          .attr("y2", Y(0));
        svg
          .append("path")
          .attr("d", area(/** @type {any} */ (v)))
          .attr("fill", col)
          .attr("opacity", 0.15);
        svg
          .append("path")
          .attr("class", "ck-line")
          .attr("d", line(/** @type {any} */ (v)))
          .attr("stroke", col)
          .attr("stroke-width", 2);
        svg
          .append("text")
          .attr("class", "ck-tick")
          .attr("x", 2)
          .attr("y", H - 1)
          .text(ys[0]);
        svg
          .append("text")
          .attr("class", "ck-tick")
          .attr("x", W - 2)
          .attr("y", H - 1)
          .attr("text-anchor", "end")
          .text(/** @type {string} */ (ys.at(-1)));
        return box;
      }),
    ),
  );
  dataTable(node, {
    head: ["Pays", ...ys],
    rows: codes.map((c) => [
      A.providers[c].country,
      ...ys.map((y) =>
        A.providers[c].years[y]?.flights
          ? fmtNum(A.providers[c].years[y].delay / A.providers[c].years[y].flights, 2)
          : "",
      ),
    ]),
  });
}

/** The summer week: seven discs, their area the minutes of delay per flight. */
export function weekDiscs(node, A, { label }) {
  const w = A.week;
  const max = Math.max(...w);
  const hi = w.indexOf(max);
  frame(node, {
    label,
    min: 320,
    height: (W) => (W < 560 ? 150 : 200),
    draw: (s, W, H, narrow) => {
      const step = W / 7;
      const R = Math.min(step / 2 - 4, H / 2 - 30);
      w.forEach((/** @type {number} */ v, /** @type {number} */ k) => {
        const cx = step * (k + 0.5);
        const r = R * Math.sqrt(v / max);
        s.append("circle")
          .attr("cx", cx)
          .attr("cy", H / 2 - 12)
          .attr("r", r)
          .attr("fill", k === hi ? INK.magenta : INK.blue)
          .attr("opacity", k === hi ? 1 : 0.8);
        s.append("text")
          .attr("class", "ck-value")
          .attr("x", cx)
          .attr("y", H / 2 - 12)
          .attr("dy", "0.35em")
          .attr("text-anchor", "middle")
          .attr("fill", "#fff")
          .style("font-size", narrow ? "12px" : "16px")
          .text(fmtNum(v, 1));
        s.append("text")
          .attr("class", k === hi ? "ck-label" : "ck-label muted")
          .attr("x", cx)
          .attr("y", H - 8)
          .attr("text-anchor", "middle")
          .text(narrow ? DAYS_FR[k].slice(0, 3) + "." : DAYS_FR[k]);
      });
    },
  });
  dataTable(node, { head: ["Jour", "Minutes par vol"], rows: DAYS_FR.map((d, k) => [d, fmtNum(w[k], 2)]) });
}

export { refX };
