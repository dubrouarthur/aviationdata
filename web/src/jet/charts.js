// Paper charts of the jet-stream story (d3, SVG). Colours: --east (towards France, with the
// wind) and --west (towards America, against it), read from the CSS so both themes agree.
import * as d3 from "d3";
import { el, showTip, hideTip, onResize, dataTable } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { hm, kmh, longDate, minutes, monthShort, monthName, winter } from "./fmt.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = () => ({
  east: css("--east"),
  west: css("--west"),
  ink: css("--ink"),
  ink2: css("--ink-2"),
  muted: css("--muted"),
  grid: css("--grid"),
  axis: css("--axis"),
  paper: css("--card"),
});

function frame(node, height, margin) {
  const width = node.clientWidth || 640;
  const svg = d3
    .select(node)
    .selectAll("svg")
    .data([0])
    .join("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height);
  svg.selectAll("*").remove();
  return {
    svg,
    width,
    height,
    m: margin,
    iw: width - margin.left - margin.right,
    ih: height - margin.top - margin.bottom,
  };
}

const axisStyle = (g, c) => {
  g.selectAll(".domain").remove();
  g.selectAll("line").attr("stroke", c.grid);
  g.selectAll("text").attr("fill", c.muted).attr("font-size", 12);
};

const label = (g, x, y, text, { anchor = "start", color, weight = 650, size = 13, halo } = {}) =>
  g
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", anchor)
    .attr("font-size", size)
    .attr("font-weight", weight)
    .attr("fill", color)
    .attr("paint-order", halo ? "stroke" : null)
    .attr("stroke", halo || null)
    .attr("stroke-width", halo ? 4 : null)
    .attr("stroke-linejoin", "round")
    .text(text);

/* ------------------------------------------------------------------ durations, both ways */
export function histogram(node, pair, meds) {
  const { hist } = pair;
  const bins = hist.east.map((_, i) => hist.start + i * hist.bin);
  const draw = () => {
    const c = C();
    const f = frame(node, 300, { top: 34, right: 12, bottom: 34, left: 12 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const lo = d3.min(bins.filter((_, i) => hist.east[i] + hist.west[i] > 3));
    const hi = d3.max(bins.filter((_, i) => hist.east[i] + hist.west[i] > 3)) + hist.bin;
    const x = d3.scaleLinear().domain([lo, hi]).range([0, f.iw]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max([...hist.east, ...hist.west])])
      .range([f.ih, 0]);
    const ticks = d3.range(Math.ceil(lo / 60) * 60, hi, 30);
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(hm).tickSize(-f.ih))
      .call((a) => axisStyle(a, c));
    for (const dir of ["east", "west"]) {
      const area = d3
        .area()
        .curve(d3.curveStepAfter)
        .x((d, i) => x(bins[i]))
        .y0(f.ih)
        .y1((d) => y(d));
      g.append("path")
        .datum(hist[dir])
        .attr("d", area)
        .attr("fill", c[dir])
        .attr("fill-opacity", 0.22)
        .attr("stroke", c[dir])
        .attr("stroke-width", 1.6);
      const mx = x(meds[dir]);
      g.append("line")
        .attr("x1", mx)
        .attr("x2", mx)
        .attr("y1", -6)
        .attr("y2", f.ih)
        .attr("stroke", c[dir])
        .attr("stroke-dasharray", "3 3");
      label(
        g,
        mx + (dir === "east" ? -6 : 6),
        -14,
        `${dir === "east" ? "Vers Paris" : "Vers New York"} ${hm(meds[dir])}`,
        {
          anchor: dir === "east" ? "end" : "start",
          color: c[dir],
        },
      );
    }
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ every route: dumbbells */
export function routesChart(node, routes) {
  const rows = [...routes].sort((a, b) => a.km - b.km);
  const draw = () => {
    const c = C();
    const narrow = (node.clientWidth || 640) < 520;
    const rowH = 26;
    const left = narrow ? 112 : 150;
    const f = frame(node, rows.length * rowH + 40, { top: 26, right: 58, bottom: 14, left });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const x = d3
      .scaleLinear()
      .domain([d3.min(rows, (r) => r.east.med) - 15, d3.max(rows, (r) => r.west.med) + 10])
      .range([0, f.iw]);
    const y = (i) => i * rowH + rowH / 2;
    g.append("g")
      .attr("transform", `translate(0,-6)`)
      .call(
        d3
          .axisTop(x)
          .tickValues(d3.range(360, x.domain()[1], 60))
          .tickFormat(hm)
          .tickSize(-(rows.length * rowH)),
      )
      .call((a) => axisStyle(a, c));
    rows.forEach((r, i) => {
      const row = g.append("g").attr("transform", `translate(0,${y(i)})`);
      const name = r.from === "Paris-CDG" ? r.to : `${r.to} (${r.from})`;
      label(row, -10, 4, name, { anchor: "end", color: c.ink2, weight: 500, size: narrow ? 12 : 13 });
      row
        .append("line")
        .attr("x1", x(r.east.med))
        .attr("x2", x(r.west.med))
        .attr("stroke", c.axis)
        .attr("stroke-width", 2);
      for (const dir of ["east", "west"])
        row
          .append("circle")
          .attr("cx", x(r[dir].med))
          .attr("r", 5.5)
          .attr("fill", c[dir])
          .attr("stroke", c.paper)
          .attr("stroke-width", 1.5);
      label(row, x(r.west.med) + 10, 4, `+${hm(r.west.med - r.east.med)}`, { color: c.ink, size: 12 });
      row
        .append("rect")
        .attr("x", -left)
        .attr("y", -rowH / 2)
        .attr("width", f.iw + left + f.m.right)
        .attr("height", rowH)
        .attr("fill", "transparent")
        .on("pointermove", (ev) =>
          showTip(ev, `${r.from} – ${r.to}, ${fmtNum(r.km)} km`, [
            { color: c.west, value: hm(r.west.med), label: `vers l'Amérique (${fmtNum(r.west.n)} vols)` },
            { color: c.east, value: hm(r.east.med), label: `vers la France (${fmtNum(r.east.n)} vols)` },
          ]),
        )
        .on("pointerleave", hideTip);
    });
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Ligne", "km", "Vers l'Amérique", "Vers la France", "Écart"],
    rows: rows.map((r) => [
      `${r.from} – ${r.to}`,
      fmtNum(r.km),
      hm(r.west.med),
      hm(r.east.med),
      hm(r.west.med - r.east.med),
    ]),
  });
}

/* ------------------------------------------------------------------ month by month */
export function monthlyChart(node, monthly) {
  const rows = monthly.map((d) => ({ ...d, date: new Date(`${d.m}-15`) }));
  const draw = () => {
    const c = C();
    const f = frame(node, 400, { top: 18, right: 112, bottom: 28, left: 52 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const h1 = Math.round(f.ih * 0.66);
    const h2 = f.ih - h1 - 26;
    const x = d3
      .scaleTime()
      .domain([new Date("2019-01-01"), new Date("2023-01-01")])
      .range([0, f.iw]);
    const vals = rows.flatMap((d) => [d.e, d.w]).filter((v) => v !== null);
    const y = d3
      .scaleLinear()
      .domain([Math.floor(d3.min(vals) / 30) * 30, Math.ceil(d3.max(vals) / 30) * 30])
      .range([h1, 0]);
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(hm).tickSize(-f.iw))
      .call((a) => axisStyle(a, c));
    const line = (k) =>
      d3
        .line()
        .defined((d) => d[k] !== null)
        .x((d) => x(d.date))
        .y((d) => y(d[k]));
    for (const [k, dir, name] of [
      ["w", "west", "Vers New York"],
      ["e", "east", "Vers Paris"],
    ]) {
      g.append("path")
        .datum(rows)
        .attr("d", line(k))
        .attr("fill", "none")
        .attr("stroke", c[dir])
        .attr("stroke-width", 2.2);
      const lastRow = rows.filter((d) => d[k] !== null).at(-1);
      label(g, f.iw + 8, y(lastRow[k]) + 4, name, { color: c[dir] });
    }
    // lower panel: tailwind along the route of the flights to Paris
    const g2 = g.append("g").attr("transform", `translate(0,${h1 + 26})`);
    const y2 = d3
      .scaleLinear()
      .domain([0, Math.ceil(d3.max(rows, (d) => d.te ?? 0) / 50) * 50])
      .range([h2, 0]);
    g2.append("g")
      .call(d3.axisLeft(y2).ticks(3).tickSize(-f.iw))
      .call((a) => axisStyle(a, c));
    const bw = Math.max(1, f.iw / rows.length - 2);
    g2.selectAll("rect")
      .data(rows.filter((d) => d.te !== null))
      .join("rect")
      .attr("x", (d) => x(d.date) - bw / 2)
      .attr("width", bw)
      .attr("y", (d) => y2(d.te))
      .attr("height", (d) => h2 - y2(d.te))
      .attr("fill", c.east)
      .attr("fill-opacity", 0.45);
    label(g2, f.iw + 8, 10, "Vent arrière", { color: c.ink2, weight: 500, size: 12 });
    label(g2, f.iw + 8, 25, "vers Paris, km/h", { color: c.ink2, weight: 500, size: 12 });
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y"))
          .tickSize(0)
          .tickPadding(10),
      )
      .call((a) => axisStyle(a, c));
    // hover: one month
    const focus = g.append("line").attr("y1", 0).attr("y2", f.ih).attr("stroke", c.axis).attr("opacity", 0);
    g.append("rect")
      .attr("width", f.iw)
      .attr("height", f.ih)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx] = d3.pointer(ev);
        const d = rows[d3.minIndex(rows, (r) => Math.abs(x(r.date) - mx))];
        focus.attr("x1", x(d.date)).attr("x2", x(d.date)).attr("opacity", 1);
        const [yy, mm] = d.m.split("-").map(Number);
        showTip(ev, `${monthName(mm)} ${yy}`, [
          { color: c.west, value: d.w === null ? "–" : hm(d.w), label: `vers New York (${d.nw} vols)` },
          { color: c.east, value: d.e === null ? "–" : hm(d.e), label: `vers Paris (${d.ne} vols)` },
          { value: d.te === null ? "–" : kmh(d.te), label: "vent arrière moyen vers Paris" },
        ]);
      })
      .on("pointerleave", () => {
        focus.attr("opacity", 0);
        hideTip();
      });
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ one day = one dot */
export function scatterChart(node, days, fit) {
  const pts = [
    ...days.e.map(([d, dur, w, n]) => ({ d, dur, w, n, dir: "east" })),
    ...days.w.map(([d, dur, w, n]) => ({ d, dur, w, n, dir: "west" })),
  ].filter((p) => p.w !== null && p.dur !== null);
  const draw = () => {
    const c = C();
    const f = frame(node, 440, { top: 20, right: 16, bottom: 44, left: 56 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const xMax = Math.ceil(d3.max(pts, (p) => Math.abs(p.w)) / 50) * 50;
    const x = d3.scaleLinear().domain([-xMax, xMax]).range([0, f.iw]);
    const y = d3
      .scaleLinear()
      .domain([
        Math.floor(d3.min(pts, (p) => p.dur) / 30) * 30,
        Math.ceil(d3.max(pts, (p) => p.dur) / 30) * 30,
      ])
      .range([f.ih, 0]);
    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickFormat(hm).tickSize(-f.iw))
      .call((a) => axisStyle(a, c));
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(8)
          .tickFormat((v) => fmtNum(v))
          .tickSize(-f.ih),
      )
      .call((a) => axisStyle(a, c));
    g.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", f.ih).attr("stroke", c.axis);
    label(g, x(-xMax) + 2, f.ih + 38, "← vent de face, km/h", { color: c.ink2, weight: 500, size: 12 });
    label(g, x(xMax) - 2, f.ih + 38, "vent arrière, km/h →", {
      anchor: "end",
      color: c.ink2,
      weight: 500,
      size: 12,
    });
    g.append("g")
      .selectAll("circle")
      .data(pts)
      .join("circle")
      .attr("cx", (p) => x(p.w))
      .attr("cy", (p) => y(p.dur))
      .attr("r", 2.4)
      .attr("fill", (p) => c[p.dir])
      .attr("fill-opacity", 0.45);
    for (const [dir, k] of [
      ["east", "e"],
      ["west", "w"],
    ]) {
      const ws = pts.filter((p) => p.dir === dir).map((p) => p.w);
      const [a, b] = d3.extent(ws);
      const yy = (w) => y(fit[k].icpt + (fit[k].slope / 10) * w);
      g.append("line")
        .attr("x1", x(a))
        .attr("x2", x(b))
        .attr("y1", yy(a))
        .attr("y2", yy(b))
        .attr("stroke", c.paper)
        .attr("stroke-width", 5);
      g.append("line")
        .attr("x1", x(a))
        .attr("x2", x(b))
        .attr("y1", yy(a))
        .attr("y2", yy(b))
        .attr("stroke", c[dir])
        .attr("stroke-width", 2.4);
      const tx = dir === "east" ? x(b) : x(a);
      label(
        g,
        tx,
        yy(dir === "east" ? b : a) + (dir === "east" ? -16 : -14),
        dir === "east" ? "Vers Paris" : "Vers New York",
        {
          anchor: dir === "east" ? "end" : "start",
          color: c[dir],
          halo: c.paper,
        },
      );
    }
    const delaunay = d3.Delaunay.from(
      pts,
      (p) => x(p.w),
      (p) => y(p.dur),
    );
    const ring = g
      .append("circle")
      .attr("r", 6)
      .attr("fill", "none")
      .attr("stroke", c.ink)
      .attr("opacity", 0);
    g.append("rect")
      .attr("width", f.iw)
      .attr("height", f.ih)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx, my] = d3.pointer(ev);
        const p = pts[delaunay.find(mx, my)];
        ring.attr("cx", x(p.w)).attr("cy", y(p.dur)).attr("opacity", 1);
        showTip(ev, longDate(p.d), [
          {
            color: c[p.dir],
            value: hm(p.dur),
            label: `${p.dir === "east" ? "vers Paris" : "vers New York"}, médiane de ${p.n} vols`,
          },
          { value: kmh(Math.abs(p.w)), label: p.w >= 0 ? "de vent arrière" : "de vent de face" },
        ]);
      })
      .on("pointerleave", () => {
        ring.attr("opacity", 0);
        hideTip();
      });
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ calendar strip of the explorer */
export function dayStrip(node, days, onPick) {
  let picked = null;
  const byYear = d3.group(days, (d) => d[0].slice(0, 4));
  const gain = (d) => d[3] - d[4];
  // colours from the node: the strip sits on the dark explorer band
  const cs = () => getComputedStyle(node);
  const v = (k) => cs().getPropertyValue(k).trim();
  const draw = () => {
    const c = { muted: v("--strip-ink"), ink: v("--strip-mark"), west: v("--strip-hi") };
    const color = d3
      .scaleSequential([0, 60], (t) => d3.interpolateRgb(v("--strip-lo"), v("--strip-hi"))(Math.sqrt(t)))
      .clamp(true);
    const width = node.clientWidth || 640;
    const left = 38;
    const rowH = 18;
    const f = frame(node, byYear.size * (rowH + 6) + 22, { top: 2, right: 2, bottom: 20, left });
    const x = d3
      .scaleLinear()
      .domain([0, 366])
      .range([0, width - left - 2]);
    const g = f.svg.append("g").attr("transform", `translate(${left},2)`);
    [...byYear.keys()].forEach((yr, r) => {
      const row = g.append("g").attr("transform", `translate(0,${r * (rowH + 6)})`);
      label(row, -6, rowH - 5, yr, { anchor: "end", color: c.muted, weight: 500, size: 12 });
      row
        .selectAll("rect")
        .data(byYear.get(yr))
        .join("rect")
        .attr("x", (d) => x(d3.timeDay.count(d3.timeYear(new Date(d[0])), new Date(d[0]))))
        .attr("width", Math.max(1, x(1) - x(0)))
        .attr("height", rowH)
        .attr("fill", (d) => color(gain(d)))
        .attr("data-day", (d) => d[0]);
    });
    const months = d3.range(12).map((m) => d3.timeDay.count(new Date(2019, 0, 1), new Date(2019, m, 1)));
    g.append("g")
      .attr("transform", `translate(0,${byYear.size * (rowH + 6)})`)
      .selectAll("text")
      .data(months)
      .join("text")
      .attr("x", (d) => x(d) + 2)
      .attr("y", 10)
      .attr("font-size", 11)
      .attr("fill", c.muted)
      .text((d, i) => (width < 520 && i % 2 ? "" : monthShort(i + 1)));
    const mark = g
      .append("rect")
      .attr("class", "strip-mark")
      .attr("fill", "none")
      .attr("stroke", c.ink)
      .attr("stroke-width", 2)
      .attr("height", rowH + 4);
    const show = (iso) => {
      const yr = iso.slice(0, 4);
      const r = [...byYear.keys()].indexOf(yr);
      if (r < 0) return;
      const i = d3.timeDay.count(d3.timeYear(new Date(iso)), new Date(iso));
      mark
        .attr("x", x(i) - 2)
        .attr("y", r * (rowH + 6) - 2)
        .attr("width", Math.max(4, x(1) - x(0)) + 4);
    };
    g.append("rect")
      .attr("width", x(366))
      .attr("height", byYear.size * (rowH + 6))
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("pointermove", (ev) => {
        const [mx, my] = d3.pointer(ev);
        const yr = [...byYear.keys()][Math.min(byYear.size - 1, Math.max(0, Math.floor(my / (rowH + 6))))];
        const i = Math.max(0, Math.min(365, Math.floor(x.invert(mx))));
        const d = byYear.get(yr)[Math.min(i, byYear.get(yr).length - 1)];
        showTip(ev, longDate(d[0]), [
          {
            color: c.west,
            value: `${hm(d[3])} → ${hm(d[4])}`,
            label: "vers New York, ligne droite puis meilleure route",
          },
        ]);
      })
      .on("pointerleave", hideTip)
      .on("click", (ev) => {
        const [mx, my] = d3.pointer(ev);
        const yr = [...byYear.keys()][Math.min(byYear.size - 1, Math.max(0, Math.floor(my / (rowH + 6))))];
        const i = Math.max(0, Math.min(365, Math.floor(x.invert(mx))));
        const d = byYear.get(yr)[Math.min(i, byYear.get(yr).length - 1)];
        onPick(d[0]);
      });
    if (picked) show(picked);
    node._show = show;
  };
  draw();
  onResize(node, draw);
  return {
    select(iso) {
      picked = iso;
      node._show?.(iso);
    },
  };
}

/* ------------------------------------------------------------------ mean gain by calendar month */
export function gainsChart(node, days) {
  const byMonth = d3.range(1, 13).map((m) => {
    const ds = days.filter((d) => +d[0].slice(5, 7) === m);
    return { m, e: d3.mean(ds, (d) => d[1] - d[2]), w: d3.mean(ds, (d) => d[3] - d[4]) };
  });
  const draw = () => {
    const c = C();
    const f = frame(node, 260, { top: 26, right: 8, bottom: 26, left: 40 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const x0 = d3
      .scaleBand()
      .domain(byMonth.map((d) => d.m))
      .range([0, f.iw])
      .paddingInner(0.25);
    const x1 = d3.scaleBand().domain(["w", "e"]).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(d3.max(byMonth, (d) => d.w) / 5) * 5])
      .range([f.ih, 0]);
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((v) => `${v}`)
          .tickSize(-f.iw),
      )
      .call((a) => axisStyle(a, c));
    label(g, -36, -12, "minutes gagnées", { color: c.muted, weight: 500, size: 12 });
    for (const k of ["w", "e"])
      g.selectAll(`.b${k}`)
        .data(byMonth)
        .join("rect")
        .attr("x", (d) => x0(d.m) + x1(k))
        .attr("width", x1.bandwidth())
        .attr("y", (d) => y(d[k]))
        .attr("height", (d) => f.ih - y(d[k]))
        .attr("fill", k === "w" ? c.west : c.east)
        .on("pointermove", (ev, d) =>
          showTip(ev, monthName(d.m), [
            { color: c.west, value: minutes(d.w, 1), label: "vers New York" },
            { color: c.east, value: minutes(d.e, 1), label: "vers Paris" },
          ]),
        )
        .on("pointerleave", hideTip);
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(
        d3
          .axisBottom(x0)
          .tickFormat((m) => monthShort(m).replace(".", "")[0].toUpperCase())
          .tickSize(0)
          .tickPadding(8),
      )
      .call((a) => axisStyle(a, c));
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ the round trip */
export function roundTripChart(node, routing) {
  const s = routing.summary;
  const rows = [
    { key: "Sans vent", w: routing.nowind, e: routing.nowind },
    { key: "Ligne droite, vents réels", w: s.gc_w, e: s.gc_e },
    { key: "Meilleure route chaque jour", w: s.opt_w, e: s.opt_e },
  ];
  const draw = () => {
    const c = C();
    const narrow = (node.clientWidth || 640) < 560;
    const left = narrow ? 0 : 210;
    const rowH = narrow ? 64 : 46;
    const f = frame(node, rows.length * rowH + 10, { top: 4, right: 74, bottom: 6, left });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r) => r.w + r.e)])
      .range([0, f.iw]);
    rows.forEach((r, i) => {
      const top = i * rowH + (narrow ? 20 : 8);
      label(g, narrow ? 0 : -12, narrow ? top - 6 : top + 19, r.key, {
        anchor: narrow ? "start" : "end",
        color: c.ink2,
        weight: 500,
        size: 13,
      });
      g.append("rect")
        .attr("x", 0)
        .attr("y", top)
        .attr("width", x(r.w))
        .attr("height", 28)
        .attr("fill", c.west);
      g.append("rect")
        .attr("x", x(r.w))
        .attr("y", top)
        .attr("width", x(r.e))
        .attr("height", 28)
        .attr("fill", c.east);
      for (const [x0, v] of [
        [x(r.w) / 2, r.w],
        [x(r.w) + x(r.e) / 2, r.e],
      ])
        label(g, x0, top + 19, hm(v), { anchor: "middle", color: "#fff", size: 12 });
      label(g, x(r.w + r.e) + 8, top + 19, hm(r.w + r.e), { color: c.ink, size: 14, weight: 750 });
    });
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ winters since 1949, with the NAO */
export function wintersChart(node, climate) {
  const rows = climate.winters;
  const draw = () => {
    const c = C();
    const f = frame(node, 390, { top: 26, right: 10, bottom: 26, left: 44 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const h1 = Math.round(f.ih * 0.62);
    const gap = 24;
    const h2 = f.ih - h1 - gap;
    const x = d3
      .scaleBand()
      .domain(rows.map((r) => r.y))
      .range([0, f.iw])
      .paddingInner(0.2);
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(d3.max(rows, (r) => r.w) / 25) * 25])
      .range([h1, 0]);
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(-f.iw))
      .call((a) => axisStyle(a, c));
    label(g, -40, -14, "km/h", { color: c.muted, weight: 500, size: 11 });
    const lastFull = rows.at(-1).y;
    g.selectAll(".w")
      .data(rows)
      .join("rect")
      .attr("x", (r) => x(r.y))
      .attr("width", x.bandwidth())
      .attr("y", (r) => y(r.w))
      .attr("height", (r) => h1 - y(r.w))
      .attr("fill", c.east)
      .attr("fill-opacity", (r) => (r.y < 1979 ? 0.4 : 0.85));
    g.append("line")
      .attr("x1", 0)
      .attr("x2", f.iw)
      .attr("y1", y(climate.mean))
      .attr("y2", y(climate.mean))
      .attr("stroke", c.ink)
      .attr("stroke-dasharray", "4 3");
    label(g, 4, y(climate.mean) - 6, `moyenne 1991-2020 : ${kmh(climate.mean)}`, {
      color: c.ink,
      size: 12,
      halo: c.paper,
    });
    // NAO
    const g2 = g.append("g").attr("transform", `translate(0,${h1 + gap})`);
    const ext = d3.max(rows, (r) => Math.abs(r.nao ?? 0));
    const y2 = d3.scaleLinear().domain([-ext, ext]).range([h2, 0]);
    g2.selectAll("rect")
      .data(rows.filter((r) => r.nao !== null))
      .join("rect")
      .attr("x", (r) => x(r.y))
      .attr("width", x.bandwidth())
      .attr("y", (r) => Math.min(y2(0), y2(r.nao)))
      .attr("height", (r) => Math.abs(y2(r.nao) - y2(0)))
      .attr("fill", (r) => (r.nao >= 0 ? c.ink2 : c.muted))
      .attr("fill-opacity", (r) => (r.nao >= 0 ? 0.8 : 0.4));
    g2.append("line")
      .attr("x1", 0)
      .attr("x2", f.iw)
      .attr("y1", y2(0))
      .attr("y2", y2(0))
      .attr("stroke", c.axis);
    label(g2, -40, y2(ext) + 10, "NAO", { color: c.muted, weight: 650, size: 11 });
    label(g2, -40, y2(ext) + 24, "+", { color: c.muted, weight: 650, size: 12 });
    label(g2, -40, y2(-ext), "−", { color: c.muted, weight: 650, size: 12 });
    const years = rows.map((r) => r.y).filter((yy) => yy % 10 === 0 || yy === lastFull);
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(d3.axisBottom(x).tickValues(years).tickSize(0).tickPadding(8))
      .call((a) => axisStyle(a, c));
    g.append("rect")
      .attr("width", f.iw)
      .attr("height", f.ih)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx] = d3.pointer(ev);
        const r = rows[Math.max(0, Math.min(rows.length - 1, Math.floor(mx / x.step())))];
        showTip(ev, `Hiver ${winter(r.y)}`, [
          { color: c.east, value: kmh(r.w), label: "vent arrière moyen, New York → Paris" },
          { value: r.nao === null ? "–" : fmtNum(r.nao, 2), label: "indice NAO moyen" },
        ]);
      })
      .on("pointerleave", hideTip);
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Hiver", "Vent arrière (km/h)", "NAO"],
    rows: rows.map((r) => [winter(r.y), fmtNum(r.w), r.nao === null ? "–" : fmtNum(r.nao, 2)]),
  });
}

/* ------------------------------------------------------------------ Trappes: the year in the balloons */
export function trappesMonths(node, months) {
  const draw = () => {
    const c = C();
    const f = frame(node, 310, { top: 26, right: 10, bottom: 26, left: 44 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const x = d3
      .scalePoint()
      .domain(months.map((d) => d.m))
      .range([0, f.iw])
      .padding(0.4);
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(d3.max(months, (d) => d.p90) / 50) * 50])
      .range([f.ih, 0]);
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-f.iw))
      .call((a) => axisStyle(a, c));
    label(g, -40, -14, "km/h", { color: c.muted, weight: 500, size: 11 });
    const band = (lo, hi) =>
      d3
        .area()
        .curve(d3.curveMonotoneX)
        .x((d) => x(d.m))
        .y0((d) => y(d[lo]))
        .y1((d) => y(d[hi]));
    g.append("path")
      .datum(months)
      .attr("d", band("p10", "p90"))
      .attr("fill", c.east)
      .attr("fill-opacity", 0.14);
    g.append("path")
      .datum(months)
      .attr("d", band("p25", "p75"))
      .attr("fill", c.east)
      .attr("fill-opacity", 0.26);
    g.append("path")
      .datum(months)
      .attr(
        "d",
        d3
          .line()
          .curve(d3.curveMonotoneX)
          .x((d) => x(d.m))
          .y((d) => y(d.p50)),
      )
      .attr("fill", "none")
      .attr("stroke", c.east)
      .attr("stroke-width", 2.4);
    const jan = months[0];
    label(g, x(1) + 6, y(jan.p90) - 6, "1 sondage sur 10 au-dessus", {
      color: c.ink2,
      weight: 500,
      size: 12,
      halo: c.paper,
    });
    label(g, x(1) + 6, y(jan.p50) - 8, "médiane", { color: c.ink, size: 12 });
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((m) => monthShort(m).replace(".", "")[0].toUpperCase())
          .tickSize(0)
          .tickPadding(8),
      )
      .call((a) => axisStyle(a, c));
    g.append("rect")
      .attr("width", f.iw)
      .attr("height", f.ih)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx] = d3.pointer(ev);
        const d = months[d3.minIndex(months, (r) => Math.abs(x(r.m) - mx))];
        showTip(ev, monthName(d.m), [
          { value: kmh(d.p50), label: "vent médian" },
          { value: `${kmh(d.p25)} – ${kmh(d.p75)}`, label: "la moitié des sondages" },
          { value: kmh(d.p90), label: "dépassé 1 fois sur 10" },
        ]);
      })
      .on("pointerleave", hideTip);
  };
  draw();
  onResize(node, draw);
}

export function trappesYears(node, years) {
  const rows = years.map((d) => ({ ...d, share: (100 * d.strong) / d.n }));
  const draw = () => {
    const c = C();
    const f = frame(node, 300, { top: 14, right: 10, bottom: 26, left: 36 });
    const g = f.svg.append("g").attr("transform", `translate(${f.m.left},${f.m.top})`);
    const x = d3
      .scaleBand()
      .domain(rows.map((r) => r.y))
      .range([0, f.iw])
      .paddingInner(0.2);
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(d3.max(rows, (r) => r.share) / 2) * 2])
      .range([f.ih, 0]);
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((v) => `${v} %`)
          .tickSize(-f.iw),
      )
      .call((a) => axisStyle(a, c));
    g.selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", (r) => x(r.y))
      .attr("width", x.bandwidth())
      .attr("y", (r) => y(r.share))
      .attr("height", (r) => f.ih - y(r.share))
      .attr("fill", c.east)
      .attr("fill-opacity", 0.8)
      .on("pointermove", (ev, r) =>
        showTip(ev, String(r.y), [{ value: `${r.strong} sur ${r.n}`, label: "sondages à 200 km/h ou plus" }]),
      )
      .on("pointerleave", hideTip);
    g.append("g")
      .attr("transform", `translate(0,${f.ih})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(rows.map((r) => r.y).filter((yy) => yy % 10 === 0))
          .tickSize(0)
          .tickPadding(8),
      )
      .call((a) => axisStyle(a, c));
  };
  draw();
  onResize(node, draw);
  dataTable(node, {
    head: ["Année", "Sondages", "200 km/h ou plus"],
    rows: rows.map((r) => [String(r.y), fmtNum(r.n), fmtNum(r.strong)]),
  });
}

export { el };
