// The dark maps of the jet-stream story: the opening night of storm Ciara and the seasonal
// climatology (the day-by-day explorer lives in explorer.js).
import * as d3 from "d3";
import { feature } from "topojson-client";
import { $, el, onResize } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { decodeField, drawSpeed, particles, plateCarree, SPEED_STOPS, speedRGB } from "./wind.js";
import { bearing, greatCircle, legMinutes, windAt } from "./route.js";
import { hm, kmh, tonnes } from "./fmt.js";
import { fmtNum } from "../lib/format.js";

const PLANE =
  "M0,-7 L2,-1 L7,2 L7,3.5 L2,2 L1.4,5.5 L3,7 L3,8 L0,7.2 L-3,8 L-3,7 L-1.4,5.5 L-2,2 L-7,3.5 L-7,2 L-2,-1 Z";
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let landCache = null;
export async function loadLand() {
  landCache ||= fetch(asset("geo/world-110m.json"))
    .then((r) => r.json())
    .then((topo) => feature(topo, topo.objects.land ?? topo.objects.countries));
  return landCache;
}

/** Land and coastlines on a canvas, under the wind. */
export function drawLand(canvas, land, view, { fill, stroke }) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(view.width * dpr);
  canvas.height = Math.round(view.height * dpr);
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const path = d3.geoPath(view, ctx);
  ctx.beginPath();
  path(land);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export const line = (view) =>
  d3
    .line()
    .x((p) => view.x(p[1]))
    .y((p) => view.y(p[0]))
    .curve(d3.curveCatmullRom.alpha(0.5));

/** Speed legend: the particle colours with their thresholds. */
export function speedLegend(node, title = "Vent à 10 km d'altitude") {
  node.replaceChildren(
    el("span", { class: "sl-title", text: title }),
    el(
      "span",
      { class: "sl-ramp" },
      SPEED_STOPS.map((s, c) =>
        el("span", { class: "sl-step" }, [
          el("i", { style: `background: rgb(${speedRGB(c).join(",")})` }),
          c === 0 ? "calme" : c === SPEED_STOPS.length - 1 ? `${s} km/h` : `${s}`,
        ]),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ opening map */
/**
 * The opening: the night of storm Ciara, and a race. The same aircraft leaves New York for Paris and
 * Paris for New York in the same wind (ERA5 at 250 hPa, 9 February 2020 at 00 UTC, frozen, 900 km/h),
 * each on its fastest route. The panel shows durations only, against two marks: no wind, and the straight
 * line. Its closing sentence gives the gap between the two directions (minutes, tonnes) and what the fastest
 * route gains on the straight line towards New York; no euros per flight, which read next to the story's
 * mean gain as a contradiction (C: costFacts, cost.js).
 */
export async function openMap(hero, C) {
  const stage = $("#open-map");
  const img = $("#open-sat");
  const svg = d3.select("#open-routes");
  const bytes = await fetch(asset("data/jet/hero.bin"))
    .then((r) => r.arrayBuffer())
    .then((b) => new Int8Array(b));
  const field = decodeField(bytes, hero);
  const [s, w, n, e] = hero.image.bbox;
  const box = { south: s, west: w, north: n, east: e };
  const wind = particles($("#open-wind"), { density: 1 / 210, rate: 0.045, width: 1.15, fade: 0.97 });

  // each flight: its route, the minutes at each point (scaled to the build's total), its total
  const flight = (key, path, total, gc) => {
    const t = [0];
    for (let i = 1; i < path.length; i++)
      t.push(t[i - 1] + legMinutes(field, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
    const k = total / t.at(-1);
    return { key, path, total, gc, t: t.map((x) => x * k) };
  };
  const flights = [flight("east", hero.route.fast, hero.route.t_fast, hero.route.t_gc)];
  if (hero.west) flights.push(flight("west", hero.west.fast, hero.west.t_fast, hero.west.t_gc));
  const longest = d3.max(flights, (f) => f.total);
  // the bars' scale holds the slowest straight line, so that each row can mark its own
  const scale = 1.03 * d3.max(flights, (f) => Math.max(f.total, f.gc));
  const at = (f, m) => {
    const mm = Math.min(m, f.total);
    const i = Math.max(1, d3.bisectLeft(f.t, mm));
    const a = f.path[i - 1];
    const b = f.path[Math.min(i, f.path.length - 1)];
    const u = (mm - f.t[i - 1]) / Math.max(1e-9, f.t[i] - f.t[i - 1]);
    return {
      i,
      lat: a[0] + (b[0] - a[0]) * u,
      lon: a[1] + (b[1] - a[1]) * u,
      brg: bearing(a[0], a[1], b[0], b[1]),
    };
  };

  let view = null;
  let minute = 0;
  const layout = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    // a phone shows the whole crossing, from New York to Paris, under the headline
    view =
      width < 700
        ? plateCarree({ west: -90, east: 16, south: 33, north: 67 }, width, height, { fit: "contain" })
        : plateCarree(box, width, height, { fit: "cover", focus: [-42, 46] });
    Object.assign(img.style, {
      left: `${view.x(w)}px`,
      top: `${view.y(n)}px`,
      width: `${view.x(e) - view.x(w)}px`,
      height: `${view.y(s) - view.y(n)}px`,
    });
    wind.resize(view);
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    const r = hero.route;
    const L = line(view);
    svg.append("path").attr("d", L(r.gc)).attr("class", "route-gc");
    for (const f of flights) {
      svg.append("path").attr("d", L(f.path)).attr("class", `route-ghost route-${f.key}`);
      svg.append("path").attr("class", "route-halo").attr("id", `flown-halo-${f.key}`);
      svg.append("path").attr("class", `route-${f.key}`).attr("id", `flown-${f.key}`);
    }
    const ends = [
      [r.gc[0], "New York", "end"],
      [r.gc.at(-1), "Paris", "start"],
    ];
    for (const [[la, lo], name, anchor] of ends) {
      svg.append("circle").attr("cx", view.x(lo)).attr("cy", view.y(la)).attr("r", 4).attr("class", "apt");
      // on a phone, New York sits near the left edge: its name goes under the dot
      const under = anchor === "end" && view.x(lo) < 90;
      svg
        .append("text")
        .attr("x", view.x(lo) + (under ? 0 : anchor === "end" ? -14 : 14))
        .attr("y", view.y(la) + (under ? 20 : 4))
        .attr("text-anchor", under ? "middle" : anchor)
        .attr("class", "apt-label")
        .text(name);
    }
    const mx = view.x(hero.max.lon);
    const my = view.y(hero.max.lat);
    svg.append("circle").attr("cx", mx).attr("cy", my).attr("r", 9).attr("class", "max-ring");
    svg
      .append("text")
      .attr("x", mx)
      .attr("y", my - 15)
      .attr("text-anchor", "middle")
      .attr("class", "max-label")
      .text(kmh(hero.max.kmh));
    for (const f of flights)
      svg
        .append("g")
        .attr("class", `race-plane race-${f.key}`)
        .attr("id", `plane-${f.key}`)
        .append("path")
        .attr("d", PLANE);
    paint(minute);
  };

  // the race panel: one row per direction, a bar against two marks (no wind, the straight line), a clock
  const panel = $("#open-race");
  const rows = {};
  if (panel) {
    const names = { east: "New York → Paris", west: "Paris → New York" };
    const wrap = el("div", { class: "race-rows" });
    for (const f of flights) {
      const fill = el("i", { class: "rr-fill" });
      const time = el("b", { class: "rr-time" });
      wrap.append(
        el("div", { class: `race-row race-${f.key}` }, [
          el("span", { class: "rr-name", text: names[f.key] }),
          el("span", { class: "rr-bar" }, [
            fill,
            el("s", { class: "rr-calm", style: `left:${(100 * hero.route.nowind) / scale}%` }),
            el("s", { class: "rr-gc", style: `left:${(100 * f.gc) / scale}%` }),
          ]),
          time,
          el("span", { class: "rr-line", text: `ligne droite : ${hm(f.gc)}` }),
        ]),
      );
      rows[f.key] = { fill, time };
    }
    const calm = el("p", { class: "race-calm" }, [
      el("span", {}, [el("s", { "aria-hidden": "true" }), `sans vent : ${hm(hero.route.nowind)}`]),
      el("span", {}, [el("s", { class: "is-gc", "aria-hidden": "true" }), "ligne droite, dans le même vent"]),
    ]);
    const gap = el("p", { class: "race-gap", "aria-live": "polite" });
    const replay = el("button", { type: "button", class: "race-replay", text: "Rejouer" });
    panel.replaceChildren(wrap, calm, gap, replay);
    replay.addEventListener("click", () => play(true));
    rows.gap = gap;
  }

  function paint(m) {
    minute = m;
    if (!view) return;
    const L = line(view);
    for (const f of flights) {
      const p = at(f, m);
      const flown = [...f.path.slice(0, p.i), [p.lat, p.lon]];
      const d = m > 0 ? L(flown) : null;
      svg.select(`#flown-${f.key}`).attr("d", d);
      svg.select(`#flown-halo-${f.key}`).attr("d", d);
      // the heading on screen, from two points along the track
      const q = at(f, Math.min(f.total, m + 4));
      const x = view.x(p.lon);
      const y = view.y(p.lat);
      const angle = (Math.atan2(view.y(q.lat) - y, view.x(q.lon) - x) * 180) / Math.PI + 90;
      svg
        .select(`#plane-${f.key}`)
        .attr("transform", `translate(${x},${y}) rotate(${Number.isFinite(angle) ? angle : 90}) scale(1.35)`)
        .attr("opacity", m > 0 ? 1 : 0);
      const R = rows[f.key];
      if (R) {
        const mm = Math.min(m, f.total);
        R.fill.style.width = `${(100 * mm) / scale}%`;
        R.time.textContent = hm(mm);
        R.fill.parentElement.parentElement.classList.toggle("arrived", m >= f.total);
      }
    }
    if (rows.gap) {
      const done = m >= longest && flights.length > 1;
      // from the minutes on screen, so that the gap is the difference of the two clocks
      const [east, west] = flights.map((f) => Math.round(f.total));
      const dt = west - east;
      const saved = Math.round(flights[1]?.gc) - west;
      rows.gap.textContent = done
        ? `Même distance, même nuit : ${hm(dt)} d'écart, environ ${tonnes((dt * C.KG) / 1000, 0)} de kérosène. Vers New York, contourner le jet par le nord fait déjà gagner ${hm(saved)} sur la ligne droite.`
        : "Les deux avions partent en même temps, à la même vitesse par rapport à l'air. Seul le vent change.";
    }
  }

  // ten seconds for the longest flight; once, when the opening is on screen, or at once without motion
  let raf = 0;
  function play(again = false) {
    cancelAnimationFrame(raf);
    if (reduced()) return paint(longest);
    const ms = 9000 / longest; // per minute of flight
    let t0 = 0;
    const tick = (t) => {
      t0 ||= t;
      const m = (t - t0) / ms;
      paint(Math.min(m, longest));
      if (m < longest) raf = requestAnimationFrame(tick);
    };
    if (again) paint(0);
    raf = requestAnimationFrame(tick);
  }

  wind.setField(field);
  layout();
  wind.start();
  onResize(stage, layout);
  speedLegend($("#open-legend"));
  $("#open-legend").append(
    el("span", { class: "ol-credit" }, [
      "Image : NASA Worldview, VIIRS, 8 février 2020. Vent : ERA5 (Copernicus), 250 hPa, 9 février 2020 à 00 h UTC, figé ; avion à 900 km/h par rapport à l'air, chacun sur sa route la plus rapide. ",
      `Kérosène d'un long-courrier moyen : ${fmtNum(C.KG, 0)} kg par minute de vol (DGAC), `,
      el("a", { href: "#couts", text: "calcul détaillé" }),
      ".",
    ]),
  );
  let started = false;
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !started) {
        started = true;
        setTimeout(() => play(), 500);
      }
    },
    { threshold: 0.35 },
  ).observe(stage);
}

/* ------------------------------------------------------------------ seasonal climatology */
export async function climMap(clim, route) {
  const node = $("#clim-map");
  const seg = $("#clim-season");
  const land = await loadLand();
  const size = clim.nx * clim.ny;
  const fields = Object.fromEntries(
    ["djf", "jja"].map((k) => [
      k,
      { ...clim, u: Float64Array.from(clim[k], (s) => s / 3.6), v: new Float64Array(size) },
    ]),
  );
  const box = { west: -100, east: 25, south: 20, north: 72 };
  let season = "djf";
  const base = el("canvas", { class: "cm-base", "aria-hidden": "true" });
  const speed = el("canvas", { class: "cm-speed", "aria-hidden": "true" });
  const svg = d3.create("svg").attr("class", "cm-svg");
  node.replaceChildren(base, speed, svg.node());
  const draw = () => {
    const width = node.clientWidth;
    const height = Math.round(Math.min(420, Math.max(240, width * 0.55)));
    node.style.height = `${height}px`;
    const view = plateCarree(box, width, height, { fit: "cover", focus: [-38, 46] });
    drawLand(base, land, view, { fill: css("--map-land"), stroke: css("--map-coast") });
    drawSpeed(speed, fields[season], view, { alpha: 0.95, range: [30, 170] });
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    const gc = greatCircle(route[0], route[1], 60);
    svg.append("path").attr("d", line(view)(gc)).attr("class", "route-gc");
    for (const [[la, lo], name, anchor] of [
      [route[0], "New York", "end"],
      [route[1], "Paris", "start"],
    ]) {
      svg.append("circle").attr("cx", view.x(lo)).attr("cy", view.y(la)).attr("r", 3.5).attr("class", "apt");
      svg
        .append("text")
        .attr("x", view.x(lo) + (anchor === "end" ? -7 : 7))
        .attr("y", view.y(la) + 4)
        .attr("text-anchor", anchor)
        .attr("class", "apt-label")
        .text(name);
    }
  };
  seg.replaceChildren(
    ...[
      ["djf", "Hiver"],
      ["jja", "Été"],
    ].map(([k, t]) =>
      el("button", {
        type: "button",
        "aria-pressed": String(k === season),
        text: t,
        onclick: () => {
          season = k;
          seg
            .querySelectorAll("button")
            .forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === t)));
          draw();
        },
      }),
    ),
  );
  draw();
  onResize(node, draw);
  return fields;
}

/** Jet core along one meridian of a climatology field: { lat, kmh }. */
export function coreAt(field, lon) {
  let best = { lat: null, kmh: -1 };
  for (let i = 0; i < field.ny; i++) {
    const lat = field.lat0 + i * field.d;
    const [u] = windAt(field, lat, lon);
    const v = Math.abs(u) * 3.6;
    if (v > best.kmh) best = { lat, kmh: v };
  }
  return best;
}
