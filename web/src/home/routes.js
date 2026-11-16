// @ts-check
// Behind the home page's title: the busiest business-jet routes of Europe in the last year of the data
// (jets.json, routesEu), drawn as arcs between their airports, with a few aircraft flying them. A
// picture of real routes, not a chart: it carries no number and the page says nothing about it. Time
// runs in seconds, not frames (the same speed at 60 and 120 Hz); still with reduced motion, paused when
// out of sight or in a background tab.

const BOX = { lon: [-11, 31], lat: [35.5, 61] };

/** Equirectangular over Europe, scaled by the cosine of the middle latitude, fitted into w × h. */
function projector(w, h) {
  const k = Math.cos((((BOX.lat[0] + BOX.lat[1]) / 2) * Math.PI) / 180);
  const sx = (BOX.lon[1] - BOX.lon[0]) * k;
  const sy = BOX.lat[1] - BOX.lat[0];
  const s = Math.min((w * 0.9) / sx, (h * 1.08) / sy);
  // Europe across the opening, a little right of centre: the title on its west, the board on its east
  const x0 = (w - sx * s) / 2 + w * 0.06;
  const y0 = (h - sy * s) / 2;
  return ([lat, lon]) => [x0 + (lon - BOX.lon[0]) * k * s, y0 + (BOX.lat[1] - lat) * s];
}

/**
 * @param {HTMLElement} node
 * @param {any} J jets.json
 */
export function homeRoutes(node, J) {
  const year = J.compare.at(-1);
  const routes = (J.routesEu?.[year] ?? []).filter(([a, b]) => J.airports[a]?.lat && J.airports[b]?.lat);
  if (!routes.length) return;
  const max = Math.max(...routes.map((r) => r[2]));
  const canvas = document.createElement("canvas");
  node.replaceChildren(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(document.documentElement);
  const hi = css.getPropertyValue("--magenta-hi").trim() || "#f59ac8";
  let arcs = [];
  let W = 0;
  let H = 0;

  const layout = () => {
    const r = node.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = projector(W, H);
    arcs = routes.map(([a, b, n], k) => {
      const p0 = P([J.airports[a].lat, J.airports[a].lon]);
      const p1 = P([J.airports[b].lat, J.airports[b].lon]);
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      // the control point lifts the arc to the north of its chord, like a great circle on this map
      const c = [mx + (p0[1] - p1[1]) * 0.18, my - len * 0.22];
      return { p0, p1, c, w: n / max, phase: (k * 0.37) % 1, speed: 0.05 + (0.04 * ((k * 7) % 5)) / 5 };
    });
  };
  const at = (a, t) => {
    const u = 1 - t;
    return [
      u * u * a.p0[0] + 2 * u * t * a.c[0] + t * t * a.p1[0],
      u * u * a.p0[1] + 2 * u * t * a.c[1] + t * t * a.p1[1],
    ];
  };
  const draw = (time) => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    for (const a of arcs) {
      ctx.strokeStyle = `rgba(166, 182, 198, ${0.1 + 0.22 * a.w})`;
      ctx.lineWidth = 0.6 + 1.4 * a.w;
      ctx.beginPath();
      ctx.moveTo(a.p0[0], a.p0[1]);
      ctx.quadraticCurveTo(a.c[0], a.c[1], a.p1[0], a.p1[1]);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(232, 238, 244, 0.55)";
    for (const a of arcs)
      for (const p of [a.p0, a.p1]) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    // the aircraft: one per busy route, its trail fading behind it
    ctx.fillStyle = hi;
    for (const a of arcs.slice(0, 28)) {
      const t = reduced ? 0.55 : (a.phase + (time / 1000) * a.speed) % 1;
      for (let k = 0; k < 6; k++) {
        const tt = t - k * 0.012;
        if (tt < 0) break;
        const [x, y] = at(a, tt);
        ctx.globalAlpha = (1 - k / 6) * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, 2.2 - k * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  let visible = true;
  let raf = 0;
  const loop = (time) => {
    draw(time);
    if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(loop);
    else raf = 0;
  };
  const start = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  layout();
  draw(0);
  new ResizeObserver(() => {
    layout();
    draw(performance.now());
  }).observe(node);
  if (reduced) return;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start();
  }).observe(node);
  document.addEventListener("visibilitychange", () => !document.hidden && visible && start());
  start();
}
