// The opening: every accident of the period, one small square each, one column per year. The squares of
// accidents whose probable cause names a person light up in orange, once, when the opening is seen.
import { onResize, reducedMotion } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { BIT } from "./facts.js";

const HUMAN = "#ff8a3d";
const OTHER = "rgba(169, 188, 205, 0.3)";
const LABEL = "#a9bccd";

/** [{year, n, person}] from the cells of accidents.json */
export function yearCounts(acc) {
  const out = [];
  for (let y = acc.period[0]; y <= acc.period[1]; y++) out.push({ year: y, n: 0, person: 0 });
  for (const [y, , , mask, n] of acc.cells) {
    const r = out[y - acc.period[0]];
    r.n += n;
    if (mask & BIT.person) r.person += n;
  }
  return out;
}

/** The size of a square and the squares per row that fit every year's column in the box. */
export function layout(years, width, height, gap) {
  const cols = years.length;
  const max = Math.max(...years.map((y) => y.n));
  for (let p = 7; p >= 1.4; p -= 0.1) {
    const k = Math.floor((width - (cols - 1) * gap) / cols / p);
    if (k < 1) continue;
    if (Math.ceil(max / k) * p <= height) return { p, k, colW: k * p };
  }
  return { p: 1.4, k: Math.max(1, Math.floor((width - (cols - 1) * gap) / cols / 1.4)), colW: 0 };
}

export function mosaic(canvas, acc, { onCount } = {}) {
  const years = yearCounts(acc);
  const total = years.reduce((s, y) => s + y.person, 0);
  let t = 0; // progress of the lighting, 0 to 1
  let geo = null;

  const size = () => {
    const box = canvas.parentElement;
    const width = box.clientWidth;
    const narrow = width < 560;
    const height = Math.round(
      narrow ? Math.min(380, width * 0.95) : Math.min(470, Math.max(320, width * 0.62)),
    );
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const gap = narrow ? 3 : 8;
    const labelH = 22;
    const L = layout(years, width, height - labelH, gap);
    geo = { width, height, dpr, gap, labelH, narrow, ...L };
    draw();
  };

  function draw() {
    if (!geo) return;
    const { width, height, dpr, gap, labelH, p, k, colW, narrow } = geo;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const cell = p >= 3 ? p - 1 : p * 0.72;
    const used = years.length * colW + (years.length - 1) * gap;
    const x0 = Math.max(0, (width - used) / 2);
    const base = height - labelH;
    let lit = 0;
    years.forEach((y, ci) => {
      const cx = x0 + ci * (colW + gap);
      const on = Math.round(t * y.person);
      lit += on;
      for (let i = 0; i < y.n; i++) {
        const row = Math.floor(i / k);
        const col = i % k;
        ctx.fillStyle = i < on ? HUMAN : OTHER;
        ctx.fillRect(cx + col * p, base - (row + 1) * p, cell, cell);
      }
      const show = narrow ? ci === 0 || ci === years.length - 1 || y.year % 5 === 0 : true;
      if (show) {
        ctx.fillStyle = LABEL;
        ctx.font = `600 ${narrow ? 12 : 12.5}px Archivo, system-ui, sans-serif`;
        ctx.textAlign = "center";
        const label = narrow || colW >= 34 ? String(y.year) : `’${String(y.year).slice(2)}`;
        ctx.fillText(label, cx + colW / 2, height - 5);
      }
    });
    onCount?.(lit, total);
  }

  function play() {
    if (reducedMotion()) {
      t = 1;
      return draw();
    }
    const ms = 3400;
    let start = 0;
    const tick = (now) => {
      start ||= now;
      const x = Math.min(1, (now - start) / ms);
      t = 1 - (1 - x) ** 3;
      draw();
      if (x < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  size();
  onResize(canvas.parentElement, size);
  let started = false;
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting && !started) {
        started = true;
        setTimeout(play, 300);
      }
    },
    { threshold: 0.3 },
  ).observe(canvas);
  return { years, total, fmt: fmtNum };
}
