// The charts of the fourth investigation (d3, drawn again on resize). Every chart reads values computed
// in facts.js; colours come from eu.css (--south above 2019, --north below, --eu-seq-* for volumes).
import * as d3 from "d3";
import { el, showTip, hideTip, onResize, dataTable } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";

const MONTHS = [
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
const MONTHS_LONG = [
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
export const monthLabel = (ym) => `${MONTHS_LONG[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
/** 1 234 567 -> "1,2 M" ; 845 000 -> "845 000" */
export const mio = (v, d = 1) => (v >= 1e6 ? `${fmtNum(v / 1e6, d)} M` : fmtNum(Math.round(v / 1000) * 1000));
export const pct = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtNum(Math.abs(v), d)} %`;

function frame(node, height, margin) {
  const width = node.clientWidth || 600;
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
  return { svg, g, w: width - margin.left - margin.right, h: height - margin.top - margin.bottom, width };
}

const yAxisMio = (g, y, w, ticks = 5) => {
  const ax = g.append("g").attr("class", "axis y");
  for (const t of y.ticks(ticks)) {
    ax.append("line").attr("class", "grid").attr("x1", 0).attr("x2", w).attr("y1", y(t)).attr("y2", y(t));
    ax.append("text")
      .attr("x", -8)
      .attr("y", y(t))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text(t ? `${fmtNum(t / 1e6)} M` : "0");
  }
};

/** Monthly passengers of a zone, with its record month and its lowest month marked. */
export function monthChart(node, { months, series, color = "var(--eu-accent)" }) {
  const draw = () => {
    const small = node.clientWidth < 560;
    const { g, w, h } = frame(node, small ? 240 : 320, { top: 22, right: 18, bottom: 26, left: 52 });
    const pts = months.map((m, i) => ({
      m,
      d: new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 15),
      v: series[i],
    }));
    const x = d3
      .scaleTime()
      .domain([new Date(+months[0].slice(0, 4), 0, 1), d3.max(pts, (p) => p.d)])
      .range([0, w]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(pts, (p) => p.v) * 1.08])
      .nice()
      .range([h, 0]);
    yAxisMio(g, y, w);
    const years = d3.range(+months[0].slice(0, 4), +months.at(-1).slice(0, 4) + 1);
    const step = small ? 4 : 2;
    g.append("g")
      .attr("class", "axis x")
      .selectAll("text")
      .data(years.filter((yr) => yr % step === 0))
      .join("text")
      .attr("x", (yr) => x(new Date(yr, 0, 1)))
      .attr("y", h + 18)
      .attr("text-anchor", "middle")
      .text((yr) => yr);
    const line = d3
      .line()
      .defined((p) => p.v != null)
      .x((p) => x(p.d))
      .y((p) => y(p.v));
    const area = d3
      .area()
      .defined((p) => p.v != null)
      .x((p) => x(p.d))
      .y0(h)
      .y1((p) => y(p.v));
    g.append("path").attr("class", "eu-area").attr("d", area(pts)).style("fill", color);
    g.append("path").attr("class", "eu-line").attr("d", line(pts)).style("stroke", color);
    const valid = pts.filter((p) => p.v != null);
    const top = d3.greatest(valid, (p) => p.v);
    const low = d3.least(valid, (p) => p.v);
    for (const [p, label, dy] of [
      [top, `record : ${monthLabel(top.m)}, ${mio(top.v)}`, -10],
      [low, `${monthLabel(low.m)} : ${mio(low.v, 2)}`, -10],
    ]) {
      g.append("circle").attr("class", "eu-mark").attr("cx", x(p.d)).attr("cy", y(p.v)).attr("r", 3.5);
      const right = x(p.d) > w * 0.62;
      g.append("text")
        .attr("class", "eu-label")
        .attr("x", x(p.d) + (right ? -6 : 6))
        .attr("y", y(p.v) + dy)
        .attr("text-anchor", right ? "end" : "start")
        .text(label);
    }
    // hover: the month under the pointer
    const focus = g.append("g").attr("class", "eu-focus").style("display", "none");
    focus.append("line").attr("y1", 0).attr("y2", h);
    focus.append("circle").attr("r", 4);
    g.append("rect")
      .attr("width", w)
      .attr("height", h)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx] = d3.pointer(ev);
        const d = x.invert(mx);
        const p = d3.least(valid, (q) => Math.abs(q.d - d));
        focus.style("display", null).attr("transform", `translate(${x(p.d)},0)`);
        focus.select("circle").attr("cy", y(p.v));
        showTip(ev, monthLabel(p.m), [{ label: "passagers", value: mio(p.v, 2), color }]);
      })
      .on("pointerleave", () => {
        focus.style("display", "none");
        hideTip();
      });
  };
  draw();
  onResize(node, draw);
}

/** Years down, months across: every month of a zone, darker when busier. Missing months stay empty. */
export function heatmap(node, { months, series }) {
  const draw = () => {
    const years = d3.range(+months[0].slice(0, 4), +months.at(-1).slice(0, 4) + 1);
    const small = node.clientWidth < 520;
    const rowH = small ? 11 : 14;
    const { g, w } = frame(node, years.length * rowH + 40, { top: 22, right: 6, bottom: 18, left: 40 });
    const cw = w / 12;
    const max = d3.max(series);
    const color = d3.scaleSequential([0, max], d3.interpolateRgb("#e7efed", "#0b4f4a"));
    const byKey = new Map(months.map((m, i) => [m, series[i]]));
    g.append("g")
      .attr("class", "axis x")
      .selectAll("text")
      .data(MONTHS)
      .join("text")
      .attr("x", (_, i) => i * cw + cw / 2)
      .attr("y", -7)
      .attr("text-anchor", "middle")
      .text((m) => (small ? m.slice(0, 1).toUpperCase() : m));
    g.append("g")
      .attr("class", "axis y")
      .selectAll("text")
      .data(years.filter((y, i) => !small || i % 2 === 0 || y === years.at(-1)))
      .join("text")
      .attr("x", -6)
      .attr("y", (y) => (y - years[0]) * rowH + rowH / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text((y) => y);
    const cells = years.flatMap((y) =>
      d3.range(12).map((i) => {
        const k = `${y}-${String(i + 1).padStart(2, "0")}`;
        return { k, y, i, v: byKey.get(k) };
      }),
    );
    g.selectAll("rect")
      .data(cells.filter((c) => c.v != null))
      .join("rect")
      .attr("x", (c) => c.i * cw + 0.5)
      .attr("y", (c) => (c.y - years[0]) * rowH + 0.5)
      .attr("width", cw - 1)
      .attr("height", rowH - 1)
      .attr("fill", (c) => color(c.v))
      .on("pointermove", (ev, c) =>
        showTip(ev, monthLabel(c.k), [{ label: "passagers", value: mio(c.v, 2) }]),
      )
      .on("pointerleave", hideTip);
  };
  draw();
  onResize(node, draw);
}

/** Stacked bars per year: national, to another EU country, outside the EU. */
export function partsChart(node, { years, parts, from }) {
  const keys = [
    ["nat", "Intérieur", "var(--eu-nat)"],
    ["ieu", "Vers l'UE", "var(--eu-ieu)"],
    ["xeu", "Hors UE", "var(--eu-xeu)"],
  ];
  const draw = () => {
    const small = node.clientWidth < 520;
    const { svg, g, w, h } = frame(node, small ? 230 : 280, { top: 30, right: 6, bottom: 24, left: 52 });
    const rows = years
      .map((y, i) => ({ y, nat: parts.nat[i], ieu: parts.ieu[i], xeu: parts.xeu[i] }))
      .filter((r) => r.y >= from && r.nat != null && r.ieu != null && r.xeu != null);
    const x = d3
      .scaleBand()
      .domain(rows.map((r) => r.y))
      .range([0, w])
      .padding(0.18);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r) => r.nat + r.ieu + r.xeu) * 1.05])
      .nice()
      .range([h, 0]);
    yAxisMio(g, y, w, 4);
    const stack = d3.stack().keys(keys.map((k) => k[0]))(rows);
    stack.forEach((layer, li) => {
      g.append("g")
        .attr("fill", keys[li][2])
        .selectAll("rect")
        .data(layer)
        .join("rect")
        .attr("x", (d) => x(d.data.y))
        .attr("width", x.bandwidth())
        .attr("y", (d) => y(d[1]))
        .attr("height", (d) => Math.max(0, y(d[0]) - y(d[1])))
        .on("pointermove", (ev, d) =>
          showTip(
            ev,
            String(d.data.y),
            keys.map(([k, label, c]) => ({ label, value: mio(d.data[k]), color: c })),
          ),
        )
        .on("pointerleave", hideTip);
    });
    g.append("g")
      .attr("class", "axis x")
      .selectAll("text")
      .data(
        rows.filter((r, i) => {
          const step = small ? 4 : 2;
          // the last year always, the others every step unless they would touch it
          return i === rows.length - 1 || (r.y % step === 0 && rows.at(-1).y - r.y > step / 2);
        }),
      )
      .join("text")
      .attr("x", (r) => x(r.y) + x.bandwidth() / 2)
      .attr("y", h + 16)
      .attr("text-anchor", "middle")
      .text((r) => r.y);
    const lg = svg.append("g").attr("class", "eu-legend").attr("transform", "translate(52,10)");
    let lx = 0;
    keys.forEach(([, label, c]) => {
      lg.append("rect").attr("x", lx).attr("y", -8).attr("width", 10).attr("height", 10).attr("fill", c);
      const t = lg
        .append("text")
        .attr("x", lx + 14)
        .attr("y", 1)
        .text(label);
      lx += 14 + t.node().getComputedTextLength() + 16;
    });
  };
  draw();
  onResize(node, draw);
}

/** Change on 2019, one bar per country, above 2019 to the right. */
export function rankBars(node, rows, { onPick } = {}) {
  const draw = () => {
    const rowH = 19;
    const { g, w, h } = frame(node, rows.length * rowH + 30, { top: 10, right: 46, bottom: 20, left: 96 });
    const ext = d3.max(rows, (r) => Math.abs(r.change));
    const x = d3.scaleLinear().domain([-ext, ext]).nice().range([0, w]);
    const y = d3
      .scaleBand()
      .domain(rows.map((r) => r.code))
      .range([0, h])
      .padding(0.22);
    for (const t of x.ticks(5)) {
      g.append("line")
        .attr("class", t === 0 ? "zero" : "grid")
        .attr("x1", x(t))
        .attr("x2", x(t))
        .attr("y1", 0)
        .attr("y2", h);
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(t))
        .attr("y", h + 14)
        .attr("text-anchor", "middle")
        .text(pct(t));
    }
    const row = g
      .selectAll("g.r")
      .data(rows)
      .join("g")
      .attr("class", "r")
      .attr("transform", (r) => `translate(0,${y(r.code)})`)
      .style("cursor", onPick ? "pointer" : null)
      .on("click", (_, r) => onPick?.(r.code));
    row
      .append("rect")
      .attr("x", (r) => x(Math.min(0, r.change)))
      .attr("width", (r) => Math.abs(x(r.change) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", (r) => (r.change >= 0 ? "var(--south)" : "var(--north)"));
    row
      .append("text")
      .attr("class", "lab")
      .attr("x", -8)
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text((r) => r.name);
    row
      .append("text")
      .attr("class", "val")
      .attr("x", (r) => x(r.change) + (r.change >= 0 ? 4 : -4))
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", (r) => (r.change >= 0 ? "start" : "end"))
      .text((r) => pct(r.change, 1));
  };
  draw();
  onResize(node, draw);
  dataTable(node, { head: ["Pays", "2025 / 2019"], rows: rows.map((r) => [r.name, pct(r.change, 1)]) });
}

/** National passengers, 2019 then the last year: a dot for each, joined, falling ones in blue. */
export function dumbbell(node, rows, { last }) {
  const draw = () => {
    const rowH = 26;
    const { svg, g, w, h } = frame(node, rows.length * rowH + 44, {
      top: 30,
      right: 70,
      bottom: 18,
      left: 96,
    });
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r) => Math.max(r.y2019, r.now))])
      .nice()
      .range([0, w]);
    const y = d3
      .scaleBand()
      .domain(rows.map((r) => r.code))
      .range([0, h])
      .padding(0.4);
    for (const t of x.ticks(5)) {
      g.append("line").attr("class", "grid").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", h);
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(t))
        .attr("y", h + 14)
        .attr("text-anchor", "middle")
        .text(t ? `${fmtNum(t / 1e6)} M` : "0");
    }
    const row = g
      .selectAll("g.r")
      .data(rows)
      .join("g")
      .attr("class", "r")
      .attr("transform", (r) => `translate(0,${y(r.code) + y.bandwidth() / 2})`);
    row
      .append("line")
      .attr("x1", (r) => x(r.y2019))
      .attr("x2", (r) => x(r.now))
      .attr("stroke", (r) => (r.change < 0 ? "var(--north)" : "var(--south)"))
      .attr("stroke-width", 3);
    row
      .append("circle")
      .attr("cx", (r) => x(r.y2019))
      .attr("r", 4.5)
      .attr("class", "d2019");
    row
      .append("circle")
      .attr("cx", (r) => x(r.now))
      .attr("r", 5.5)
      .attr("fill", (r) => (r.change < 0 ? "var(--north)" : "var(--south)"));
    row
      .append("text")
      .attr("class", "lab")
      .attr("x", -8)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text((r) => r.name);
    row
      .append("text")
      .attr("class", "val")
      .attr("x", (r) => x(Math.max(r.y2019, r.now)) + 9)
      .attr("dy", "0.32em")
      .text((r) => pct(r.change));
    const lg = svg.append("g").attr("class", "eu-legend").attr("transform", "translate(96,12)");
    lg.append("circle").attr("cx", 5).attr("cy", -3).attr("r", 4.5).attr("class", "d2019");
    lg.append("text").attr("x", 14).attr("y", 1).text("2019");
    lg.append("circle").attr("cx", 64).attr("cy", -3).attr("r", 5.5).attr("fill", "var(--north)");
    lg.append("text").attr("x", 74).attr("y", 1).text(String(last));
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Pays", "2019", String(last), "Évolution"],
    rows: rows.map((r) => [r.name, mio(r.y2019), mio(r.now), pct(r.change)]),
  });
}

/** Ranks of airports across the years: one line per airport, the top N of the last year highlighted. */
export function bumpChart(node, { years, ranks, highlight, top = 12 }) {
  const draw = () => {
    const small = node.clientWidth < 620;
    const rowH = small ? 22 : 28;
    const { g, w, h } = frame(node, top * rowH + 50, {
      top: 22,
      right: small ? 112 : 168,
      bottom: 22,
      left: small ? 26 : 150,
    });
    const x = d3.scalePoint().domain(years).range([0, w]);
    const y = d3
      .scaleLinear()
      .domain([1, top])
      .range([0, h - rowH / 2]);
    const shown = (r) => r != null && r <= top;
    for (const yr of years.filter((yr, i) => i % (small ? 4 : 2) === 0 || yr === years.at(-1))) {
      g.append("text")
        .attr("class", "axis-t")
        .attr("x", x(yr))
        .attr("y", h + 14)
        .attr("text-anchor", "middle")
        .text(yr);
    }
    const lines = ranks.filter((a) => a.rank.some(shown));
    for (const a of lines) {
      const on = highlight.includes(a.code);
      const segs = [];
      let cur = [];
      a.rank.forEach((r, i) => {
        if (shown(r)) cur.push([x(years[i]), y(r)]);
        else if (cur.length) (segs.push(cur), (cur = []));
      });
      if (cur.length) segs.push(cur);
      for (const s of segs)
        g.append("path")
          .attr("class", on ? "bump on" : "bump")
          .attr("d", d3.line().curve(d3.curveMonotoneX)(s))
          .style("stroke", on ? a.color : null);
      a.rank.forEach((r, i) => {
        if (!shown(r)) return;
        g.append("circle")
          .attr("class", on ? "bump-dot on" : "bump-dot")
          .attr("cx", x(years[i]))
          .attr("cy", y(r))
          .attr("r", on ? 3.5 : 2.5)
          .style("fill", on ? a.color : null)
          .on("pointermove", (ev) =>
            showTip(ev, `${a.name}, ${years[i]}`, [
              { label: "rang", value: `${r}e` },
              { label: "passagers", value: mio(a.pax[i]) },
            ]),
          )
          .on("pointerleave", hideTip);
      });
      const lastR = a.rank.at(-1);
      if (shown(lastR))
        g.append("text")
          .attr("class", on ? "bump-lab on" : "bump-lab")
          .attr("x", w + 8)
          .attr("y", y(lastR))
          .attr("dy", "0.32em")
          .style("fill", on ? a.color : null)
          .text(`${lastR}. ${a.name}`);
      const firstR = a.rank[0];
      if (!small && shown(firstR))
        g.append("text")
          .attr("class", "bump-lab first")
          .attr("x", -8)
          .attr("y", y(firstR))
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .text(a.name);
    }
  };
  draw();
  onResize(node, draw);
}

/** The airports of a zone: their passengers in 2008, 2019 and the last year, and a small curve. */
export function airportTable(node, rows, { years, last }) {
  const spark = (pax) => {
    const W = 120;
    const H = 26;
    const max = d3.max(pax) || 1;
    const x = d3
      .scaleLinear()
      .domain([0, pax.length - 1])
      .range([1, W - 1]);
    const y = d3
      .scaleLinear()
      .domain([0, max])
      .range([H - 2, 2]);
    const d = d3
      .line()
      .defined((v) => v != null)
      .x((_, i) => x(i))
      .y((v) => y(v))(pax);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `<line x1="${x(years.indexOf(2019))}" x2="${x(years.indexOf(2019))}" y1="0" y2="${H}" class="sp-2019"/><path d="${d}" class="sp-line"/>`;
    return svg;
  };
  const i08 = years.indexOf(2008);
  const i19 = years.indexOf(2019);
  const iL = years.indexOf(last);
  const table = el("table", { class: "eu-apt-table" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col", text: "" }),
        el("th", { scope: "col", text: "Aéroport" }),
        el("th", { scope: "col", class: "n", text: "2008" }),
        el("th", { scope: "col", class: "n", text: "2019" }),
        el("th", { scope: "col", class: "n", text: String(last) }),
        el("th", { scope: "col", class: "n", text: `${last} / 2019` }),
        el("th", { scope: "col", class: "sp", text: `${years[0]}-${last}` }),
      ]),
    ]),
    el(
      "tbody",
      {},
      rows.map((a, k) => {
        const ch = a.pax[i19] ? 100 * (a.pax[iL] / a.pax[i19] - 1) : null;
        return el("tr", {}, [
          el("td", { class: "rk", text: String(k + 1) }),
          el("th", { scope: "row", text: a.name }),
          el("td", { class: "n", text: a.pax[i08] != null ? mio(a.pax[i08]) : "–" }),
          el("td", { class: "n", text: a.pax[i19] != null ? mio(a.pax[i19]) : "–" }),
          el("td", { class: "n", text: a.pax[iL] != null ? mio(a.pax[iL]) : "–" }),
          el("td", {
            class: `n ${ch == null ? "" : ch >= 0 ? "up" : "down"}`,
            text: ch == null ? "–" : pct(ch),
          }),
          el("td", { class: "sp" }, [spark(a.pax)]),
        ]);
      }),
    ),
  ]);
  node.replaceChildren(el("div", { class: "table-scroll" }, [table]));
}
