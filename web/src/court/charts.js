// Charts of the short format ("En 5 minutes"): three plain forms, drawn in the inks of the Carte design
// system (site/carte.css). Each one labels its own lines or bars, so no legend is needed, and offers its
// values as a table (dataTable) for those who do not read charts.
import * as d3 from "d3";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum, fmtPct } from "../lib/format.js";

const INK = { magenta: "var(--magenta)", blue: "var(--blue)", ink: "var(--ink)", grey: "var(--grey)" };
const ink = (c) => INK[c] ?? c;

function svg(node, w, h, label) {
  node.replaceChildren();
  return d3
    .select(node)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("role", "img")
    .attr("aria-label", label);
}

/**
 * Lines over years, each labelled at its end with its last value.
 * series: [{key, label, color, values:[number|null] }], x: [labels], opts: {label, fmt, base}
 * `base` draws the reference line (100 for an index).
 */
export function lineChart(node, { x, series, label, fmt = (v) => fmtNum(v), base = null, unit = "" }) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = narrow ? 300 : 360;
    const M = { t: 18, r: narrow ? 98 : 150, b: 30, l: 40 };
    const s = svg(node, W, H, label);
    const all = series.flatMap((d) => d.values).filter((v) => v !== null);
    const lo = Math.min(...all, base ?? Infinity);
    const hi = Math.max(...all, base ?? -Infinity);
    const pad = (hi - lo) * 0.08;
    const X = d3
      .scalePoint()
      .domain(x)
      .range([M.l, W - M.r]);
    const Y = d3
      .scaleLinear()
      .domain([lo - pad, hi + pad])
      .nice()
      .range([H - M.b, M.t]);
    const g = s.append("g").attr("class", "grid");
    for (const t of Y.ticks(5)) {
      g.append("line")
        .attr("x1", M.l)
        .attr("x2", W - M.r)
        .attr("y1", Y(t))
        .attr("y2", Y(t));
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", M.l - 8)
        .attr("y", Y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(fmtNum(t));
    }
    if (base !== null)
      s.append("line")
        .attr("class", "c-base")
        .attr("x1", M.l)
        .attr("x2", W - M.r)
        .attr("y1", Y(base))
        .attr("y2", Y(base));
    const every = narrow ? Math.ceil(x.length / 5) : Math.ceil(x.length / 10);
    x.forEach((v, i) => {
      if (i !== x.length - 1 && (i % every || x.length - 1 - i < every)) return;
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(v))
        .attr("y", H - M.b + 18)
        .attr("text-anchor", "middle")
        .text(v);
    });
    const line = d3
      .line()
      .defined((d) => d !== null)
      .x((_, i) => X(x[i]))
      .y((d) => Y(d));
    // end labels, pushed apart when they would overlap
    const ends = series.map((d) => {
      let i = d.values.length - 1;
      while (i > 0 && d.values[i] === null) i--;
      return { d, i, y: Y(d.values[i]) };
    });
    ends.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 34);
    for (const { d, i, y } of ends) {
      s.append("path").attr("class", "c-line").attr("d", line(d.values)).style("stroke", ink(d.color));
      s.append("circle")
        .attr("cx", X(x[i]))
        .attr("cy", Y(d.values[i]))
        .attr("r", 4)
        .style("fill", ink(d.color));
      const t = s
        .append("text")
        .attr("class", "c-end")
        .attr("x", X(x[i]) + 10)
        .attr("y", y)
        .style("fill", ink(d.color));
      t.append("tspan")
        .attr("class", "c-end-v")
        .text(`${fmt(d.values[i])}${unit}`);
      t.append("tspan")
        .attr("x", X(x[i]) + 10)
        .attr("dy", "1.15em")
        .text(d.label);
    }
    // hover: the values of the year under the pointer
    const zone = s
      .append("rect")
      .attr("x", M.l)
      .attr("y", M.t)
      .attr("width", W - M.l - M.r)
      .attr("height", H - M.t - M.b)
      .attr("fill", "transparent");
    zone.on("pointermove", (ev) => {
      const [px] = d3.pointer(ev);
      const i = Math.max(0, Math.min(x.length - 1, Math.round((px - M.l) / X.step())));
      showTip(
        ev,
        String(x[i]),
        series.map((d) => ({ label: d.label, value: `${fmt(d.values[i])}${unit}`, color: ink(d.color) })),
      );
    });
    zone.on("pointerleave", hideTip);
  };
  onResize(node, draw);
  draw(node.clientWidth || 640);
  dataTable(node, {
    head: ["", ...series.map((d) => d.label)],
    rows: x.map((v, i) => [String(v), ...series.map((d) => `${fmt(d.values[i])}${unit}`)]),
  });
}

/**
 * Twelve columns around zero (a month against the year's average): above in magenta, below in blue.
 * rows: [{label, value}] in %, the highest and lowest labelled.
 */
export function monthBars(node, { rows, label }) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = narrow ? 260 : 300;
    const M = { t: 26, r: 8, b: 30, l: 8 };
    const s = svg(node, W, H, label);
    const X = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([M.l, W - M.r])
      .padding(0.22);
    const ext = d3.max(rows, (d) => Math.abs(d.value));
    const Y = d3
      .scaleLinear()
      .domain([-ext * 1.15, ext * 1.15])
      .range([H - M.b, M.t]);
    const hi = d3.maxIndex(rows, (d) => d.value);
    const lo = d3.minIndex(rows, (d) => d.value);
    s.append("line")
      .attr("class", "c-base")
      .attr("x1", M.l)
      .attr("x2", W - M.r)
      .attr("y1", Y(0))
      .attr("y2", Y(0));
    rows.forEach((d, i) => {
      const up = d.value >= 0;
      s.append("rect")
        .attr("class", `c-bar ${up ? "up" : "down"}${i === hi || i === lo ? " key" : ""}`)
        .attr("x", X(d.label))
        .attr("width", X.bandwidth())
        .attr("y", up ? Y(d.value) : Y(0))
        .attr("height", Math.max(1, Math.abs(Y(d.value) - Y(0))))
        .on("pointermove", (ev) =>
          showTip(ev, d.full ?? d.label, [{ label: "par rapport à la moyenne", value: fmtPct(d.value, 0) }]),
        )
        .on("pointerleave", hideTip);
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(d.label) + X.bandwidth() / 2)
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(narrow ? d.label.slice(0, 1).toUpperCase() : d.label);
      if (i === hi || i === lo)
        s.append("text")
          .attr("class", "c-val")
          .attr("x", X(d.label) + X.bandwidth() / 2)
          .attr("y", up ? Y(d.value) - 8 : Y(d.value) + 16)
          .attr("text-anchor", "middle")
          .text(fmtPct(d.value, 0));
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 640);
  dataTable(node, {
    head: ["Mois", "Écart à la moyenne de l'année"],
    rows: rows.map((d) => [d.full ?? d.label, fmtPct(d.value, 1)]),
  });
}

/**
 * Horizontal bars of a signed value (a change in %), sorted as given, each with its label and value.
 * rows: [{label, value, color?, note?}], opts: {label, fmt, unit}
 */
export function hbars(node, { rows, label, fmt = (v) => fmtPct(v, 0), head = "Valeur" }) {
  node.replaceChildren(
    el(
      "ol",
      { class: "c-hbars", "aria-label": label },
      (() => {
        const max = Math.max(...rows.map((d) => Math.abs(d.value)));
        return rows.map((d) =>
          el("li", { class: d.strong ? "strong" : "" }, [
            el("span", { class: "c-hb-label" }, [d.label, d.note ? el("small", { text: d.note }) : null]),
            el(
              "span",
              { class: "c-hb-track" },
              el("i", {
                style: `width:${((Math.abs(d.value) / max) * 100).toFixed(1)}%;--c:${ink(d.color ?? "blue")}`,
              }),
            ),
            el("b", { class: "c-hb-val", text: fmt(d.value) }),
          ]),
        );
      })(),
    ),
  );
  dataTable(node, { head: ["", head], rows: rows.map((d) => [d.label, fmt(d.value)]) });
}
