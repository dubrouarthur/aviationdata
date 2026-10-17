import * as d3 from "d3";
import { $, el, rich, segmented, showTip, hideTip, onResize, dataTable, keyFigures } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { stackedArea } from "../lib/stacked.js";
import { toDate, pctChange } from "../lib/series.js";
import { fmtPct, fmtPctAbs, fmtNum } from "../lib/format.js";

// segments of the DGAC CO2 series, bottom to top of the stack; magenta = domestic, as everywhere on the page
export const SEGS = [
  { key: "MET_INTERIEUR", label: "Intérieur", long: "Intérieur métropole", color: "var(--magenta)" },
  { key: "MET-OM_ET_OM-OM", label: "Outre-mer", long: "Outre-mer", color: "var(--ochre)" },
  { key: "INTL_MC", label: "Moyen-courrier", long: "International moyen-courrier", color: "var(--teal)" },
  { key: "INTL_LC", label: "Long-courrier", long: "International long-courrier", color: "var(--blue)" },
];
const UP = "var(--magenta)";
const DOWN = "var(--teal)";
const TOTAL = "var(--ink-2)";

const mt = (v, d = 1) => `${fmtNum(v, d)} Mt`;
const signedMt = (v, d = 1) => `${v >= 0 ? "+" : "−"}${fmtNum(Math.abs(v), d)} Mt`;

/** CO2: where emissions come from (segments), CO2 per passenger-km, and the change split into traffic vs efficiency. */
export function initCo2(data) {
  const co2 = data.co2;
  const { years } = co2;
  const L = years.length - 1;
  const i0 = 0;
  const [p1, p2] = co2.decomp.periods;
  const T = co2.mt.FRANCE_TOT;
  const G = co2.g_peqkm;
  const lc = co2.mt.INTL_LC[L];
  const dom = co2.mt.MET_INTERIEUR;

  $("#co2-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${years[L]}, le trafic aérien commercial en France a émis `,
        { b: `${fmtNum(T[L], 1)} millions de tonnes de CO2` },
        `. Le long-courrier international en pèse à lui seul `,
        { b: fmtPctAbs((lc / T[L]) * 100, 0) },
        ` (${mt(lc)}). Les vols intérieurs en métropole n'en représentent que ${mt(dom[L])}, `,
        { b: `${fmtPctAbs(pctChange(dom[i0], dom[L]), 0)} de moins` },
        ` qu'en ${years[i0]}.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `Chaque passager-kilomètre émet en moyenne ${fmtNum(G.FRANCE_TOT[L], 0)} g de CO2, contre ${fmtNum(G.FRANCE_TOT[i0], 0)} g en ${years[i0]} (`,
        { b: fmtPct(pctChange(G.FRANCE_TOT[i0], G.FRANCE_TOT[L]), 0) },
        `). Un vol intérieur reste le plus émetteur au kilomètre : ${fmtNum(G.MET_INTERIEUR[L], 0)} g, contre ${fmtNum(G.INTL_LC[L], 0)} g en long-courrier. Sur un trajet court, le décollage et la montée, les phases les plus gourmandes en carburant, pèsent davantage.`,
      ]),
    ),
    el(
      "p",
      {},
      rich([
        `De ${p1.from} à ${p1.to}, la hausse du trafic aurait ajouté `,
        { b: mt(p1.trafic) },
        ` de CO2 à efficacité constante ; des vols plus sobres en ont retiré `,
        { b: mt(-p1.intensite) },
        `. Bilan : ${mt(Math.abs(p1.c1 - p1.c0))} ${p1.c1 >= p1.c0 ? "de plus" : "de moins"}. Depuis ${p2.from}, les émissions ont reculé de `,
        { b: fmtPctAbs(pctChange(p2.c0, p2.c1), 1) },
        ` : les deux effets jouent dans le même sens, un peu moins de trafic (${fmtPct(p2.trafic_pct, 1)}) et un peu moins de CO2 par passager-kilomètre (${fmtPct(p2.intensite_pct, 1)}).`,
      ]),
    ),
  );

  keyFigures($("#kf-co2"), [
    {
      value: mt(T[L]),
      label: `de CO2 émis en ${years[L]}, dont ${fmtPctAbs((lc / T[L]) * 100, 0)} en long-courrier`,
      color: "var(--blue)",
    },
    {
      value: fmtPct(pctChange(G.FRANCE_TOT[i0], G.FRANCE_TOT[L]), 0),
      label: `de CO2 par passager-kilomètre depuis ${years[i0]}`,
      color: DOWN,
    },
  ]);

  // ---------------------------------------------------------------- A. emissions by segment (stacked)
  stackedArea($("#chart-co2-seg"), {
    years,
    series: SEGS.map((s) => ({ key: s.key, label: s.label, color: s.color, values: co2.mt[s.key] })),
    yFormat: (v) => fmtNum(v),
    valueFormat: (v) => mt(v),
    height: 290,
    events: [{ year: 2020, label: "Covid" }],
    tableHead: "Année (Mt de CO2)",
  });

  // ---------------------------------------------------------------- B. grams per passenger-km
  const gNode = $("#chart-co2-g");
  const gSeries = [
    ...[...SEGS]
      .reverse()
      .map((s) => ({ key: s.key, label: s.label, color: s.color, values: G[s.key], width: 2 })),
    { key: "FRANCE_TOT", label: "Ensemble", color: "var(--ink)", values: G.FRANCE_TOT, width: 2.8 },
  ];
  gNode.before(
    el(
      "div",
      { class: "legend-row" },
      gSeries.map((s) => el("span", { class: "lg" }, [el("i", { style: `--c:${s.color}` }), s.label])),
    ),
  );
  lineChart(gNode, {
    dates: years.map((y) => toDate(y)),
    series: gSeries,
    xDomain: [toDate(years[0]), toDate(years[L])],
    yZero: true,
    yFormat: (v) => `${fmtNum(v)} g`,
    tipFormat: (v) => `${fmtNum(v, 0)} g`,
    title: (i) => `${years[i]}, g de CO2 par passager-km`,
    events: [{ date: toDate(2020), label: "Covid", short: "Covid" }],
    endDots: true,
    endText: (s) => `${s.label} ${fmtNum(s.values[L], 0)} g`,
    height: 290,
    animate: true,
    table: {
      head: "Année (g par passager-km)",
      date: (d) => String(d.getUTCFullYear()),
      value: (v) => fmtNum(v, 1),
    },
  });

  // ---------------------------------------------------------------- C. what moves CO2
  // overview: emissions = traffic x CO2 per passenger-km, in index form, with passengers per flight beside them
  const AP = data.aeroports;
  const ysum = (arr, y) => d3.sum(AP.months, (m, i) => (m.startsWith(String(y)) ? (arr[i] ?? 0) : 0));
  const perFlight = years.map((y) => {
    const v = ysum(AP.national.vols, y);
    return v ? ysum(AP.national.pax, y) / v : null;
  });
  const traffic = years.map((_, i) => (T[i] * 1e12) / G.FRANCE_TOT[i]); // passenger-km (passenger-equivalent)
  const idx = (arr) => arr.map((v) => (v === null ? null : (v / arr[0]) * 100));
  const WHY = [
    {
      key: "pkm",
      label: "Passagers-km",
      long: "Trafic (passagers-kilomètres)",
      color: "var(--blue)",
      values: idx(traffic),
    },
    {
      key: "pv",
      label: "Passagers par vol",
      long: "Passagers par vol",
      color: "var(--ochre)",
      values: idx(perFlight),
    },
    {
      key: "co2",
      label: "Émissions",
      long: "Émissions de CO2",
      color: "var(--ink)",
      values: idx(T),
      width: 3,
    },
    {
      key: "g",
      label: "CO2 par passager-km",
      long: "CO2 par passager-kilomètre",
      color: DOWN,
      values: idx(G.FRANCE_TOT),
    },
  ].map((s) => ({ width: 2.4, ...s }));
  const signedIdx = (v) => (Math.abs(v - 100) < 0.5 ? "0 %" : fmtPct(v - 100, 0));
  const NOTES = {
    index: `Indice 100 en ${years[0]}. Les émissions (en noir) suivent le trafic multiplié par le CO2 émis pour chaque passager-kilomètre ; ce dernier baisse à mesure que chaque vol emporte plus de passagers.`,
    steps:
      "On part des émissions d'une année et on ajoute deux effets. Effet trafic : ce qu'auraient changé les passagers-kilomètres supplémentaires (ou perdus) à efficacité constante. Effet efficacité : ce qu'a changé la baisse du CO2 émis pour chaque passager-kilomètre. En millions de tonnes de CO2.",
    seg: "Les mêmes deux effets, segment par segment, en millions de tonnes de CO2.",
  };
  const iNode = $("#chart-co2-index");
  let iChart = null;
  const wNode = $("#chart-waterfall");
  let view = "index";
  const periodSeg = $("#co2-period");
  periodSeg.replaceChildren(
    el("button", { type: "button", "data-v": "index", text: "Vue d'ensemble" }),
    el("button", { type: "button", "data-v": "steps", text: "Deux périodes" }),
    el("button", { type: "button", "data-v": "seg", text: "Par segment" }),
  );
  const legend = () =>
    $("#co2-legend").replaceChildren(
      ...(view === "index"
        ? WHY.map((s) => el("span", { class: "lg" }, [el("i", { style: `--c:${s.color}` }), s.long]))
        : [
            ...(view === "steps" ? [[TOTAL, "Émissions de l'année"]] : []),
            [UP, "Fait monter les émissions"],
            [DOWN, "Fait baisser les émissions"],
          ].map(([c, t]) => el("span", { class: "lg" }, [el("i", { class: "sq", style: `--c:${c}` }), t]))),
    );
  const show = () => {
    $("#co2-why-note").textContent = NOTES[view];
    iNode.style.display = view === "index" ? "" : "none";
    wNode.style.display = view === "index" ? "none" : "";
    if (wNode._dataTable) wNode._dataTable.style.display = view === "index" ? "none" : "";
    if (iNode._dataTable) iNode._dataTable.style.display = view === "index" ? "" : "none";
  };
  segmented(periodSeg, view, (v) => {
    view = v;
    legend();
    show();
    draw(wNode.clientWidth || iNode.clientWidth);
  });
  legend();

  function drawIndex() {
    if (iChart) return;
    iChart = lineChart(iNode, {
      dates: years.map((y) => toDate(y)),
      series: WHY,
      xDomain: [toDate(years[0]), toDate(years[L])],
      baseline: 100,
      yFormat: (v) => fmtNum(v, 0),
      tipFormat: (v) => `${signedIdx(v)} depuis ${years[0]}`,
      title: (i) => `${years[i]} (indice 100 en ${years[0]})`,
      events: [{ date: toDate(2020), label: "Covid", short: "Covid" }],
      endDots: true,
      endText: (s) => `${s.label} ${signedIdx(s.values[L])}`,
      endWidth: 172,
      height: 320,
      animate: true,
      table: {
        head: `Année (indice 100 en ${years[0]})`,
        date: (d) => String(d.getUTCFullYear()),
        value: (v) => fmtNum(v, 0),
      },
    });
  }
  const draw = (width) => {
    if (view === "index") return drawIndex();
    if (!width) return;
    return view === "seg" ? drawSegments(width) : drawSteps(width);
  };

  function drawSteps(width) {
    wNode.replaceChildren();
    const narrow = width < 560;
    const steps = [];
    let run = 0;
    const total = (year, v) => {
      steps.push({ kind: "total", year, v, y0: 0, y1: v });
      run = v;
    };
    const effect = (type, p) => {
      const v = type === "trafic" ? p.trafic : p.intensite;
      const pct = type === "trafic" ? p.trafic_pct : p.intensite_pct;
      const name =
        type === "trafic"
          ? v >= 0
            ? "Plus de trafic"
            : "Moins de trafic"
          : v <= 0
            ? "Vols plus sobres"
            : "Vols moins sobres";
      const sub = type === "trafic" ? `trafic ${fmtPct(pct, 0)}` : `CO2/passager-km ${fmtPct(pct, 0)}`;
      steps.push({ kind: "effect", type, v, pct, p, name, sub, y0: run, y1: run + v });
      run += v;
    };
    total(p1.from, p1.c0);
    effect("trafic", p1);
    effect("intensite", p1);
    total(p1.to, p1.c1);
    effect("trafic", p2);
    effect("intensite", p2);
    total(p2.to, p2.c1);

    dataTable(wNode, {
      head: ["Étape", "Mt de CO2", "Évolution"],
      rows: steps.map((s) =>
        s.kind === "total"
          ? [`Émissions ${s.year}`, fmtNum(s.v, 1), ""]
          : [
              `${s.p.from} → ${s.p.to} : effet ${s.type === "trafic" ? "trafic" : "efficacité"}`,
              signedMt(s.v).replace(" Mt", ""),
              s.type === "trafic"
                ? `${fmtPct(s.pct, 1)} de passagers-km`
                : `${fmtPct(s.pct, 1)} de CO2 par passager-km`,
            ],
      ),
    });

    const h = narrow ? 320 : 340;
    const m = { top: 26, right: 8, bottom: narrow ? 76 : 72, left: 40 };
    const x = d3
      .scaleBand()
      .domain(steps.map((_, i) => i))
      .range([m.left, width - m.right])
      .padding(0.24);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(steps, (s) => Math.max(s.y0, s.y1)) * 1.1])
      .nice()
      .range([h - m.bottom, m.top]);
    const svg = d3.select(wNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - m.left - m.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6))
      .call((g) => g.select(".domain").remove());
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", m.left)
      .attr("y", 12)
      .style("font-weight", 500)
      .text("Mt de CO2");

    const bw = Math.min(54, x.bandwidth());
    const cx = (i) => x(i) + x.bandwidth() / 2;
    const bx = (i) => cx(i) - bw / 2;
    const fill = (s) => (s.kind === "total" ? TOTAL : s.v >= 0 ? UP : DOWN);

    // connectors first, under the bars
    steps.slice(0, -1).forEach((s, i) =>
      svg
        .append("line")
        .attr("x1", bx(i) + bw)
        .attr("x2", bx(i + 1))
        .attr("y1", y(s.y1))
        .attr("y2", y(s.y1))
        .style("stroke", "var(--axis)")
        .style("stroke-dasharray", "2 2"),
    );
    const g = svg.selectAll("g.step").data(steps).join("g").attr("class", "step");
    g.append("rect")
      .attr("x", (_, i) => bx(i))
      .attr("width", bw)
      .attr("y", (s) => y(Math.max(s.y0, s.y1)))
      .attr("height", (s) => Math.max(2, Math.abs(y(s.y0) - y(s.y1))))
      .attr("rx", 4)
      .style("fill", fill)
      .on("pointermove", (event, s) =>
        s.kind === "total"
          ? showTip(event, `Émissions ${s.year}`, [{ label: "CO2", value: mt(s.v) }])
          : showTip(event, `${s.p.from} → ${s.p.to} : ${s.name.toLowerCase()}`, [
              { label: "effet sur les émissions", value: signedMt(s.v, 2), color: fill(s) },
              s.type === "trafic"
                ? { label: "passagers-km", value: fmtPct(s.pct, 1) }
                : { label: "CO2 par passager-km", value: fmtPct(s.pct, 1) },
            ]),
      )
      .on("pointerleave", hideTip);
    // values: above rising bars and totals, below falling bars
    g.append("text")
      .attr("class", "end-label")
      .attr("x", (_, i) => cx(i))
      .attr("y", (s) =>
        s.kind === "effect" && s.v < 0 ? y(Math.min(s.y0, s.y1)) + 15 : y(Math.max(s.y0, s.y1)) - 6,
      )
      .attr("text-anchor", "middle")
      .style("font-weight", (s) => (s.kind === "total" ? 700 : 600))
      .text((s) => {
        const t = s.kind === "total" ? mt(s.v) : signedMt(s.v);
        return narrow ? t.replace(" Mt", "") : t;
      });
    // step names under the axis
    const showSub = x.step() >= 118;
    g.append("text")
      .attr("class", "axis")
      .attr("text-anchor", "middle")
      .style("fill", "var(--ink-2)")
      .each(function (s, i) {
        const t = d3.select(this);
        const X = cx(i);
        const base = h - m.bottom + 16;
        if (s.kind === "total") {
          t.append("tspan")
            .attr("x", X)
            .attr("y", base)
            .style("font-weight", 700)
            .style("font-size", narrow ? "11px" : "12.5px")
            .style("fill", "var(--ink)")
            .text(s.year);
          return;
        }
        if (narrow) {
          // one short word, staggered so neighbours never collide
          t.append("tspan")
            .attr("x", X)
            .attr("y", base + (s.type === "trafic" ? 0 : 13))
            .style("font-size", "10px")
            .text(s.type === "trafic" ? "Trafic" : "Sobriété");
          return;
        }
        t.append("tspan")
          .attr("x", X)
          .attr("y", base)
          .style("font-size", "11.5px")
          .style("font-weight", 600)
          .text(s.name);
        if (showSub)
          t.append("tspan")
            .attr("x", X)
            .attr("y", base + 14)
            .style("font-size", "11px")
            .style("fill", "var(--muted)")
            .text(s.sub);
      });
    // period brackets with the net change
    [
      [0, 3, p1],
      [3, 6, p2],
    ].forEach(([a, b, p]) => {
      const yb = h - m.bottom + (narrow ? 36 : 40);
      const xa = cx(a) + 4;
      const xb = cx(b) - 4;
      svg
        .append("path")
        .attr("d", `M${xa},${yb - 5}V${yb}H${xb}V${yb - 5}`)
        .style("fill", "none")
        .style("stroke", "var(--muted)");
      const t = svg
        .append("text")
        .attr("class", "end-label")
        .attr("x", (xa + xb) / 2)
        .attr("y", yb + 16)
        .attr("text-anchor", "middle")
        .style("font-size", narrow ? "10.5px" : "12px")
        .style("font-weight", 600);
      if (narrow) {
        t.append("tspan")
          .attr("x", (xa + xb) / 2)
          .text(`${p.from} → ${p.to}`);
        t.append("tspan")
          .attr("x", (xa + xb) / 2)
          .attr("dy", 13)
          .text(signedMt(p.c1 - p.c0));
      } else t.text(`${p.from} → ${p.to} : ${signedMt(p.c1 - p.c0)}`);
    });
  }

  function drawSegments(width) {
    wNode.replaceChildren();
    const narrow = width < 560;
    const segs = SEGS.map((s) => ({ ...s, ...co2.decomp.segments[s.key] })).filter((s) => s.from);
    const head = narrow ? 34 : 0;
    const rowH = head + 66;
    const m = { top: 30, right: 12, bottom: 6, left: narrow ? 12 : 220 };
    const h = m.top + m.bottom + segs.length * rowH;
    const lim = d3.max(segs, (s) => Math.max(Math.abs(s.trafic), Math.abs(s.intensite))) * 1.04;
    const x = d3
      .scaleLinear()
      .domain([-lim, lim])
      .range([m.left, width - m.right]);
    dataTable(wNode, {
      head: [
        "Segment",
        `Émissions ${segs[0]?.from} (Mt)`,
        "Effet trafic (Mt)",
        "Effet efficacité (Mt)",
        `Émissions ${segs[0]?.to} (Mt)`,
      ],
      rows: segs.map((s) => [
        s.long,
        fmtNum(s.c0, 1),
        signedMt(s.trafic, 2).replace(" Mt", ""),
        signedMt(s.intensite, 2).replace(" Mt", ""),
        fmtNum(s.c1, 1),
      ]),
    });
    const svg = d3.select(wNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("text")
      .attr("class", "end-label")
      .attr("x", narrow ? m.left : x(0))
      .attr("y", 14)
      .attr("text-anchor", narrow ? "start" : "middle")
      .style("font-weight", 500)
      .text(`Effets sur les émissions, de ${segs[0]?.from} à ${segs[0]?.to}`);
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", m.top - 4)
      .attr("y2", h - m.bottom)
      .style("stroke", "var(--axis)");
    const g = svg
      .selectAll("g.seg")
      .data(segs)
      .join("g")
      .attr("class", "seg")
      .attr("transform", (_, i) => `translate(0,${m.top + i * rowH})`);
    // segment name and its net change
    const lx = narrow ? m.left : 12;
    g.append("text")
      .attr("class", "end-label")
      .attr("x", lx)
      .attr("y", narrow ? 14 : 26)
      .style("font-weight", 600)
      .text((s) => s.long);
    g.append("text")
      .attr("class", "end-label")
      .attr("x", lx)
      .attr("y", narrow ? 29 : 42)
      .style("fill", "var(--muted)")
      .style("font-size", "11.5px")
      .text((s) => `${mt(s.c0)} → ${mt(s.c1)} (${signedMt(s.c1 - s.c0)})`);
    [
      ["trafic", head + 8, "trafic_pct", (pct) => `trafic ${fmtPct(pct, 0)}`, "passagers-km"],
      [
        "intensite",
        head + 34,
        "intensite_pct",
        (pct) => `${narrow ? "CO2/pkm" : "CO2 par passager-km"} ${fmtPct(pct, 0)}`,
        "CO2 par passager-km",
      ],
    ].forEach(([key, dy, pctKey, name, tipName]) => {
      g.append("rect")
        .attr("x", (s) => Math.min(x(0), x(s[key])))
        .attr("y", dy)
        .attr("height", 20)
        .attr("width", (s) => Math.max(1, Math.abs(x(s[key]) - x(0))))
        .attr("rx", 4)
        .style("fill", (s) => (s[key] >= 0 ? UP : DOWN))
        .on("pointermove", (event, s) =>
          showTip(event, `${s.long}, effet ${key === "trafic" ? "trafic" : "efficacité"}`, [
            { label: "effet sur les émissions", value: signedMt(s[key], 2), color: s[key] >= 0 ? UP : DOWN },
            { label: tipName, value: fmtPct(s[pctKey], 1) },
          ]),
        )
        .on("pointerleave", hideTip);
      // label on the empty side of the zero line, so it never runs off the chart
      g.append("text")
        .attr("class", "end-label")
        .attr("x", (s) => (s[key] >= 0 ? x(0) - 8 : x(0) + 8))
        .attr("y", dy + 14)
        .attr("text-anchor", (s) => (s[key] >= 0 ? "end" : "start"))
        .text((s) => `${signedMt(s[key])} · ${name(s[pctKey])}`);
    });
  }

  onResize(wNode, (w) => view !== "index" && draw(w));
  show();
  draw();
}
