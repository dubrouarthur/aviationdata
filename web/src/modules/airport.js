import * as d3 from "d3";
import { feature } from "topojson-client";
import { $, el, rich, segmented, showTip, hideTip, onResize, dataTable, keyFigures } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { rolling12, yearSum, pctChange, toDate, isNum } from "../lib/series.js";
import {
  fmtPax,
  fmtPaxAxis,
  fmtPct,
  fmtPctAbs,
  fmtNum,
  fmtMonth,
  monthName,
  monthShort,
  ordinal,
} from "../lib/format.js";
import { selection } from "../lib/data.js";
import { shortName } from "./names.js";

const PARIS = new Set(["LFPG", "LFPO", "LFOB"]);
const RINGS = [500, 1000, 2000, 5000, 10000];
const BIG = 200000; // airports above this many passengers in 2019 make the recovery count
const RANK_SHORT = 15;
const RANK_MIN_2019 = 100000; // below this, a change since 2019 in the ranking is mostly noise
// route colours: the same meaning as everywhere on the page (magenta = Paris, teal = province...)
const ROUTE_KINDS = [
  { key: "paris", label: "Paris–province", color: "var(--magenta)" },
  { key: "prov", label: "Province–province", color: "var(--teal)" },
  { key: "om", label: "Outre-mer", color: "var(--ochre)" },
  { key: "intl", label: "International", color: "var(--blue)" },
];

// signed change without a "−0 %"; compact counts for lists ("726 k", "63 k", "1,2 M")
const signed = (v) => (v === null ? "–" : Math.abs(v) < 0.5 ? "0 %" : fmtPct(v, 0));
const compact = (v) =>
  !isNum(v)
    ? "–"
    : v >= 1e6
      ? `${fmtNum(v / 1e6, 1)} M`
      : v >= 1e4
        ? `${fmtNum(v / 1e3, 0)} k`
        : fmtNum(v, 0);

const lg = (color, label, cls = "") =>
  el("span", { class: "lg" }, [el("i", { class: cls, style: `--c:${color}` }), label]);

/**
 * Airport explorer: a recovery overview of every airport (APT), then one airport in depth: key figures and a
 * sentence, passengers since 1990 (with a second airport to compare), its seasons, and its detailed routes (PAP).
 */
export function initAirport(data, { world }) {
  const { months, airports, years } = data.aeroports;
  const R = data.routes;
  const lastYear = years.at(-1);
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const yr = (a, y) => yearSum(months, a.pax, y);
  const pax = (a) => yr(a, lastYear) ?? 0;
  const ranked = [...airports].filter((a) => pax(a) > 0).sort((p, q) => pax(q) - pax(p));
  const rank = new Map(ranked.map((a, i) => [a.code, i + 1]));
  const vs2019 = (a) => {
    const p19 = yr(a, 2019) ?? 0;
    return p19 > 0 && pax(a) > 0 ? pctChange(p19, pax(a)) : null;
  };
  const land = feature(world, world.objects.countries);
  let routeYear = lastYear;

  // ---------------------------------------------------------------- the airports' own two speeds
  const big = airports.filter((a) => (yr(a, 2019) ?? 0) >= BIG);
  const recovered = big.filter((a) => pax(a) >= yr(a, 2019));
  const movers = big.map((a) => ({ a, d: vs2019(a) ?? -100 })).sort((p, q) => q.d - p.d);
  const [g1, g2] = movers;
  const [l1, l2] = movers.slice(-2).reverse();
  const named = (m) => `${shortName(m.a)} (${fmtPct(m.d, 0)})`;
  $("#apt-intro").replaceChildren(
    el(
      "p",
      {},
      rich([
        `Sur les ${big.length} aéroports qui accueillaient plus de 200 000 passagers en 2019, `,
        { b: `${recovered.length} ont retrouvé ou dépassé ce niveau` },
        ` en ${lastYear}. Là aussi, le ciel avance à deux vitesses : ${named(g1)} et ${named(g2)} en tête, ${named(l1)} et ${named(l2)} en queue.`,
      ]),
    ),
    el("p", {
      text: "Cherchez un aéroport : son trafic depuis 1990, ses saisons, ses liaisons, et sa place parmi tous les aéroports français.",
    }),
  );
  keyFigures($("#kf-apt"), [
    {
      value: `${recovered.length} sur ${big.length}`,
      label: `aéroports de plus de 200 000 passagers ont retrouvé leur niveau de 2019`,
      color: "var(--blue)",
    },
    {
      value: fmtPct(g1.d, 0),
      label: `à ${shortName(g1.a)}, la plus forte hausse depuis 2019`,
      color: "var(--ink-2)",
    },
  ]);

  // ---------------------------------------------------------------- search and quick picks
  const input = $("#apt-input");
  $("#apt-list").replaceChildren(...airports.map((a) => el("option", { value: `${a.nom} (${a.code})` })));
  const pick = () => {
    const v = input.value.trim();
    const code = /\(([A-Z]{4})\)\s*$/.exec(v)?.[1] || (/^[a-z]{4}$/i.test(v) ? v.toUpperCase() : null);
    const found =
      (code && byCode.get(code)) ||
      airports.find((a) => a.nom.toLowerCase() === v.toLowerCase()) ||
      (v.length >= 3 && airports.find((a) => a.nom.toLowerCase().includes(v.toLowerCase())));
    if (found) {
      selection.set(found.code);
      input.value = "";
      input.blur();
    }
  };
  input.addEventListener("change", pick);
  input.addEventListener("keydown", (e) => e.key === "Enter" && pick());
  const picks = ranked
    .slice(0, 8)
    .map((a) =>
      el("button", { type: "button", "data-code": a.code, "aria-pressed": "false", text: shortName(a) }),
    );
  picks.forEach((b) => b.addEventListener("click", () => selection.set(b.dataset.code)));
  $("#apt-picks").replaceChildren(el("span", { text: "Les plus fréquentés :" }), ...picks);
  const markPick = (code) =>
    picks.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.code === code)));

  // ---------------------------------------------------------------- the airport card: a sentence and key figures
  function renderCard(a) {
    const yi = years.indexOf(lastYear);
    const pL = pax(a);
    const vols = a.vols?.[yi];
    const fret = a.fret?.[yi];
    const firstYear = years.find((y) => (yr(a, y) ?? 0) > 0);
    const perYear = years.map((y) => yr(a, y) ?? 0);
    const rec = d3.maxIndex(perYear);
    const d19 = vs2019(a);
    const nRoutes = R.pairs.filter(
      (p) => (p.a === a.code || p.b === a.code) && p.pax[R.years.indexOf(lastYear)] > 0,
    ).length;
    const inLast = months.map((m, i) => [m, i]).filter(([m]) => m.startsWith(String(lastYear)));
    const mv = inLast.map(([, i]) => a.pax[i]);
    const peak = d3.maxIndex(mv, (v) => (isNum(v) ? v : -1));
    const sentence = pL
      ? [
          `${a.nom} a accueilli `,
          { b: `${fmtPax(pL)} passagers` },
          ` en ${lastYear}`,
          d19 === null ? "" : `, ${fmtPctAbs(d19, 0)} ${d19 >= 0 ? "de plus" : "de moins"} qu'en 2019`,
          `. C'est le ${ordinal(rank.get(a.code))} aéroport français. `,
          rec === yi
            ? "C'est son record. "
            : `Son record : ${fmtPax(perYear[rec])} passagers en ${years[rec]}. `,
          isNum(mv[peak]) && mv[peak] > 0
            ? `Mois le plus chargé en ${lastYear} : ${monthName(peak)} (${fmtPctAbs((mv[peak] / d3.sum(mv)) * 100, 0)} des passagers de l'année).`
            : "",
        ]
      : [
          `Aucun trafic de passagers n'est publié pour ${a.nom} en ${lastYear} (aéroport fermé ou sous le seuil de diffusion). `,
          perYear[rec] > 0 ? `Son record : ${fmtPax(perYear[rec])} passagers en ${years[rec]}.` : "",
        ];
    $("#apt-head").replaceChildren(
      el("div", { class: "apt-title" }, [
        el("h3", { text: a.nom }),
        el("p", {
          class: "note",
          text: `${a.code}, ${a.zone === "OM" ? "Outre-mer" : "métropole"}, trafic publié depuis ${firstYear}`,
        }),
      ]),
      el("p", { class: "apt-sentence" }, rich(sentence)),
    );
    const facts = [
      [fmtPax(pL), `passagers en ${lastYear}`],
      [signed(d19), "par rapport à 2019"],
      [rank.get(a.code) ? ordinal(rank.get(a.code)) : "–", "aéroport français"],
      [vols && pL ? fmtNum(pL / vols, 0) : "–", "passagers par vol"],
      [
        isNum(fret) && fret > 0
          ? `${fmtNum(fret >= 1000 ? fret / 1000 : fret, fret >= 1000 ? 1 : 0)}${fret >= 1000 ? " kt" : " t"}`
          : "–",
        "de fret et poste",
      ],
      [String(nRoutes), "liaisons détaillées"],
    ];
    $("#apt-facts").replaceChildren(
      ...facts.map(([b, s]) => el("div", { class: "fact" }, [el("b", { text: b }), el("span", { text: s })])),
    );
  }

  // ---------------------------------------------------------------- passengers since 1990, optionally against another airport
  const compareSel = $("#apt-compare");
  compareSel.replaceChildren(
    el("option", { value: "", text: "Comparer avec un autre aéroport…" }),
    ...ranked.map((a) => el("option", { value: a.code, text: `${shortName(a)} (${fmtPax(pax(a))})` })),
  );
  let compare = "";
  let scale = "pax";
  compareSel.addEventListener("change", () => {
    compare = compareSel.value;
    renderTrend(byCode.get(selection.get()));
  });
  segmented($("#apt-scale"), scale, (v) => {
    scale = v;
    renderTrend(byCode.get(selection.get()));
  });
  let trend = null;
  function renderTrend(a) {
    if (!a) return;
    const b = compare && compare !== a.code ? byCode.get(compare) : null;
    const avg = (x) => rolling12(x.pax).map((v) => (isNum(v) ? v / 12 : null));
    const base = (x) => (yr(x, 2019) ?? 0) / 12;
    const idx = scale === "idx";
    const asScale = (x, vals) =>
      idx ? vals.map((v) => (isNum(v) && base(x) > 0 ? (v / base(x)) * 100 : null)) : vals;
    const series = [];
    if (!b && !idx)
      series.push({ key: "m", label: "Chaque mois", color: "var(--axis)", values: a.pax, width: 1.2 });
    series.push({
      key: "a",
      label: shortName(a),
      color: "var(--blue)",
      values: asScale(a, avg(a)),
      width: 2.6,
    });
    if (b)
      series.push({
        key: "b",
        label: shortName(b),
        color: "var(--ochre)",
        values: asScale(b, avg(b)),
        width: 2.4,
      });
    const firstMonth = months.findIndex((m, i) => isNum(a.pax[i]) || (b && isNum(b.pax[i])));
    const fmtIdx = (v) => fmtNum(v, 0);
    const opts = {
      dates: months.map(toDate),
      series,
      xDomain: [toDate(months[Math.max(0, firstMonth)]), toDate(months.at(-1))],
      yZero: !idx,
      baseline: idx ? 100 : null,
      yFormat: idx ? fmtIdx : fmtPaxAxis,
      tipFormat: idx ? (v) => `${fmtNum(v, 0)} (2019 = 100)` : fmtPax,
      title: (i) => fmtMonth(months[i]),
      events: [{ date: toDate("2020-03"), label: "Covid", short: "Covid" }],
      height: 250,
      // two airports: name each line at its end, with its last value
      endLabels: !!b,
      endDots: !!b,
      endText: (sr) => {
        const v = [...sr.values].reverse().find(isNum);
        return `${sr.label} ${idx ? fmtNum(v, 0) : compact(v)}`;
      },
    };
    $("#apt-legend").replaceChildren(
      ...series.map((s) => lg(s.color, s.key === "m" ? "Chaque mois" : `${s.label}, moyenne sur 12 mois`)),
    );
    $("#apt-chart-note").textContent = idx
      ? "Moyenne mensuelle sur 12 mois glissants, en indice : 100 = le niveau moyen de 2019."
      : "Passagers chaque mois et moyenne sur 12 mois glissants (arrivées et départs).";
    if (!trend) trend = lineChart($("#chart-apt"), opts);
    else trend.update(opts);
    const rows = years
      .filter((y) => (yr(a, y) ?? 0) > 0 || (b && (yr(b, y) ?? 0) > 0))
      .map((y) => [String(y), fmtPax(yr(a, y) ?? null), ...(b ? [fmtPax(yr(b, y) ?? null)] : [])]);
    dataTable($("#chart-apt"), {
      head: ["Année", `${shortName(a)} (passagers)`, ...(b ? [`${shortName(b)} (passagers)`] : [])],
      rows,
    });
  }

  // ---------------------------------------------------------------- seasons: each month's share of the year
  const seasonNode = $("#apt-season");
  function renderSeasons(a) {
    seasonNode.replaceChildren();
    if (!a) return;
    const share = (y) => {
      const vals = d3.range(12).map((k) => a.pax[months.indexOf(`${y}-${String(k + 1).padStart(2, "0")}`)]);
      const tot = d3.sum(vals, (v) => (isNum(v) ? v : 0));
      return vals.map((v) => (isNum(v) && tot > 0 ? (v / tot) * 100 : null));
    };
    const now = share(lastYear);
    const then = share(2019);
    const has = (arr) => arr.some((v) => isNum(v) && v > 0);
    const peak = d3.maxIndex(now, (v) => v ?? -1);
    $("#apt-season-title").textContent = `Ses saisons`;
    $("#apt-season-note").textContent = has(now)
      ? `Part de chaque mois dans les passagers de l'année. ${now.some((v) => v === null) ? "Les mois sans barre sont sous le seuil de diffusion. " : ""}Pic en ${monthName(peak)} : ${fmtPctAbs(now[peak], 0)} du trafic de ${lastYear}.`
      : `Pas de trafic publié en ${lastYear}.`;
    $("#apt-season-legend").replaceChildren(
      lg("var(--blue)", String(lastYear), "sq"),
      ...(has(then) ? [lg("var(--ink-2)", "2019")] : []),
    );
    const width = seasonNode.clientWidth || 480;
    const h = 230;
    const m = { top: 22, right: 6, bottom: 24, left: 36 };
    const x = d3
      .scaleBand()
      .domain(d3.range(12))
      .range([m.left, width - m.right])
      .padding(0.28);
    const top = d3.max([...now, ...then], (v) => v ?? 0) || 10;
    const y = d3
      .scaleLinear()
      .domain([0, top * 1.12])
      .nice()
      .range([h - m.bottom, m.top]);
    const svg = d3.select(seasonNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(-(width - m.left - m.right))
          .tickFormat(""),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(0)
          .tickPadding(6)
          .tickFormat((v) => `${v} %`),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((k) => (width < 420 ? monthShort(k).slice(0, 1).toUpperCase() : monthShort(k))),
      )
      .call((g) => g.select(".domain").remove());
    const bw = Math.min(24, x.bandwidth());
    const g = svg.selectAll("g.month").data(d3.range(12)).join("g").attr("class", "month");
    g.filter((k) => isNum(now[k]))
      .append("rect")
      .attr("x", (k) => x(k) + (x.bandwidth() - bw) / 2)
      .attr("width", bw)
      .attr("y", (k) => y(now[k]))
      .attr("height", (k) => Math.max(1, y(0) - y(now[k])))
      .attr("rx", 4)
      .style("fill", (k) =>
        k === peak ? "var(--blue)" : "color-mix(in srgb, var(--blue) 62%, var(--card))",
      );
    if (has(then))
      g.filter((k) => isNum(then[k]))
        .append("line")
        .attr("x1", (k) => x(k) + (x.bandwidth() - bw) / 2 - 4)
        .attr("x2", (k) => x(k) + (x.bandwidth() + bw) / 2 + 4)
        .attr("y1", (k) => y(then[k]))
        .attr("y2", (k) => y(then[k]))
        .style("stroke", "var(--ink-2)")
        .style("stroke-width", 2.2)
        .style("stroke-linecap", "round");
    if (isNum(now[peak]))
      svg
        .append("text")
        .attr("class", "end-label")
        .attr("x", x(peak) + x.bandwidth() / 2)
        .attr("y", y(Math.max(now[peak], then[peak] ?? 0)) - 7)
        .attr("text-anchor", "middle")
        .text(`${fmtNum(now[peak], 0)} %`);
    // hover: the whole month column
    g.append("rect")
      .attr("x", (k) => x(k) - (x.step() - x.bandwidth()) / 2)
      .attr("width", x.step())
      .attr("y", m.top)
      .attr("height", h - m.top - m.bottom)
      .attr("fill", "transparent")
      .on("pointermove", (event, k) =>
        showTip(event, `${monthName(k)}`, [
          {
            label: String(lastYear),
            value: isNum(now[k]) ? `${fmtNum(now[k], 1)} %` : "–",
            color: "var(--blue)",
          },
          ...(has(then)
            ? [
                {
                  label: "2019",
                  value: isNum(then[k]) ? `${fmtNum(then[k], 1)} %` : "–",
                  color: "var(--ink-2)",
                },
              ]
            : []),
        ]),
      )
      .on("pointerleave", hideTip);
    dataTable(seasonNode, {
      head: ["Mois", `${lastYear} (% de l'année)`, "2019 (% de l'année)"],
      rows: d3
        .range(12)
        .map((k) => [
          monthName(k),
          isNum(now[k]) ? fmtNum(now[k], 1) : "–",
          isNum(then[k]) ? fmtNum(then[k], 1) : "–",
        ]),
    });
  }

  // ---------------------------------------------------------------- routes: spider map (azimuthal equidistant) and ranked list
  const yearSel = $("#apt-year");
  yearSel.replaceChildren(
    ...[...R.years]
      .reverse()
      .map((y) => el("option", { value: y, text: `En ${y}`, selected: y === routeYear || null })),
  );
  yearSel.addEventListener("change", () => {
    routeYear = +yearSel.value;
    renderRoutes(selection.get());
  });
  $("#apt-routes-legend").replaceChildren(...ROUTE_KINDS.map((k) => lg(k.color, k.label)));
  const kindOf = (r, code) =>
    r.info.fr
      ? r.other.startsWith("LF")
        ? PARIS.has(r.other) || PARIS.has(code)
          ? ROUTE_KINDS[0]
          : ROUTE_KINDS[1]
        : ROUTE_KINDS[2]
      : ROUTE_KINDS[3];
  const placeName = (info) => info.nom.split("-")[0];

  const mapNode = $("#apt-routes");
  function routesOf(code) {
    const yi = R.years.indexOf(routeYear);
    const y19 = R.years.indexOf(2019);
    return R.pairs
      .filter((p) => (p.a === code || p.b === code) && p.pax[yi] > 0)
      .map((p) => {
        const other = p.a === code ? p.b : p.a;
        return { p, other, info: R.airports[other], pax: p.pax[yi], vols: p.vols[yi], prev: p.pax[y19] };
      })
      .sort((x, y) => y.pax - x.pax);
  }

  function renderRoutes(code) {
    const a = byCode.get(code);
    mapNode.replaceChildren();
    if (!a) return;
    const routes = routesOf(code);
    $("#apt-routes-title").textContent = `Ses liaisons en ${routeYear}`;
    renderTop(a, routes);
    if (!routes.length) {
      $("#apt-routes-note").textContent =
        "Aucune liaison de cet aéroport n'est détaillée par la DGAC cette année-là : seules les lignes exploitées par au moins trois compagnies le sont.";
      return;
    }
    // zoom on the bulk of the network; the few far routes run to the edge with their distance
    const dists = routes.map((r) => r.p.dist).sort(d3.ascending);
    const maxKm = dists.at(-1);
    const bulk = Math.max(700, (d3.quantile(dists, 0.8) || maxKm) * 1.3);
    const reachKm = maxKm <= bulk * 1.5 ? maxKm * 1.12 : bulk;
    const far = routes.filter((r) => r.p.dist > reachKm);
    $("#apt-routes-note").textContent =
      `${routes.length} liaisons détaillées par la DGAC (celles qui comptent au moins trois compagnies). Les cercles indiquent la distance depuis l'aéroport` +
      (far.length
        ? ` ; ${far.length > 1 ? "les liaisons" : "la liaison"} plus ${far.length > 1 ? "lointaines sortent" : "lointaine sort"} du cadre.`
        : ".");
    const reach = Math.min(179, reachKm / 111.2);
    const width = mapNode.clientWidth || 520;
    const h = Math.round(width * 0.86);
    const proj = d3
      .geoAzimuthalEquidistant()
      .rotate([-a.lon, -a.lat])
      .clipAngle(reach)
      .fitExtent(
        [
          [10, 10],
          [width - 10, h - 10],
        ],
        d3.geoCircle().center([a.lon, a.lat]).radius(reach)(),
      );
    const path = d3.geoPath(proj);
    const svg = d3.select(mapNode).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    svg
      .append("path")
      .attr("d", path({ type: "Sphere" }))
      .style("fill", "var(--sea)")
      .style("stroke", "var(--rule)");
    svg
      .append("path")
      .attr("d", path(land))
      .style("fill", "var(--card)")
      .style("stroke", "var(--axis)")
      .style("stroke-width", 0.5);
    const [cx0, cy0] = proj([a.lon, a.lat]);
    for (const km of RINGS.filter((k) => k < reachKm)) {
      svg
        .append("path")
        .attr(
          "d",
          path(
            d3
              .geoCircle()
              .center([a.lon, a.lat])
              .radius(km / 111.2)(),
          ),
        )
        .style("fill", "none")
        .style("stroke", "var(--ink-2)")
        .style("stroke-opacity", 0.25)
        .style("stroke-dasharray", "3 4");
      // label each ring to the south-west of the airport, usually the emptiest side of the map
      const top = proj([a.lon, Math.min(89, a.lat + km / 111.2)]);
      if (top) {
        const rr = Math.hypot(top[0] - cx0, top[1] - cy0);
        svg
          .append("text")
          .attr("class", "end-label")
          .attr("text-anchor", "end")
          .style("font-weight", 500)
          .style("font-size", "11.5px")
          .attr("x", cx0 - rr * Math.SQRT1_2 - 3)
          .attr("y", cy0 + rr * Math.SQRT1_2 + 12)
          .text(`${fmtNum(km)} km`);
      }
    }
    const w = d3
      .scaleSqrt()
      .domain([0, d3.max(routes, (r) => r.pax) || 1])
      .range([0.8, Math.max(6, width * 0.014)]);
    // where a route ends on the map: its airport, or the edge of the frame for the far ones
    const endOf = (r) => {
      if (r.p.dist <= reachKm) return [r.info.lon, r.info.lat];
      return d3.geoInterpolate([a.lon, a.lat], [r.info.lon, r.info.lat])((reachKm * 0.985) / r.p.dist);
    };
    svg
      .append("g")
      .selectAll("path")
      .data([...routes].reverse())
      .join("path")
      .attr("d", (r) => path({ type: "LineString", coordinates: [[a.lon, a.lat], endOf(r)] }))
      .style("fill", "none")
      .style("stroke", (r) => kindOf(r, code).color)
      .style("stroke-width", (r) => w(r.pax))
      .style("stroke-linecap", "round")
      .style("opacity", 0.8)
      .on("pointermove", (event, r) => routeTip(event, a, r, code))
      .on("pointerleave", hideTip);
    svg
      .append("g")
      .selectAll("circle")
      .data(routes.filter((r) => r.p.dist <= reachKm))
      .join("circle")
      .attr("cx", (r) => proj(endOf(r))[0])
      .attr("cy", (r) => proj(endOf(r))[1])
      .attr("r", (r) => 1.5 + w(r.pax) * 0.6)
      .style("fill", (r) => kindOf(r, code).color);
    const boxes = [];
    const fits = (b) =>
      b.x0 > 2 &&
      b.x1 < width - 2 &&
      !boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const labels = [];
    for (const r of routes) {
      if (labels.length >= 14) break;
      const pt = proj(endOf(r));
      const text = r.p.dist > reachKm ? `${placeName(r.info)} ${fmtNum(r.p.dist)} km →` : placeName(r.info);
      const wTxt = text.length * 6.3 + 6;
      // the far labels sit inside the frame, on the side facing the airport
      const right = r.p.dist > reachKm ? pt[0] < cx0 : true;
      const b = right
        ? { x0: pt[0] + 4, x1: pt[0] + 4 + wTxt, y0: pt[1] - 8, y1: pt[1] + 6 }
        : { x0: pt[0] - 4 - wTxt, x1: pt[0] - 4, y0: pt[1] - 8, y1: pt[1] + 6 };
      if (r.p.dist > reachKm && !right) Object.assign(b, { x0: pt[0] + 6, x1: pt[0] + 6 + wTxt });
      if (!fits(b)) continue;
      boxes.push(b);
      labels.push({ x: b.x0 + 1, y: pt[1] + 4, text });
    }
    svg
      .append("g")
      .selectAll("text")
      .data(labels)
      .join("text")
      .attr("class", "end-label")
      .attr("x", (l) => l.x)
      .attr("y", (l) => l.y)
      .text((l) => l.text);
    svg
      .append("circle")
      .attr("cx", cx0)
      .attr("cy", cy0)
      .attr("r", 5)
      .style("fill", "var(--ink)")
      .style("stroke", "var(--card)")
      .style("stroke-width", 2);
  }

  function routeTip(event, a, r, code) {
    showTip(event, `${shortName({ code, nom: a.nom })} ↔ ${r.info.nom}`, [
      { label: `passagers en ${routeYear}`, value: fmtPax(r.pax), color: kindOf(r, code).color },
      { label: "vols", value: fmtNum(r.vols) },
      { label: "distance", value: `${fmtNum(r.p.dist)} km` },
      ...(r.prev > 0 && routeYear !== 2019
        ? [{ label: "par rapport à 2019", value: fmtPct(pctChange(r.prev, r.pax), 0) }]
        : []),
    ]);
  }

  // the ten busiest routes, as a list a reader can scan; French destinations open their own airport
  function renderTop(a, routes) {
    const list = $("#apt-top");
    const top = routes.slice(0, 10);
    $("#apt-top-title").textContent = `Ses principales liaisons en ${routeYear}`;
    $("#apt-top-note").textContent = top.length
      ? `Passagers dans les deux sens${routeYear !== 2019 ? ", et évolution depuis 2019" : ""}. Cliquez sur un aéroport français pour l'explorer.`
      : "Pas de liaison détaillée cette année-là.";
    const max = top[0]?.pax || 1;
    list.replaceChildren(
      ...top.map((r) => {
        const kind = kindOf(r, a.code);
        const d = r.prev > 0 && routeYear !== 2019 ? pctChange(r.prev, r.pax) : null;
        const go = byCode.has(r.other);
        const name = el(go ? "button" : "span", {
          class: "rl-name",
          type: go ? "button" : null,
          text: r.info.nom,
        });
        if (go) name.addEventListener("click", () => selection.set(r.other, { scroll: true }));
        return el("li", {}, [
          name,
          el("span", { class: "rl-bar" }, [
            el("i", { style: `width:${((r.pax / max) * 100).toFixed(1)}%;--c:${kind.color}` }),
          ]),
          el("span", { class: "rl-v", text: compact(r.pax) }),
          el("span", { class: "rl-d", text: d === null ? "" : signed(d) }),
        ]);
      }),
    );
  }

  // ---------------------------------------------------------------- every airport, ranked
  let zone = "all";
  let sortBy = "pax";
  let showAll = false;
  segmented($("#apt-zone"), zone, (v) => {
    zone = v;
    renderRanking();
  });
  const more = $("#apt-rank-more");
  more.addEventListener("click", () => {
    showAll = !showAll;
    renderRanking();
  });
  const spark = (a) => {
    const vals = years.map((y) => yr(a, y) ?? 0);
    const mx = d3.max(vals) || 1;
    const W = 96;
    const H = 22;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 4) + 2, H - 2 - (v / mx) * (H - 4)]);
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg
      .append("path")
      .attr("d", d3.line()(pts))
      .style("fill", "none")
      .style("stroke", "var(--blue)")
      .style("stroke-width", 1.4);
    svg
      .append("circle")
      .attr("cx", pts.at(-1)[0])
      .attr("cy", pts.at(-1)[1])
      .attr("r", 2.2)
      .style("fill", "var(--blue)");
    return svg.node();
  };
  function renderRanking() {
    const table = $("#apt-rank");
    const pool = ranked.filter((a) => zone === "all" || (zone === "om" ? a.zone === "OM" : a.zone !== "OM"));
    const change = (a) => ((yr(a, 2019) ?? 0) >= RANK_MIN_2019 ? vs2019(a) : null);
    const rows = [...pool].sort((p, q) =>
      sortBy === "pax" ? pax(q) - pax(p) : (change(q) ?? -Infinity) - (change(p) ?? -Infinity),
    );
    const shown = showAll ? rows : rows.slice(0, RANK_SHORT);
    const maxPax = d3.max(pool, pax) || 1; // bars are linear: Paris's weight shows as it is
    const head = (key, label) => {
      const btn = el("button", { type: "button", class: "sort", text: label });
      btn.addEventListener("click", () => {
        sortBy = key;
        renderRanking();
      });
      return el("th", { scope: "col", "aria-sort": sortBy === key ? "descending" : "none" }, btn);
    };
    const sel = selection.get();
    table.replaceChildren(
      el(
        "thead",
        {},
        el("tr", {}, [
          el("th", { scope: "col", class: "r", text: "Rang" }),
          el("th", { scope: "col", text: "Aéroport" }),
          head("pax", "Passagers"),
          head("d", "Depuis 2019"),
          el("th", { scope: "col", class: "spark", text: `1990–${lastYear}` }),
        ]),
      ),
      el(
        "tbody",
        {},
        shown.map((a) => {
          const d = change(a);
          const name = el("button", { type: "button", class: "rk-name" }, [
            el("span", { class: "full", text: a.nom }),
            el("span", { class: "short", text: shortName(a) }),
          ]);
          const tr = el("tr", { "aria-selected": String(a.code === sel) }, [
            el("td", { class: "r", text: String(rank.get(a.code)) }),
            el("th", { scope: "row" }, name),
            el("td", { class: "pax" }, [
              el("span", { class: "pax-track", "aria-hidden": "true" }, [
                el("i", { style: `width:${((100 * pax(a)) / maxPax).toFixed(2)}%` }),
              ]),
              el("span", { class: "pax-v", text: fmtPax(pax(a)) }),
            ]),
            el("td", {
              class: d === null || Math.abs(d) < 0.5 ? "" : d > 0 ? "up" : "down",
              text: signed(d),
            }),
            el("td", { class: "spark" }, spark(a)),
          ]);
          tr.addEventListener("click", () => selection.set(a.code, { scroll: true }));
          return tr;
        }),
      ),
    );
    $("#apt-rank-note").textContent =
      `${pool.length} aéroports avec du trafic publié en ${lastYear}, classés par ${sortBy === "pax" ? "nombre de passagers" : "évolution depuis 2019"}. L'évolution n'est donnée que pour les aéroports de plus de 100 000 passagers en 2019. Cliquez sur une ligne pour explorer l'aéroport.`;
    more.hidden = rows.length <= RANK_SHORT;
    more.textContent = showAll ? "Afficher moins" : `Afficher les ${rows.length} aéroports`;
  }

  // ---------------------------------------------------------------- wiring
  function render(code, opts = {}) {
    const a = byCode.get(code);
    if (!a) return;
    renderCard(a);
    if (compare === code) {
      compare = "";
      compareSel.value = "";
    }
    renderTrend(a);
    renderSeasons(a);
    renderRoutes(code);
    renderRanking();
    if (opts.scroll)
      document.getElementById("apt-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  selection.on((code, opts) => {
    markPick(code);
    render(code, opts);
  });
  onResize(mapNode, () => renderRoutes(selection.get()));
  onResize(seasonNode, () => renderSeasons(byCode.get(selection.get())));
  const fromHash = selection.fromHash();
  selection.set(fromHash && byCode.has(fromHash) ? fromHash : "LFBO");
}
