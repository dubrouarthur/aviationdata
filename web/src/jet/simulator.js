// "Placez l'avion": the flight simulator. A chosen day at three cruise levels, winds that change
// during the flight, an aircraft flown at its cruise Mach, and three routes side by side: the great
// circle, the fastest (or least-fuel) route solved in the browser (sim.js), and the reader's own,
// drawn by dragging three points. "Lancer le vol" flies the three at once on a UTC clock.
import * as d3 from "d3";
import { $, el, onResize } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { fmtNum } from "../lib/format.js";
import { drawSpeed, particles, plateCarree } from "./wind.js";
import { bearing, greatCircle, haversine } from "./route.js";
import { bestRoute, decodeSimDay, pathTime, soundKmh } from "./sim.js";
import { drawLand, line, loadLand, css, speedLegend } from "./maps.js";
import { hm, kmh, minutes, shortDate } from "./fmt.js";

const HOURS = [0, 6, 12, 18];
const GROUPS = {
  storm: "Tempêtes",
  record: "Records 2019-2022",
  typical: "Jours ordinaires",
  history: "Records depuis 1959",
};
const PLANE =
  "M0,-7 L2,-1 L7,2 L7,3.5 L2,2 L1.4,5.5 L3,7 L3,8 L0,7.2 L-3,8 L-3,7 L-1.4,5.5 L-2,2 L-7,3.5 L-7,2 L-2,-1 Z";
const ROUTES = [
  { key: "gc", name: "Ligne droite", cls: "sim-gc" },
  { key: "best", name: "Route optimale", cls: "sim-best" },
  { key: "you", name: "Votre route", cls: "sim-you" },
];

/** A smooth path through [a, ...handles, b] (Catmull-Rom in latitude-longitude), n points. */
export function splinePath(points, n = 64) {
  const out = [];
  const segs = points.length - 1;
  for (let s = 0; s <= n - 1; s++) {
    const t = (s / (n - 1)) * segs;
    const i = Math.min(segs - 1, Math.floor(t));
    const u = t - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c = (k) =>
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * u +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
    out.push([c(0), c(1)]);
  }
  return out;
}

export function simulator({ sim, grid: winds, onReady }) {
  const G = sim.grid;
  const stage = $("#sim-stage");
  const svg = d3.select("#sim-svg");
  const base = $("#sim-base");
  const speedCanvas = $("#sim-speed");
  const wind = particles($("#sim-wind"), { density: 1 / 300, speed: 0.007, width: 1, fade: 0.955 });
  const cache = new Map();
  const loadDay = (day) =>
    cache.get(day) ??
    cache
      .set(
        day,
        fetch(asset(`data/jet/sim/${day}.bin`))
          .then((r) => {
            if (!r.ok) throw new Error(`sim/${day}.bin: HTTP ${r.status}`);
            return r.arrayBuffer();
          })
          .then((b) => decodeSimDay(new Int8Array(b), G)),
      )
      .get(day);
  const dests = Object.keys(winds.names).filter((c) => c !== "LFPG");
  const short = (c) => winds.names[c].replace(/-.*/, "");
  const state = {
    day: sim.days.find((d) => d.day === "2020-02-08")?.day ?? sim.days[0].day,
    dest: "KJFK",
    west: true,
    hour: 12,
    level: 1, // index, or "free"
    plane: sim.aircraft.findIndex((a) => a.code === "B77W"),
    goal: "time",
    field: null,
    handles: null,
    res: null,
    view: null,
    land: null,
    clock: null,
  };
  const ends = () => {
    const p = winds.airports.LFPG;
    const x = winds.airports[state.dest];
    return state.west ? [p, x] : [x, p];
  };
  const resetHandles = () => {
    const [a, b] = ends();
    const gc = greatCircle(a, b, 5);
    state.handles = gc.slice(1, 4).map(([la, lo]) => [la, lo]);
  };
  resetHandles();

  /* ---------------------------------------------------------------- controls */
  const daySel = $("#sim-day");
  const groups = d3.group(sim.days, (d) => d.group);
  daySel.replaceChildren(
    ...[...groups].map(([g, list]) =>
      el(
        "optgroup",
        { label: GROUPS[g] },
        list.map((d) =>
          el("option", {
            value: d.day,
            text: `${shortDate(d.day)}, ${d.title.charAt(0).toLowerCase()}${d.title.slice(1)}`,
          }),
        ),
      ),
    ),
  );
  daySel.value = state.day;
  daySel.addEventListener("change", () => setDay(daySel.value));

  const seg = (node, items, current, onPick) => {
    node.replaceChildren(
      ...items.map(([value, text]) =>
        el("button", {
          type: "button",
          "aria-pressed": String(value === current()),
          "data-value": String(value),
          text,
          onclick: () => {
            onPick(value);
            node
              .querySelectorAll("button")
              .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(value))));
          },
        }),
      ),
    );
  };
  seg(
    $("#sim-dest"),
    dests.map((c) => [c, short(c)]),
    () => state.dest,
    (c) => {
      state.dest = c;
      resetHandles();
      solve();
    },
  );
  const dirBtn = $("#sim-dir");
  const dirText = () =>
    (dirBtn.textContent = state.west ? `Paris → ${short(state.dest)}` : `${short(state.dest)} → Paris`);
  dirBtn.addEventListener("click", () => {
    state.west = !state.west;
    dirBtn.setAttribute("aria-pressed", String(!state.west));
    resetHandles();
    solve();
  });
  seg(
    $("#sim-hour"),
    HOURS.map((h) => [h, `${String(h).padStart(2, "0")} h`]),
    () => state.hour,
    (h) => {
      state.hour = h;
      solve();
    },
  );
  seg(
    $("#sim-level"),
    [...sim.levels.map((l, i) => [i, `FL${l.fl}`]), ["free", "Libre"]],
    () => state.level,
    (l) => {
      state.level = l === "free" ? "free" : +l;
      solve();
    },
  );
  const planeSel = $("#sim-plane");
  planeSel.replaceChildren(
    ...sim.aircraft.map((a, i) =>
      el("option", { value: String(i), text: `${a.name}, Mach ${fmtNum(a.mach, 2)}` }),
    ),
  );
  planeSel.value = String(state.plane);
  planeSel.addEventListener("change", () => {
    state.plane = +planeSel.value;
    solve();
  });
  seg(
    $("#sim-goal"),
    [
      ["time", "Le plus rapide"],
      ["fuel", "Le moins de carburant"],
    ],
    () => state.goal,
    (g) => {
      state.goal = g;
      solve();
    },
  );
  $("#sim-reset").addEventListener("click", () => {
    resetHandles();
    solve();
  });

  /* ---------------------------------------------------------------- model */
  const plane = () => sim.aircraft[state.plane];
  const flLevel = () => (state.level === "free" ? 1 : state.level); // level of the great circle and your route
  function co2(route, burn) {
    const [a, b] = ends();
    const km = haversine(a[0], a[1], b[0], b[1]);
    const ref = (sim.co2.g_pkm * km) / 1000; // kg per passenger, DGAC long-haul average
    const tref = (km / (plane().mach * soundKmh(220.8))) * 60; // minutes without wind at FL340
    return (ref * burn) / tref;
  }
  function solve() {
    dirText();
    $("#simulateur").classList.toggle("east", !state.west);
    if (!state.field) return;
    const [a, b] = ends();
    const p = plane();
    const fuel = p.fuel;
    const lvl = flLevel();
    const t0 = state.hour;
    const gcPts = greatCircle(a, b, 64);
    const gc = pathTime(state.field, gcPts, t0, lvl, p.mach, fuel);
    const best = bestRoute(
      state.field,
      a,
      b,
      t0,
      p.mach,
      state.level === "free" ? null : state.level,
      state.goal === "fuel" ? fuel : null,
    );
    if (state.goal !== "fuel")
      best.burn = best.path
        .slice(1)
        .reduce((s, q, i) => s + (best.times[i + 1] - best.times[i]) * 60 * fuel[q[2]], 0);
    const youPts = splinePath([a, ...state.handles, b], 64);
    const you = pathTime(state.field, youPts, t0, lvl, p.mach, fuel);
    state.res = {
      gc: { ...gc, pts: gcPts, levels: gcPts.map(() => lvl) },
      best: { ...best, pts: best.path.map((q) => [q[0], q[1]]), levels: best.path.map((q) => q[2]) },
      you: { ...you, pts: youPts, levels: youPts.map(() => lvl) },
    };
    best.winds = best.path.slice(1).map((q, i) => alongWind(best.path[i], q, best.times[i], q[2]));
    state.res.best.winds = best.winds;
    draw();
    kpis();
    profileChart();
    matrix();
  }
  // wind along the track of one leg (km/h), for the profile chart of the optimal route
  function alongWind(p, q, t, level) {
    const r = pathTime(state.field, [p, q], t, level, plane().mach);
    return r.winds[0];
  }

  /* ---------------------------------------------------------------- map */
  const field2d = (hour, level) => {
    const f = state.field;
    const size = f.nx * f.ny;
    const fk = Math.min(Math.max(hour / 6, 0), f.steps - 1.000001);
    const k0 = Math.floor(fk);
    const dk = fk - k0;
    const u = new Float64Array(size);
    const v = new Float64Array(size);
    const o0 = (k0 * f.levels + level) * size;
    const o1 = ((k0 + 1) * f.levels + level) * size;
    for (let i = 0; i < size; i++) {
      u[i] = f.u[o0 + i] * (1 - dk) + f.u[o1 + i] * dk;
      v[i] = f.v[o0 + i] * (1 - dk) + f.v[o1 + i] * dk;
    }
    return { lat0: f.lat0, lon0: f.lon0, d: f.d, nx: f.nx, ny: f.ny, u, v };
  };
  let lastRaster = -1;
  const showField = (hour, force = false) => {
    const f2 = field2d(hour, flLevel());
    if (force) wind.setField(f2);
    else wind.swapField(f2);
    if (force || Math.abs(hour - lastRaster) > 0.4) {
      drawSpeed(speedCanvas, f2, state.view);
      lastRaster = hour;
    }
    clockText(hour);
  };
  const clockText = (hour) => {
    const d = new Date(`${state.day}T00:00Z`);
    d.setUTCMinutes(Math.round(hour * 60));
    const iso = d.toISOString();
    $("#sim-clock").textContent =
      `${shortDate(iso.slice(0, 10))}, ${iso.slice(11, 13)} h ${iso.slice(14, 16)} UTC, vent à FL${sim.levels[flLevel()].fl}`;
  };

  const layout = () => {
    const box = {
      west: G.lon0,
      east: G.lon0 + G.d * (G.nx - 1),
      south: G.lat0,
      north: G.lat0 + G.d * (G.ny - 1),
    };
    const aspect = ((box.east - box.west) * Math.cos(Math.PI / 4)) / (box.north - box.south);
    const width = Math.min(stage.parentElement.clientWidth, Math.round(640 * aspect));
    const height = Math.round(width / aspect);
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    state.view = plateCarree(box, width, height, { fit: "contain" });
    if (state.land)
      drawLand(base, state.land, state.view, { fill: css("--map-land"), stroke: css("--map-coast") });
    wind.resize(state.view);
    if (state.field) {
      showField(state.clock ?? state.hour, true);
      draw();
    }
  };

  function draw() {
    const v = state.view;
    if (!v || !state.res) return;
    svg.attr("viewBox", `0 0 ${v.width} ${v.height}`).attr("width", v.width).attr("height", v.height);
    svg.selectAll("*").remove();
    const L = line(v);
    for (const r of ROUTES) {
      const pts = state.res[r.key].pts;
      if (r.key !== "gc") svg.append("path").attr("d", L(pts)).attr("class", "route-halo");
      svg.append("path").attr("d", L(pts)).attr("class", r.cls);
    }
    // levels of the optimal route, when it may change altitude
    if (state.level === "free") {
      const b = state.res.best;
      b.pts.forEach((p, i) => {
        if (i && b.levels[i] !== b.levels[i - 1])
          svg
            .append("text")
            .attr("x", v.x(p[1]))
            .attr("y", v.y(p[0]) - 9)
            .attr("text-anchor", "middle")
            .attr("class", "sim-fl")
            .text(`FL${sim.levels[b.levels[i]].fl}`);
      });
    }
    const [a, b] = ends();
    for (const [[la, lo], name, right] of [
      [a, state.west ? "Paris" : short(state.dest), state.west],
      [b, state.west ? short(state.dest) : "Paris", !state.west],
    ]) {
      svg.append("circle").attr("cx", v.x(lo)).attr("cy", v.y(la)).attr("r", 4).attr("class", "apt");
      svg
        .append("text")
        .attr("x", v.x(lo) + (right ? 8 : -8))
        .attr("y", v.y(la) + 4)
        .attr("text-anchor", right ? "start" : "end")
        .attr("class", "apt-label")
        .text(name);
    }
    // the reader's three points
    const drag = d3
      .drag()
      .container(svg.node())
      .subject((ev) => ({ x: ev.x, y: ev.y })) // the data are [lat, lon], not {x, y}
      .on("start", function () {
        d3.select(this).classed("dragging", true);
      })
      .on("drag", function (ev) {
        const i = svg.selectAll(".sim-handle").nodes().indexOf(this);
        const lon = Math.max(G.lon0, Math.min(G.lon0 + G.d * (G.nx - 1), v.lon(ev.x)));
        const lat = Math.max(G.lat0, Math.min(G.lat0 + G.d * (G.ny - 1), v.lat(ev.y)));
        state.handles[i] = [lat, lon];
        quickYou();
      })
      .on("end", function () {
        d3.select(this).classed("dragging", false);
        solve();
      });
    svg
      .selectAll(".sim-handle")
      .data(state.handles)
      .join("circle")
      .attr("class", "sim-handle")
      .attr("cx", (h) => v.x(h[1]))
      .attr("cy", (h) => v.y(h[0]))
      .attr("r", 9)
      .attr("tabindex", 0)
      .attr("role", "slider")
      .attr("aria-label", (h, i) => `Point ${i + 1} de votre route`)
      .call(drag)
      .on("keydown", function (ev) {
        const i = svg.selectAll(".sim-handle").nodes().indexOf(this);
        const h = state.handles[i];
        const step = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
        if (!step) return;
        ev.preventDefault();
        state.handles[i] = [h[0] + step[0], h[1] + step[1]];
        solve();
        svg.selectAll(".sim-handle").nodes()[i]?.focus();
      });
    svg.append("g").attr("class", "sim-planes");
  }

  // while dragging: only your route moves, the optimum stays
  function quickYou() {
    const [a, b] = ends();
    const p = plane();
    const pts = splinePath([a, ...state.handles, b], 64);
    const you = pathTime(state.field, pts, state.hour, flLevel(), p.mach, p.fuel);
    state.res.you = { ...you, pts, levels: pts.map(() => flLevel()) };
    svg.select(".sim-you").attr("d", line(state.view)(pts));
    svg
      .selectAll(".route-halo")
      .filter((d, i) => i === 1)
      .attr("d", line(state.view)(pts));
    svg
      .selectAll(".sim-handle")
      .data(state.handles)
      .attr("cx", (h) => state.view.x(h[1]))
      .attr("cy", (h) => state.view.y(h[0]));
    kpis();
  }

  /* ---------------------------------------------------------------- key figures */
  function kpis() {
    const r = state.res;
    const gcMin = r.gc.minutes;
    $("#sim-kpis").replaceChildren(
      ...ROUTES.map(({ key, name, cls }) => {
        const x = r[key];
        const diff = x.minutes - gcMin;
        return el("div", { class: `sim-kpi ${cls}` }, [
          el("p", { class: "sk-name" }, [el("i", { "aria-hidden": "true" }), name]),
          el("b", { text: hm(x.minutes) }),
          el("p", {
            class: "sk-diff",
            text:
              key === "gc"
                ? "la référence"
                : Math.abs(diff) < 0.5
                  ? "comme la ligne droite"
                  : `${diff < 0 ? "−" : "+"}${minutes(Math.abs(diff))} sur la ligne droite`,
          }),
          el("p", {
            class: "sk-co2",
            text: `≈ ${fmtNum(Math.round(co2(key, x.burn)))} kg de CO2 par passager`,
          }),
        ]);
      }),
    );
  }

  /* ---------------------------------------------------------------- wind met along each route */
  function profileChart() {
    const node = $("#sim-profile");
    const width = node.clientWidth || 600;
    const height = 220;
    const m = { top: 16, right: 12, bottom: 30, left: 46 };
    const c = { ink: css("--night-ink"), muted: css("--night-muted"), grid: "rgba(255,255,255,0.12)" };
    const series = ROUTES.map((r) => {
      const x = state.res[r.key];
      let dist = 0;
      const pts = x.winds.map((w, i) => {
        const [p, q] = [x.pts[i], x.pts[i + 1]];
        const seg = haversine(p[0], p[1], q[0], q[1]);
        dist += seg;
        return [dist - seg / 2, w];
      });
      return { ...r, pts };
    });
    const all = series.flatMap((s) => s.pts.map((p) => p[1]));
    const ext = Math.max(50, Math.ceil(d3.max(all, Math.abs) / 50) * 50);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(series, (s) => d3.max(s.pts, (p) => p[0]))])
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain([-ext, ext])
      .range([height - m.bottom, m.top]);
    const s = d3
      .select(node)
      .selectAll("svg")
      .data([0])
      .join("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);
    s.selectAll("*").remove();
    s.append("g")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - m.left - m.right)),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll("line").attr("stroke", c.grid);
        g.selectAll("text").attr("fill", c.muted).attr("font-size", 11);
      });
    s.append("g")
      .attr("transform", `translate(0,${height - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(width < 520 ? 3 : 6)
          .tickFormat((v) => `${fmtNum(v)} km`)
          .tickSize(0)
          .tickPadding(8),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll("text").attr("fill", c.muted).attr("font-size", 11);
      });
    s.append("line")
      .attr("x1", m.left)
      .attr("x2", width - m.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", c.muted);
    s.append("text")
      .attr("x", m.left + 4)
      .attr("y", m.top + 10)
      .attr("fill", c.muted)
      .attr("font-size", 11)
      .text("vent dans le dos, km/h");
    s.append("text")
      .attr("x", m.left + 4)
      .attr("y", height - m.bottom - 6)
      .attr("fill", c.muted)
      .attr("font-size", 11)
      .text("vent de face");
    for (const sr of series)
      s.append("path")
        .datum(sr.pts)
        .attr("class", `${sr.cls}-line`)
        .attr(
          "d",
          d3
            .line()
            .x((p) => x(p[0]))
            .y((p) => y(p[1])),
        );
  }

  /* ---------------------------------------------------------------- when and how high */
  let matrixToken = 0;
  function matrix() {
    const node = $("#sim-matrix");
    const token = ++matrixToken;
    const [a, b] = ends();
    const p = plane();
    const fuel = state.goal === "fuel" ? p.fuel : null;
    const cols = [...sim.levels.map((l, i) => [i, `FL${l.fl}`]), ["free", "Libre"]];
    const cells = [];
    const table = el("table", { class: "sim-table" }, [
      el(
        "thead",
        {},
        el("tr", {}, [
          el("th", { scope: "col", text: "Départ (UTC)" }),
          ...cols.map(([, t]) => el("th", { scope: "col", text: t })),
        ]),
      ),
      el(
        "tbody",
        {},
        HOURS.map((h) =>
          el("tr", {}, [
            el("th", { scope: "row", text: `${String(h).padStart(2, "0")} h` }),
            ...cols.map(([lv]) => {
              const td = el("td", {}, el("button", { type: "button", class: "sim-cell", text: "…" }));
              const btn = td.firstChild;
              btn.addEventListener("click", () => {
                state.hour = h;
                state.level = lv;
                $("#sim-hour")
                  .querySelectorAll("button")
                  .forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.value === h)));
                $("#sim-level")
                  .querySelectorAll("button")
                  .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.value === String(lv))));
                solve();
              });
              cells.push({ h, lv, btn });
              return td;
            }),
          ]),
        ),
      ),
    ]);
    node.replaceChildren(table);
    // solve the cells a few at a time, so the page stays responsive
    const results = [];
    const next = (i) => {
      if (token !== matrixToken) return;
      if (i >= cells.length) return paint();
      const c = cells[i];
      const r = bestRoute(state.field, a, b, c.h, p.mach, c.lv === "free" ? null : c.lv, fuel);
      results[i] = r.minutes;
      c.btn.textContent = hm(r.minutes);
      setTimeout(() => next(i + 1), 0);
    };
    const paint = () => {
      const [lo, hi] = d3.extent(results);
      const color = d3.scaleLinear().domain([lo, hi]).range([0, 1]);
      cells.forEach((c, i) => {
        c.btn.style.setProperty("--k", color(results[i]).toFixed(3));
        const current = c.h === state.hour && String(c.lv) === String(state.level);
        c.btn.setAttribute("aria-pressed", String(current));
        c.btn.title = `${hm(results[i])}`;
      });
      const i = d3.minIndex(results);
      $("#sim-matrix-note").textContent =
        `Le plus rapide ce jour-là : départ à ${String(cells[i].h).padStart(2, "0")} h UTC, ${cells[i].lv === "free" ? "altitude libre" : `FL${sim.levels[cells[i].lv].fl}`}, ${hm(results[i])} ; le plus lent : ${hm(d3.max(results))}.`;
    };
    next(0);
  }

  /* ---------------------------------------------------------------- the flight */
  let raf = 0;
  const play = $("#sim-play");
  function fly() {
    if (raf) return stopFly();
    const r = state.res;
    const end = Math.max(...ROUTES.map(({ key }) => r[key].times.at(-1)));
    const t0 = state.hour;
    const g = svg.select(".sim-planes");
    const planes = ROUTES.map(({ key, cls }) => ({
      key,
      node: g.append("path").attr("d", PLANE).attr("class", `sim-plane ${cls}-plane`),
    }));
    play.textContent = "Arrêter";
    play.setAttribute("aria-pressed", "true");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const speed = (end - t0) / (reduce ? 0.001 : 9); // the whole flight in about nine seconds
    let start = null;
    const step = (now) => {
      start ??= now;
      const hour = Math.min(end, t0 + ((now - start) / 1000) * speed);
      state.clock = hour;
      showField(hour);
      for (const p of planes) {
        const x = r[p.key];
        const i = Math.max(0, Math.min(x.times.length - 2, d3.bisectRight(x.times, hour) - 1));
        const f = Math.min(1, Math.max(0, (hour - x.times[i]) / (x.times[i + 1] - x.times[i])));
        const [a, b] = [x.pts[i], x.pts[i + 1]];
        const lat = a[0] + (b[0] - a[0]) * f;
        const lon = a[1] + (b[1] - a[1]) * f;
        const ang = bearing(a[0], a[1], b[0], b[1]);
        const done = hour >= x.times.at(-1);
        p.node
          .attr("transform", `translate(${state.view.x(lon)},${state.view.y(lat)}) rotate(${ang}) scale(1.4)`)
          .classed("landed", done);
      }
      if (hour < end) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        play.textContent = "Relancer le vol";
        play.setAttribute("aria-pressed", "false");
      }
    };
    raf = requestAnimationFrame(step);
  }
  function stopFly() {
    cancelAnimationFrame(raf);
    raf = 0;
    svg.selectAll(".sim-plane").remove();
    state.clock = null;
    showField(state.hour, true);
    play.textContent = "Lancer le vol";
    play.setAttribute("aria-pressed", "false");
  }
  play.addEventListener("click", fly);

  /* ---------------------------------------------------------------- day */
  async function setDay(day) {
    state.day = day;
    daySel.value = day;
    if (raf) stopFly();
    const f = await loadDay(day);
    if (state.day !== day) return;
    state.field = f;
    const meta = sim.days.find((d) => d.day === day);
    $("#sim-day-note").textContent = dayNote(meta);
    showField(state.hour, true);
    solve();
  }
  const dayNote = (d) =>
    `Vent le plus fort de la journée sur la carte : ${kmh(d.max.kmh)}, à FL${sim.levels[d.max.level].fl}, ${String(d.max.hour % 24).padStart(2, "0")} h UTC${d.max.hour >= 24 ? " le lendemain" : ""}. Vent moyen sur la ligne droite New York → Paris à midi : ${kmh(Math.abs(d.tail))} ${d.tail >= 0 ? "dans le dos" : "de face"}.`;

  let started = false;
  async function start() {
    if (started) return;
    started = true;
    state.land = await loadLand();
    layout();
    await setDay(state.day);
    wind.start();
    onReady?.();
  }
  new IntersectionObserver(([e]) => e.isIntersecting && start(), { rootMargin: "800px 0px" }).observe(stage);
  onResize(stage.parentElement, () => started && (layout(), profileChart()));
  speedLegend($("#sim-speed-legend"), "Vent à l'altitude choisie");
  return {
    setDay: (d) => (started ? setDay(d) : ((state.day = d), start())),
    get state() {
      return state;
    },
  };
}
