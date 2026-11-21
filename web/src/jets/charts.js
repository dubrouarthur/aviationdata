// @ts-check
// Figures of « Le ciel des jets privés », in the inks of the Carte design system: magenta for the business
// jets (the series the investigation is about), blue for the airliners they are compared with. Each
// figure labels its own series and offers its values as a table (dataTable) for those who do not read
// charts. Classes c-line, c-tick, c-end, c-hbars come from court.css; the rest from jets.css.
import * as d3 from "d3";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { MONTHS_SHORT, MONTHS_FR, DAYS_FR, monthLabel } from "./facts.js";

const INK = { jets: "var(--magenta)", liners: "var(--blue)", ink: "var(--ink)", muted: "var(--muted)" };
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
 * Lines over the 48 months of 2019-2022, years on the axis, each line labelled at its end.
 * series: [{label, color, values: (number|null)[]}]; base: a reference value (100 for an index);
 * mark: {i, text} a month to point at.
 */
export function monthLines(
  node,
  { months, series, label, fmt, tick = fmt, base = null, mark = null, floor = null },
) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = narrow ? 300 : 340;
    const M = { t: 22, r: narrow ? 96 : 140, b: 30, l: 44 };
    const s = svg(node, W, H, label);
    const all = series.flatMap((d) => d.values).filter((v) => v !== null);
    const X = d3
      .scaleLinear()
      .domain([0, months.length - 1])
      .range([M.l, W - M.r]);
    const Y = d3
      .scaleLinear()
      .domain([floor ?? Math.min(...all, base ?? Infinity), Math.max(...all, base ?? -Infinity) * 1.06])
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
        .text(tick(t));
    }
    // a single year: each month named; several: each January as a tick, the year under its middle
    const single = months.length <= 14;
    months.forEach((m, i) => {
      if (single) {
        if (narrow && i % 2) return;
        s.append("text")
          .attr("class", "c-tick")
          .attr("x", X(i))
          .attr("y", H - M.b + 18)
          .attr("text-anchor", i === 0 ? "start" : "middle")
          .text(MONTHS_SHORT[+m.slice(5) - 1] + (i === 0 || m.endsWith("-01") ? ` ${m.slice(0, 4)}` : ""));
        return;
      }
      if (m.endsWith("-01")) {
        s.append("line")
          .attr("class", "jp-year")
          .attr("x1", X(i))
          .attr("x2", X(i))
          .attr("y1", H - M.b)
          .attr("y2", H - M.b + 5);
        s.append("text")
          .attr("class", "c-tick")
          .attr("x", X(Math.min(i + 5.5, months.length - 1)))
          .attr("y", H - M.b + 18)
          .attr("text-anchor", "middle")
          .text(m.slice(0, 4));
      }
    });
    if (base !== null)
      s.append("line")
        .attr("class", "c-base")
        .attr("x1", M.l)
        .attr("x2", W - M.r)
        .attr("y1", Y(base))
        .attr("y2", Y(base));
    const line = /** @type {d3.Line<number | null>} */ (/** @type {unknown} */ (d3.line()))
      .defined((d) => d !== null)
      .x((_, i) => X(i))
      .y((d) => Y(d));
    const ends = series.map((d) => {
      let i = d.values.length - 1;
      while (i > 0 && d.values[i] === null) i--;
      return { d, i, y: Y(d.values[i]) };
    });
    ends.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 34);
    for (const { d, i, y } of ends) {
      s.append("path").attr("class", "c-line").attr("d", line(d.values)).style("stroke", ink(d.color));
      s.append("circle").attr("cx", X(i)).attr("cy", Y(d.values[i])).attr("r", 4).style("fill", ink(d.color));
      const t = s
        .append("text")
        .attr("class", "c-end")
        .attr("x", X(i) + 10)
        .attr("y", y)
        .style("fill", ink(d.color));
      t.append("tspan").attr("class", "c-end-v").text(fmt(d.values[i]));
      t.append("tspan")
        .attr("x", X(i) + 10)
        .attr("dy", "1.15em")
        .text(d.label);
    }
    if (mark) {
      const d = series[0];
      const v = d.values[mark.i];
      s.append("circle")
        .attr("class", "jp-mark")
        .attr("cx", X(mark.i))
        .attr("cy", Y(v))
        .attr("r", 6)
        .style("stroke", ink(d.color));
      s.append("text")
        .attr("class", "jp-mark-t")
        .attr("x", X(mark.i) + 10)
        .attr("y", Y(v) - 4)
        .text(mark.text);
    }
    const zone = s
      .append("rect")
      .attr("x", M.l)
      .attr("y", M.t)
      .attr("width", W - M.l - M.r)
      .attr("height", H - M.t - M.b)
      .attr("fill", "transparent");
    zone.on("pointermove", (ev) => {
      const [px] = d3.pointer(ev);
      const i = Math.max(0, Math.min(months.length - 1, Math.round(X.invert(px))));
      showTip(
        ev,
        monthLabel(months[i]),
        series.map((d) => ({
          label: d.label,
          value: d.values[i] === null ? "–" : fmt(d.values[i]),
          color: ink(d.color),
        })),
      );
    });
    zone.on("pointerleave", hideTip);
  };
  onResize(node, draw);
  draw(node.clientWidth || 640);
  dataTable(node, {
    head: ["Mois", ...series.map((d) => d.label)],
    rows: months.map((m, i) => [
      monthLabel(m),
      ...series.map((d) => (d.values[i] === null ? "–" : fmt(d.values[i]))),
    ]),
  });
}

/**
 * Two bars per row, business jets above, airliners below, on one scale.
 * rows: [{label, a, b}], names: [a's name, b's name].
 */
export function pairBars(node, { rows, names, label, fmt, head = "Ligne", strongRows = [] }) {
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]));
  node.replaceChildren(
    el("div", { class: "jp-key", "aria-hidden": "true" }, [
      el("span", { class: "jp-k jets", text: names[0] }),
      el("span", { class: "jp-k liners", text: names[1] }),
    ]),
    el(
      "ol",
      { class: "jp-pairs", "aria-label": label },
      rows.map((r, k) =>
        el("li", { class: strongRows.includes(k) ? "strong" : "" }, [
          el("span", { class: "jp-pl", text: r.label }),
          el("span", { class: "jp-pt" }, [
            el("span", { class: "jp-bar jets" }, [
              el("i", { style: `width:${((r.a / max) * 100).toFixed(1)}%` }),
              el("b", { text: fmt(r.a) }),
            ]),
            el("span", { class: "jp-bar liners" }, [
              el("i", { style: `width:${((r.b / max) * 100).toFixed(1)}%` }),
              el("b", { text: fmt(r.b) }),
            ]),
          ]),
        ]),
      ),
    ),
  );
  dataTable(node, { head: [head, ...names], rows: rows.map((r) => [r.label, fmt(r.a), fmt(r.b)]) });
}

/**
 * The seasons of the airports: a row per airport, a cell per month, tinted by the month's business-jet
 * movements over the year's monthly mean (1 = an average month); the busiest month outlined.
 */
export function seasonGrid(node, rows, { label }) {
  const tone = (v) => Math.max(0, Math.min(1, (v - 0.4) / 1.6));
  node.replaceChildren(
    el(
      "div",
      { class: "jp-grid-wrap", tabindex: "0", role: "region", "aria-label": `${label} (défile de côté)` },
      [
        el("table", { class: "jp-grid", "aria-label": label }, [
          el(
            "thead",
            {},
            el("tr", {}, [
              el("th", { scope: "col", text: "Aéroport" }),
              ...MONTHS_SHORT.map((m, k) => el("th", { scope: "col", title: MONTHS_FR[k], text: m })),
            ]),
          ),
          el(
            "tbody",
            {},
            rows.map((r) =>
              el("tr", {}, [
                el("th", { scope: "row", text: r.label }),
                ...r.prof.map((v, k) =>
                  el("td", {
                    class: [k === r.peak ? "peak" : "", v >= 1.25 ? "hi" : ""].join(" ").trim(),
                    style: `--a:${tone(v).toFixed(3)}`,
                    title: `${r.label}, ${MONTHS_FR[k]} : ${fmtNum(v * 100, 0)} (100 = un mois moyen)`,
                    text: fmtNum(v * 100, 0),
                  }),
                ),
              ]),
            ),
          ),
        ]),
      ],
    ),
  );
}

/** Stacked shares, one bar per row: rows [{label, parts: [{key, label, value}]}]. */
export function stackBars(node, rows, { label, fmt }) {
  node.replaceChildren(
    el(
      "ol",
      { class: "jp-stack", "aria-label": label },
      rows.map((r) =>
        el("li", {}, [
          el("span", { class: "jp-pl", text: r.label }),
          el(
            "span",
            { class: "jp-st" },
            r.parts.map((p) =>
              el(
                "i",
                {
                  class: `jp-s ${p.key}`,
                  style: `width:${(p.value * 100).toFixed(2)}%`,
                  title: `${p.label} : ${fmt(p.value)}`,
                },
                [p.value >= 0.12 ? el("b", { text: fmt(p.value) }) : null],
              ),
            ),
          ),
        ]),
      ),
    ),
    el(
      "div",
      { class: "jp-key", "aria-hidden": "true" },
      rows[0].parts.map((p) => el("span", { class: `jp-k ${p.key}`, text: p.label })),
    ),
  );
  dataTable(node, {
    head: ["", ...rows[0].parts.map((p) => p.label)],
    rows: rows.map((r) => [r.label, ...r.parts.map((p) => fmt(p.value))]),
  });
}

/**
 * A year in days: 365 small squares per row, as many lit as the median aircraft flies days in the year.
 * rows: [{label, days, kind}] (kind: "jets" or "liners").
 */
export function yearDays(node, rows, { label, fmtDays }) {
  node.replaceChildren(
    el(
      "div",
      { class: "jp-years", role: "group", "aria-label": label },
      rows.map((r) => {
        const lit = Math.round(r.days);
        return el("div", { class: `jp-yr ${r.kind}` }, [
          el("p", { class: "jp-yr-h" }, [el("b", { text: fmtDays(r.days) }), ` ${r.label}`]),
          el(
            "div",
            { class: "jp-days", "aria-hidden": "true" },
            Array.from({ length: 365 }, (_, k) => el("i", { class: k < lit ? "on" : "" })),
          ),
        ]);
      }),
    ),
  );
  dataTable(node, {
    head: ["", "Jours de vol dans l'année (avion médian)"],
    rows: rows.map((r) => [r.label, fmtDays(r.days)]),
  });
}

/** A hundred flights, as many lit as the business jets' share: rows [{label, share, strong}]. */
export function hundred(node, rows) {
  node.replaceChildren(
    ...rows.map((r) => {
      const lit = Math.round(r.share * 100);
      return el("div", { class: `jp-dots${r.strong ? " strong" : ""}` }, [
        el("p", { class: "jp-dots-h" }, [el("b", { text: `${fmtNum(lit, 0)} sur 100` }), ` ${r.label}`]),
        el(
          "div",
          { class: "jp-dots-g", "aria-hidden": "true" },
          Array.from({ length: 100 }, (_, k) => el("i", { class: k < lit ? "on" : "", style: `--k:${k}` })),
        ),
      ]);
    }),
  );
}

export { DAYS_FR };
