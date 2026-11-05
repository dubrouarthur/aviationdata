// The illustrated figures of « Le ciel, modèle par modèle »: the distances as a strip of aircraft along one
// axis (`swarm`), a day in the life of an aircraft (`dayStrips`) and two models overlaid to scale
// (`overlay`). Drawings from plane.js; every figure keeps its table (dataTable) for who does not read charts.
import * as d3 from "d3";
import { el, dataTable, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { GROUPS } from "./charts.js";
import { plane, planeIcon, planeInG, dimsOf } from "./plane.js";

const color = (g) => GROUPS.find((x) => x.key === g).color;
const m1 = (v) => `${fmtNum(v, 1)} m`;

/**
 * The models along a logarithmic axis of distance, one small aircraft each, stacked where they crowd.
 * rows: [{code, label, value, group, kindFr}]; refs: [{label, km}] landmarks drawn across the strip.
 * Pointer, touch or the arrow keys pick a model: its card, under the strip, gives its distance and its
 * drawing to scale.
 */
export function swarm(node, rows, { label, fmt, refs = [], start, head }) {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  let sel = Math.max(
    0,
    sorted.findIndex((r) => r.code === start),
  );
  const card = el("div", { class: "av-sw-card", "aria-live": "polite" });
  const plot = el("div", { class: "av-sw-plot" });
  node.replaceChildren(plot, card);

  let marks = [];
  const showCard = () => {
    const r = sorted[sel];
    const d = dimsOf(r.code);
    card.replaceChildren(
      el("div", { class: "av-sw-txt" }, [
        el("b", { text: r.label }),
        el("span", { text: r.kindFr }),
        el("p", {}, [
          "Vol médian : ",
          el("strong", { class: "num", text: fmt(r.value) }),
          ". La moitié de ses vols sont plus courts, l'autre moitié plus longs.",
        ]),
        d
          ? el("small", { text: `Longueur ${m1(d.len)}, envergure ${m1(d.span)}. Dessin à l'échelle.` })
          : null,
      ]),
      el(
        "div",
        { class: "av-sw-draw", "aria-hidden": "true" },
        plane(r.code, { scale: 2.4, color: color(r.group) }),
      ),
    );
    marks.forEach((m, i) => m.classed("on", i === sel));
  };

  const draw = (width) => {
    const narrow = width < 620;
    const W = Math.max(300, width);
    const size = narrow ? 20 : 26; // icon box
    const step = size * 0.92;
    const x = d3
      .scaleLog()
      .domain([120, 12500])
      .range([size / 2 + 4, W - size / 2 - 4]);
    // greedy stacking: each model, shortest first, on the first free level around the middle
    const levels = [];
    const placed = sorted.map((r) => {
      const px = x(r.value);
      for (let k = 0; ; k++) {
        const lv = k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2;
        const used = levels.filter((l) => l.lv === lv);
        if (used.every((l) => Math.abs(l.px - px) >= size * 0.95)) {
          levels.push({ lv, px });
          return { r, px, lv };
        }
      }
    });
    const lo = Math.min(...placed.map((p) => p.lv));
    const hi = Math.max(...placed.map((p) => p.lv));
    const top = 46;
    const H = top + (hi - lo + 1) * step + 64;
    const yOf = (lv) => top + (lv - lo) * step + step / 2;

    plot.replaceChildren();
    const svg = d3
      .select(plot)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("role", "img")
      .attr("aria-label", label);
    // landmarks: a dashed line across the strip, its name at the top
    const rg = svg.append("g").attr("class", "av-sw-refs");
    refs.forEach((f, i) => {
      rg.append("line")
        .attr("x1", x(f.km))
        .attr("x2", x(f.km))
        .attr("y1", 30)
        .attr("y2", H - 34);
      rg.append("text")
        .attr("x", x(f.km))
        .attr("y", i % 2 && narrow ? 24 : 14)
        .attr("text-anchor", "middle")
        .text(narrow ? f.short : f.label);
      if (!narrow || i % 2 === 0)
        rg.append("text")
          .attr("class", "av-sw-ref-km")
          .attr("x", x(f.km))
          .attr("y", narrow ? 24 : 26)
          .attr("text-anchor", "middle")
          .text(narrow ? "" : fmt(f.km));
    });
    // axis
    const ticks = narrow ? [200, 1000, 5000] : [200, 500, 1000, 2000, 5000, 10000];
    const ax = svg.append("g").attr("class", "av-sw-axis");
    ax.append("line")
      .attr("x1", x.range()[0])
      .attr("x2", x.range()[1])
      .attr("y1", H - 30)
      .attr("y2", H - 30);
    ax.selectAll("text")
      .data(ticks)
      .join("text")
      .attr("class", "c-tick")
      .attr("x", x)
      .attr("y", H - 12)
      .attr("text-anchor", "middle")
      .text((t) => fmt(t));
    ax.selectAll("line.t")
      .data(ticks)
      .join("line")
      .attr("class", "t")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", H - 34)
      .attr("y2", H - 26);
    // the aircraft
    marks = placed.map((p, i) => {
      const g = svg
        .append("g")
        .attr("class", "av-sw-p")
        .attr("transform", `translate(${p.px},${yOf(p.lv)})`);
      g.append("circle")
        .attr("class", "av-sw-ring")
        .attr("r", size * 0.62);
      if (!planeInG(g.node(), p.r.code, size, color(p.r.group)))
        g.append("circle")
          .attr("r", size / 4)
          .style("fill", color(p.r.group));
      g.append("circle")
        .attr("class", "av-sw-hit")
        .attr("r", size * 0.62)
        .on("pointerenter", (ev) => {
          sel = i;
          showCard();
          showTip(ev, p.r.label, [{ label: "vol médian", value: fmt(p.r.value) }]);
        })
        .on("pointermove", (ev) => showTip(ev, p.r.label, [{ label: "vol médian", value: fmt(p.r.value) }]))
        .on("pointerleave", hideTip)
        .on("click", () => {
          sel = i;
          showCard();
        });
      return g;
    });
    // the shortest and the longest, named at the ends
    for (const [p, anchor, dx] of [
      [placed[0], "start", -size / 2],
      [placed.at(-1), "end", size / 2],
    ])
      svg
        .append("text")
        .attr("class", "av-sw-end")
        .attr("x", p.px + dx)
        .attr("y", yOf(hi) + step / 2 + 14)
        .attr("text-anchor", anchor)
        .text(`${p.r.label}, ${fmt(p.r.value)}`);
    showCard();
  };
  node.addEventListener("keydown", (ev) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
    if (k) sel = Math.min(sorted.length - 1, Math.max(0, sel + k));
    else if (ev.key === "Home") sel = 0;
    else if (ev.key === "End") sel = sorted.length - 1;
    else return;
    ev.preventDefault();
    showCard();
  });
  onResize(node, draw);
  draw(node.clientWidth || 700);
  dataTable(node, { head: head ?? ["Modèle", "Valeur"], rows: sorted.map((r) => [r.label, fmt(r.value)]) });
}

/**
 * A day in the life of each model's median aircraft: its flights of the day, each as long as the model's
 * median flight, spread evenly over 24 hours (a diagram, not a timetable). The last flight, when the
 * aircraft makes it only some days, is drawn light. rows: [{code, label, note, group, perDay, dur}].
 */
export function dayStrips(node, rows, { label, hm }) {
  const DAY = 24 * 60;
  node.replaceChildren(
    el("div", { class: "av-day-head", "aria-hidden": "true" }, [
      el("span"),
      el(
        "span",
        { class: "av-day-ruler" },
        [0, 6, 12, 18, 24].map((h) =>
          el("i", { style: `left:${((h / 24) * 100).toFixed(2)}%`, text: `${h} h` }),
        ),
      ),
      el("span"),
    ]),
    el(
      "ol",
      { class: "av-day", "aria-label": label },
      rows.map((r) => {
        const full = Math.floor(r.perDay + 1e-9);
        const frac = r.perDay - full;
        const k = full + (frac >= 0.05 ? 1 : 0);
        const gap = Math.max(0, (DAY - k * r.dur) / k);
        const blocks = Array.from({ length: k }, (_, i) => {
          const x0 = gap / 2 + i * (r.dur + gap);
          return el("i", {
            class: i >= full ? "some" : "",
            style: `left:${((x0 / DAY) * 100).toFixed(2)}%;width:${((Math.min(r.dur, DAY - x0) / DAY) * 100).toFixed(2)}%;--c:${color(r.group)}`,
          });
        });
        const air = r.perDay * r.dur;
        const li = el("li", { tabindex: "0" }, [
          el("span", { class: "av-day-l" }, [
            el(
              "span",
              { class: "av-day-ic", "aria-hidden": "true" },
              planeIcon(r.code, 26, { color: color(r.group) }),
            ),
            el("span", {}, [r.label, el("small", { text: r.note })]),
          ]),
          el("span", { class: "av-day-track" }, blocks),
          el("span", { class: "av-day-v" }, [
            el("b", { text: `${fmtNum(r.perDay, 1)} vols` }),
            el("small", { text: `de ${hm(r.dur)}` }),
          ]),
        ]);
        const tip = (ev) =>
          showTip(ev, r.label, [
            { label: "vols par jour de vol", value: fmtNum(r.perDay, 1) },
            { label: "vol médian", value: hm(r.dur) },
            { label: "en vol par jour, environ", value: hm(air) },
          ]);
        li.addEventListener("pointermove", tip);
        li.addEventListener("pointerleave", hideTip);
        li.addEventListener("focus", () => tip({ anchor: li.querySelector(".av-day-track") }));
        li.addEventListener("blur", hideTip);
        return li;
      }),
    ),
  );
  dataTable(node, {
    head: ["Modèle", "Vols par jour de vol", "Vol médian", "En vol par jour, environ"],
    rows: rows.map((r) => [r.label, fmtNum(r.perDay, 1), hm(r.dur), hm(r.perDay * r.dur)]),
  });
}

/** Two models overlaid to scale, centred on each other: the first filled, the second outlined. */
export function overlay(node, a, b, { nameA, nameB }) {
  const A = dimsOf(a);
  const B = dimsOf(b);
  if (!A || !B) {
    node.replaceChildren(
      el("p", {
        class: "note",
        text: "Les dimensions de l'un des deux modèles manquent à la base de la FAA : pas de dessin.",
      }),
    );
    return;
  }
  const L = Math.max(A.len, B.len);
  const S = Math.max(A.span, B.span);
  const scale = Math.min(6, 420 / L, ((node.clientWidth || 420) * 0.96) / L);
  const box = (code, cls) => {
    const svg = plane(code, { scale, cls, color: cls === "av-ov-a" ? "var(--blue)" : "var(--magenta)" });
    const d = dimsOf(code);
    // centre the drawing in the common box
    svg.style.left = `${(((L - d.len) / 2) * scale).toFixed(1)}px`;
    svg.style.top = `${(((S - d.span) / 2) * scale).toFixed(1)}px`;
    return svg;
  };
  node.replaceChildren(
    el("div", { class: "av-ov" }, [
      el(
        "div",
        {
          class: "av-ov-draw",
          role: "img",
          "aria-label": `${nameA} et ${nameB} superposés à la même échelle`,
          style: `width:${(L * scale).toFixed(1)}px;height:${(S * scale).toFixed(1)}px`,
        },
        [box(a, "av-ov-a"), box(b, "av-ov-b")],
      ),
      el("ul", { class: "av-ov-key" }, [
        el("li", { class: "a" }, [
          el("i"),
          el("b", { text: nameA }),
          ` ${m1(A.len)} de long, ${m1(A.span)} d'envergure`,
        ]),
        el("li", { class: "b" }, [
          el("i"),
          el("b", { text: nameB }),
          ` ${m1(B.len)} de long, ${m1(B.span)} d'envergure`,
        ]),
      ]),
    ]),
  );
}
