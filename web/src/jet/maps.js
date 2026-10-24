// The dark maps of the jet-stream story: the opening night of storm Ciara and the seasonal
// climatology (the day-by-day explorer lives in explorer.js).
import * as d3 from "d3";
import { feature } from "topojson-client";
import { $, el, onResize } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { decodeField, drawSpeed, particles, plateCarree, SPEED_STOPS, speedRGB } from "./wind.js";
import { greatCircle, windAt } from "./route.js";
import { kmh } from "./fmt.js";

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
export async function openMap(hero) {
  const stage = $("#open-map");
  const img = $("#open-sat");
  const svg = d3.select("#open-routes");
  const [bytes] = await Promise.all([
    fetch(asset("data/jet/hero.bin"))
      .then((r) => r.arrayBuffer())
      .then((b) => new Int8Array(b)),
  ]);
  const field = decodeField(bytes, hero);
  const [s, w, n, e] = hero.image.bbox;
  const box = { south: s, west: w, north: n, east: e };
  const wind = particles($("#open-wind"), { density: 1 / 210, speed: 0.009, width: 1.15, fade: 0.955 });
  const layout = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const narrow = width < 700;
    const view = plateCarree(box, width, height, { fit: "cover", focus: narrow ? [-38, 46] : [-40, 44] });
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
    svg.append("path").attr("d", L(r.fast)).attr("class", "route-halo");
    svg.append("path").attr("d", L(r.fast)).attr("class", "route-east");
    const ends = [
      [r.gc[0], "New York", "end"],
      [r.gc.at(-1), "Paris", "start"],
    ];
    for (const [[la, lo], name, anchor] of ends) {
      svg.append("circle").attr("cx", view.x(lo)).attr("cy", view.y(la)).attr("r", 4).attr("class", "apt");
      svg
        .append("text")
        .attr("x", view.x(lo) + (anchor === "end" ? -8 : 8))
        .attr("y", view.y(la) + 4)
        .attr("text-anchor", anchor)
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
  };
  wind.setField(field);
  layout();
  wind.start();
  onResize(stage, layout);
  speedLegend($("#open-legend"));
  $("#open-legend").append(
    el("span", { class: "ol-routes" }, [
      el("i", { class: "k-gc" }),
      "route la plus courte",
      el("i", { class: "k-east" }),
      "route la plus rapide (modèle)",
    ]),
    el("span", {
      class: "ol-credit",
      text: "Image : NASA Worldview, VIIRS, 8 février 2020. Vent : ERA5 (Copernicus), 250 hPa, 9 février 2020 à 00 h UTC.",
    }),
  );
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
