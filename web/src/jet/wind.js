// Wind fields on a map: decoding the int8 files of the ETL, a plate carrée view, a raster of
// wind speed and drifting particles that trace the flow. Shared by the home page and the story.
import { geoProjection } from "d3";
import { windAt } from "./route.js";

/** One day of a winds-<year>.bin file ([day][u, v][lat][lon], int8, `scale` m/s per unit). */
export function decodeDay(bytes, grid, day) {
  const size = grid.nx * grid.ny;
  const at = day * 2 * size;
  const u = new Float64Array(size);
  const v = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    u[i] = bytes[at + i] * grid.scale;
    v[i] = bytes[at + size + i] * grid.scale;
  }
  return { ...grid, u, v };
}

/** A single field file (hero.bin: [u, v][lat][lon]). */
export const decodeField = (bytes, grid) => decodeDay(bytes, grid, 0);

export const fieldBox = (f) => ({
  west: f.lon0,
  east: f.lon0 + f.d * (f.nx - 1),
  south: f.lat0,
  north: f.lat0 + f.d * (f.ny - 1),
});

const COS45 = Math.cos(Math.PI / 4);

/**
 * Plate carrée with a standard parallel at 45 N, fitted to width x height px.
 * fit "contain" shows the whole box, "cover" fills the frame (cropping), centred on `focus`.
 */
export function plateCarree(box, width, height, { fit = "contain", focus, pad = 0 } = {}) {
  const spanX = (box.east - box.west) * COS45;
  const spanY = box.north - box.south;
  const pick = fit === "cover" ? Math.max : Math.min;
  const k = pick((width - 2 * pad) / spanX, (height - 2 * pad) / spanY); // px per degree of latitude
  const [flon, flat] = focus || [(box.west + box.east) / 2, (box.south + box.north) / 2];
  let tx = width / 2 - flon * COS45 * k;
  let ty = height / 2 + flat * k;
  if (fit === "cover") {
    // never show the outside of the box
    tx = Math.min(-box.west * COS45 * k, Math.max(width - box.east * COS45 * k, tx));
    ty = Math.max(box.north * k, Math.min(height + box.south * k, ty));
  }
  const view = {
    width,
    height,
    k,
    x: (lon) => tx + lon * COS45 * k,
    y: (lat) => ty - lat * k,
    lon: (x) => (x - tx) / (COS45 * k),
    lat: (y) => (ty - y) / k,
  };
  // the same projection for d3.geoPath (coastlines): d3 cuts the polygons that cross the
  // antimeridian and clips them to the frame
  const proj = geoProjection((l, p) => [l * COS45, p])
    .scale((k * 180) / Math.PI)
    .translate([tx, ty])
    .clipExtent([
      [-2, -2],
      [width + 2, height + 2],
    ]);
  view.stream = (s) => proj.stream(s);
  return view;
}

/** Speed classes for particles and the raster (km/h). */
export const SPEED_STOPS = [0, 80, 140, 200, 260, 320];
const RAMP = [
  [96, 128, 160], // under 80 km/h: slate
  [92, 158, 214], // blue
  [118, 200, 228], // cyan
  [214, 238, 244], // near white
  [255, 214, 140], // pale amber, the core of the jet
  [255, 168, 84], // amber
];
export const speedClass = (kmh) => {
  let c = 0;
  while (c < SPEED_STOPS.length - 1 && kmh >= SPEED_STOPS[c + 1]) c++;
  return c;
};
export const speedRGB = (c) => RAMP[c];

function sizeCanvas(canvas, width, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Wind speed raster under the particles: transparent where calm, glowing where the jet runs. */
export function drawSpeed(canvas, field, view, { alpha = 0.55, range = [60, 340] } = {}) {
  const ctx = sizeCanvas(canvas, view.width, view.height);
  const step = 4;
  const w = Math.ceil(view.width / step);
  const h = Math.ceil(view.height / step);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  const img = octx.createImageData(w, h);
  const box = fieldBox(field);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const lon = view.lon(i * step + step / 2);
      const lat = view.lat(j * step + step / 2);
      if (lon < box.west || lon > box.east || lat < box.south || lat > box.north) continue;
      const [u, v] = windAt(field, lat, lon);
      const kmh = Math.hypot(u, v) * 3.6;
      const t = Math.min(1, Math.max(0, (kmh - range[0]) / (range[1] - range[0])));
      if (t <= 0) continue;
      const c = RAMP[speedClass(kmh)];
      const o = (j * w + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = Math.round(255 * alpha * t ** 1.2);
    }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, view.width, view.height);
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Particles drifting with the wind on a transparent canvas (trails fade so the layer can sit on an
 * image). Returns { setField, swapField, resize, start, stop }. The loop runs only while the canvas is
 * on screen and the tab visible; with reduced motion, one still frame of short streaks is drawn.
 * Motion is timed, not counted in frames, so a 120 Hz screen shows the same speed as a 60 Hz one:
 * `rate` is in degrees per second for a wind of 1 m/s (0.03: the core of a 300 km/h jet crosses about
 * 2.5 degrees of longitude a second); `fade` is the share of a trail kept after 1/60 s.
 */
export function particles(
  canvas,
  { density = 1 / 260, max = 4200, rate = 0.03, width = 1.1, fade = 0.97, life = [2.5, 4.5] } = {},
) {
  let field = null;
  let view = null;
  let ctx = null;
  let n = 0;
  let lon;
  let lat;
  let age;
  let raf = 0;
  let last = 0;
  let onScreen = false;
  let wanted = false;

  const box = () => {
    const b = fieldBox(field);
    return {
      west: Math.max(b.west, view.lon(0)),
      east: Math.min(b.east, view.lon(view.width)),
      south: Math.max(b.south, view.lat(view.height)),
      north: Math.min(b.north, view.lat(0)),
    };
  };
  const lifetime = () => life[0] + Math.random() * (life[1] - life[0]);
  const seed = (i, b, fresh = false) => {
    lon[i] = b.west + Math.random() * (b.east - b.west);
    lat[i] = b.south + Math.random() * (b.north - b.south);
    age[i] = fresh ? Math.random() * life[1] : lifetime(); // seconds left
  };
  const reset = () => {
    if (!field || !view) return;
    ctx = sizeCanvas(canvas, view.width, view.height);
    n = Math.min(max, Math.round(view.width * view.height * density));
    lon = new Float64Array(n);
    lat = new Float64Array(n);
    age = new Float32Array(n);
    const b = box();
    for (let i = 0; i < n; i++) seed(i, b, true);
  };

  const buckets = SPEED_STOPS.map(() => []);
  function step(dt, clear = true) {
    if (clear) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = `rgba(0,0,0,${fade ** (dt * 60)})`;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.globalCompositeOperation = "source-over";
    }
    const b = box();
    const k = rate * dt;
    for (const q of buckets) q.length = 0;
    for (let i = 0; i < n; i++) {
      age[i] -= dt;
      if (age[i] <= 0) {
        seed(i, b);
        continue;
      }
      const [u, v] = windAt(field, lat[i], lon[i]);
      const x0 = view.x(lon[i]);
      const y0 = view.y(lat[i]);
      // true trajectories: a degree of longitude shrinks with the cosine of the latitude
      lon[i] += (u * k) / Math.max(0.2, Math.cos((lat[i] * Math.PI) / 180));
      lat[i] += v * k;
      if (lon[i] < b.west || lon[i] > b.east || lat[i] < b.south || lat[i] > b.north) {
        seed(i, b);
        continue;
      }
      buckets[speedClass(Math.hypot(u, v) * 3.6)].push(x0, y0, view.x(lon[i]), view.y(lat[i]));
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    buckets.forEach((q, c) => {
      if (!q.length) return;
      const [r, g, bl] = RAMP[c];
      ctx.strokeStyle = `rgba(${r},${g},${bl},${0.5 + 0.1 * c})`;
      ctx.beginPath();
      for (let j = 0; j < q.length; j += 4) {
        ctx.moveTo(q[j], q[j + 1]);
        ctx.lineTo(q[j + 2], q[j + 3]);
      }
      ctx.stroke();
    });
  }

  const loop = (t) => {
    // a long pause (tab in the background, a slow frame) must not throw the particles across the map
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    step(dt);
    raf = requestAnimationFrame(loop);
  };
  const still = () => {
    ctx.clearRect(0, 0, view.width, view.height);
    for (let s = 0; s < 40; s++) step(1 / 30, false);
  };
  const run = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    if (!field || !view) return;
    if (reducedMotion()) return still();
    if (wanted && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
  };

  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    run();
  }).observe(canvas);
  document.addEventListener("visibilitychange", run);

  return {
    /** Change the wind without wiping the trails (a field that evolves during a flight). */
    swapField(f) {
      field = f;
      if (view && !n) reset();
    },
    setField(f) {
      field = f;
      if (view && !n) reset();
      if (ctx) ctx.clearRect(0, 0, view.width, view.height);
      run();
    },
    resize(v) {
      view = v;
      reset();
      run();
    },
    start() {
      wanted = true;
      run();
    },
    stop() {
      wanted = false;
      run();
    },
    get running() {
      return raf !== 0;
    },
  };
}
