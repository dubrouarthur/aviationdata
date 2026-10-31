// The seasons of "Cap au sud": every country's year as a ridge (passengers per day of each month against
// the year's daily mean), the Union on top as the reference, in the order the reader picks; and the
// seasonal gap of each country year after year. Numbers from seasonFacts() (facts.js).
import * as d3 from "d3";
import { el, showTip, hideTip, onResize, dataTable, reducedMotion } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";

export const MONTHS =
  "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(" ");
export const times = (v) => `×${fmtNum(v, 1)}`;

/** Sandy for an even year, amber for a year that lives by its summer. */
const gapColor = d3
  .scaleSequentialLog()
  .domain([1.25, 8])
  .interpolator(d3.interpolateRgb("#f1ead9", "#c47a12"))
  .clamp(true);
const SHORT = [
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

/** Label positions at least `gap` px apart, in order, as close as possible to where they want to be. */
function spread(ys, gap) {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  return out;
}

/**
 * The ridges: each country's year drawn from its own baseline, high enough for the ridges to overlap, each
 * one painted over those above it. Returns { set({ year, sort }), pick(code) }; hovering, tapping or the
 * arrow keys pick a country, drawn on top with the Union's ridge dashed over it, and onPick(row, year)
 * receives its numbers (null for the Union).
 */
export function ridgeline(node, S, { onPick }) {
  const eu = { code: "EU27_2020", name: "Union européenne" };
  const state = { year: S.last, sort: "gap", picked: null };
  // the highest month of any country in any year shown: the room the first ridge needs
  const peak = d3.max(S.years, (y) => d3.max(S.rows(y), (r) => d3.max(r.index)));
  const euPeak = d3.max(S.years, (y) => d3.max(S.at(eu.code, y).index));
  let order = [];
  let paint = () => {};
  let overlay = () => {};

  const sorted = () => {
    const rows = S.rows(state.year);
    return state.sort === "lat" ? rows.sort((a, b) => b.lat - a.lat) : rows.sort((a, b) => b.gap - a.gap);
  };

  const draw = () => {
    const width = node.clientWidth || 640;
    const small = width < 520;
    const step = small ? 19 : 22;
    const unit = step * (small ? 1.8 : 2.1);
    const n = S.rows(state.year).length;
    const margin = { top: 30, right: small ? 40 : 56, bottom: 28, left: small ? 84 : 124 };
    const euBase = margin.top + euPeak * unit + 4;
    const first = euBase + 20 + (peak - 0.35) * unit;
    const yOf = (i) => first + i * step;
    const height = yOf(n - 1) + margin.bottom;
    const svg = d3
      .select(node)
      .selectAll("svg")
      .data([0])
      .join("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    const w = width - margin.left - margin.right;
    const x = (i) => margin.left + ((i + 0.5) * w) / 12;
    const area = d3
      .area()
      .x((_, i) => x(i))
      .y0(0)
      .y1((v) => -v * unit)
      .curve(d3.curveMonotoneX);
    const line = d3
      .line()
      .x((_, i) => x(i))
      .y((v) => -v * unit)
      .curve(d3.curveMonotoneX);
    // the months, above and below
    const ax = svg.append("g").attr("class", "rid-axis");
    SHORT.forEach((m, i) => {
      ax.append("line")
        .attr("class", "grid")
        .attr("x1", x(i))
        .attr("x2", x(i))
        .attr("y1", margin.top - 8)
        .attr("y2", height - margin.bottom + 6);
      for (const yy of [margin.top - 14, height - 8])
        ax.append("text")
          .attr("class", "axis-t")
          .attr("x", x(i))
          .attr("y", yy)
          .attr("text-anchor", "middle")
          .text(small ? m[0].toUpperCase() : m);
    });
    // the Union, apart, as the reference
    const euRow = svg.append("g").attr("class", "rid eu").attr("transform", `translate(0,${euBase})`);
    const euPath = euRow.append("path").attr("class", "rid-area");
    const euName = euRow
      .append("text")
      .attr("class", "rid-name")
      .attr("x", margin.left - 8)
      .attr("text-anchor", "end")
      .text(small ? "Union" : eu.name);
    const euGap = euRow
      .append("text")
      .attr("class", "rid-gap")
      .attr("x", width - margin.right + 8);
    const rows = svg.append("g").attr("class", "rid-rows");
    const over = svg.append("g").attr("class", "rid-over").style("display", "none");
    const pickPath = over.append("path").attr("class", "rid-pick");
    const euLine = over.append("path").attr("class", "rid-eu");

    overlay = () => {
      const i = order.findIndex((r) => r.code === state.picked);
      if (i < 0) return over.style("display", "none");
      over.style("display", null).attr("transform", `translate(0,${yOf(i)})`);
      pickPath.attr("d", line(order[i].index));
      euLine.attr("d", line(S.at(eu.code, state.year).index));
    };

    paint = (animate) => {
      order = sorted();
      const ue = S.at(eu.code, state.year);
      const t = animate && !reducedMotion() ? d3.transition().duration(650).ease(d3.easeCubicInOut) : null;
      const tr = (sel) => (t ? sel.transition(t) : sel);
      tr(euPath).attr("d", area(ue.index));
      euName.attr("y", -ue.index[0] * unit - 4);
      euGap.attr("y", -ue.index[11] * unit - 4).text(times(ue.gap));
      // names at the height of January, values at the height of December, never on top of each other
      const left = spread(
        order.map((r, i) => yOf(i) - r.index[0] * unit + 4),
        13.5,
      );
      const right = spread(
        order.map((r, i) => yOf(i) - r.index[11] * unit + 4),
        13.5,
      );
      const g = rows
        .selectAll("g.rid")
        .data(order, (r) => r.code)
        .join((enter) => {
          const e = enter
            .append("g")
            .attr("class", "rid")
            .attr("transform", (_, i) => `translate(0,${yOf(i)})`);
          e.append("path").attr("class", "rid-area");
          e.append("text")
            .attr("class", "rid-name")
            .attr("x", margin.left - 8)
            .attr("text-anchor", "end");
          e.append("text")
            .attr("class", "rid-gap")
            .attr("x", width - margin.right + 8);
          return e;
        });
      // lower rows painted last, over the ridges above them
      g.order();
      tr(g).attr("transform", (_, i) => `translate(0,${yOf(i)})`);
      tr(g.select(".rid-area"))
        .attr("d", (r) => area(r.index))
        .style("fill", (r) => gapColor(r.gap));
      tr(g.select(".rid-name").text((r) => r.name)).attr("y", (_, i) => left[i] - yOf(i));
      tr(g.select(".rid-gap").text((r) => times(r.gap))).attr("y", (_, i) => right[i] - yOf(i));
      g.on("pointerenter", (_, r) => pick(r.code))
        .on("click", (_, r) => pick(r.code))
        .on("pointermove", (ev, r) =>
          showTip(ev, `${r.name}, ${state.year}`, [
            { label: "mois le plus chargé", value: MONTHS[r.peak - 1] },
            { label: "mois le plus creux", value: MONTHS[r.low - 1] },
            { label: "écart saisonnier", value: times(r.gap) },
          ]),
        )
        .on("pointerleave", hideTip);
      mark();
      dataTable(node, {
        head: ["Pays", "Mois le plus chargé", "Mois le plus creux", `Écart ${state.year}`],
        rows: [
          [eu.name, MONTHS[ue.peak - 1], MONTHS[ue.low - 1], times(ue.gap)],
          ...order.map((r) => [r.name, MONTHS[r.peak - 1], MONTHS[r.low - 1], times(r.gap)]),
        ],
      });
    };
    paint(false);
  };

  const mark = () => {
    d3.select(node)
      .selectAll("g.rid-rows g.rid")
      .classed("on", (r) => r.code === state.picked);
    overlay();
    onPick(order.find((r) => r.code === state.picked) ?? null, state.year);
  };
  const pick = (code) => {
    if (state.picked === code) return;
    state.picked = code;
    mark();
  };

  // the arrow keys walk the rows, Escape goes back to the Union
  node.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      state.picked = null;
      mark();
      return;
    }
    const i = order.findIndex((r) => r.code === state.picked);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    pick(order[Math.max(0, Math.min(order.length - 1, next))].code);
  });
  // a mouse leaving the chart goes back to the Union; a finger keeps its pick until the next tap
  node.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    state.picked = null;
    mark();
  });

  draw();
  onResize(node, draw);
  return {
    set(next) {
      Object.assign(state, next);
      paint(true);
    },
    pick,
  };
}

/** The year slider (years without the pandemic), its play button and the order of the rows. */
export function seasonControls(box, S, ridges) {
  const years = S.years;
  const input = el("input", {
    type: "range",
    min: 0,
    max: years.length - 1,
    step: 1,
    value: years.length - 1,
    "aria-label": "Année des profils saisonniers",
  });
  const out = el("output", { class: "ss-year" });
  const play = el("button", { type: "button", class: "ss-play", "aria-label": "Faire défiler les années" });
  play.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l9-5z" fill="currentColor"/></svg>';
  const set = (k) => {
    input.value = k;
    out.textContent = years[k];
    input.setAttribute("aria-valuetext", String(years[k]));
    ridges.set({ year: years[k] });
  };
  input.addEventListener("input", () => set(+input.value));
  let timer = 0;
  play.addEventListener("click", () => {
    clearInterval(timer);
    let k = 0;
    set(k);
    timer = setInterval(() => {
      k += 1;
      if (k >= years.length) return clearInterval(timer);
      set(k);
    }, 900);
  });
  const sort = el("div", { class: "seg", role: "group", "aria-label": "Ordre des pays" }, [
    el("button", {
      type: "button",
      "data-v": "gap",
      "aria-pressed": "true",
      text: "Du plus au moins saisonnier",
    }),
    el("button", { type: "button", "data-v": "lat", "aria-pressed": "false", text: "Du nord au sud" }),
  ]);
  for (const b of sort.querySelectorAll("button"))
    b.addEventListener("click", () => {
      for (const o of sort.querySelectorAll("button")) o.setAttribute("aria-pressed", String(o === b));
      ridges.set({ sort: b.dataset.v });
    });
  box.replaceChildren(
    el("div", { class: "eu-field" }, [
      el("span", { text: "Année" }),
      el("div", { class: "ss-row" }, [play, input, out]),
    ]),
    el("div", { class: "eu-field" }, [el("span", { text: "Ordre" }), sort]),
  );
  out.textContent = years.at(-1);
  input.setAttribute("aria-valuetext", String(years.at(-1)));
}

/**
 * The seasonal gap of every country, year after year (log scale), the pandemic years left out; a few
 * countries named and coloured, the others grey until hovered.
 */
export function gapLines(node, S, { highlight }) {
  const all = S.change.map((c) => c.code);
  const series = ["EU27_2020", ...all].map((code) => ({
    code,
    name: code === "EU27_2020" ? "Union européenne" : S.change.find((c) => c.code === code).name,
    values: d3
      .range(S.first, S.last + 1)
      .map((y) => ({ y, gap: S.years.includes(y) ? S.at(code, y).gap : null })),
  }));
  const draw = () => {
    const width = node.clientWidth || 640;
    const small = width < 520;
    const margin = { top: 14, right: small ? 92 : 130, bottom: 28, left: 44 };
    const height = small ? 330 : 380;
    const svg = d3
      .select(node)
      .selectAll("svg")
      .data([0])
      .join("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const x = d3.scaleLinear().domain([S.first, S.last]).range([0, w]);
    const max = d3.max(series, (s) => d3.max(s.values, (v) => v.gap));
    const y = d3
      .scaleLog()
      .domain([1, max * 1.05])
      .range([h, 0]);
    // the years left out
    const gap = [S.years.filter((yy) => yy < 2020).at(-1), S.years.find((yy) => yy > 2020)];
    g.append("rect")
      .attr("class", "gl-out")
      .attr("x", x(gap[0]))
      .attr("width", x(gap[1]) - x(gap[0]))
      .attr("y", 0)
      .attr("height", h);
    g.append("text")
      .attr("class", "axis-t")
      .attr("x", (x(gap[0]) + x(gap[1])) / 2)
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .text(small ? "Covid" : "2020-2022 écartées");
    for (const t of [1, 1.5, 2, 3, 4, 6, 8].filter((t) => t <= max * 1.05)) {
      g.append("line").attr("class", "grid").attr("x1", 0).attr("x2", w).attr("y1", y(t)).attr("y2", y(t));
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", -8)
        .attr("y", y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(times(t).replace(",0", ""));
    }
    for (const yy of S.years.filter(
      (v, i, a) => i === 0 || v === S.last || (v - a[0]) % (small ? 5 : 3) === 0,
    ))
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(yy))
        .attr("y", h + 18)
        .attr("text-anchor", "middle")
        .text(yy);
    const line = d3
      .line()
      .defined((v) => v.gap != null)
      .x((v) => x(v.y))
      .y((v) => y(v.gap));
    const color = (s) => highlight[s.code] ?? null;
    const lines = g
      .selectAll("g.gl")
      .data([...series].sort((a, b) => Boolean(color(a)) - Boolean(color(b))))
      .join("g")
      .attr("class", (s) => (color(s) ? "gl hl" : "gl"))
      .style("--c", (s) => color(s));
    lines
      .append("path")
      .attr("class", "gl-line")
      .attr("d", (s) => line(s.values));
    lines
      .append("path")
      .attr("class", "gl-hit")
      .attr("d", (s) => line(s.values));
    // the names of the coloured lines, nudged apart so that none covers another
    const at = new Map(series.map((s) => [s.code, y(end1(s))]));
    const named = series.filter(color).sort((a, b) => at.get(a.code) - at.get(b.code));
    named.forEach((s, i) => {
      if (i) at.set(s.code, Math.max(at.get(s.code), at.get(named[i - 1].code) + 14));
    });
    lines
      .append("text")
      .attr("class", "gl-lab")
      .attr("x", w + 6)
      .attr("y", (s) => at.get(s.code))
      .attr("dy", "0.32em")
      .text((s) => `${s.code === "EU27_2020" ? "Union" : s.name} ${times(end1(s))}`);
    lines
      .on("pointerenter", function () {
        d3.select(this).classed("on", true).raise();
      })
      .on("pointermove", (ev, s) => {
        const yy = Math.round(x.invert(d3.pointer(ev, g.node())[0]));
        const v = s.values.find((d) => d.y === yy && d.gap != null);
        showTip(ev, s.name, v ? [{ label: `écart saisonnier ${yy}`, value: times(v.gap) }] : []);
      })
      .on("pointerleave", function () {
        d3.select(this).classed("on", false);
        hideTip();
      });
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Pays", String(S.first), String(S.last)],
    rows: series.map((s) => [s.name, times(s.values[0].gap), times(end1(s))]),
  });
}

const end1 = (s) => s.values.at(-1).gap;
