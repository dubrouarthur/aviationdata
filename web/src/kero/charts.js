// @ts-check
// Figures of « D'où vient le kérosène des avions européens ? »: maps of the flows into the Union (an arc from
// each supplier, as wide as its tonnes), a gap between what European refineries make and what is delivered, ten
// years of suppliers as stacked shares, the suppliers month by month, the shift from one period to the next, the
// prices, and each country's suppliers in a hundred squares. The Gulf is in magenta (the series the story is
// about), the other origins in the blues and greys of the Carte design system. Each figure offers its values as a
// table (dataTable).
import * as d3 from "d3";
import { feature } from "topojson-client";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { asset } from "../lib/site.js";
import { GROUP_ORDER, monthLabel } from "./facts.js";

/** one colour per group: magenta for the Gulf, the rest in blues, a green and greys */
export const GCOL = {
  golfe: "#b5246e",
  inde: "#e08bb5",
  asie: "#7b9fc9",
  russie: "#3d3d3d",
  europe: "#1f5fa8",
  afrique: "#2f8f6b",
  ameriques: "#14202e",
  autres: "#b8c2cc",
};
const pc = (/** @type {number} */ v, d = 0) => `${fmtNum(v * 100, d)} %`;
const kt = (/** @type {number} */ v) => `${fmtNum(Math.round(v), 0)} kt`;

/** @type {Promise<any> | null} */
let worldP = null;
const loadWorld = () =>
  (worldP ||= fetch(asset("geo/world-110m.json"))
    .then((r) => r.json())
    .then((t) => ({ land: feature(t, t.objects.land), countries: feature(t, t.objects.countries) })));

/** where Europe receives: a mark on the North Sea coast, the arcs end there */
const EU_POINT = /** @type {[number, number]} */ ([5.5, 51.5]);

/**
 * The flows of one period into the Union: from each supplier (centroid of its country) an arc to Europe, as wide as
 * its tonnes a month, coloured by its group. flows: [{key, label, iso, group, t}] (t = kt a month); max: the scale,
 * shared between the two maps of a comparison.
 */
export async function flowMap(node, { flows, max, label, top = 5 }) {
  const { land, countries } = await loadWorld();
  const centroid = Object.fromEntries(countries.features.map((f) => [String(+f.id), d3.geoCentroid(f)]));
  // a few countries whose centroid sits far from their coast or ports: a point inside them, nearer the sea
  const FIX = { 840: [-95, 31], 124: [-80, 47], 643: [38, 56], 156: [118, 32], 356: [73, 21], 682: [49, 25] };
  const draw = (width) => {
    const W = Math.max(300, width);
    const H = Math.round(W * 0.52);
    const proj = d3.geoNaturalEarth1().rotate([-20, 0]);
    proj.fitExtent(
      [
        [4, 4],
        [W - 4, H - 4],
      ],
      {
        type: "MultiPoint",
        // the corners of the useful world: from the Gulf of Mexico to Korea, from Nigeria to Norway
        coordinates: [-100, -60, -20, 20, 60, 100, 132].flatMap((lo) =>
          [-2, 25, 45, 64].map((la) => [lo, la]),
        ),
      },
    );
    const path = d3.geoPath(proj);
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label)
      .style("overflow", "hidden");
    s.append("rect").attr("width", W).attr("height", H).attr("class", "k-sea");
    s.append("path").attr("d", path(land)).attr("class", "k-land");
    const [ex, ey] = /** @type {[number, number]} */ (proj(EU_POINT));
    const wid = (t) => 1 + (t / max) * Math.max(14, W / 40);
    const sorted = [...flows].filter((f) => f.t > 0.5).sort((a, b) => a.t - b.t);
    for (const f of sorted) {
      const c = FIX[f.iso] ?? centroid[String(f.iso)];
      if (!c) continue;
      const [x, y] = /** @type {[number, number]} */ (proj(c));
      const mx = (x + ex) / 2;
      const my = (y + ey) / 2 - Math.hypot(ex - x, ey - y) * 0.22;
      s.append("path")
        .attr("d", `M${x},${y} Q${mx},${my} ${ex},${ey}`)
        .attr("class", "k-flow")
        .attr("stroke", GCOL[f.group])
        .attr("stroke-width", wid(f.t))
        .on("pointermove", (ev) =>
          showTip(ev, f.label, [{ label: "Importé chaque mois", value: kt(f.t), color: GCOL[f.group] }]),
        )
        .on("pointerleave", hideTip);
      s.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 2 + wid(f.t) / 3)
        .attr("fill", GCOL[f.group]);
    }
    s.append("circle").attr("cx", ex).attr("cy", ey).attr("r", 6).attr("class", "k-eu");
    // the largest suppliers named
    const big = [...flows].sort((a, b) => b.t - a.t).slice(0, top);
    const placed = [];
    for (const f of big) {
      const c = FIX[f.iso] ?? centroid[String(f.iso)];
      if (!c) continue;
      const [x, y] = /** @type {[number, number]} */ (proj(c));
      const w = f.label.length * 6.6;
      const lx = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, x));
      let ly = y - 10;
      for (
        let k = 0;
        k < 8 && placed.some((q) => Math.abs(q.x - lx) < (q.w + w) / 2 + 4 && Math.abs(q.y - ly) < 15);
        k++
      )
        ly = k % 2 ? y - 10 - 15 * Math.ceil((k + 1) / 2) : y + 18 + 15 * (k / 2);
      placed.push({ x: lx, y: ly, w });
      s.append("text")
        .attr("class", "k-lab")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", "middle")
        .text(f.label);
    }
  };
  onResize(node, draw);
  draw(node.clientWidth || 600);
}

/**
 * What European refineries make against what is delivered, month by month: two lines, the gap between them
 * shaded (what must come from elsewhere or from stocks).
 */
export function gapChart(node, { months, refinery, deliveries, label, mark }) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = narrow ? 280 : 340;
    const M = { t: 16, r: narrow ? 92 : 140, b: 28, l: 44 };
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const X = d3
      .scaleLinear()
      .domain([0, months.length - 1])
      .range([M.l, W - M.r]);
    const Y = d3
      .scaleLinear()
      .domain([0, Math.max(...deliveries.filter((v) => v !== null)) * 1.08])
      .nice()
      .range([H - M.b, M.t]);
    for (const t of Y.ticks(5)) {
      s.append("line")
        .attr("class", "k-grid")
        .attr("x1", M.l)
        .attr("x2", W - M.r)
        .attr("y1", Y(t))
        .attr("y2", Y(t));
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", M.l - 6)
        .attr("y", Y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(fmtNum(t / 1000, 1));
    }
    months.forEach((m, i) => {
      if (!m.endsWith("-01") || +m.slice(0, 4) % (narrow ? 2 : 1)) return;
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(i))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(m.slice(0, 4));
    });
    const ok = (i) => refinery[i] !== null && deliveries[i] !== null;
    const area = d3
      .area()
      .defined((_, i) => ok(i))
      .x((_, i) => X(i))
      .y0((_, i) => Y(refinery[i]))
      .y1((_, i) => Y(Math.max(refinery[i], deliveries[i])));
    s.append("path")
      .attr("class", "k-gap")
      .attr("d", area(/** @type {any} */ (months)));
    const line = (v) =>
      d3
        .line()
        .defined((_, i) => v[i] !== null)
        .x((_, i) => X(i))
        .y((_, i) => Y(v[i]))(/** @type {any} */ (months));
    s.append("path").attr("class", "k-line del").attr("d", line(deliveries));
    s.append("path").attr("class", "k-line ref").attr("d", line(refinery));
    const lastI = months.length - 1 - [...months].reverse().findIndex((_, k) => ok(months.length - 1 - k));
    s.append("text")
      .attr("class", "k-end del")
      .attr("x", X(lastI) + 8)
      .attr("y", Y(deliveries[lastI]))
      .attr("dy", "0.32em")
      .text("Livré");
    s.append("text")
      .attr("class", "k-end ref")
      .attr("x", X(lastI) + 8)
      .attr("y", Y(refinery[lastI]))
      .attr("dy", "0.32em")
      .text("Raffiné en Europe");
    if (mark) {
      const i = months.indexOf(mark.month);
      if (i >= 0) {
        s.append("line")
          .attr("class", "k-mark")
          .attr("x1", X(i))
          .attr("x2", X(i))
          .attr("y1", M.t)
          .attr("y2", H - M.b);
        s.append("text")
          .attr("class", "k-mark-t")
          .attr("x", X(i) + 4)
          .attr("y", M.t + 10)
          .text(mark.text);
      }
    }
  };
  onResize(node, draw);
  draw(node.clientWidth || 720);
  dataTable(node, {
    head: ["Mois", "Raffiné en Europe (kt)", "Livré (kt)"],
    rows: months
      .map((m, i) => [
        monthLabel(m),
        refinery[i] === null ? "" : fmtNum(refinery[i], 0),
        deliveries[i] === null ? "" : fmtNum(deliveries[i], 0),
      ])
      .filter((_, i) => months[i].slice(5) === "01" || i >= months.length - 12),
  });
}

/**
 * Ten years of suppliers: the share of each group in the month's imports from outside the Union, stacked to 100 %,
 * smoothed over three months; a mark on the closure of Hormuz and on the embargo on Russian oil products.
 */
export function shareStream(node, { months, groups, total, labels, label, marks = [] }) {
  const n = months.length;
  const smooth = (v) => v.map((_, i) => d3.mean(v.slice(Math.max(0, i - 1), i + 2)) ?? 0);
  const tot = smooth(total.map((x) => x ?? 0));
  const shares = GROUP_ORDER.map((g) =>
    smooth(groups[g].map((x) => x ?? 0)).map((x, i) => (tot[i] ? x / tot[i] : 0)),
  );
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const H = narrow ? 300 : 380;
    const M = { t: 18, r: narrow ? 8 : 150, b: 28, l: 40 };
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const X = d3
      .scaleLinear()
      .domain([0, n - 1])
      .range([M.l, W - M.r]);
    const Y = d3
      .scaleLinear()
      .domain([0, 1])
      .range([H - M.b, M.t]);
    let acc = new Array(n).fill(0);
    GROUP_ORDER.forEach((g, k) => {
      const lo = acc;
      const hi = acc.map((a, i) => a + shares[k][i]);
      const area = d3
        .area()
        .x((_, i) => X(i))
        .y0((_, i) => Y(lo[i]))
        .y1((_, i) => Y(hi[i]));
      s.append("path")
        .attr("d", area(/** @type {any} */ (months)))
        .attr("fill", GCOL[g])
        .attr("class", "k-band")
        .on("pointermove", (ev) => {
          const [px] = d3.pointer(ev);
          const i = Math.max(0, Math.min(n - 1, Math.round(X.invert(px))));
          showTip(ev, monthLabel(months[i]), [{ label: labels[g], value: pc(shares[k][i]), color: GCOL[g] }]);
        })
        .on("pointerleave", hideTip);
      if (!narrow) {
        const mid = (lo[n - 1] + hi[n - 1]) / 2;
        if (hi[n - 1] - lo[n - 1] > 0.035)
          s.append("text")
            .attr("class", "k-band-t")
            .attr("x", W - M.r + 8)
            .attr("y", Y(mid))
            .attr("dy", "0.32em")
            .attr("fill", GCOL[g])
            .text(labels[g]);
      }
      acc = hi;
    });
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", M.l - 6)
        .attr("y", Y(t))
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(pc(t));
    months.forEach((m, i) => {
      if (!m.endsWith("-01") || +m.slice(0, 4) % (narrow ? 3 : 1)) return;
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(i))
        .attr("y", H - 8)
        .attr("text-anchor", "middle")
        .text(m.slice(0, 4));
    });
    for (const mk of marks) {
      const i = months.indexOf(mk.month);
      if (i < 0) continue;
      s.append("line")
        .attr("class", "k-mark light")
        .attr("x1", X(i))
        .attr("x2", X(i))
        .attr("y1", M.t - 4)
        .attr("y2", H - M.b);
      s.append("text")
        .attr("class", "k-mark-t light")
        .attr("x", X(i) - 4)
        .attr("y", M.t + 12)
        .attr("text-anchor", "end")
        .text(mk.text);
    }
  };
  onResize(node, draw);
  draw(node.clientWidth || 720);
  dataTable(node, {
    head: ["Année", ...GROUP_ORDER.map((g) => labels[g])],
    rows: d3
      .range(0, n, 12)
      .map((i) => [months[i].slice(0, 4), ...GROUP_ORDER.map((_, k) => pc(shares[k][i]))]),
  });
}

/** From one period to the next: each group's share before (open dot) and after (filled), joined by a line. */
export function shiftDots(node, { rows, label, names }) {
  const draw = (width) => {
    const narrow = width < 560;
    const W = Math.max(300, width);
    const M = { t: 34, r: 60, b: 10, l: narrow ? 118 : 170 };
    const rh = 40;
    const H = M.t + rows.length * rh + M.b;
    node.replaceChildren();
    const s = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    const X = d3
      .scaleLinear()
      .domain([0, Math.max(...rows.flatMap((r) => [r.before, r.after])) * 1.05])
      .nice()
      .range([M.l, W - M.r]);
    for (const t of X.ticks(5)) {
      s.append("line")
        .attr("class", "k-grid")
        .attr("x1", X(t))
        .attr("x2", X(t))
        .attr("y1", M.t - 6)
        .attr("y2", H - M.b);
      s.append("text")
        .attr("class", "c-tick")
        .attr("x", X(t))
        .attr("y", M.t - 12)
        .attr("text-anchor", "middle")
        .text(pc(t));
    }
    rows.forEach((r, i) => {
      const y = M.t + i * rh + rh / 2;
      s.append("text")
        .attr("class", "k-row")
        .attr("x", M.l - 10)
        .attr("y", y)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .text(r.label);
      s.append("line")
        .attr("class", "k-shift")
        .attr("x1", X(r.before))
        .attr("x2", X(r.after))
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", GCOL[r.group]);
      s.append("circle")
        .attr("class", "k-dot-b")
        .attr("cx", X(r.before))
        .attr("cy", y)
        .attr("r", 7)
        .attr("stroke", GCOL[r.group]);
      s.append("circle").attr("cx", X(r.after)).attr("cy", y).attr("r", 7).attr("fill", GCOL[r.group]);
      s.append("text")
        .attr("class", "k-val")
        .attr("x", X(Math.max(r.before, r.after)) + 12)
        .attr("y", y)
        .attr("dy", "0.32em")
        .text(pc(r.after));
    });
  };
  onResize(node, draw);
  draw(node.clientWidth || 720);
  dataTable(node, {
    head: ["Origine", ...names],
    rows: rows.map((r) => [r.label, pc(r.before, 1), pc(r.after, 1)]),
  });
}

/** A hundred squares, one per percent, coloured by group in GROUP_ORDER. */
export function hundred(shares) {
  const cells = [];
  let k = 0;
  // largest remainder: exactly 100 squares
  const raw = GROUP_ORDER.map((g) => ({ g, v: (shares[g] ?? 0) * 100 }));
  const fl = raw.map((x) => ({ ...x, n: Math.floor(x.v) }));
  let left = 100 - fl.reduce((a, x) => a + x.n, 0);
  [...fl]
    .sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)))
    .forEach((x) => {
      if (left > 0) {
        x.n++;
        left--;
      }
    });
  for (const x of fl)
    for (let i = 0; i < x.n; i++, k++)
      cells.push(
        `<rect x="${(k % 10) * 11}" y="${Math.floor(k / 10) * 11}" width="10" height="10" rx="1.5" fill="${GCOL[x.g]}"/>`,
      );
  return `<svg viewBox="0 0 109 109" class="k-hundred" aria-hidden="true">${cells.join("")}</svg>`;
}

/** Each country's suppliers before and after, in a hundred squares each. */
export function countryGrids(node, { countries, label, names }) {
  node.replaceChildren(
    el(
      "div",
      { class: "k-grids", role: "img", "aria-label": label },
      countries.map((c) => {
        const sh = (p) =>
          Object.fromEntries(GROUP_ORDER.map((g) => [g, p.total ? (p[g] ?? 0) / p.total : 0]));
        const box = el("div", { class: "k-country" }, [el("p", { class: "k-country-h", text: c.label })]);
        const pair = el("div", { class: "k-pair" });
        for (const [k, name] of [
          ["before", names[0]],
          ["after", names[1]],
        ]) {
          const f = el("div", { class: "k-cell" });
          f.innerHTML = hundred(sh(c[k]));
          f.append(el("span", { text: `${name} · ${pc(sh(c[k]).golfe)} du Golfe` }));
          pair.append(f);
        }
        box.append(pair);
        return box;
      }),
    ),
  );
  dataTable(node, {
    head: ["Pays", ...names.map((n) => `Golfe, ${n}`), ...names.map((n) => `Importé, ${n} (kt)`)],
    rows: countries.map((c) => [
      c.label,
      pc(c.before.total ? c.before.golfe / c.before.total : 0),
      pc(c.after.total ? c.after.golfe / c.after.total : 0),
      fmtNum(c.before.total, 0),
      fmtNum(c.after.total, 0),
    ]),
  });
}

/** The legend of the groups (colours), once per page. */
export function groupLegend(node, labels) {
  node.replaceChildren(
    ...GROUP_ORDER.filter((g) => g !== "russie").map((g) =>
      el("span", { class: "k-key" }, [el("i", { style: `background:${GCOL[g]}` }), labels[g]]),
    ),
  );
}
