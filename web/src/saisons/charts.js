// The figures of "Le calendrier du ciel": the calendar of every country (twelve months coloured from the
// quietest to the busiest), the profiles of a few countries, the map of the seasonal gap, national against
// international flights, and the gap year after year. Numbers from seasonFacts() (facts.js).
import * as d3 from "d3";
import { el, showTip, hideTip, onResize, dataTable, reducedMotion } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { projectionFor, box } from "../eu/map.js";

export const MONTHS =
  "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(" ");
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
export const times = (v) => `×${fmtNum(v, 1)}`;
const EU = "EU27_2020";

/** A month's passengers per day against the year's mean: cool below, paper at the mean, warm above. */
export const indexColor = d3
  .scaleDiverging()
  .domain([Math.log(0.45), 0, Math.log(2.3)])
  .interpolator(d3.interpolateRgbBasis(["#2c5878", "#86a9bf", "#f1ede3", "#e8a85a", "#b9590b", "#6b2d00"]))
  .clamp(true);
const colorOf = (v) => indexColor(Math.log(v));
/** The seasonal gap as a colour: sand for an even year, deep amber for a year that lives by its summer. */
export const gapColor = d3
  .scaleSequentialLog()
  .domain([1.25, 8])
  .interpolator(d3.interpolateRgbBasis(["#f1ede3", "#e8a85a", "#b9590b", "#6b2d00"]))
  .clamp(true);

function svgIn(node, height) {
  const width = node.clientWidth || 640;
  const svg = d3
    .select(node)
    .selectAll("svg")
    .data([0])
    .join("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();
  return { svg, width };
}

/**
 * The calendar: one row per country, the Union on top, one cell per month coloured by its passengers per
 * day against the year's mean; the busiest month outlined. Rows sorted by seasonal gap or from north to
 * south. Returns { set({ year, sort, picked }) }; a hover, a tap or the arrow keys pick a country.
 */
export function calendar(node, S, { onPick, compact = false }) {
  const state = { year: S.last, sort: "gap", picked: null };
  let paint = () => {};
  let order = [];
  const sorted = () => {
    const rows = S.rows(state.year);
    if (state.sort === "lat") return rows.sort((a, b) => b.lat - a.lat);
    if (state.sort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return rows.sort((a, b) => b.gap - a.gap);
  };

  const draw = () => {
    const width = node.clientWidth || 640;
    const small = width < 560;
    const rowH = compact ? 15 : small ? 18 : 20;
    const m = { top: 24, right: small ? 40 : 52, left: small ? 82 : 128, bottom: 6 };
    const n = S.rows(state.year).length;
    const euGap = 12;
    const height = m.top + rowH + euGap + n * rowH + m.bottom;
    const { svg } = svgIn(node, height);
    const cw = (width - m.left - m.right) / 12;
    const x = (i) => m.left + i * cw;
    SHORT.forEach((mo, i) =>
      svg
        .append("text")
        .attr("class", "cal-month")
        .attr("x", x(i) + cw / 2)
        .attr("y", m.top - 9)
        .attr("text-anchor", "middle")
        .text(small || cw < 40 ? mo[0].toUpperCase() : mo),
    );
    const rowsG = svg.append("g");
    const yOf = (i) => (i < 0 ? m.top : m.top + rowH + euGap + i * rowH);

    const rowEnter = (enter) => {
      const g = enter.append("g").attr("class", (r) => (r.code === EU ? "cal-row eu" : "cal-row"));
      g.append("rect").attr("class", "cal-hit").attr("x", 0).attr("width", width).attr("height", rowH);
      g.append("text")
        .attr("class", "cal-name")
        .attr("x", m.left - 8)
        .attr("y", rowH / 2)
        .attr("dy", "0.34em")
        .attr("text-anchor", "end");
      g.append("text")
        .attr("class", "cal-gap")
        .attr("x", width - m.right + 8)
        .attr("y", rowH / 2)
        .attr("dy", "0.34em");
      g.selectAll("rect.cal-cell")
        .data(d3.range(12))
        .join("rect")
        .attr("class", "cal-cell")
        .attr("x", (i) => x(i) + 1)
        .attr("y", 1)
        .attr("width", cw - 2)
        .attr("height", rowH - 2)
        .attr("rx", 2);
      g.append("rect")
        .attr("class", "cal-peak")
        .attr("y", 0.5)
        .attr("width", cw - 1)
        .attr("height", rowH - 1)
        .attr("rx", 2.5);
      return g;
    };

    paint = (animate) => {
      const eu = { code: EU, name: small ? "Union" : "Union européenne", ...S.at(EU, state.year) };
      order = sorted();
      const all = [eu, ...order];
      const t = animate && !reducedMotion() ? d3.transition().duration(600).ease(d3.easeCubicInOut) : null;
      const tr = (sel) => (t ? sel.transition(t) : sel);
      const g = rowsG
        .selectAll("g.cal-row")
        .data(all, (r) => r.code)
        .join(rowEnter);
      tr(g).attr("transform", (r, i) => `translate(0,${yOf(i - 1)})`);
      g.select(".cal-name").text((r) => r.name);
      g.select(".cal-gap").text((r) => times(r.gap));
      tr(g.selectAll("rect.cal-cell").data((r) => r.index.map((v, i) => ({ v, i, r })))).attr("fill", (d) =>
        colorOf(d.v),
      );
      tr(g.select(".cal-peak")).attr("x", (r) => x(r.peak - 1) + 0.5);
      g.on("pointerenter", (_, r) => r.code !== EU && pick(r.code))
        .on("click", (_, r) => pick(r.code === EU ? null : r.code))
        .on("pointerleave", hideTip);
      g.selectAll("rect.cal-cell").on("pointermove", (ev, d) =>
        showTip(ev, `${d.r.name}, ${MONTHS[d.i]} ${state.year}`, [
          { label: "passagers par jour", value: `${fmtNum(d.v, 2)} fois la moyenne de l'année` },
        ]),
      );
      mark();
      dataTable(node, {
        head: ["Pays", ...SHORT, "Écart"],
        rows: all.map((r) => [r.name, ...r.index.map((v) => fmtNum(v, 2)), times(r.gap)]),
      });
    };
    paint(false);
  };

  const mark = () => {
    d3.select(node)
      .selectAll("g.cal-row")
      .classed("on", (r) => r.code === state.picked)
      .classed("dim", (r) => state.picked != null && r.code !== state.picked && r.code !== EU);
    onPick(order.find((r) => r.code === state.picked) ?? null, state.year);
  };
  const pick = (code) => {
    if (state.picked === code) return;
    state.picked = code;
    mark();
  };

  node.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return pick(null);
    const i = order.findIndex((r) => r.code === state.picked);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    pick(order[Math.max(0, Math.min(order.length - 1, next))].code);
  });
  // a mouse leaving the calendar goes back to the Union; a finger keeps its pick until the next tap
  node.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && pick(null));

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

/** The year (pandemic years left out), its play button, and the order of the rows. */
export function calendarControls(boxNode, S, { onYear, onSort }) {
  const years = S.years;
  const input = el("input", {
    type: "range",
    min: 0,
    max: years.length - 1,
    step: 1,
    value: years.length - 1,
    "aria-label": "Année du calendrier",
  });
  const out = el("output", { class: "cal-year" });
  const play = el("button", { type: "button", class: "cal-play", "aria-label": "Faire défiler les années" });
  play.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l9-5z" fill="currentColor"/></svg>';
  const set = (k) => {
    input.value = k;
    out.textContent = years[k];
    input.setAttribute("aria-valuetext", String(years[k]));
    onYear(years[k]);
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
    }, 850);
  });
  const sort = el("div", { class: "seg", role: "group", "aria-label": "Ordre des pays" }, [
    el("button", {
      type: "button",
      "data-v": "gap",
      "aria-pressed": "true",
      text: "Les plus saisonniers d'abord",
    }),
    el("button", { type: "button", "data-v": "lat", "aria-pressed": "false", text: "Du nord au sud" }),
    el("button", { type: "button", "data-v": "name", "aria-pressed": "false", text: "Par nom" }),
  ]);
  for (const b of sort.querySelectorAll("button"))
    b.addEventListener("click", () => {
      for (const o of sort.querySelectorAll("button")) o.setAttribute("aria-pressed", String(o === b));
      onSort(b.dataset.v);
    });
  boxNode.replaceChildren(
    el("div", { class: "cal-field" }, [
      el("span", { text: "Année" }),
      el("div", { class: "cal-row-ctl" }, [play, input, out]),
    ]),
    el("div", { class: "cal-field" }, [el("span", { text: "Ordre" }), sort]),
  );
  out.textContent = years.at(-1);
  input.setAttribute("aria-valuetext", String(years.at(-1)));
}

/** The colour key of the calendar: from the quietest month to the busiest, the year's mean in the middle. */
export function calendarKey(node) {
  const ticks = [0.5, 1, 1.5, 2];
  const w = 260;
  const svg = d3
    .select(node)
    .selectAll("svg")
    .data([0])
    .join("svg")
    .attr("width", w + 20)
    .attr("height", 40);
  svg.selectAll("*").remove();
  const x = d3
    .scaleLog()
    .domain([0.45, 2.3])
    .range([10, w + 10]);
  for (let k = 0; k < 60; k++) {
    const v = Math.exp(Math.log(0.45) + ((Math.log(2.3) - Math.log(0.45)) * (k + 0.5)) / 60);
    svg
      .append("rect")
      .attr("x", 10 + (k * w) / 60)
      .attr("y", 4)
      .attr("width", w / 60 + 0.5)
      .attr("height", 10)
      .attr("fill", colorOf(v));
  }
  for (const t of ticks)
    svg
      .append("text")
      .attr("class", "cal-key-t")
      .attr("x", x(t))
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .text(t === 1 ? "moyenne" : `${fmtNum(t, 2).replace(/,?0+$/, "")} ×`);
}

/**
 * A few countries' years, month by month (passengers per day against the year's mean), named at their
 * busiest month; the country the reader picks joins them, dashed.
 */
export function profiles(node, S, { codes, colors }) {
  let state = { year: S.last, extra: null };
  const draw = () => {
    const width = node.clientWidth || 640;
    const small = width < 520;
    const m = { top: 18, right: small ? 14 : 24, bottom: 28, left: 40 };
    const height = small ? 300 : 360;
    const { svg } = svgIn(node, height);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const list = [...codes, ...(state.extra && !codes.includes(state.extra) ? [state.extra] : [])];
    const series = list
      .map((code) => ({ code, row: S.at(code, state.year), name: S.name(code) }))
      .filter((s) => s.row);
    const max = d3.max(series, (s) => d3.max(s.row.index));
    const x = d3.scalePoint().domain(d3.range(12)).range([0, w]).padding(0.3);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(2.2, max * 1.08)])
      .range([h, 0]);
    for (const t of y.ticks(5)) {
      g.append("line")
        .attr("class", t === 1 ? "pf-mean" : "grid")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", y(t))
        .attr("y2", y(t));
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", -8)
        .attr("y", y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(t === 1 ? "moy." : `${fmtNum(t, 1).replace(",0", "")}×`);
    }
    SHORT.forEach((mo, i) =>
      g
        .append("text")
        .attr("class", "axis-t")
        .attr("x", x(i))
        .attr("y", h + 18)
        .attr("text-anchor", "middle")
        .text(small ? mo[0].toUpperCase() : mo),
    );
    const line = d3
      .line()
      .x((_, i) => x(i))
      .y((v) => y(v))
      .curve(d3.curveMonotoneX);
    const labels = [];
    for (const s of series) {
      const extra = s.code === state.extra && !codes.includes(s.code);
      const c = extra ? "var(--ink)" : colors[s.code];
      g.append("path")
        .attr("class", extra ? "pf-line extra" : "pf-line")
        .attr("d", line(s.row.index))
        .style("stroke", c);
      const pk = s.row.peak - 1;
      g.append("circle")
        .attr("class", "pf-dot")
        .attr("cx", x(pk))
        .attr("cy", y(s.row.index[pk]))
        .attr("r", 3.5)
        .style("fill", c);
      labels.push({ s, c, x: x(pk), y: y(s.row.index[pk]) - 9 });
      g.append("path")
        .attr("class", "pf-hit")
        .attr("d", line(s.row.index))
        .on("pointermove", (ev) => {
          const i = Math.max(
            0,
            Math.min(11, Math.round(d3.pointer(ev, g.node())[0] / x.step() - x.padding())),
          );
          showTip(ev, `${s.name}, ${MONTHS[i]} ${state.year}`, [
            { label: "passagers par jour", value: `${fmtNum(s.row.index[i], 2)} fois la moyenne` },
          ]);
        })
        .on("pointerleave", hideTip);
    }
    // names above each line's busiest month, nudged apart when two peaks meet
    // when two peaks meet, the lower line's name goes under its own point
    labels.sort((a, b) => a.y - b.y);
    labels.forEach((l, i) => {
      if (labels.slice(0, i).some((o) => Math.abs(o.x - l.x) < 110 && Math.abs(o.y - l.y) < 16)) l.y += 27;
    });
    for (const l of labels)
      g.append("text")
        .attr("class", "pf-lab")
        .attr("x", l.x)
        .attr("y", l.y)
        .attr("text-anchor", "middle")
        .style("fill", l.c)
        .text(`${l.s.code === EU ? "Union" : l.s.name} ${times(l.s.row.gap)}`);
  };
  draw();
  onResize(node, draw);
  return {
    set(next) {
      state = { ...state, ...next };
      draw();
    },
  };
}

/** The map of the seasonal gap, country by country; a click picks the country in the calendar. */
export function gapMap(node, geo, S, { onPick }) {
  let year = S.last;
  const draw = () => {
    const width = node.clientWidth || 600;
    const height = Math.round(Math.min(600, width * 0.92));
    const { svg } = svgIn(node, height + 44);
    const rows = new Map(S.rows(year).map((r) => [r.iso, r]));
    const proj = projectionFor(width, height, box(-24, 34, 34, 70.5));
    const path = d3.geoPath(proj);
    svg
      .append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("class", (f) => (rows.has(+f.id) ? "gm-cty in" : "gm-cty"))
      .style("fill", (f) => (rows.has(+f.id) ? gapColor(rows.get(+f.id).gap) : null))
      .style("cursor", (f) => (rows.has(+f.id) ? "pointer" : null))
      .on("pointermove", (ev, f) => {
        const r = rows.get(+f.id);
        if (r)
          showTip(ev, `${r.name}, ${year}`, [
            { label: "écart saisonnier", value: times(r.gap) },
            { label: "mois le plus chargé", value: MONTHS[r.peak - 1] },
          ]);
      })
      .on("pointerleave", hideTip)
      .on("click", (_, f) => rows.has(+f.id) && onPick?.(rows.get(+f.id).code));
    // the key: from an even year to a year that lives by its summer
    const lg = svg.append("g").attr("transform", `translate(10,${height + 12})`);
    const W = Math.min(280, width - 30);
    const x = d3.scaleLog().domain([1.25, 8]).range([0, W]);
    for (let k = 0; k < 56; k++) {
      const v = Math.exp(Math.log(1.25) + ((Math.log(8) - Math.log(1.25)) * (k + 0.5)) / 56);
      lg.append("rect")
        .attr("x", (k * W) / 56)
        .attr("width", W / 56 + 0.5)
        .attr("height", 10)
        .attr("fill", gapColor(v));
    }
    for (const t of [1.5, 2, 4, 8])
      lg.append("text")
        .attr("class", "cal-key-t")
        .attr("x", x(t))
        .attr("y", 25)
        .attr("text-anchor", t === 8 ? "end" : "middle")
        .text(times(t).replace(",0", ""));
  };
  draw();
  onResize(node, draw);
  return {
    set(y) {
      year = y;
      draw();
    },
  };
}

/** National against international flights: the seasonal gap of each, joined, on a log scale. */
export function kindsChart(node, S) {
  const rows = S.kinds;
  const draw = () => {
    const width = node.clientWidth || 600;
    const small = width < 520;
    const rowH = 30;
    const m = { top: 30, right: small ? 30 : 44, bottom: 26, left: small ? 96 : 140 };
    const height = m.top + rows.length * rowH + m.bottom;
    const { svg } = svgIn(node, height);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const w = width - m.left - m.right;
    const h = rows.length * rowH;
    const x = d3
      .scaleLog()
      .domain([1, Math.max(8, d3.max(rows, (r) => Math.max(r.nat.gap, r.intl.gap)) * 1.05)])
      .range([0, w]);
    for (const t of [1, 1.5, 2, 3, 4, 6, 8].filter((t) => t <= x.domain()[1])) {
      g.append("line").attr("class", "grid").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", h);
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(t))
        .attr("y", h + 16)
        .attr("text-anchor", "middle")
        .text(times(t).replace(",0", ""));
    }
    const lg = svg.append("g").attr("class", "eu-legend").attr("transform", `translate(${m.left},14)`);
    lg.append("circle").attr("cx", 5).attr("cy", -4).attr("r", 5).attr("class", "kd-nat");
    lg.append("text").attr("x", 14).attr("y", 0).text("vols intérieurs");
    lg.append("circle").attr("cx", 124).attr("cy", -4).attr("r", 5).attr("class", "kd-intl");
    lg.append("text").attr("x", 133).attr("y", 0).text("vols internationaux");
    const row = g
      .selectAll("g.kd")
      .data(rows)
      .join("g")
      .attr("class", (r) => (r.code === EU ? "kd eu" : "kd"))
      .attr("transform", (_, i) => `translate(0,${i * rowH + rowH / 2})`)
      .on("pointermove", (ev, r) =>
        showTip(ev, r.name, [
          {
            label: "vols intérieurs",
            value: `${times(r.nat.gap)}, au plus haut en ${MONTHS[r.nat.peak - 1]}`,
          },
          {
            label: "vols internationaux",
            value: `${times(r.intl.gap)}, au plus haut en ${MONTHS[r.intl.peak - 1]}`,
          },
          { label: "part des vols intérieurs", value: `${fmtNum(r.share)} %` },
        ]),
      )
      .on("pointerleave", hideTip);
    row
      .append("line")
      .attr("class", (r) => (r.nat.gap < r.intl.gap ? "kd-link" : "kd-link up"))
      .attr("x1", (r) => x(r.nat.gap))
      .attr("x2", (r) => x(r.intl.gap));
    row
      .append("circle")
      .attr("class", "kd-intl")
      .attr("cx", (r) => x(r.intl.gap))
      .attr("r", 5.5);
    row
      .append("circle")
      .attr("class", "kd-nat")
      .attr("cx", (r) => x(r.nat.gap))
      .attr("r", 5.5);
    row
      .append("text")
      .attr("class", "lab")
      .attr("x", -10)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text((r) => (r.code === EU ? "Union européenne" : r.name));
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Pays", "Part des vols intérieurs", "Écart, vols intérieurs", "Écart, vols internationaux"],
    rows: rows.map((r) => [r.name, `${fmtNum(r.share)} %`, times(r.nat.gap), times(r.intl.gap)]),
  });
}
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
