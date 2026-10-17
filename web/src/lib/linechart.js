import * as d3 from "d3";
import { showTip, hideTip, placeTip, onResize } from "./ui.js";
import { isNum } from "./series.js";

/**
 * Multi-series time chart with crosshair, one tooltip for every series, event rules,
 * direct end labels and keyboard navigation (← → on the focused chart).
 *
 * opts = {
 *   dates: Date[],                       shared x positions
 *   series: [{key, label, color, values, dashed, width}],
 *   xDomain: [Date, Date], yFormat: v => string, tipFormat: v => string,
 *   title: i => string, baseline: number|null, events: [{date: Date, label}],
 *   height, yZero: bool, endLabels: bool, area: key|null
 * }
 */
export function lineChart(node, initial) {
  let opts = { height: 360, endLabels: true, events: [], baseline: null, yZero: false, ...initial };
  let width = node.clientWidth || 800;
  let focusIndex = null;
  // draw-in animation the first time the chart scrolls into view (opts.animate)
  let revealed = !initial.animate;
  let pendingReveal = null;
  const svg = d3.select(node).append("svg");

  function render() {
    const narrow = width < 560;
    const visible = opts.series.filter((s) => s.values.some(isNum));
    const showEnd = opts.endLabels && !narrow && visible.length <= 5;
    const eventsIn = opts.events.filter((e) => e.date >= opts.xDomain[0] && e.date <= opts.xDomain[1]);
    const margin = { top: 14, right: showEnd ? 128 : 14, bottom: 26, left: 52 };

    const x = d3
      .scaleUtc()
      .domain(opts.xDomain)
      .range([margin.left, width - margin.right]);

    // event label rows (avoid collisions)
    const rows = [];
    const placed = eventsIn
      .map((e) => ({ ...e, label: narrow && e.short ? e.short : e.label, x: x(e.date) }))
      .sort((a, b) => a.x - b.x)
      .map((e) => {
        const w = e.label.length * 6.1 + 10;
        const flip = e.x + w > width - 4; // would overflow: anchor the label to the left of its rule
        const x0 = flip ? e.x - w : e.x;
        let r = rows.findIndex((endX) => x0 > endX);
        if (r === -1) {
          rows.push(0);
          r = rows.length - 1;
        }
        rows[r] = x0 + w;
        return { ...e, row: r, flip };
      });
    margin.top += rows.length * 15;
    const height = opts.height + rows.length * 15;

    const idx = opts.dates
      .map((d, i) => (d >= opts.xDomain[0] && d <= opts.xDomain[1] ? i : -1))
      .filter((i) => i >= 0);
    const vals = visible.flatMap((s) => idx.map((i) => s.values[i]).filter(isNum));
    let [lo, hi] = d3.extent(vals.length ? vals : [0, 1]);
    if (opts.baseline !== null) {
      lo = Math.min(lo, opts.baseline);
      hi = Math.max(hi, opts.baseline);
    }
    if (opts.yZero) lo = Math.min(0, lo);
    const pad = (hi - lo) * 0.06 || 1;
    const y = d3
      .scaleLinear()
      .domain([opts.yZero && lo >= 0 ? 0 : lo - pad, hi + pad])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("height", height);
    svg.selectAll("*").remove();

    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(narrow ? 4 : 6)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(narrow ? 4 : 6)
          .tickFormat(opts.yFormat)
          .tickSize(0)
          .tickPadding(8),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(narrow ? 4 : 9)
          .tickFormat(d3.utcFormat("%Y"))
          .tickSizeOuter(0),
      );

    if (opts.baseline !== null) {
      svg
        .append("line")
        .attr("class", "ref-line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(opts.baseline))
        .attr("y2", y(opts.baseline));
    }

    const ev = svg.append("g").selectAll("g").data(placed).join("g").attr("class", "event");
    ev.append("line")
      .attr("x1", (d) => d.x)
      .attr("x2", (d) => d.x)
      .attr("y1", (d) => 14 + d.row * 15 + 4)
      .attr("y2", height - margin.bottom);
    ev.append("text")
      .attr("x", (d) => (d.flip ? d.x - 4 : d.x + 4))
      .attr("text-anchor", (d) => (d.flip ? "end" : "start"))
      .attr("y", (d) => 14 + d.row * 15)
      .text((d) => d.label);

    const line = d3
      .line()
      .defined((d) => isNum(d[1]))
      .x((d) => x(d[0]))
      .y((d) => y(d[1]));

    const g = svg.append("g");
    if (opts.band) {
      // shaded gap between two series (e.g. passengers vs flights)
      const A = opts.series.find((s) => s.key === opts.band.a);
      const B = opts.series.find((s) => s.key === opts.band.b);
      if (A && B) {
        const area = d3
          .area()
          .defined((i) => isNum(A.values[i]) && isNum(B.values[i]))
          .x((i) => x(opts.dates[i]))
          .y0((i) => y(B.values[i]))
          .y1((i) => y(A.values[i]));
        g.append("path").attr("d", area(idx)).style("fill", opts.band.color).style("opacity", 0.5);
        if (opts.band.label) {
          const k = idx[Math.floor(idx.length * 0.82)];
          if (isNum(A.values[k]) && isNum(B.values[k]))
            g.append("text")
              .attr("class", "end-label")
              .attr("x", x(opts.dates[k]))
              .attr("y", (y(A.values[k]) + y(B.values[k])) / 2 + 4)
              .attr("text-anchor", "middle")
              .text(opts.band.label);
        }
      }
    }
    const drawn = [];
    for (const s of visible) {
      const pts = idx.map((i) => [opts.dates[i], s.values[i]]);
      drawn.push(
        g
          .append("path")
          .attr("class", "series-line")
          .attr("d", line(pts))
          .style("stroke", s.color)
          .style("stroke-width", s.width || 2)
          .style("stroke-dasharray", s.dashed ? "5 4" : null),
      );
    }
    if (!revealed) {
      for (const p of drawn) {
        if (p.style("stroke-dasharray") !== "none" && p.style("stroke-dasharray")) continue;
        const L = p.node().getTotalLength?.() || 0;
        p.style("stroke-dasharray", `${L} ${L}`).style("stroke-dashoffset", L);
      }
      pendingReveal = () => {
        revealed = true;
        for (const p of drawn)
          p.transition()
            .duration(1600)
            .ease(d3.easeCubicOut)
            .style("stroke-dashoffset", 0)
            .on("end", function () {
              if (!d3.select(this).attr("data-dashed")) d3.select(this).style("stroke-dasharray", null);
            });
      };
    }

    if (showEnd) {
      const ends = visible
        .map((s) => {
          const i = [...idx].reverse().find((j) => isNum(s.values[j]));
          return i === undefined ? null : { s, x: x(opts.dates[i]), y: y(s.values[i]) };
        })
        .filter(Boolean)
        .sort((a, b) => a.y - b.y);
      for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 15);
      svg
        .append("g")
        .selectAll("text")
        .data(ends)
        .join("text")
        .attr("class", "end-label")
        .attr("x", (d) => d.x + 8)
        .attr("y", (d) => d.y + 4)
        .text((d) => d.s.label);
    }

    // crosshair layer
    const cross = svg.append("g").style("display", "none");
    cross
      .append("line")
      .attr("class", "crosshair")
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom);
    const dots = cross
      .selectAll("circle")
      .data(visible)
      .join("circle")
      .attr("r", 4.5)
      .style("fill", (s) => s.color)
      .style("stroke", "var(--surface)")
      .style("stroke-width", 2);

    const showAt = (i, event) => {
      if (i === null || i === undefined) return;
      focusIndex = i;
      const cx = x(opts.dates[i]);
      cross.style("display", null);
      cross.select("line").attr("x1", cx).attr("x2", cx);
      dots
        .attr("cx", cx)
        .attr("cy", (s) => (isNum(s.values[i]) ? y(s.values[i]) : -99))
        .style("display", (s) => (isNum(s.values[i]) ? null : "none"));
      const rowsTip = visible
        .filter((s) => isNum(s.values[i]))
        .sort((a, b) => b.values[i] - a.values[i])
        .map((s) => ({
          label: s.label,
          value: opts.tipFormat(s.values[i]),
          color: s.color,
          dashed: s.dashed,
        }));
      if (!rowsTip.length) return;
      showTip(event, opts.title(i), rowsTip);
    };

    const nearest = (px) => {
      const d = x.invert(px);
      let best = null;
      let bd = Infinity;
      for (const i of idx) {
        const dd = Math.abs(opts.dates[i] - d);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      return best;
    };

    svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", Math.max(0, width - margin.left - margin.right))
      .attr("height", Math.max(0, height - margin.top - margin.bottom))
      .attr("fill", "transparent")
      .style("touch-action", "pan-y")
      .on("pointermove", (event) => showAt(nearest(d3.pointer(event)[0]), event))
      .on("pointerleave", () => {
        cross.style("display", "none");
        hideTip();
      });

    node.onkeydown = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const pos = focusIndex === null ? idx.length - 1 : Math.max(0, idx.indexOf(focusIndex));
      const next = idx[Math.min(idx.length - 1, Math.max(0, pos + (e.key === "ArrowRight" ? 1 : -1)))];
      const box = node.getBoundingClientRect();
      showAt(next, { clientX: box.left + x(opts.dates[next]), clientY: box.top + margin.top + 20 });
    };
    node.onblur = () => {
      cross.style("display", "none");
      hideTip();
    };
  }

  onResize(node, (w) => {
    width = w;
    render();
  });
  render();
  if (!revealed) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            revealed = true;
            render();
          } else pendingReveal?.();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
  }
  return {
    update(next) {
      opts = { ...opts, ...next };
      render();
    },
  };
}

export { placeTip };
