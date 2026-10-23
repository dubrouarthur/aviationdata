import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./jet.css";
import "./home.css";
import * as d3 from "d3";
import { watchFrenchSpacing } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { decodeField, particles, plateCarree, fieldBox } from "./jet/wind.js";
import { loadLand } from "./jet/maps.js";

watchFrenchSpacing(document.body);

/** The lead story's map, live behind its headline: the jet stream of the night of storm Ciara. */
async function leadWind() {
  const section = document.querySelector(".lead");
  const canvas = document.getElementById("lead-wind");
  if (!section || !canvas) return;
  const land = document.createElement("canvas");
  land.className = "lead-land";
  land.setAttribute("aria-hidden", "true");
  canvas.before(land);
  const [grid, bytes, geo] = await Promise.all([
    fetch(asset("data/jet/hero.json")).then((r) => r.json()),
    fetch(asset("data/jet/hero.bin"))
      .then((r) => r.arrayBuffer())
      .then((b) => new Int8Array(b)),
    loadLand(),
  ]);
  const field = decodeField(bytes, grid);
  const box = { ...fieldBox(field), south: 22, north: 72, west: -95 };
  const wind = particles(canvas, { density: 1 / 230, speed: 0.018, width: 1.1 });
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const layout = () => {
    const width = section.clientWidth;
    const height = section.clientHeight;
    const view = plateCarree(box, width, height, {
      fit: "cover",
      focus: width < 700 ? [-30, 50] : [-38, 47],
    });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    land.width = Math.round(width * dpr);
    land.height = Math.round(height * dpr);
    land.style.width = `${width}px`;
    land.style.height = `${height}px`;
    const ctx = land.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    d3.geoPath(view, ctx)(geo);
    ctx.fillStyle = css("--map-land");
    ctx.fill();
    ctx.strokeStyle = css("--map-coast");
    ctx.lineWidth = 0.8;
    ctx.stroke();
    wind.resize(view);
  };
  wind.setField(field);
  layout();
  wind.start();
  let w = section.clientWidth;
  new ResizeObserver(() => {
    if (section.clientWidth !== w) {
      w = section.clientWidth;
      layout();
    }
  }).observe(section);
}

leadWind().catch((err) => console.error("lead wind:", err));
