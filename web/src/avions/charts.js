// Figures of « Le ciel, modèle par modèle ». Plain forms, each labelled on itself, each with its table
// (dataTable) for who does not read charts. Colours: the Carte inks, one per group of models (GROUPS).
import * as d3 from "d3";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { plane, planeIcon, planeInG, GROUP_ICON } from "./plane.js";

/** The groups of models the page colours, in the order of the legend. */
export const GROUPS = [
  { key: "a320", label: "Famille Airbus A320", color: "var(--blue)", hi: "var(--blue-hi)" },
  { key: "b737", label: "Famille Boeing 737", color: "var(--magenta)", hi: "var(--magenta-hi)" },
  { key: "regional", label: "Avions régionaux", color: "var(--teal)", hi: "var(--teal-hi)" },
  { key: "wide", label: "Gros-porteurs", color: "var(--ochre)", hi: "var(--ochre-hi)" },
  { key: "other", label: "Autres monocouloirs", color: "var(--grey)", hi: "#c3ccd5" },
];
export const groupOf = (t) =>
  t.family === "A320" || t.family === "A320neo"
    ? "a320"
    : t.family.startsWith("737")
      ? "b737"
      : t.kind === "regional"
        ? "regional"
        : t.kind === "wide"
          ? "wide"
          : "other";
const color = (g, hi = false) => {
  const x = GROUPS.find((y) => y.key === g);
  return hi ? x.hi : x.color;
};

/** A legend of the groups, as a line of swatches. */
export function legend(node, keys = GROUPS.map((g) => g.key), hi = false) {
  node.replaceChildren(
    ...GROUPS.filter((g) => keys.includes(g.key)).map((g) =>
      el("span", { class: "av-key" }, [el("i", { style: `background:${hi ? g.hi : g.color}` }), g.label]),
    ),
  );
}

/** A hundred squares: one per hundredth of the flights, by group (largest remainders, so they sum to 100). */
export function waffle(node, parts, { label, hi = true, planes = false }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const exact = parts.map((p) => (p.value / total) * 100);
  const n = exact.map(Math.floor);
  let left = 100 - n.reduce((a, b) => a + b, 0);
  [...exact.keys()]
    .sort((a, b) => exact[b] - n[b] - (exact[a] - n[a]))
    .forEach((i) => {
      if (left > 0) {
        n[i]++;
        left--;
      }
    });
  const cells = parts.flatMap((p, i) => Array.from({ length: n[i] }, () => p.key));
  node.replaceChildren(
    el(
      "div",
      { class: "waffle", role: "img", "aria-label": label },
      cells.map((g) => {
        if (!planes) return el("i", { style: `background:${color(g, hi)}` });
        // a flight, an aircraft: the group's most flown model, nose up
        const i = el("i", { class: "wf-plane" });
        const svg = planeIcon(GROUP_ICON[g], 40, { nose: "up", color: color(g, hi) });
        if (svg) i.append(svg);
        else i.style.background = color(g, hi);
        return i;
      }),
    ),
  );
  node._counts = Object.fromEntries(parts.map((p, i) => [p.key, n[i]]));
  return node._counts;
}

/**
 * Two marks a row: what was expected (a ring) and what was (a dot), joined. rows: [{label, note, a, b, group}].
 * Better is `better` ("high" or "low"): the dot is magenta when worse than expected, blue when better.
 */
export function dumbbell(node, rows, { label, fmt, domain, better = "high", aName, bName, head }) {
  const draw = (width) => {
    const narrow = width < 620;
    const W = Math.max(320, width);
    const L = narrow ? 150 : 236;
    const R = 64;
    const row = 30;
    const H = rows.length * row + 34;
    const x = d3
      .scaleLinear()
      .domain(domain)
      .range([L, W - R]);
    node.replaceChildren();
    const svg = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const ticks = x.ticks(narrow ? 4 : 6);
    svg
      .append("g")
      .selectAll("line")
      .data(ticks)
      .join("line")
      .attr("class", "av-grid")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", 22)
      .attr("y2", H - 4);
    svg
      .append("g")
      .selectAll("text")
      .data(ticks)
      .join("text")
      .attr("class", "c-tick")
      .attr("x", x)
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .text(fmt);
    rows.forEach((r, i) => {
      const y = 34 + i * row;
      const worse = better === "high" ? r.b < r.a : r.b > r.a;
      const g = svg.append("g").attr("class", "av-db");
      // the model's drawing, an icon of the same size for all, between its name and the axis
      if (r.code) planeInG(svg.append("g").attr("transform", `translate(${L - 19},${y})`).node(), r.code, 22, color(r.group));
      g.append("text")
        .attr("class", "av-db-l")
        .attr("x", L - 38)
        .attr("y", y)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(r.label);
      g.append("line")
        .attr("class", "av-db-line")
        .attr("x1", x(r.a))
        .attr("x2", x(r.b))
        .attr("y1", y)
        .attr("y2", y);
      g.append("circle").attr("class", "av-db-a").attr("cx", x(r.a)).attr("cy", y).attr("r", 5);
      g.append("circle")
        .attr("class", `av-db-b ${worse ? "worse" : "better"}`)
        .attr("cx", x(r.b))
        .attr("cy", y)
        .attr("r", 6);
      g.append("text")
        .attr("class", "av-db-v")
        .attr("x", W - 4)
        .attr("y", y)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(fmt(r.b));
      g.append("rect")
        .attr("x", 0)
        .attr("y", y - row / 2)
        .attr("width", W)
        .attr("height", row)
        .attr("fill", "transparent")
        .on("pointermove", (ev) =>
          showTip(ev, r.label, [
            { label: bName, value: fmt(r.b) },
            { label: aName, value: fmt(r.a) },
          ]),
        )
        .on("pointerleave", hideTip);
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 700);
  dataTable(node, {
    head: head ?? ["Modèle", bName, aName],
    rows: rows.map((r) => [r.label, fmt(r.b), fmt(r.a)]),
  });
}

/** Models along one axis (a logarithmic one for distances): a labelled dot each, coloured by group. */
export function strip(node, rows, { label, fmt, log = false, unit = "", head }) {
  const draw = (width) => {
    const W = Math.max(320, width);
    const row = 22;
    const H = rows.length * row + 40;
    const ext = d3.extent(rows, (r) => r.value);
    const x = (log ? d3.scaleLog() : d3.scaleLinear())
      .domain(log ? [ext[0] * 0.8, ext[1] * 1.15] : [0, ext[1] * 1.08])
      .range([8, W - (W < 520 ? 190 : 150)]);
    node.replaceChildren();
    const svg = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const ticks = log
      ? [300, 500, 1000, 2000, 5000, 10000].filter((t) => t >= x.domain()[0] && t <= x.domain()[1])
      : x.ticks(5);
    svg
      .append("g")
      .selectAll("line")
      .data(ticks)
      .join("line")
      .attr("class", "av-grid")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", 20)
      .attr("y2", H);
    svg
      .append("g")
      .selectAll("text")
      .data(ticks)
      .join("text")
      .attr("class", "c-tick")
      .attr("x", x)
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .text((t) => `${fmtNum(t, 0)}${unit}`);
    rows.forEach((r, i) => {
      const y = 32 + i * row;
      svg
        .append("line")
        .attr("class", "av-stem")
        .attr("x1", x.range()[0])
        .attr("x2", x(r.value))
        .attr("y1", y)
        .attr("y2", y);
      svg.append("circle").attr("cx", x(r.value)).attr("cy", y).attr("r", 5.5).style("fill", color(r.group));
      svg
        .append("text")
        .attr("class", "av-st-l")
        .attr("x", x(r.value) + 10)
        .attr("y", y)
        .attr("dy", "0.32em")
        .text(`${r.label}  ${fmt(r.value)}`);
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 700);
  dataTable(node, { head: head ?? ["Modèle", "Valeur"], rows: rows.map((r) => [r.label, fmt(r.value)]) });
}

/** Horizontal bars, one per row, coloured by group, the value at the end. rows: [{label, note, value, group}] */
export function bars(node, rows, { label, fmt, head, max, draw }) {
  const top = max ?? Math.max(...rows.map((r) => r.value));
  node.replaceChildren(
    el(
      "ol",
      { class: `c-hbars av-bars${draw ? " av-bars-pl" : ""}`, "aria-label": label },
      rows.map((r) =>
        el("li", {}, [
          draw
            ? el("span", { class: "av-bar-pl", "aria-hidden": "true" }, plane(r.code, { scale: draw, color: color(r.group) }))
            : null,
          el("span", { class: "c-hb-label" }, [r.label, r.note ? el("small", { text: r.note }) : null]),
          el(
            "span",
            { class: "c-hb-track" },
            el("i", { style: `width:${((r.value / top) * 100).toFixed(1)}%;--c:${color(r.group)}` }),
          ),
          el("b", { class: "c-hb-val", text: fmt(r.value) }),
        ]),
      ),
    ),
  );
  dataTable(node, { head: head ?? ["", "Valeur"], rows: rows.map((r) => [r.label, fmt(r.value)]) });
}

/** A table of shares, each cell tinted by its value. rows: [{label, cells:[share]}], cols: [{label, group}] */
export function heat(node, { rows, cols, label, fmt }) {
  node.replaceChildren(
    el("div", { class: "av-heat-wrap", tabindex: "0", role: "region", "aria-label": `${label} (défile de côté)` }, [
      el("table", { class: "av-heat", "aria-label": label }, [
        el(
          "thead",
          {},
          el("tr", {}, [
            el("th", { scope: "col", text: "Pays de départ" }),
            ...cols.map((c) =>
              el("th", { scope: "col" }, [
                el("span", { class: "av-heat-ic", "aria-hidden": "true" }, planeIcon(GROUP_ICON[c.group], 26, { nose: "up", color: color(c.group) })),
                c.label,
              ]),
            ),
          ]),
        ),
        el(
          "tbody",
          {},
          rows.map((r) =>
            el("tr", {}, [
              el("th", { scope: "row" }, [r.label, el("small", { text: r.note })]),
              ...r.cells.map((v, k) =>
                el("td", {
                  style: `--a:${Math.min(1, v / 0.7).toFixed(3)};--c:${color(cols[k].group)}`,
                  class: v >= 0.35 ? "strong" : "",
                  text: fmt(v),
                }),
              ),
            ]),
          ),
        ),
      ]),
    ]),
  );
}

/** "Boeing 737-800" → "737-800", "Embraer 175" → "E175", "Bombardier CRJ900" → "CRJ900". */
export const shortName = (name) =>
  name
    .replace(/^Embraer (\d)/, "E$1")
    .replace(/^(Airbus|Boeing|Bombardier|Embraer|McDonnell Douglas|De Havilland Canada|Sukhoï) /, "");

/** For each airline, its models along one axis: how far apart models fly within one airline. */
export function airlineSpread(node, rows, { label, fmt, domain }) {
  const draw = (width) => {
    const narrow = width < 620;
    const W = Math.max(320, width);
    const L = narrow ? 92 : 130;
    const row = 56;
    const H = rows.length * row + 30;
    const x = d3
      .scaleLinear()
      .domain(domain)
      .range([L, W - 20]);
    node.replaceChildren();
    const svg = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const ticks = x.ticks(narrow ? 4 : 6);
    svg
      .append("g")
      .selectAll("line")
      .data(ticks)
      .join("line")
      .attr("class", "av-grid")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", 18)
      .attr("y2", H);
    svg
      .append("g")
      .selectAll("text")
      .data(ticks)
      .join("text")
      .attr("class", "c-tick")
      .attr("x", x)
      .attr("y", 10)
      .attr("text-anchor", "middle")
      .text(fmt);
    rows.forEach((r, i) => {
      const y = 34 + i * row;
      const vals = r.models.map((m) => m.value);
      svg
        .append("text")
        .attr("class", "av-db-l")
        .attr("x", L - 12)
        .attr("y", y)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(r.label);
      svg
        .append("line")
        .attr("class", "av-sp-line")
        .attr("x1", x(Math.min(...vals)))
        .attr("x2", x(Math.max(...vals)))
        .attr("y1", y)
        .attr("y2", y);
      svg
        .append("line")
        .attr("class", "av-sp-mean")
        .attr("x1", x(r.airline))
        .attr("x2", x(r.airline))
        .attr("y1", y - 11)
        .attr("y2", y + 11);
      for (const m of r.models)
        svg
          .append("circle")
          .attr("cx", x(m.value))
          .attr("cy", y)
          .attr("r", 5.5)
          .style("fill", color(m.group))
          .on("pointermove", (ev) =>
            showTip(ev, `${r.label}, ${m.label}`, [{ label: "à l'heure", value: fmt(m.value) }]),
          )
          .on("pointerleave", hideTip);
      // its best and worst models, named under their dots (only the best when the two are too close)
      const sorted = [...r.models].sort((p, q) => p.value - q.value);
      const lo = sorted[0];
      const hi = sorted.at(-1);
      const named = x(hi.value) - x(lo.value) > (narrow ? 76 : 96) ? [lo, hi] : [hi];
      for (const m of named)
        svg
          .append("text")
          .attr("class", "av-sp-name")
          .attr("x", x(m.value))
          .attr("y", y + 18)
          .attr("text-anchor", m === lo ? "end" : named.length > 1 ? "start" : "middle")
          .attr("dx", named.length > 1 ? (m === lo ? 6 : -6) : 0)
          .text(shortName(m.label));
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 700);
  dataTable(node, {
    head: ["Compagnie", "Moyenne de la compagnie", "Modèles"],
    rows: rows.map((r) => [
      r.label,
      fmt(r.airline),
      r.models.map((m) => `${m.label} ${fmt(m.value)}`).join(", "),
    ]),
  });
}
