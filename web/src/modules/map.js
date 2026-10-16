import * as d3 from "d3";
import { $, el, rich, segmented, showTip, hideTip, onResize, cssVar, reducedMotion } from "../lib/ui.js";
import { yearSum, pctChange, isNum } from "../lib/series.js";
import { fmtPax, fmtPct, fmtPctAbs, fmtNum, ordinal } from "../lib/format.js";
import { selection } from "../lib/data.js";

const SHORT = {
  LFPG: "Roissy-CDG",
  LFPO: "Orly",
  LFOB: "Beauvais",
  LFSB: "Bâle-Mulhouse",
  LFML: "Marseille",
};
export const shortName = (a) => {
  if (SHORT[a.code]) return SHORT[a.code];
  const parts = a.nom.split(/-| \(/);
  return /^Sainte?$/.test(parts[0]) && parts[1] ? `${parts[0]}-${parts[1]}` : parts[0];
};

export function initMap(data) {
  const { months, airports } = data.aeroports;
  const years = d3.range(+months[0].slice(0, 4), +months.at(-1).slice(0, 4) + 1);
  const lastYear = years.at(-1);
  const annual = new Map(
    airports.map((a) => [a.code, new Map(years.map((y) => [y, yearSum(months, a.pax, y)]))]),
  );
  const paxOf = (a, y) => annual.get(a.code).get(y);
  const deltaOf = (a, y) => pctChange(paxOf(a, 2019), paxOf(a, y));
  const metro = airports.filter((a) => a.zone === "MET");
  const om = airports.filter((a) => a.zone === "OM");
  const maxPax = d3.max(airports, (a) => d3.max(years, (y) => paxOf(a, y)));

  const state = { year: lastYear, mode: "pax", hover: null, playing: null };
  const mapNode = $("#map");
  let geo = null;
  let width = mapNode.clientWidth || 640;
  const svg = d3.select(mapNode).append("svg");
  const defs = svg.append("defs");
  defs
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%")
    .append("feGaussianBlur")
    .attr("stdDeviation", 4);
  const gLand = svg.append("g");
  const gHalo = svg.append("g").attr("filter", "url(#glow)");
  const gDots = svg.append("g");
  const gLabels = svg.append("g");
  let projection = null;
  let r = null;

  // ---------------------------------------------------------------- hero text
  const f = data.fracture.annual;
  const iY = f.years.indexOf(lastYear);
  const i19 = f.years.indexOf(2019);
  const ms = data.fracture.months;
  const fsc = (k, y) => yearSum(ms, data.fracture.faisceaux[k] || [], y);
  const radial = pctChange(fsc("MET_RAD", 2019), fsc("MET_RAD", lastYear));
  $("#dek").replaceChildren(
    rich([
      `Le trafic aérien commercial français a atteint `,
      { b: `${fmtNum(f.TOTAL[iY] / 1e6, 1)} millions` },
      ` de passagers en ${lastYear}, `,
      { b: fmtPct(pctChange(f.TOTAL[i19], f.TOTAL[iY])) },
      ` par rapport à 2019. Mais la reprise est à deux vitesses : l'international a gagné `,
      { b: fmtPctAbs(pctChange(f.INTL[i19], f.INTL[iY])) },
      `, quand les vols entre Paris et la province ont perdu `,
      { b: fmtPctAbs(radial) },
      `. Sur la carte, chaque cercle est un aéroport.`,
    ]),
  );

  // ---------------------------------------------------------------- controls
  const slider = $("#year");
  Object.assign(slider, { min: years[0], max: lastYear, step: 1, value: lastYear });
  slider.addEventListener("input", () => {
    stop();
    setYear(+slider.value);
  });
  segmented(
    $("#map-mode"),
    state.mode,
    (m) => {
      state.mode = m;
      paint(false);
    },
    "mode",
  );

  const playBtn = $("#play");
  const PLAY =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
  const PAUSE =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
  function stop() {
    if (state.playing) clearInterval(state.playing);
    state.playing = null;
    playBtn.innerHTML = PLAY;
    playBtn.setAttribute("aria-label", "Lancer l'animation de 1990 à aujourd'hui");
  }
  playBtn.addEventListener("click", () => {
    if (state.playing) return stop();
    if (state.year >= lastYear) setYear(years[0]);
    playBtn.innerHTML = PAUSE;
    playBtn.setAttribute("aria-label", "Mettre l'animation en pause");
    state.playing = setInterval(
      () => {
        if (state.year >= lastYear) return stop();
        setYear(state.year + 1);
      },
      reducedMotion() ? 700 : 380,
    );
  });

  function setYear(y) {
    state.year = y;
    slider.value = y;
    paint(true);
  }

  // ---------------------------------------------------------------- drawing
  function layout() {
    if (!geo) return;
    const height = Math.round(width * 0.92);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    projection = d3
      .geoConicConformal()
      .parallels([44, 49])
      .rotate([-3, 0])
      .fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        geo,
      );
    gLand
      .selectAll("path")
      .data([geo])
      .join("path")
      .attr("class", "map-land")
      .attr("d", d3.geoPath(projection));
    r = d3
      .scaleSqrt()
      .domain([0, maxPax])
      .range([0, Math.max(22, width * 0.062)]);
    paint(false, true);
  }

  const radius = (a) => {
    const p = paxOf(a, state.year);
    return isNum(p) && p > 0 ? Math.max(2.2, r(p)) : 0;
  };

  function colorOf(a) {
    if (state.mode === "pax") return cssVar("--glow");
    const d = deltaOf(a, state.year);
    if (!isNum(d)) return cssVar("--div-mid");
    const t = Math.max(-1, Math.min(1, d / 60));
    const mid = cssVar("--div-mid");
    return t < 0
      ? d3.interpolateRgb(mid, cssVar("--div-down"))(-t)
      : d3.interpolateRgb(mid, cssVar("--div-up"))(t);
  }

  function paint(animate, initial = false) {
    if (!projection) return;
    $("#map-year").textContent = state.year;
    $("#year-out").textContent = state.year;
    const dur = animate && !reducedMotion() ? 320 : 0;
    const ordered = [...metro].sort((a, b) => (paxOf(b, state.year) ?? 0) - (paxOf(a, state.year) ?? 0));
    const xy = (a) => projection([a.lon, a.lat]);

    gHalo
      .selectAll("circle")
      .data(ordered, (a) => a.code)
      .join("circle")
      .attr("class", "airport-halo")
      .attr("cx", (a) => xy(a)[0])
      .attr("cy", (a) => xy(a)[1])
      .transition()
      .duration(dur)
      .attr("r", (a) => (state.mode === "pax" && radius(a) ? radius(a) * 1.35 + 5 : 0));

    const dots = gDots
      .selectAll("circle")
      .data(ordered, (a) => a.code)
      .join((enter) =>
        enter
          .append("circle")
          .attr("class", "airport-dot")
          .attr("r", 0)
          .attr("tabindex", -1)
          .on("pointerenter pointermove", (event, a) => hover(a, event))
          .on("pointerleave", () => hover(null))
          .on("click", (_, a) => selection.set(a.code)),
      )
      .attr("cx", (a) => xy(a)[0])
      .attr("cy", (a) => xy(a)[1])
      .classed("is-selected", (a) => a.code === selection.get())
      .classed("is-dim", (a) => state.hover && a.code !== state.hover)
      .style("fill", colorOf);
    dots.order();
    const t = dots.transition().duration(initial && !reducedMotion() ? 900 : dur);
    if (initial && !reducedMotion()) t.delay((_, i) => Math.min(i * 6, 500));
    t.attr("r", radius);

    // labels: biggest airports first, each placed right/left/below/above where it collides with nothing
    const top = ordered.filter((a) => (paxOf(a, state.year) ?? 0) > 0).slice(0, width < 480 ? 6 : 12);
    const sel = metro.find((a) => a.code === selection.get());
    const candidates = sel && !top.includes(sel) ? [sel, ...top] : top;
    const circles = ordered
      .filter((a) => radius(a) > 5)
      .map((a) => ({ x: xy(a)[0], y: xy(a)[1], r: radius(a), code: a.code }));
    const hitsCircle = (b, c) => {
      const nx = Math.max(b.x0, Math.min(c.x, b.x1));
      const ny = Math.max(b.y0, Math.min(c.y, b.y1));
      return Math.hypot(nx - c.x, ny - c.y) < c.r;
    };
    const boxes = [];
    const labels = [];
    for (const a of candidates) {
      const [cx, cy] = xy(a);
      const rr = radius(a);
      const w = shortName(a).length * 6.3 + 4;
      const spots = [
        { x: cx + rr + 4, y: cy + 4, anchor: "start" },
        { x: cx - rr - 4, y: cy + 4, anchor: "end" },
        { x: cx, y: cy + rr + 13, anchor: "middle" },
        { x: cx, y: cy - rr - 5, anchor: "middle" },
      ];
      for (const o of spots) {
        const x0 = o.anchor === "start" ? o.x : o.anchor === "end" ? o.x - w : o.x - w / 2;
        const b = { x0, x1: x0 + w, y0: o.y - 10, y1: o.y + 3 };
        if (b.x0 < 2 || b.x1 > width - 2) continue;
        const clash =
          boxes.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0) ||
          circles.some((c) => c.code !== a.code && hitsCircle(b, c));
        if (!clash) {
          boxes.push(b);
          labels.push({ a, ...o });
          break;
        }
      }
    }
    gLabels
      .selectAll("text")
      .data(labels, (d) => d.a.code)
      .join("text")
      .attr("class", "map-label")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", (d) => d.anchor)
      .text((d) => shortName(d.a));

    renderSide();
    renderLegend();
  }

  function hover(a, event) {
    state.hover = a ? a.code : null;
    gDots.selectAll("circle").classed("is-dim", (d) => state.hover && d.code !== state.hover);
    $("#rank-list")
      .querySelectorAll("li")
      .forEach((li) => li.setAttribute("aria-selected", String(li.dataset.code === state.hover)));
    if (!a) return hideTip();
    showTip(event, a.nom, tipRows(a));
  }

  function tipRows(a) {
    const p = paxOf(a, state.year);
    const rows = [{ label: `passagers en ${state.year}`, value: fmtPax(p) }];
    const d = deltaOf(a, state.year);
    if (state.year !== 2019 && isNum(d)) rows.push({ label: "par rapport à 2019", value: fmtPct(d) });
    const rank = rankOf(a);
    if (rank) rows.push({ label: "rang national", value: ordinal(rank) });
    return rows;
  }

  const ranking = () =>
    airports
      .filter((a) => (paxOf(a, state.year) ?? 0) > 0)
      .sort((a, b) => paxOf(b, state.year) - paxOf(a, state.year));
  const rankOf = (a) => ranking().findIndex((d) => d.code === a.code) + 1 || null;

  function renderSide() {
    const ranked = ranking();
    $("#rank-title").textContent = `Les 10 premiers aéroports en ${state.year}`;
    $("#rank-list").replaceChildren(
      ...ranked.slice(0, 10).map((a, i) => {
        const d = deltaOf(a, state.year);
        const li = el(
          "li",
          { tabindex: 0, "data-code": a.code, "aria-selected": String(a.code === selection.get()) },
          [
            el("span", { class: "r", text: i + 1 }),
            el("span", { class: "n", text: shortName(a) }),
            el("span", { class: "v", text: fmtPax(paxOf(a, state.year)) }),
            el("span", {
              class: `d ${isNum(d) && state.year !== 2019 ? (d >= 0 ? "up" : "down") : ""}`,
              text: state.year === 2019 ? "réf." : fmtPct(d),
              title: "Évolution par rapport à 2019",
            }),
          ],
        );
        li.addEventListener("pointerenter", (e) => a.zone === "MET" && hover(a, e));
        li.addEventListener("pointerleave", () => hover(null));
        li.addEventListener("click", () => selection.set(a.code, { scroll: true }));
        li.addEventListener("keydown", (e) => e.key === "Enter" && selection.set(a.code, { scroll: true }));
        return li;
      }),
    );
    const omSorted = [...om]
      .sort((a, b) => (paxOf(b, state.year) ?? 0) - (paxOf(a, state.year) ?? 0))
      .filter((a) => paxOf(a, state.year) > 0);
    $("#om-row").replaceChildren(
      ...omSorted.slice(0, 10).map((a) => {
        const s = Math.max(5, Math.min(22, r ? r(paxOf(a, state.year)) * 0.9 : 8));
        const b = el(
          "button",
          { type: "button", title: `${a.nom} : ${fmtPax(paxOf(a, state.year))} passagers` },
          [el("i", { style: `width:${s}px;height:${s}px;background:${colorOf(a)}` }), shortName(a)],
        );
        b.addEventListener("click", () => selection.set(a.code, { scroll: true }));
        b.addEventListener("pointerenter", (e) => showTip(e, a.nom, tipRows(a)));
        b.addEventListener("pointerleave", hideTip);
        return b;
      }),
    );
  }

  function renderLegend() {
    const lg = $("#map-legend");
    if (state.mode === "delta") {
      lg.replaceChildren(
        el("span", { text: "Recul" }),
        el("span", { class: "ramp", "aria-hidden": "true" }),
        el("span", { text: "Hausse" }),
        el("span", { text: `Évolution du trafic ${state.year} par rapport à 2019 (échelle bornée à ±60 %)` }),
      );
    } else {
      // nested, bottom-aligned circles at the map's true scale
      const sizes = [50e6, 10e6, 1e6];
      const rMax = r ? r(sizes[0]) : 20;
      const h = rMax * 2 + 14;
      const svgL = d3
        .create("svg")
        .attr("width", rMax * 2 + 70)
        .attr("height", h)
        .attr("aria-hidden", "true");
      sizes.forEach((v) => {
        const rr = r ? r(v) : 4;
        const cy = h - 2 - rr;
        svgL
          .append("circle")
          .attr("cx", rMax + 2)
          .attr("cy", cy)
          .attr("r", rr)
          .style("fill", "none")
          .style("stroke", "var(--muted)");
        svgL
          .append("line")
          .attr("x1", rMax + 2)
          .attr("x2", rMax * 2 + 14)
          .attr("y1", cy - rr)
          .attr("y2", cy - rr)
          .style("stroke", "var(--axis)")
          .style("stroke-dasharray", "2 2");
        svgL
          .append("text")
          .attr("x", rMax * 2 + 18)
          .attr("y", cy - rr + 4)
          .attr("class", "map-label")
          .style("stroke", "none")
          .text(`${v / 1e6} M`);
      });
      lg.replaceChildren(svgL.node(), el("span", { text: "Surface du cercle : passagers de l'année" }));
    }
  }

  selection.on(() => paint(false));
  new MutationObserver(() => paint(false)).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => paint(false));

  fetch("geo/metropole.geojson")
    .then((res) => res.json())
    .then((g) => {
      geo = g;
      layout();
    })
    .catch(() =>
      mapNode.append(el("p", { class: "note", text: "Le fond de carte n'a pas pu être chargé." })),
    );
  onResize(mapNode, (w) => {
    width = w;
    layout();
  });
}
