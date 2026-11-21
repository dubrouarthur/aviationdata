// @ts-check
// The figures of « Quand les avions heurtent-ils des oiseaux ? », all drawn with the chart kit (lib/chartkit.js,
// site/figures.css): the year as a clock on the night (opening), the hours of each month, each species' season,
// the height ladder, the flight profile, the struck parts on an airliner, the species by damage, and the reports
// against the damaging strikes. Blue for the data, magenta for what the text is about.
import * as d3 from "d3";
import { el, dataTable, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { frame, gridY, annotate, legend, rampKey, INK, SEQ, SEQ_NIGHT } from "../lib/chartkit.js";
import { MONTHS_FR, MONTHS_SHORT, NIGHT, FT, PHASES } from "./facts.js";

const n0 = (/** @type {number} */ v) => fmtNum(v, 0);
const pc = (/** @type {number} */ v, d = 0) => `${fmtNum(v * 100, d)} %`;
/** feet -> "300 m" (to the ten metres under 1 000, to the hundred above) */
const metres = (/** @type {number} */ ft) => {
  const m = ft * FT;
  return `${n0(m < 1000 ? Math.round(m / 10) * 10 : Math.round(m / 100) * 100)} m`;
};
const hour = (/** @type {number} */ h) => `${h} h`;

/**
 * The opening: the year as a clock. Each ring is a month (January inside), each sector an hour (midnight at the
 * top, clockwise); the brighter, the more strikes reported at that hour of that month.
 */
export function yearClock(node, B, { label }) {
  const max = Math.max(...B.clock.flat());
  frame(node, {
    label,
    min: 300,
    height: (W) => Math.min(W, 620),
    draw: (s, W, H, narrow) => {
      const R = Math.min(W, H) / 2 - (narrow ? 26 : 34);
      const r0 = R * 0.24;
      const ring = (R - r0) / 12;
      const g = s.append("g").attr("transform", `translate(${W / 2},${H / 2})`);
      const arc = d3.arc();
      for (let k = 0; k < 12; k++)
        for (let h = 0; h < 24; h++) {
          const v = B.clock[h][k];
          g.append("path")
            .attr(
              "d",
              arc({
                innerRadius: r0 + k * ring + 0.6,
                outerRadius: r0 + (k + 1) * ring - 0.6,
                startAngle: (h / 24) * 2 * Math.PI + 0.004,
                endAngle: ((h + 1) / 24) * 2 * Math.PI - 0.004,
              }),
            )
            .attr("fill", SEQ_NIGHT(Math.min(1, v / max) ** 0.7))
            .on("pointermove", (ev) =>
              showTip(ev, `${MONTHS_FR[k]}, de ${hour(h)} à ${hour((h + 1) % 24)}`, [
                { label: "Impacts déclarés", value: n0(v) },
              ]),
            )
            .on("pointerleave", hideTip);
        }
      // the hours around the dial
      for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
        const a = (h / 24) * 2 * Math.PI;
        g.append("text")
          .attr("class", "ck-tick ck-on-night")
          .attr("x", Math.sin(a) * (R + (narrow ? 14 : 18)))
          .attr("y", -Math.cos(a) * (R + (narrow ? 14 : 18)))
          .attr("dy", "0.32em")
          .attr("text-anchor", "middle")
          .text(hour(h));
      }
      // the months along the midnight ray
      for (const k of [0, 3, 6, 9, 11]) {
        g.append("text")
          .attr("class", "ck-tick ck-on-night bc-month")
          .attr("x", 4)
          .attr("y", -(r0 + (k + 0.5) * ring))
          .attr("dy", "0.32em")
          .text(MONTHS_SHORT[k]);
      }
      g.append("text")
        .attr("class", "bc-center")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .text("janvier");
      g.append("text")
        .attr("class", "bc-center")
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .text("au centre");
    },
  });
}

/** Chapter 1: months (columns) x hours (rows, from noon at the top round to the next morning), the night framed. */
export function hourGrid(node, B, F, { label }) {
  const order = [...Array(24).keys()].map((i) => (i + 5) % 24); // 5 h at the top, 4 h at the bottom
  const max = Math.max(...B.clock.flat());
  frame(node, {
    label,
    min: 320,
    height: (W) => (W < 560 ? 470 : 560),
    draw: (s, W, H, narrow) => {
      const M = { l: narrow ? 40 : 52, r: narrow ? 8 : 150, t: 24, b: 8 };
      const cw = (W - M.l - M.r) / 12;
      const rh = (H - M.t - M.b) / 24;
      order.forEach((h, i) => {
        for (let k = 0; k < 12; k++) {
          const v = B.clock[h][k];
          s.append("rect")
            .attr("x", M.l + k * cw + 1)
            .attr("y", M.t + i * rh + 1)
            .attr("width", cw - 2)
            .attr("height", rh - 2)
            .attr("rx", 2)
            .attr("fill", SEQ(Math.min(1, v / max) ** 0.75))
            .on("pointermove", (ev) =>
              showTip(ev, `${MONTHS_FR[k]}, de ${hour(h)} à ${hour((h + 1) % 24)}`, [
                { label: "Impacts déclarés", value: n0(v) },
              ]),
            )
            .on("pointerleave", hideTip);
        }
        if (h % 3 === 0)
          s.append("text")
            .attr("class", "ck-tick")
            .attr("x", M.l - 8)
            .attr("y", M.t + i * rh + rh / 2)
            .attr("dy", "0.32em")
            .attr("text-anchor", "end")
            .text(hour(h));
      });
      MONTHS_SHORT.forEach((m, k) =>
        s
          .append("text")
          .attr("class", "ck-tick")
          .attr("x", M.l + k * cw + cw / 2)
          .attr("y", 14)
          .attr("text-anchor", "middle")
          .text(narrow ? m.slice(0, 1).toUpperCase() : m),
      );
      // the night, framed
      const n0i = order.indexOf(NIGHT[0]);
      s.append("rect")
        .attr("class", "bc-night")
        .attr("x", M.l - 1)
        .attr("y", M.t + n0i * rh)
        .attr("width", 12 * cw + 2)
        .attr("height", NIGHT.length * rh);
      if (!narrow) {
        const tx = W - M.r + 14;
        s.append("text")
          .attr("class", "ck-note-text")
          .attr("x", tx)
          .attr("y", M.t + (n0i + 1) * rh)
          .selectAll("tspan")
          .data(["La nuit,", `pics en ${MONTHS_FR[F.spring]}`, `et en ${MONTHS_FR[F.autumn]}`])
          .join("tspan")
          .attr("x", tx)
          .attr("dy", (_, i) => (i ? 16 : 0))
          .text((d) => d);
        s.append("text")
          .attr("class", "ck-note-text")
          .attr("x", tx)
          .attr("y", M.t + order.indexOf(8) * rh)
          .selectAll("tspan")
          .data(["Le jour,", "l'été autour", "de 8 h"])
          .join("tspan")
          .attr("x", tx)
          .attr("dy", (_, i) => (i ? 16 : 0))
          .text((d) => d);
      }
    },
  });
  node.before(
    rampKey({
      interp: (t) => SEQ(t ** 0.75),
      title: "Impacts déclarés à cette heure",
      low: "aucun",
      high: `${n0(max)} et +`,
    }),
  );
  dataTable(node, {
    head: ["Mois", "Impacts déclarés, la nuit (21 h - 5 h)", "Le jour", "Part de la nuit"],
    rows: MONTHS_FR.map((m, k) => [m, n0(F.night[k]), n0(F.day[k]), pc(F.nightShare[k])]),
  });
}

/** Chapter 2: each species, month by month, against its own busiest month (small multiples). */
export function speciesSeasons(node, F, { keys, label }) {
  const list = keys.map((/** @type {string} */ k) => F.species.find((/** @type {any} */ s) => s.key === k));
  node.replaceChildren();
  node.setAttribute("aria-label", label);
  const grid = el("div", { class: "ck-multiples bc-multiples" });
  node.append(grid);
  for (const sp of list) {
    const cell = el("div", { class: "ck-multiple" }, [
      el("p", { class: "ck-label" }, [
        el("b", { text: sp.name }),
        el("span", { text: ` ${n0(sp.n)} impacts` }),
      ]),
    ]);
    const box = el("div");
    cell.append(box);
    grid.append(cell);
    const mx = Math.max(...sp.months);
    const top = sp.months.indexOf(mx);
    frame(box, {
      label: `${sp.name}, impacts déclarés chaque mois`,
      min: 140,
      height: () => 92,
      draw: (s, W, H) => {
        const X = d3
          .scaleLinear()
          .domain([0, 11])
          .range([4, W - 4]);
        const Y = d3
          .scaleLinear()
          .domain([0, mx])
          .range([H - 18, 6]);
        const area = d3
          .area()
          .x((_, i) => X(i))
          .y0(Y(0))
          .y1((/** @type {any} */ d) => Y(d))
          .curve(d3.curveMonotoneX);
        s.append("path")
          .attr("class", "ck-area")
          .attr("d", area(sp.months))
          .attr("fill", sp.size === "grand" ? INK.magenta : INK.blue)
          .attr("opacity", 0.22);
        s.append("path")
          .attr("class", "ck-line")
          .attr("d", area.lineY1()(sp.months))
          .attr("stroke", sp.size === "grand" ? INK.magenta : INK.blue)
          .attr("fill", "none");
        s.append("line")
          .attr("class", "ck-axis")
          .attr("x1", 4)
          .attr("x2", W - 4)
          .attr("y1", Y(0))
          .attr("y2", Y(0));
        for (const k of [0, 6, 11])
          s.append("text")
            .attr("class", "ck-tick")
            .attr("x", X(k))
            .attr("y", H - 3)
            .attr("text-anchor", k ? (k === 11 ? "end" : "middle") : "start")
            .text(MONTHS_SHORT[k]);
        s.append("circle")
          .attr("cx", X(top))
          .attr("cy", Y(mx))
          .attr("r", 3.5)
          .attr("fill", sp.size === "grand" ? INK.magenta : INK.blue);
      },
    });
  }
  dataTable(node, {
    head: ["Espèce", ...MONTHS_SHORT],
    rows: list.map((s) => [s.name, ...s.months.map(n0)]),
  });
}

/** Chapter 3: the height ladder. One row a height band, ground at the bottom; one dot = `per` reports, magenta = with damage. */
export function heightLadder(node, F, { label, per = 250 }) {
  const rows = [...F.heights].reverse();
  const bandLabel = (/** @type {any} */ h) =>
    h.hi === 0
      ? "au sol"
      : h.hi > 50000
        ? `plus de ${n0(h.lo - 1)} pieds`
        : `${n0(h.lo === 1 ? 0 : h.lo - 1)} à ${n0(h.hi)} pieds`;
  const bandM = (/** @type {any} */ h) =>
    h.hi === 0 ? "0 m" : h.hi > 50000 ? `plus de ${metres(h.lo - 1)}` : `jusqu'à ${metres(h.hi)}`;
  frame(node, {
    label,
    min: 320,
    height: (W) => rows.length * (W < 560 ? 64 : 50) + 20,
    draw: (s, W, H, narrow) => {
      const M = { l: narrow ? 8 : 170, r: narrow ? 8 : 120, t: 8 };
      const rh = (H - M.t - 12) / rows.length;
      const r = narrow ? 2.2 : 2.8;
      const step = r * 2 + 1.4;
      const perRow = Math.floor((W - M.l - M.r) / step);
      rows.forEach((h, i) => {
        const y = M.t + i * rh;
        const dots = Math.max(1, Math.round(h.n / per));
        const red = Math.round(dots * h.rate);
        const lines = Math.ceil(dots / perRow);
        const y0 = narrow ? y + 18 : y + rh / 2 - ((lines - 1) * step) / 2;
        for (let k = 0; k < dots; k++)
          s.append("circle")
            .attr("cx", M.l + (k % perRow) * step + r)
            .attr("cy", y0 + Math.floor(k / perRow) * step)
            .attr("r", r)
            .attr("fill", k < red ? INK.magenta : INK.blue)
            .attr("opacity", k < red ? 1 : 0.55);
        s.append("text")
          .attr("class", "ck-tick bc-band")
          .attr("x", narrow ? M.l : M.l - 12)
          .attr("y", narrow ? y + 6 : y + rh / 2)
          .attr("dy", "0.32em")
          .attr("text-anchor", narrow ? "start" : "end")
          .text(narrow ? `${bandLabel(h)} (${bandM(h)})` : bandLabel(h));
        if (!narrow)
          s.append("text")
            .attr("class", "ck-tick")
            .attr("x", M.l - 12)
            .attr("y", y + rh / 2 + 14)
            .attr("dy", "0.32em")
            .attr("text-anchor", "end")
            .text(bandM(h));
        s.append("text")
          .attr("class", "ck-value bc-rate")
          .attr("x", W - (narrow ? 8 : 10))
          .attr("y", narrow ? y + 6 : y + rh / 2)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .text(narrow ? pc(h.rate) : `${pc(h.rate)} avec dégâts`);
        s.append("rect")
          .attr("x", 0)
          .attr("y", y)
          .attr("width", W)
          .attr("height", rh)
          .attr("fill", "transparent")
          .on("pointermove", (ev) =>
            showTip(ev, `${bandLabel(h)} (${bandM(h)})`, [
              { label: "Impacts déclarés", value: n0(h.n) },
              { label: "Avec dégâts", value: `${n0(h.d)} (${pc(h.rate, 1)})`, color: INK.magenta },
            ]),
          )
          .on("pointerleave", hideTip);
      });
    },
  });
  node.before(
    legend([
      { label: `${n0(per)} impacts déclarés`, color: INK.blue },
      { label: "dont l'avion a été abîmé", color: INK.magenta },
    ]),
  );
  dataTable(node, {
    head: ["Hauteur", "Impacts déclarés", "Avec dégâts", "Part avec dégâts"],
    rows: F.heights.map((/** @type {any} */ h) => [
      `${bandLabel(h)} (${bandM(h)})`,
      n0(h.n),
      n0(h.d),
      pc(h.rate, 1),
    ]),
  });
}

/** Chapter 4: a flight's profile, from the take-off run to the landing roll; a disc per phase (area = reports, inner disc = with damage). */
export function phaseProfile(node, F, { label }) {
  const P = Object.fromEntries(F.phases.map((/** @type {any} */ p) => [p.key, p]));
  const NAMES = {
    décollage: "Course au décollage",
    montée: "Montée",
    croisière: "Croisière et descente",
    approche: "Approche",
    atterrissage: "Atterrissage",
  };
  frame(node, {
    label,
    min: 320,
    height: (W) => (W < 560 ? 360 : 380),
    draw: (s, W, H, narrow) => {
      const gy = H - 80;
      const top = 70;
      const x = (/** @type {number} */ f) => 16 + f * (W - 32);
      // runway, climb, cruise, approach, runway
      const pts = [
        [x(0), gy],
        [x(0.14), gy],
        [x(0.36), top],
        [x(0.62), top],
        [x(0.86), gy],
        [x(1), gy],
      ];
      s.append("line").attr("class", "ck-axis").attr("x1", 0).attr("x2", W).attr("y1", gy).attr("y2", gy);
      s.append("path")
        .attr("d", d3.line()(/** @type {any} */ (pts)))
        .attr("fill", "none")
        .attr("stroke", INK.muted)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 5");
      const pos = {
        décollage: [x(0.07), gy],
        montée: [x(0.25), (gy + top) / 2],
        croisière: [x(0.49), top],
        approche: [x(0.74), (gy + top) / 2],
        atterrissage: [x(0.93), gy],
      };
      const maxN = Math.max(...F.phases.map((/** @type {any} */ p) => p.n));
      const R = (/** @type {number} */ n) => Math.sqrt(n / maxN) * (narrow ? 46 : 64);
      for (const k of PHASES) {
        const p = P[k];
        const [cx, cy] = pos[k];
        s.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", R(p.n))
          .attr("fill", INK.blue)
          .attr("opacity", 0.28);
        s.append("circle").attr("cx", cx).attr("cy", cy).attr("r", R(p.d)).attr("fill", INK.magenta);
        const below = k === "décollage" || k === "atterrissage";
        const side = !narrow && (k === "montée" || k === "approche");
        const anchor = side
          ? k === "montée"
            ? "end"
            : "start"
          : k === "décollage"
            ? "start"
            : k === "atterrissage"
              ? "end"
              : "middle";
        const lx = below
          ? k === "décollage"
            ? 4
            : W - 4
          : side
            ? k === "montée"
              ? cx - R(p.n) - 12
              : cx + R(p.n) + 12
            : cx;
        const ly = below ? gy + Math.max(24, R(p.n) + 18) : side ? cy - 4 : cy - R(p.n) - (narrow ? 22 : 26);
        s.append("text")
          .attr("class", "ck-label bc-phase")
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", anchor)
          .text(narrow ? NAMES[k].split(" ")[0] : NAMES[k]);
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", lx)
          .attr("y", ly + 15)
          .attr("text-anchor", anchor)
          .text(
            narrow
              ? `${pc(p.share)} · ${pc(p.rate)} abîmés`
              : `${pc(p.share)} des impacts · ${pc(p.rate)} avec dégâts`,
          );
        s.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", Math.max(R(p.n), 18))
          .attr("fill", "transparent")
          .on("pointermove", (ev) =>
            showTip(ev, NAMES[k], [
              { label: "Impacts déclarés", value: n0(p.n) },
              { label: "Avec dégâts", value: `${n0(p.d)} (${pc(p.rate, 1)})`, color: INK.magenta },
            ]),
          )
          .on("pointerleave", hideTip);
      }
    },
  });
  node.before(
    legend([
      { label: "impacts déclarés (surface du disque)", color: INK.blue },
      { label: "dont l'avion a été abîmé", color: INK.magenta },
    ]),
  );
  dataTable(node, {
    head: ["Phase", "Impacts déclarés", "Part", "Avec dégâts", "Part avec dégâts"],
    rows: PHASES.map((k) => [NAMES[k], n0(P[k].n), pc(P[k].share, 1), n0(P[k].d), pc(P[k].rate, 1)]),
  });
}

/** Chapter 5: an airliner seen from above; a disc on each part (area = strikes), coloured by the share that damaged it. */
export function partsPlane(node, F, { label }) {
  const P = Object.fromEntries(F.parts.map((/** @type {any} */ p) => [p.key, p]));
  const NAMES = {
    radôme: "Radôme (le nez qui abrite le radar)",
    "pare-brise": "Pare-brise",
    nez: "Nez",
    moteurs: "Moteurs",
    hélices: "Hélices",
    ailes: "Ailes",
    fuselage: "Fuselage",
    train: "Train d'atterrissage",
    empennage: "Empennage",
    feux: "Feux",
  };
  const maxRate = Math.max(...F.parts.map((/** @type {any} */ p) => p.rate));
  frame(node, {
    label,
    min: 320,
    height: (W) => Math.min(560, Math.max(380, W * 0.75)),
    draw: (s, W, H, narrow) => {
      // the plane, nose up, in a 200 x 240 box scaled into the frame
      const k = Math.min((W - (narrow ? 20 : 280)) / 200, (H - 20) / 240);
      const ox = narrow ? (W - 200 * k) / 2 : (W - 200 * k) / 2;
      const oy = 10;
      const T = (/** @type {number} */ x, /** @type {number} */ y) => [ox + x * k, oy + y * k];
      const outline =
        "M100 4 C108 4 112 16 112 30 L112 92 L194 136 L194 148 L112 128 L110 196 L134 214 L134 222 L100 214 L66 222 L66 214 L90 196 L88 128 L6 148 L6 136 L88 92 L88 30 C88 16 92 4 100 4 Z";
      s.append("path")
        .attr("d", outline)
        .attr("transform", `translate(${ox},${oy}) scale(${k})`)
        .attr("fill", "color-mix(in srgb, #14202e 6%, #f3f5f2)")
        .attr("stroke", INK.muted)
        .attr("stroke-width", 1.2 / k);
      for (const [ex, ey] of [
        [58, 112],
        [142, 112],
      ])
        s.append("rect")
          .attr("x", T(ex - 7, ey)[0])
          .attr("y", T(ex, ey - 14)[1])
          .attr("width", 14 * k)
          .attr("height", 26 * k)
          .attr("rx", 5 * k)
          .attr("fill", "none")
          .attr("stroke", INK.muted)
          .attr("stroke-width", 1.2);
      /** @type {Record<string, [number, number]>} */
      const at = {
        radôme: [100, 2],
        "pare-brise": [100, 26],
        nez: [100, 50],
        fuselage: [100, 150],
        moteurs: [58, 112],
        ailes: [154, 136],
        hélices: [142, 96],
        train: [100, 104],
        empennage: [100, 210],
        feux: [190, 142],
      };
      const maxS = Math.max(...F.parts.map((/** @type {any} */ p) => p.s));
      const R = (/** @type {number} */ v) => Math.sqrt(v / maxS) * (narrow ? 20 : 27);
      const color = (/** @type {number} */ r) =>
        d3.interpolateRgb(INK.blue, INK.magenta)(Math.min(1, r / maxRate) ** 0.8);
      const order = Object.keys(at).sort((a, b) => P[b].s - P[a].s);
      for (const key of order) {
        const p = P[key];
        const [cx, cy] = T(...at[key]);
        s.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", R(p.s))
          .attr("fill", color(p.rate))
          .attr("fill-opacity", 0.8)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.2)
          .on("pointermove", (ev) =>
            showTip(ev, NAMES[key], [
              { label: "Impacts déclarés", value: n0(p.s) },
              {
                label: "Avec dégâts de la pièce",
                value: `${n0(p.d)} (${pc(p.rate, 1)})`,
                color: INK.magenta,
              },
            ]),
          )
          .on("pointerleave", hideTip);
      }
      if (narrow) {
        // on a phone, the name beside each disc
        for (const key of Object.keys(at)) {
          const [cx, cy] = T(...at[key]);
          const isLeft = at[key][0] <= 100 && key !== "fuselage" && key !== "empennage";
          s.append("text")
            .attr("class", "ck-tick bc-part")
            .attr("x", cx + (isLeft ? -R(P[key].s) - 4 : R(P[key].s) + 4))
            .attr("y", cy)
            .attr("dy", "0.32em")
            .attr("text-anchor", isLeft ? "end" : "start")
            .text(key);
        }
      }
      if (!narrow) {
        // labels on both sides, each at its target's height, pushed down to keep 40 px between labels
        const left = ["radôme", "pare-brise", "nez", "train", "moteurs"];
        const right = ["hélices", "ailes", "feux", "fuselage", "empennage"];
        const put = (/** @type {string[]} */ keys, /** @type {boolean} */ isLeft) => {
          /** @type {number[]} */
          const placed = [];
          keys.forEach((key, i) => {
            const y = T(...at[key])[1];
            placed.push(Math.max(y, i ? placed[i - 1] + 40 : 12));
          });
          keys.forEach((key, i) => {
            const [cx, cy] = T(...at[key]);
            const ty = placed[i];
            const tx = isLeft ? 8 : W - 8;
            const r = R(P[key].s);
            s.append("path")
              .attr("class", "ck-note-line")
              .attr(
                "d",
                `M${cx + (isLeft ? -r : r)},${cy} L${isLeft ? tx + 160 : tx - 160},${ty - 4} L${isLeft ? tx + 150 : tx - 150},${ty - 4}`,
              );
            const t = s
              .append("text")
              .attr("class", "ck-note-text")
              .attr("x", tx)
              .attr("y", ty)
              .attr("text-anchor", isLeft ? "start" : "end");
            t.append("tspan")
              .attr("x", tx)
              .attr("font-weight", 750)
              .text(key === "radôme" ? "Radôme" : NAMES[key]);
            t.append("tspan")
              .attr("x", tx)
              .attr("dy", 15)
              .text(`${n0(P[key].s)} · ${pc(P[key].rate)} abîmés`);
          });
        };
        put(left, true);
        put(right, false);
      }
    },
  });
  node.before(
    rampKey({
      interp: (t) => d3.interpolateRgb(INK.blue, INK.magenta)(t ** 0.8),
      title: "Part des impacts qui ont abîmé la pièce (disque : nombre d'impacts)",
      low: "0 %",
      high: pc(maxRate),
    }),
  );
  dataTable(node, {
    head: ["Pièce", "Impacts déclarés", "Pièce abîmée", "Part"],
    rows: [...F.parts]
      .sort((a, b) => b.s - a.s)
      .map((/** @type {any} */ p) => [NAMES[p.key], n0(p.s), n0(p.d), pc(p.rate, 1)]),
  });
}

/** Chapter 6: the species, by reports (x, log) and the share that damaged the aircraft (y); disc area = damaging strikes. */
export function speciesScatter(node, F, { label, named }) {
  const list = F.species;
  const col = { petit: INK.blue, moyen: "#2f8f6b", grand: INK.magenta };
  frame(node, {
    label,
    min: 320,
    height: (W) => (W < 560 ? 420 : 470),
    draw: (s, W, H, narrow) => {
      const M = { l: 48, r: narrow ? 14 : 30, t: 18, b: 40 };
      const X = d3
        .scaleLog()
        .domain([200, 15000])
        .range([M.l, W - M.r]);
      const Y = d3
        .scaleLinear()
        .domain([0, 0.8])
        .range([H - M.b, M.t]);
      gridY(s, Y, { x0: M.l, x1: W - M.r, ticks: 4, fmt: (v) => pc(v), unit: "" });
      for (const t of [300, 1000, 3000, 10000])
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", X(t))
          .attr("y", H - M.b + 18)
          .attr("text-anchor", "middle")
          .text(n0(t));
      s.append("text")
        .attr("class", "ck-tick")
        .attr("x", W - M.r)
        .attr("y", H - 4)
        .attr("text-anchor", "end")
        .text("impacts déclarés en onze ans →");
      const maxD = Math.max(...list.map((/** @type {any} */ s) => s.dmg));
      const R = (/** @type {number} */ v) => 3 + Math.sqrt(v / maxD) * (narrow ? 14 : 20);
      for (const sp of [...list].sort((a, b) => b.dmg - a.dmg)) {
        s.append("circle")
          .attr("cx", X(sp.n))
          .attr("cy", Y(sp.rate))
          .attr("r", R(sp.dmg))
          .attr("fill", col[sp.size] ?? INK.grey)
          .attr("fill-opacity", 0.75)
          .attr("stroke", "#fff")
          .on("pointermove", (ev) =>
            showTip(ev, sp.name, [
              { label: "Impacts déclarés", value: n0(sp.n) },
              { label: "Avec dégâts", value: `${n0(sp.dmg)} (${pc(sp.rate, 1)})`, color: INK.magenta },
            ]),
          )
          .on("pointerleave", hideTip);
      }
      for (const nm of named) {
        const sp = list.find((/** @type {any} */ x) => x.key === nm.key);
        if (!sp || (narrow && nm.wide)) continue;
        annotate(s, {
          x: X(sp.n),
          y: Y(sp.rate),
          text: nm.text ?? sp.name,
          dx: nm.dx ?? 0,
          dy: nm.dy ?? -30,
          anchor: nm.anchor ?? "middle",
          dot: false,
        });
      }
    },
  });
  node.before(
    legend([
      { label: "petits oiseaux et animaux", color: col.petit },
      { label: "moyens", color: col.moyen },
      { label: "grands (surface : impacts avec dégâts)", color: col.grand },
    ]),
  );
  dataTable(node, {
    head: ["Espèce", "Taille", "Impacts déclarés", "Avec dégâts", "Part"],
    rows: [...list]
      .sort((a, b) => b.n - a.n)
      .map((/** @type {any} */ s) => [s.name, s.size, n0(s.n), n0(s.dmg), pc(s.rate, 1)]),
  });
}

/** Chapter 7: reports and damaging strikes each year, as a multiple of the first year. */
export function reportsLines(node, B, F, { label }) {
  const ys = Object.keys(B.years).map(Number);
  const rep = ys.map((y) => B.years[y][0] / F.reports0);
  const dmg = ys.map((y) => B.years[y][1] / F.dmg0);
  frame(node, {
    label,
    min: 320,
    height: (W) => (W < 560 ? 320 : 380),
    draw: (s, W, H, narrow) => {
      const M = { l: 44, r: narrow ? 56 : 120, t: 16, b: 30 };
      const X = d3
        .scaleLinear()
        .domain([ys[0], ys.at(-1)])
        .range([M.l, W - M.r]);
      const Y = d3
        .scaleLinear()
        .domain([0, Math.ceil(Math.max(...rep))])
        .range([H - M.b, M.t]);
      gridY(s, Y, { x0: M.l, x1: W - M.r, ticks: 6, fmt: (v) => (v ? `× ${n0(v)}` : "0") });
      for (const y of ys.filter((y) => y % (narrow ? 10 : 5) === 0))
        s.append("text")
          .attr("class", "ck-tick")
          .attr("x", X(y))
          .attr("y", H - 8)
          .attr("text-anchor", "middle")
          .text(String(y));
      const line = d3
        .line()
        .x((_, i) => X(ys[i]))
        .y((/** @type {any} */ d) => Y(d));
      s.append("line")
        .attr("class", "ck-ref")
        .attr("x1", M.l)
        .attr("x2", W - M.r)
        .attr("y1", Y(1))
        .attr("y2", Y(1));
      s.append("path")
        .attr("class", "ck-line")
        .attr("d", line(/** @type {any} */ (rep)))
        .attr("stroke", INK.blue)
        .attr("fill", "none")
        .attr("stroke-width", 2.5);
      s.append("path")
        .attr("class", "ck-line")
        .attr("d", line(/** @type {any} */ (dmg)))
        .attr("stroke", INK.magenta)
        .attr("fill", "none")
        .attr("stroke-width", 3);
      const end = (/** @type {number[]} */ v, /** @type {string} */ c, /** @type {string} */ t) => {
        s.append("circle")
          .attr("cx", X(ys.at(-1)))
          .attr("cy", Y(v.at(-1)))
          .attr("r", 4)
          .attr("fill", c);
        s.append("text")
          .attr("class", "ck-value")
          .attr("x", X(ys.at(-1)) + 8)
          .attr("y", Y(v.at(-1)))
          .attr("dy", "0.32em")
          .attr("fill", c)
          .text(t);
      };
      end(rep, INK.blue, `× ${fmtNum(F.reportsRatio, 1)}`);
      end(dmg, INK.magenta, `× ${fmtNum(F.dmgRatio, 1)}`);
      if (!narrow) {
        annotate(s, {
          x: X(2009),
          y: Y(rep[ys.indexOf(2009)]),
          text: "2009 : la base devient\npublique, après l'Hudson",
          dy: -60,
          dx: -20,
          anchor: "end",
        });
        annotate(s, { x: X(2020), y: Y(rep[ys.indexOf(2020)]), text: "Covid", dy: 40 });
      }
      s.append("rect")
        .attr("x", M.l)
        .attr("y", M.t)
        .attr("width", W - M.l - M.r)
        .attr("height", H - M.t - M.b)
        .attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const y = Math.round(X.invert(d3.pointer(ev)[0]));
          const v = B.years[y];
          if (!v) return;
          showTip(ev, String(y), [
            { label: "Impacts déclarés", value: n0(v[0]), color: INK.blue },
            { label: "Avec dégâts", value: n0(v[1]), color: INK.magenta },
          ]);
        })
        .on("pointerleave", hideTip);
    },
  });
  node.before(
    legend([
      { label: `impacts déclarés, multiple de ${ys[0]}`, color: INK.blue, line: true },
      { label: "impacts avec dégâts", color: INK.magenta, line: true },
    ]),
  );
  dataTable(node, {
    head: ["Année", "Impacts déclarés", "Avec dégâts", "Part avec dégâts"],
    rows: ys.map((y) => [
      String(y),
      n0(B.years[y][0]),
      n0(B.years[y][1]),
      pc(B.years[y][1] / B.years[y][0], 1),
    ]),
  });
}
