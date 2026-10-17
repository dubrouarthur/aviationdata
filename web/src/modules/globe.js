import * as d3 from "d3";
import { $, el, rich, moments, showTip, hideTip, cssVar, reducedMotion } from "../lib/ui.js";
import { whileVisible, player } from "../lib/scrolly.js";
import { pctChange, isNum } from "../lib/series.js";
import { fmtPax, fmtPct, fmtPctAbs, fmtNum, fmtMonth, fmtMonthShort } from "../lib/format.js";

const CONTINENTS = ["Europe", "Afrique", "Amérique", "Asie", "Océanie"];
const DEG = Math.PI / 180;

/** The world seen from France: arcs from Paris to every destination country, animated planes. */
export function initGlobe(data, { dots }) {
  const { months, origin, countries } = data.monde;
  const years = [...new Set(months.map((m) => +m.slice(0, 4)))].filter(
    (y) => months.filter((m) => m.startsWith(String(y))).length === 12,
  );
  const lastYear = years.at(-1);
  const mIndex = new Map(months.map((m, i) => [m, i]));
  const annual = new Map(
    countries.map((c) => [
      c.id,
      new Map(
        years.map((y) => [
          y,
          d3.sum(d3.range(12), (k) => c.pax[mIndex.get(`${y}-${String(k + 1).padStart(2, "0")}`)]),
        ]),
      ),
    ]),
  );
  const intlYear = (y) =>
    d3.sum(countries, (c) => annual.get(c.id).get(y)) +
    d3.sum(Object.values(data.monde.autres), (s) =>
      d3.sum(d3.range(12), (k) => s[mIndex.get(`${y}-${String(k + 1).padStart(2, "0")}`)]),
    );

  // ---------------------------------------------------------------- state
  const state = {
    period: { kind: "year", y: lastYear },
    mode: "plain", // plain | delta (2019 -> last year)
    cont: "Tous",
    hot: null,
    selected: null,
    labels: [],
    rot: [-8, -32], // geoRotation angles: centre of view at (8°E, 32°N)
    target: null,
    lastInteraction: 0,
  };
  const VMAX = d3.max(countries, (c) => d3.max(years, (y) => annual.get(c.id).get(y))) || 1;
  const valueOf = (c) =>
    state.period.kind === "year" ? annual.get(c.id).get(state.period.y) : (c.pax[state.period.i] || 0) * 12;
  const deltaOf = (c) => pctChange(annual.get(c.id).get(2019), annual.get(c.id).get(lastYear));
  const visibleCountries = () => countries.filter((c) => state.cont === "Tous" || c.cont === state.cont);

  // ---------------------------------------------------------------- canvas
  const host = $("#globe");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Globe des destinations desservies depuis la France");
  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";
  host.prepend(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0;
  let R = 0;
  let dpr = 1;
  const colors = {};
  function readColors() {
    for (const k of ["paper", "sea", "land-dot", "blue", "magenta", "ink", "ink-2", "muted", "rule"])
      colors[k] = cssVar(`--${k}`);
  }
  function resize() {
    W = Math.min(host.clientWidth || 600, 760);
    const H = Math.min(W, Math.max(320, window.innerHeight * 0.72));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.margin = "0 auto";
    R = Math.min(W, H) / 2 - 18;
    readColors();
  }

  // ---------------------------------------------------------------- geometry
  const arcs = countries.map((c) => {
    const interp = d3.geoInterpolate([origin.lon, origin.lat], [c.hub.lon, c.hub.lat]);
    const lift = 0.04 + 0.22 * Math.min(1, c.dist / 11000);
    const n = 56;
    const pts = d3.range(n + 1).map((k) => {
      const t = k / n;
      const [lon, lat] = interp(t);
      return { lon, lat, alt: lift * Math.sin(Math.PI * t) };
    });
    return { c, pts };
  });
  const rotation = () => d3.geoRotation([state.rot[0], state.rot[1]]);
  function projector() {
    const rot = rotation();
    const cx = W / 2;
    const cy = canvas.height / dpr / 2;
    return (lon, lat, alt = 0) => {
      const [lo, la] = rot([lon, lat]);
      const k = R * (1 + alt);
      const cl = Math.cos(la * DEG);
      const x = cx + k * cl * Math.sin(lo * DEG);
      const y = cy - k * Math.sin(la * DEG);
      const depth = cl * Math.cos(lo * DEG);
      const outside = (x - cx) ** 2 + (y - cy) ** 2 > R * R;
      return { x, y, depth, visible: depth > 0 || outside };
    };
  }

  // ---------------------------------------------------------------- particles
  let clock = 0;
  const speedOf = (c) => 0.16 / (0.35 + c.dist / 9000);

  // ---------------------------------------------------------------- draw
  let projected = [];
  function draw() {
    const P = projector();
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, h);
    const cx = W / 2;
    const cy = h / 2;

    // sphere with a soft light from the top left
    const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, colors.sea);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.rule;
    ctx.stroke();

    // graticule
    const proj = d3.geoOrthographic().rotate(state.rot).scale(R).translate([cx, cy]).clipAngle(90);
    const path = d3.geoPath(proj, ctx);
    ctx.beginPath();
    path(d3.geoGraticule10());
    ctx.strokeStyle = "rgba(111,124,139,0.13)";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // land as a dot matrix, darker toward the centre
    ctx.fillStyle = colors["land-dot"];
    for (const [lon, lat] of dots) {
      const p = P(lon, lat);
      if (p.depth <= 0) continue;
      ctx.globalAlpha = 0.25 + 0.75 * p.depth;
      const s = 0.8 + 0.9 * p.depth;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // arcs
    const shown = new Set(visibleCountries().map((c) => c.id));
    const vmax = VMAX;
    projected = [];
    const active = state.selected || state.hot;
    for (const { c, pts } of arcs) {
      if (!shown.has(c.id)) continue;
      const v = valueOf(c);
      if (!(v > 0)) continue;
      const w = 0.5 + 2.8 * Math.sqrt(v / vmax);
      let color = colors.blue;
      let alpha = 0.25 + 0.55 * Math.sqrt(v / vmax);
      if (state.mode === "delta") {
        const d = deltaOf(c);
        color = isNum(d) && d < 0 ? colors.magenta : colors.blue;
        alpha = 0.18 + 0.8 * Math.min(1, Math.abs(d ?? 0) / 50);
      }
      if (active) alpha = c.id === active ? 1 : alpha * 0.25;
      const pp = pts.map((q) => P(q.lon, q.lat, q.alt));
      ctx.beginPath();
      let pen = false;
      for (const q of pp) {
        if (q.visible) {
          if (pen) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
          pen = true;
        } else pen = false;
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = c.id === active ? w + 1.2 : w;
      ctx.stroke();

      // planes: a few dots travelling along the arc, more for busier links
      if (!reducedMotion()) {
        const n = Math.min(28, Math.round(v / 350000));
        const sp = speedOf(c);
        ctx.fillStyle = state.mode === "delta" ? color : colors.ink;
        ctx.globalAlpha = active && c.id !== active ? 0.2 : 0.85;
        for (let k = 0; k < n; k++) {
          const t = (((k / n + clock * sp) % 1) + 1) % 1;
          const f = t * (pp.length - 1);
          const a = pp[Math.floor(f)];
          const b = pp[Math.min(pp.length - 1, Math.floor(f) + 1)];
          if (!a.visible || !b.visible) continue;
          const x = a.x + (b.x - a.x) * (f % 1);
          const y = a.y + (b.y - a.y) * (f % 1);
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      const end = pp.at(-1);
      if (end.visible) {
        ctx.beginPath();
        ctx.arc(end.x, end.y, 1.5 + 2.5 * Math.sqrt(v / vmax), 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(1, alpha + 0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
        projected.push({ c, x: end.x, y: end.y, v });
      }
    }

    // origin: Paris
    const o = P(origin.lon, origin.lat);
    if (o.visible) {
      const pulse = reducedMotion() ? 0 : (clock * 0.6) % 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4 + 14 * pulse, 0, 2 * Math.PI);
      ctx.strokeStyle = colors.magenta;
      ctx.globalAlpha = 1 - pulse;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = colors.magenta;
      ctx.fill();
    }

    // labels
    ctx.font = "600 12px 'Archivo Variable', system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const labelled = new Set(state.labels);
    if (active) labelled.add(active);
    const boxes = [];
    for (const p of [...projected].sort((a, b) => (b.c.id === active) - (a.c.id === active) || b.v - a.v)) {
      if (!labelled.has(p.c.id)) continue;
      const text = state.mode === "delta" ? `${p.c.nom} ${fmtPct(deltaOf(p.c), 0)}` : p.c.nom;
      const tw = ctx.measureText(text).width;
      const box = { x0: p.x + 5, x1: p.x + 9 + tw, y0: p.y - 8, y1: p.y + 8 };
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeText(text, p.x + 7, p.y);
      ctx.fillStyle = colors.ink;
      ctx.fillText(text, p.x + 7, p.y);
    }
  }

  // ---------------------------------------------------------------- loop
  let running = false;
  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // rAF time can precede start()
    last = now;
    clock += dt;
    if (state.target) {
      const t = Math.min(1, (now - state.target.start) / state.target.dur);
      const e = d3.easeCubicInOut(t);
      state.rot = [
        state.target.from[0] + (state.target.to[0] - state.target.from[0]) * e,
        state.target.from[1] + (state.target.to[1] - state.target.from[1]) * e,
      ];
      if (t >= 1) state.target = null;
    } else if (!reducedMotion() && now - state.lastInteraction > 5000) {
      state.rot = [state.rot[0] + dt * 3.2, state.rot[1]];
    }
    draw();
    requestAnimationFrame(frame);
  }
  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  const stop = () => (running = false);
  whileVisible(canvas, start, stop);

  function turnTo(lon, lat, dur = 1400) {
    let from = [...state.rot];
    let toLon = -lon;
    while (toLon - from[0] > 180) toLon -= 360;
    while (toLon - from[0] < -180) toLon += 360;
    state.target = { from, to: [toLon, -lat], start: performance.now(), dur: reducedMotion() ? 1 : dur };
    state.lastInteraction = performance.now() + dur;
  }

  // ---------------------------------------------------------------- interaction
  d3.select(canvas).call(
    d3
      .drag()
      .on("start", () => {
        state.target = null;
        canvas.style.cursor = "grabbing";
      })
      .on("drag", (event) => {
        state.lastInteraction = performance.now();
        const k = 90 / R;
        state.rot = [state.rot[0] + event.dx * k, Math.max(-75, Math.min(75, state.rot[1] - event.dy * k))];
      })
      .on("end", () => (canvas.style.cursor = "grab")),
  );
  canvas.addEventListener("pointermove", (event) => {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const near = d3.least(projected, (p) => (p.x - x) ** 2 + (p.y - y) ** 2);
    if (near && (near.x - x) ** 2 + (near.y - y) ** 2 < 18 ** 2) {
      state.hot = near.c.id;
      showTip(event, `${near.c.nom} (${near.c.hub.nom})`, tipRows(near.c));
    } else {
      state.hot = null;
      hideTip();
    }
    syncList();
  });
  canvas.addEventListener("pointerleave", () => {
    state.hot = null;
    hideTip();
    syncList();
  });
  canvas.addEventListener("click", () => {
    state.selected = state.hot && state.hot !== state.selected ? state.hot : null;
    syncList();
  });

  function tipRows(c) {
    const rows = [{ label: periodLabel(), value: fmtPax(valueOf(c)), color: colors.blue }];
    const d = deltaOf(c);
    if (isNum(d)) rows.push({ label: `entre 2019 et ${lastYear}`, value: fmtPct(d) });
    rows.push({ label: "de Paris", value: `${fmtNum(c.dist)} km` });
    return rows;
  }
  const periodLabel = () =>
    state.period.kind === "year"
      ? `passagers en ${state.period.y}`
      : `rythme annuel en ${fmtMonth(months[state.period.i])}`;

  // ---------------------------------------------------------------- legend, year
  function renderOverlay() {
    const yearBox = $("#globe-year");
    yearBox.replaceChildren(
      state.period.kind === "year"
        ? String(state.period.y)
        : fmtMonth(months[state.period.i]).replace(/^\w/, (m) => m.toUpperCase()),
      el("small", {
        text:
          state.period.kind === "year"
            ? `${fmtPax(intlYear(state.period.y))} passagers internationaux`
            : `${fmtNum(sumMonth(state.period.i))} passagers internationaux dans le mois`,
      }),
    );
    $("#globe-legend").replaceChildren(
      ...(state.mode === "delta"
        ? [
            el("span", { class: "lg" }, [el("i", { style: "--c:var(--blue)" }), `en hausse depuis 2019`]),
            el("span", { class: "lg" }, [el("i", { style: "--c:var(--magenta)" }), `en baisse depuis 2019`]),
          ]
        : [
            el("span", { class: "lg" }, [el("i", { class: "dot", style: "--c:var(--magenta)" }), "Paris"]),
            el("span", { class: "lg" }, [el("i", { style: "--c:var(--blue)" }), "épaisseur : passagers"]),
            el("span", { class: "lg" }, [
              el("i", { class: "dot", style: "--c:var(--ink)" }),
              "un point : environ 350 000 passagers par an",
            ]),
          ]),
    );
  }

  // ---------------------------------------------------------------- explorer list
  const list = $("#country-list");
  function renderList() {
    const rows = visibleCountries()
      .map((c) => ({ c, v: valueOf(c), d: deltaOf(c) }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, window.innerWidth < 640 ? 15 : 30);
    const vmax = rows[0]?.v || 1;
    $("#explorer-title").textContent =
      state.period.kind === "year"
        ? `Les ${rows.length} premiers pays en ${state.period.y}`
        : `Les premiers pays en ${fmtMonth(months[state.period.i])}`;
    list.replaceChildren(
      ...rows.map(({ c, v, d }) => {
        const li = el(
          "li",
          { tabindex: 0, "data-id": c.id, "aria-selected": String(c.id === state.selected) },
          [
            el("span", { class: "n", text: c.nom }),
            el(
              "span",
              {},
              el("span", { class: "bar", style: `display:block;width:${Math.max(3, (v / vmax) * 100)}%` }),
            ),
            el("span", {
              class: `d ${isNum(d) ? (d >= 0 ? "up" : "down") : ""}`,
              text: fmtPct(d, 0),
              title: `Évolution entre 2019 et ${lastYear}`,
            }),
          ],
        );
        li.addEventListener("pointerenter", () => {
          state.hot = c.id;
        });
        li.addEventListener("pointerleave", () => {
          state.hot = null;
        });
        const pick = () => {
          state.selected = state.selected === c.id ? null : c.id;
          if (state.selected) turnTo((origin.lon + c.hub.lon) / 2, (origin.lat + c.hub.lat) / 2);
          syncList();
        };
        li.addEventListener("click", pick);
        li.addEventListener("keydown", (e) => e.key === "Enter" && pick());
        return li;
      }),
    );
  }
  function syncList() {
    list
      .querySelectorAll("li")
      .forEach((li) =>
        li.setAttribute("aria-selected", String(li.dataset.id === (state.selected || state.hot))),
      );
  }
  const contSeg = $("#globe-cont");
  contSeg.replaceChildren(
    ...["Tous", ...CONTINENTS].map((name) => {
      const b = el("button", { type: "button", "aria-pressed": String(name === state.cont), text: name });
      b.addEventListener("click", () => {
        state.cont = name;
        contSeg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        renderList();
      });
      return b;
    }),
  );

  // ---------------------------------------------------------------- figures used by the captions
  const top = (y, n, filter = () => true) =>
    [...countries]
      .filter(filter)
      .sort((a, b) => annual.get(b.id).get(y) - annual.get(a.id).get(y))
      .slice(0, n);
  const y0 = years[0];
  const april = mIndex.get("2020-04");
  const april19 = mIndex.get("2019-04");
  const sumMonth = (i) =>
    d3.sum(countries, (c) => c.pax[i] || 0) + d3.sum(Object.values(data.monde.autres), (s) => s[i] || 0);
  const movers = countries.filter((c) => annual.get(c.id).get(2019) > 400000);
  const gainers = [...movers].sort((a, b) => deltaOf(b) - deltaOf(a)).slice(0, 4);
  const losers = [...movers].sort((a, b) => deltaOf(a) - deltaOf(b)).slice(0, 5);
  const f = data.fracture.annual;
  const iL = f.years.indexOf(lastYear);
  const i19 = f.years.indexOf(2019);
  const names = (arr) => {
    const n = arr.map((c) => c.nom);
    return n.length > 1 ? `${n.slice(0, -1).join(", ")} et ${n.at(-1)}` : n.join("");
  };
  const leader = (y) => top(y, 1)[0];
  // first year of the current unbroken run at number one
  const leadSince = (y) => {
    let k = years.indexOf(y);
    while (k > 0 && leader(years[k - 1]) === leader(y)) k -= 1;
    return years[k];
  };
  const mln = (v) => `${fmtNum(v / 1e6, 1)} millions`;
  const recordYear = d3.greatest(years, intlYear);
  const moved = (c) => {
    const d = deltaOf(c);
    return d <= -99.5 ? `${c.nom} (plus aucun passager)` : `${c.nom} (${fmtPct(d, 0)})`;
  };

  $("#hero-dek").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${lastYear}, ${fmtNum(f.TOTAL[iL] / 1e6, 1)} millions de passagers ont décollé ou atterri en France, un record. Mais la reprise avance à deux vitesses : le trafic international a gagné `,
        { b: fmtPctAbs(pctChange(f.INTL[i19], f.INTL[iL])) },
        ` depuis 2019, le trafic intérieur en a perdu `,
        { b: fmtPctAbs(pctChange(f.NAT[i19], f.NAT[iL])) },
        `.`,
      ]),
    ),
  );
  $("#hero-kicker").textContent = `Données publiques DGAC, ${y0}–${lastYear}`;

  // ---------------------------------------------------------------- moments (preset views) and captions
  const MOMENTS = [
    { key: String(y0), label: String(y0), hint: fmtPax(intlYear(y0)) },
    { key: "2019", label: "2019", hint: fmtPax(intlYear(2019)) },
    { key: "2020-04", label: "Avril 2020", hint: fmtPax(sumMonth(april)) },
    { key: String(lastYear), label: String(lastYear), hint: fmtPax(intlYear(lastYear)) },
    { key: "delta", label: "Gagnants et perdants", hint: `depuis 2019` },
  ];
  const VIEWS = {
    [y0]: { period: { kind: "year", y: y0 }, mode: "plain", labels: top(y0, 5), turn: [5, 40] },
    2019: { period: { kind: "year", y: 2019 }, mode: "plain", labels: top(2019, 6), turn: [0, 36] },
    "2020-04": { period: { kind: "month", i: april }, mode: "plain", labels: [], turn: [10, 35] },
    [lastYear]: {
      period: { kind: "year", y: lastYear },
      mode: "plain",
      labels: top(lastYear, 6),
      turn: [8, 32],
    },
    delta: {
      period: { kind: "year", y: lastYear },
      mode: "delta",
      labels: [...gainers, ...losers],
      turn: [30, 35],
    },
  };

  function caption() {
    const P = state.period;
    let title;
    let parts;
    if (state.mode === "delta") {
      title = `Depuis 2019, une nouvelle carte`;
      parts = [
        [`Les arcs bleus ont grandi : ${gainers.map(moved).join(", ")}.`],
        [`Les arcs magenta ont reculé : ${losers.map(moved).join(", ")}.`],
      ];
    } else if (P.kind === "month") {
      title = `${fmtMonth(months[P.i]).replace(/^\w/, (m) => m.toUpperCase())}, le ciel s'éteint`;
      parts = [
        [
          `Le confinement vide le ciel : `,
          { b: fmtNum(sumMonth(P.i)) },
          ` passagers internationaux dans le mois, contre `,
          { b: fmtPax(sumMonth(april19)) },
          ` en avril 2019, soit `,
          { b: fmtPct(pctChange(sumMonth(april19), sumMonth(P.i)), 1) },
          `.`,
        ],
      ];
    } else {
      const y = P.y;
      const lead = leader(y);
      const since = leadSince(y);
      const ratio = intlYear(lastYear) / intlYear(y);
      title = y === recordYear ? `${y}, l'année record` : String(y);
      parts = [
        [
          { b: mln(intlYear(y)) },
          ` de passagers internationaux`,
          ratio >= 1.5 ? `, ${fmtNum(ratio, 1)} fois moins qu'en ${lastYear}.` : `.`,
        ],
        [
          `En tête : ${names(top(y, 3))}.`,
          since > y0 ? ` Numéro un depuis ${since} : ${lead.nom} (avant : ${leader(since - 1).nom}).` : "",
        ],
      ];
    }
    $("#globe-caption").replaceChildren(el("h3", { text: title }), ...parts.map((p) => el("p", {}, rich(p))));
  }

  function apply(view) {
    timeline.stop();
    state.period = view.period;
    state.mode = view.mode;
    state.labels = view.labels.map((c) => c.id);
    if (view.period.kind === "year") timeline.set(view.period.y, false);
    else {
      const ym = months[view.period.i];
      timeline.set(+ym.slice(0, 4), false);
      $("#globe-out").textContent = fmtMonthShort(ym);
    }
    if (view.turn) turnTo(view.turn[0], view.turn[1]);
    renderOverlay();
    renderList();
    caption();
  }

  const tabs = moments($("#globe-moments"), MOMENTS, (key) => apply(VIEWS[key]));

  // ---------------------------------------------------------------- time control (free exploration)
  const timeline = player({
    button: $("#globe-play"),
    slider: $("#globe-slider"),
    output: $("#globe-out"),
    values: years,
    interval: 520,
    labels: { play: "Lancer le voyage de 1990 à aujourd'hui", pause: "Mettre le voyage en pause" },
    onChange: (y) => {
      state.period = { kind: "year", y };
      state.mode = "plain";
      state.labels = top(y, 5).map((c) => c.id);
      tabs.mark(VIEWS[y] && VIEWS[y].mode === "plain" ? String(y) : null);
      renderOverlay();
      renderList();
      caption();
    },
  });

  resize();
  tabs.select(String(lastYear));
  new ResizeObserver(() => resize()).observe(host);
}
