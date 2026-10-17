import * as d3 from "d3";
import { $, el, rich, moments, showTip, hideTip, onResize, cssVar, keyFigures } from "../lib/ui.js";
import { player } from "../lib/scrolly.js";
import { yearSum, pctChange, isNum } from "../lib/series.js";
import { fmtPax, fmtPct, fmtPctAbs, fmtNum, monthShort } from "../lib/format.js";
import { shortName } from "./names.js";

const PARIS = new Set(["LFPG", "LFPO", "LFOB"]);
const RYANAIR_EXITS = ["LFBE", "LFSL", "LFST", "LFLC"];
const isMetro = (p) => p.lat > 41 && p.lat < 51.6 && p.lon > -5.6 && p.lon < 10;

/** Domestic France: detailed routes (PAP) and airport traffic (APT), 1990 -> today, with clickable moments. */
export function initFrance(data, { france }) {
  const R = data.routes;
  const A = data.aeroports;
  const Fr = data.fracture;
  const years = A.years.filter((y) => R.years.includes(y));
  const lastYear = years.at(-1);
  const ry = (y) => R.years.indexOf(y);
  const aYear = new Map(
    A.airports.map((a) => [a.code, new Map(years.map((y) => [y, yearSum(A.months, a.pax, y)]))]),
  );
  const metroAirports = A.airports.filter((a) => a.zone === "MET");
  const pairs = R.pairs.filter((p) => {
    const a = R.airports[p.a];
    const b = R.airports[p.b];
    return a?.fr && b?.fr && isMetro(a) && isMetro(b);
  });
  const pmax = d3.max(pairs, (p) => d3.max(p.pax)) || 1;
  const amax = d3.max(metroAirports, (a) => d3.max(years, (y) => aYear.get(a.code).get(y))) || 1;
  const fsc = (k, y) => yearSum(Fr.months, Fr.faisceaux[k] || [], y);
  const routesCount = (y) => pairs.filter((p) => p.pax[ry(y)] > 0).length;

  const state = { year: 2000, mode: "plain", focus: [] };
  const node = $("#france-map");
  let width = node.clientWidth || 600;
  const svg = d3.select(node).append("svg");
  const gLand = svg.append("g");
  const gRoutes = svg.append("g");
  const gAirports = svg.append("g");
  const gLabels = svg.append("g");
  let projection = null;

  function layout() {
    const h = Math.round(Math.min(width * 0.95, window.innerHeight * 0.74));
    svg.attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    projection = d3
      .geoConicConformal()
      .parallels([44, 49])
      .rotate([-3, 0])
      .fitExtent(
        [
          [16, 70],
          [width - 16, h - 10],
        ],
        france,
      );
    gLand
      .selectAll("path")
      .data([france])
      .join("path")
      .attr("d", d3.geoPath(projection))
      .style("fill", "var(--card)")
      .style("stroke", "var(--axis)")
      .style("stroke-width", 1);
    paint(false);
  }

  const xy = (code) => projection([R.airports[code]?.lon ?? 0, R.airports[code]?.lat ?? 0]);
  const axy = (a) => projection([a.lon, a.lat]);
  const wScale = () =>
    d3
      .scaleSqrt()
      .domain([0, pmax])
      .range([0, Math.max(7, width * 0.014)]);
  const rScale = () =>
    d3
      .scaleSqrt()
      .domain([0, amax])
      .range([0, Math.max(18, width * 0.045)]);

  function curve(p) {
    const [x1, y1] = xy(p.a);
    const [x2, y2] = xy(p.b);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const k = 0.18;
    return `M${x1},${y1} Q${mx - dy * k},${my + dx * k} ${x2},${y2}`;
  }

  function paint(animate = true) {
    if (!projection) return;
    const w = wScale();
    const r = rScale();
    const yi = ry(state.year);
    const dur = animate ? 500 : 0;
    $("#france-year").replaceChildren(
      String(state.year),
      el("small", {
        text: `${fmtPax(fsc("MET_RAD", state.year))} passagers Paris–province, ${fmtPax(fsc("MET_TRA", state.year))} province–province`,
      }),
    );
    const live = pairs.filter((p) => p.pax[yi] > 0).sort((a, b) => a.pax[yi] - b.pax[yi]);
    gRoutes
      .selectAll("path")
      .data(live, (p) => `${p.a}_${p.b}`)
      .join(
        (enter) =>
          enter
            .append("path")
            .style("fill", "none")
            .style("stroke-linecap", "round")
            .style("opacity", 0)
            .attr("d", curve),
        (update) => update,
        (exit) => exit.transition().duration(dur).style("opacity", 0).remove(),
      )
      .attr("d", curve)
      .style("stroke", (p) => (PARIS.has(p.a) || PARIS.has(p.b) ? cssVar("--magenta") : cssVar("--teal")))
      .on("pointermove", (event, p) =>
        showTip(event, `${R.airports[p.a].nom} ↔ ${R.airports[p.b].nom}`, [
          {
            label: `passagers en ${state.year}`,
            value: fmtPax(p.pax[yi]),
            color: PARIS.has(p.a) || PARIS.has(p.b) ? "var(--magenta)" : "var(--teal)",
          },
          { label: "vols", value: fmtNum(p.vols[yi]) },
          { label: "distance", value: `${fmtNum(p.dist)} km` },
          ...(isNum(p.pax[ry(2019)]) && p.pax[ry(2019)] > 0 && state.year !== 2019
            ? [{ label: "par rapport à 2019", value: fmtPct(pctChange(p.pax[ry(2019)], p.pax[yi]), 0) }]
            : []),
        ]),
      )
      .on("pointerleave", hideTip)
      .transition()
      .duration(dur)
      .style("opacity", 0.78)
      .style("stroke-width", (p) => Math.max(0.8, w(p.pax[yi])));

    const delta = (a) => pctChange(aYear.get(a.code).get(2019), aYear.get(a.code).get(state.year));
    const div = (a) => {
      const d = delta(a);
      if (!isNum(d)) return cssVar("--axis");
      const t = Math.max(-1, Math.min(1, d / 50));
      return t < 0
        ? d3.interpolateRgb("#e9ecea", cssVar("--magenta"))(-t)
        : d3.interpolateRgb("#e9ecea", cssVar("--blue"))(t);
    };
    const shown = metroAirports.filter((a) => (aYear.get(a.code).get(state.year) ?? 0) > 0);
    gAirports
      .selectAll("circle")
      .data(shown, (a) => a.code)
      .join(
        (enter) => enter.append("circle").attr("r", 0),
        (update) => update,
        (exit) => exit.transition().duration(dur).attr("r", 0).remove(),
      )
      .attr("cx", (a) => axy(a)[0])
      .attr("cy", (a) => axy(a)[1])
      .style("stroke", (a) => (state.focus.includes(a.code) ? "var(--ink)" : "var(--card)"))
      .style("stroke-width", (a) => (state.focus.includes(a.code) ? 2.2 : 1))
      .on("pointermove", (event, a) => {
        const v = aYear.get(a.code).get(state.year);
        showTip(event, a.nom, [
          { label: `passagers en ${state.year}`, value: fmtPax(v) },
          ...(state.year !== 2019 && isNum(delta(a))
            ? [{ label: "par rapport à 2019", value: fmtPct(delta(a)) }]
            : []),
        ]);
      })
      .on("pointerleave", hideTip)
      .transition()
      .duration(dur)
      .attr("r", (a) => Math.max(2.2, r(aYear.get(a.code).get(state.year))))
      .style("fill", (a) => (state.mode === "delta" ? div(a) : "rgba(15,28,43,0.16)"));

    const labelled = [...shown]
      .sort((a, b) => aYear.get(b.code).get(state.year) - aYear.get(a.code).get(state.year))
      .slice(0, width < 520 ? 6 : 11)
      .concat(shown.filter((a) => state.focus.includes(a.code)));
    // labels go right of the circle, or left when they would leave the frame; overlapping ones are dropped
    const boxes = [];
    const side = new Map();
    const fits = (a) => {
      const [px, py] = axy(a);
      const rr = Math.max(2.2, r(aYear.get(a.code).get(state.year)));
      const tw = (shortName(a).length + (state.mode === "delta" ? 5 : 0)) * 6.4;
      const left = px + rr + 6 + tw > width;
      const b = left
        ? { x0: px - rr - 6 - tw, x1: px - rr - 3, y0: py - 7, y1: py + 7 }
        : { x0: px + rr + 3, x1: px + rr + 6 + tw, y0: py - 7, y1: py + 7 };
      if (boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) return false;
      boxes.push(b);
      side.set(a.code, left ? -1 : 1);
      return true;
    };
    const focusFirst = [...new Set(labelled)].sort(
      (a, b) => state.focus.includes(b.code) - state.focus.includes(a.code),
    );
    gLabels
      .selectAll("text")
      .data(focusFirst.filter(fits), (a) => a.code)
      .join("text")
      .attr("class", "end-label")
      .style("font-weight", (a) => (state.focus.includes(a.code) ? 750 : 550))
      .attr("text-anchor", (a) => (side.get(a.code) < 0 ? "end" : "start"))
      .attr(
        "x",
        (a) => axy(a)[0] + side.get(a.code) * (Math.max(2.2, r(aYear.get(a.code).get(state.year))) + 4),
      )
      .attr("y", (a) => axy(a)[1] + 4)
      .text((a) =>
        state.mode === "delta" && state.year !== 2019
          ? `${shortName(a)} ${fmtPct(delta(a), 0)}`
          : shortName(a),
      );

    $("#france-legend").replaceChildren(
      el("span", { class: "lg" }, [el("i", { style: "--c:var(--magenta)" }), "liaison avec Paris"]),
      el("span", { class: "lg" }, [
        el("i", { style: "--c:var(--teal)" }),
        "liaison entre villes de province",
      ]),
      state.mode === "delta"
        ? el("span", { class: "lg" }, [
            el("i", { class: "dot", style: "--c:var(--magenta)" }),
            "aéroport en recul depuis 2019",
          ])
        : el("span", { class: "lg" }, [
            el("i", { class: "dot", style: "--c:rgba(15,28,43,0.3)" }),
            "aéroport, taille : passagers",
          ]),
    );
  }

  let timelineHook = () => {};
  const timeline = player({
    button: $("#france-play"),
    slider: $("#france-slider"),
    output: $("#france-out"),
    values: years,
    interval: 600,
    labels: { play: "Lancer l'animation des liaisons intérieures", pause: "Mettre en pause" },
    onChange: (y) => {
      state.year = y;
      state.mode = "plain";
      state.focus = [];
      paint(true);
      timelineHook(y);
    },
  });

  // ---------------------------------------------------------------- intro and key figures
  {
    const pk = d3.greatest(years, (y) => fsc("MET_RAD", y));
    $("#france-text").replaceChildren(
      el(
        "p",
        {},
        rich([
          `Les liaisons entre Paris et la province ont longtemps été le cœur du réseau intérieur : `,
          { b: `${fmtNum(fsc("MET_RAD", pk) / 1e6, 1)} millions` },
          ` de passagers en ${pk}, leur record. Il en reste `,
          { b: `${fmtNum(fsc("MET_RAD", lastYear) / 1e6, 1)} millions` },
          ` en ${lastYear}. Choisissez un moment ou faites glisser les années pour voir la carte s'éclaircir.`,
        ]),
      ),
    );
    keyFigures($("#kf-france"), [
      {
        value: fmtPct(pctChange(fsc("MET_RAD", 2019), fsc("MET_RAD", lastYear)), 0),
        label: `de passagers entre Paris et la province depuis 2019`,
        color: "var(--magenta)",
      },
      {
        value: fmtPct(pctChange(fsc("MET_TRA", 2019), fsc("MET_TRA", lastYear)), 0),
        label: "entre villes de province",
        color: "var(--teal)",
      },
    ]);
  }

  // ---------------------------------------------------------------- moments (preset views) and captions
  const exits = RYANAIR_EXITS.map((c) => A.airports.find((a) => a.code === c)).filter(Boolean);
  const peak = d3.greatest(years, (y) => fsc("MET_RAD", y));
  const vs19 = (a) => fmtPct(pctChange(aYear.get(a.code).get(2019), aYear.get(a.code).get(lastYear)), 0);
  const CAPTIONS = {
    peak: [
      `${peak}, l'âge d'or des lignes intérieures`,
      [
        `Les liaisons entre Paris et la province transportent `,
        { b: `${fmtNum(fsc("MET_RAD", peak) / 1e6, 1)} millions` },
        ` de passagers, leur record. Les arcs magenta partent de Paris vers toutes les grandes villes.`,
      ],
    ],
    2019: [
      "2019, le déclin a déjà commencé",
      [
        `Paris–province a perdu `,
        { b: fmtPctAbs(pctChange(fsc("MET_RAD", peak), fsc("MET_RAD", 2019)), 0) },
        ` de ses passagers depuis ${peak}, des années où le TGV a atteint Marseille (2001), puis Bordeaux et Rennes (2017). Les liaisons entre villes de province, elles, montent à `,
        { b: `${fmtNum(fsc("MET_TRA", 2019) / 1e6, 1)} millions` },
        ` de passagers.`,
      ],
    ],
    last: [
      `${lastYear}, la chute`,
      [
        `Depuis 2019, Paris–province a perdu `,
        { b: fmtPctAbs(pctChange(fsc("MET_RAD", 2019), fsc("MET_RAD", lastYear))) },
        ` de ses passagers, province–province `,
        { b: fmtPctAbs(pctChange(fsc("MET_TRA", 2019), fsc("MET_TRA", lastYear))) },
        `. Les liaisons assez fréquentées pour être détaillées par la DGAC (trois compagnies au moins) passent de ${routesCount(2019)} à ${routesCount(lastYear)}.`,
      ],
    ],
    delta: [
      "Les aéroports régionaux décrochent",
      [`En bleu, les aéroports qui ont gagné des passagers depuis 2019 ; en magenta, ceux qui en ont perdu.`],
      [
        `Ryanair a cessé de desservir Brive et Strasbourg à l'hiver 2025, puis Clermont-Ferrand fin mars 2026, et réduit son programme à Bergerac, en invoquant la hausse de la taxe sur les billets. Ces départs n'apparaîtront pleinement que dans les chiffres 2026. En ${lastYear}, par rapport à 2019 : ${exits
          .map((a) => `${shortName(a)} ${vs19(a)}`)
          .join(", ")}.`,
      ],
    ],
  };
  const VIEWS = {
    peak: { year: peak, mode: "plain", focus: [] },
    2019: { year: 2019, mode: "plain", focus: [] },
    last: { year: lastYear, mode: "plain", focus: [] },
    delta: { year: lastYear, mode: "delta", focus: RYANAIR_EXITS },
  };
  function caption(key) {
    const box = $("#france-caption");
    if (!key) {
      box.replaceChildren(
        el("h3", { text: String(state.year) }),
        el(
          "p",
          {},
          rich([
            { b: fmtPax(fsc("MET_RAD", state.year)) },
            ` passagers entre Paris et la province, `,
            { b: fmtPax(fsc("MET_TRA", state.year)) },
            ` entre villes de province. ${routesCount(state.year)} liaisons détaillées sur la carte.`,
          ]),
        ),
      );
      return;
    }
    const [title, ...parts] = CAPTIONS[key];
    box.replaceChildren(el("h3", { text: title }), ...parts.map((p) => el("p", {}, rich(p))));
  }
  const tabs = moments(
    $("#france-moments"),
    [
      { key: "peak", label: String(peak), hint: "l'âge d'or" },
      { key: "2019", label: "2019", hint: "avant le Covid" },
      { key: "last", label: String(lastYear), hint: "la chute" },
      { key: "delta", label: "Gagnants et perdants", hint: "depuis 2019" },
    ],
    (key) => {
      timeline.stop();
      Object.assign(state, VIEWS[key]);
      timeline.set(state.year, false);
      paint(true);
      caption(key);
    },
  );
  timelineHook = (y) => {
    const key = Object.keys(VIEWS).find((k) => VIEWS[k].mode === "plain" && VIEWS[k].year === y) || null;
    tabs.mark(key);
    caption(key);
  };

  onResize(node, (w) => {
    width = w;
    layout();
  });
  layout();
  tabs.select("peak");
  initTsba(data);
}

/** Monthly year-on-year change by segment around the March 2025 airline ticket tax increase. */
function initTsba(data) {
  const { months, faisceaux: F } = data.fracture;
  const SEG = [
    { label: "Paris–province", keys: ["MET_RAD"] },
    { label: "Province–province", keys: ["MET_TRA"] },
    { label: "Métropole–Outre-mer", keys: ["MET_OM"] },
    { label: "International", keys: ["MET_INTL", "OM_INTL"] },
  ];
  const end = months.length - 1;
  const start = Math.max(12, end - 23);
  const span = d3.range(start, end + 1);
  const series = SEG.map((s) => {
    const v = (i) => d3.sum(s.keys, (k) => F[k]?.[i] ?? 0);
    return { ...s, vals: span.map((i) => ({ i, m: months[i], d: pctChange(v(i - 12), v(i)) })) };
  });
  const node = $("#chart-tsba");
  function draw(width) {
    node.replaceChildren();
    const cols = width < 640 ? 2 : 4;
    const gap = 22;
    const cw = (width - gap * (cols - 1)) / cols;
    const ch = 170;
    const rows = Math.ceil(series.length / cols);
    const h = rows * (ch + 34);
    const lim = Math.max(
      10,
      d3.max(series, (s) => d3.max(s.vals, (v) => Math.abs(v.d ?? 0))),
    );
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    series.forEach((s, k) => {
      const gx = (k % cols) * (cw + gap);
      const gy = Math.floor(k / cols) * (ch + 34);
      const g = svg.append("g").attr("transform", `translate(${gx},${gy})`);
      const x = d3
        .scaleBand()
        .domain(s.vals.map((v) => v.m))
        .range([30, cw])
        .padding(0.18);
      const y = d3.scaleLinear().domain([-lim, lim]).range([ch, 22]).nice();
      g.append("text")
        .attr("class", "end-label")
        .attr("x", 0)
        .attr("y", 12)
        .style("font-size", "13px")
        .style("fill", "var(--ink)")
        .text(s.label);
      g.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(30,0)")
        .call(
          d3
            .axisLeft(y)
            .ticks(4)
            .tickFormat((v) => `${fmtNum(v)} %`)
            .tickSize(0)
            .tickPadding(4),
        )
        .call((a) => a.select(".domain").remove());
      g.append("line")
        .attr("x1", 30)
        .attr("x2", cw)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .style("stroke", "var(--axis)");
      const tsba = s.vals.find((v) => v.m === "2025-03");
      if (tsba) {
        const tx = x(tsba.m) - x.step() * 0.09;
        g.append("line")
          .attr("x1", tx)
          .attr("x2", tx)
          .attr("y1", 22)
          .attr("y2", ch)
          .style("stroke", "var(--ink-2)")
          .style("stroke-dasharray", "2 3");
        g.append("text")
          .attr("class", "end-label")
          .attr("x", tx + 3)
          .attr("y", 30)
          .style("font-weight", 500)
          .text("TSBA ×2,8");
      }
      g.selectAll("rect")
        .data(s.vals.filter((v) => isNum(v.d)))
        .join("rect")
        .attr("x", (v) => x(v.m))
        .attr("width", x.bandwidth())
        .attr("y", (v) => (v.d >= 0 ? y(v.d) : y(0)))
        .attr("height", (v) => Math.abs(y(v.d) - y(0)))
        .attr("rx", 2)
        .style("fill", (v) => (v.d >= 0 ? "var(--blue)" : "var(--magenta)"))
        .on("pointermove", (event, v) =>
          showTip(event, `${s.label}, ${monthShort(+v.m.slice(5, 7) - 1)} ${v.m.slice(0, 4)}`, [
            { label: "sur un an", value: fmtPct(v.d) },
          ]),
        )
        .on("pointerleave", hideTip);
      const narrow = cw < 300;
      const ticks = s.vals.filter((v) => v.m.endsWith("-01") || (!narrow && v.m.endsWith("-07")));
      g.selectAll("text.tick")
        .data(ticks)
        .join("text")
        .attr("class", "tick axis")
        .attr("x", (v) => x(v.m))
        .attr("y", ch + 14)
        .style("fill", "var(--muted)")
        .style("font-size", "11.5px")
        .text((v) => (narrow ? v.m.slice(0, 4) : `${monthShort(+v.m.slice(5, 7) - 1)} ${v.m.slice(2, 4)}`));
    });
  }
  onResize(node, draw);
  draw(node.clientWidth || 900);
}
