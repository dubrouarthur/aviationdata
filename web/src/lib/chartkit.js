// @ts-check
// « Graphique », the chart kit of the magazine: the inks, the colour ramps and the few gestures every figure
// shares (a responsive SVG frame, axes with hairline grids, annotations tied to a mark, legends, a colour-ramp
// key). Styles live in site/figures.css (.ck-*). A figure built with the kit states one thing: blue for the data,
// magenta for the series the story is about, greys for context; never more than six hues at once.
import * as d3 from "d3";
import { el, onResize } from "./ui.js";
import { fmtNum } from "./format.js";

/** the inks of the Carte design system, as literal colours (figures are paper sheets in both themes) */
export const INK = {
  ink: "#14202e",
  muted: "#55616e",
  paper: "#f3f5f2",
  blue: "#1f5fa8",
  magenta: "#b5246e",
  magentaHi: "#f59ac8",
  night: "#0e1b2c",
  grey: "#b8c2cc",
};

/** categorical hues, in the order they are spent: the subject first, then context */
export const CAT = ["#b5246e", "#1f5fa8", "#2f8f6b", "#d98a1f", "#6b4fa3", "#14202e", "#7b9fc9", "#b8c2cc"];

/** sequential: paper -> pale blue -> map blue -> night blue -> magenta (rare to frequent) */
export const SEQ = d3.interpolateRgbBasis(["#f3f5f2", "#c9dbea", "#5e93c6", "#1f5fa8", "#3b2a74", "#b5246e"]);
/** diverging: blue (less) -> paper -> magenta (more) */
export const DIV = d3.interpolateRgbBasis(["#1f5fa8", "#8fb3d9", "#f3f5f2", "#e39ac0", "#b5246e"]);
/** sequential on the night: night -> blue -> pink (for dark openings) */
export const SEQ_NIGHT = d3.interpolateRgbBasis(["#13263b", "#1c4a82", "#4f8fd6", "#c85fb0", "#ff6fb6"]);

export const pct = (/** @type {number} */ v, d = 0) => `${fmtNum(v * 100, d)} %`;

/**
 * A responsive SVG: draw(svg, width, height) is called at each width; height(width) gives the height.
 * @param {HTMLElement} node
 * @param {{label: string, height: (w: number) => number, draw: (s: any, w: number, h: number, narrow: boolean) => void, min?: number}} o
 */
export function frame(node, { label, height, draw, min = 300 }) {
  const render = (/** @type {number} */ width) => {
    const W = Math.max(min, width);
    const H = height(W);
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    draw(s, W, H, W < 560);
  };
  onResize(node, render);
  render(node.clientWidth || 720);
}

/** Horizontal hairlines with their values at the left: the y axis of the magazine. */
export function gridY(
  s,
  Y,
  { x0, x1, ticks = 5, fmt = (/** @type {number} */ v) => fmtNum(v, 0), unit = "" },
) {
  const ts = Y.ticks(ticks);
  ts.forEach((/** @type {number} */ t, /** @type {number} */ i) => {
    s.append("line")
      .attr("class", t === 0 ? "ck-axis" : "ck-grid")
      .attr("x1", x0)
      .attr("x2", x1)
      .attr("y1", Y(t))
      .attr("y2", Y(t));
    s.append("text")
      .attr("class", "ck-tick")
      .attr("x", x0 - 8)
      .attr("y", Y(t))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text(fmt(t) + (i === ts.length - 1 ? unit : ""));
  });
}

/** Year marks under a monthly or daily axis: X(date) scale, one tick per year (every `every` when narrow). */
export function yearsX(s, X, years, { y, every = 1 }) {
  years.forEach((/** @type {number} */ yr, /** @type {number} */ i) => {
    if (i % every) return;
    s.append("text")
      .attr("class", "ck-tick")
      .attr("x", X(yr))
      .attr("y", y)
      .attr("text-anchor", "middle")
      .text(String(yr));
  });
}

/**
 * An annotation: a dot on the mark, a hairline, a short sentence (lines split on "\n").
 * dx, dy: where the text sits from the mark.
 */
export function annotate(s, { x, y, text, dx = 0, dy = -34, anchor = "middle", dot = true }) {
  const g = s.append("g").attr("class", "ck-note");
  const tx = x + dx;
  const ty = y + dy;
  g.append("path")
    .attr("class", "ck-note-line")
    .attr(
      "d",
      `M${x},${y + (dy < 0 ? -5 : 5)} L${x},${ty + (dy < 0 ? 6 : -14)}${dx ? ` L${tx},${ty + (dy < 0 ? 6 : -14)}` : ""}`,
    );
  if (dot) g.append("circle").attr("class", "ck-note-dot").attr("cx", x).attr("cy", y).attr("r", 4);
  const lines = text.split("\n");
  const t = g
    .append("text")
    .attr("class", "ck-note-text")
    .attr("x", tx)
    .attr("y", ty - (dy < 0 ? (lines.length - 1) * 15 : 0))
    .attr("text-anchor", anchor);
  lines.forEach((/** @type {string} */ l, /** @type {number} */ i) =>
    t
      .append("tspan")
      .attr("x", tx)
      .attr("dy", i ? 15 : 0)
      .text(l),
  );
  return g;
}

/** A vertical reference (a date) with its word at the top. */
export function refX(s, { x, y0, y1, text, anchor = "start" }) {
  s.append("line").attr("class", "ck-ref").attr("x1", x).attr("x2", x).attr("y1", y0).attr("y2", y1);
  s.append("text")
    .attr("class", "ck-ref-text")
    .attr("x", x + (anchor === "start" ? 5 : -5))
    .attr("y", y0 + 11)
    .attr("text-anchor", anchor)
    .text(text);
}

/** A legend of chips: items [{label, color, line?}]. Returns the element (insert it before the chart). */
export function legend(items) {
  return el(
    "ul",
    { class: "ck-legend" },
    items.map((it) =>
      el("li", {}, [el("i", { class: it.line ? "line" : "", style: `--c:${it.color}` }), it.label]),
    ),
  );
}

/** The key of a colour ramp: title, the ramp, its two ends (and a middle). */
export function rampKey({ interp, title, low, high, mid = "" }) {
  const stops = d3.range(0, 1.0001, 0.1).map((t) => `${interp(t)} ${Math.round(t * 100)}%`);
  return el("div", { class: "ck-ramp" }, [
    el("b", { text: title }),
    el("i", { style: `background:linear-gradient(90deg, ${stops.join(", ")})` }),
    el("span", {}, [
      el("em", { text: low, style: "font-style:normal" }),
      mid ? el("em", { text: mid, style: "font-style:normal" }) : null,
      el("em", { text: high, style: "font-style:normal" }),
    ]),
  ]);
}

/** Big numbers above a figure: [{value, label, hi?}]. */
export function stats(items) {
  return el(
    "div",
    { class: "ck-stats" },
    items.map((it) =>
      el("div", { class: `ck-stat${it.hi ? " hi" : ""}` }, [
        el("b", { text: it.value }),
        el("span", { text: it.label }),
      ]),
    ),
  );
}
