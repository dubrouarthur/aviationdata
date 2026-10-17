import * as d3 from "d3";
import { feature } from "topojson-client";
import { $, el, showTip, hideTip, onResize } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { rolling12, yearSum, pctChange, toDate, isNum } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtNum, fmtMonth, ordinal } from "../lib/format.js";
import { selection } from "../lib/data.js";
import { shortName } from "./names.js";

const PARIS = new Set(["LFPG", "LFPO", "LFOB"]);
const RINGS = [500, 1000, 2000, 5000, 10000];

/** Airport explorer: key figures crossing APT (passengers, flights, freight) and PAP (detailed routes). */
export function initAirport(data, { world }) {
  const { months, airports, years } = data.aeroports;
  const R = data.routes;
  const lastYear = years.at(-1);
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const yr = (a, y) => yearSum(months, a.pax, y);
  const rankIn = (y) =>
    new Map(
      [...airports]
        .filter((a) => (yr(a, y) ?? 0) > 0)
        .sort((p, q) => yr(q, y) - yr(p, y))
        .map((a, i) => [a.code, i + 1]),
    );
  const land = feature(world, world.objects.countries);
  let routeYear = lastYear;

  // ---------------------------------------------------------------- controls
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
  // quick picks: the busiest airports, one click away
  const busiest = [...airports]
    .filter((a) => (yr(a, lastYear) ?? 0) > 0)
    .sort((p, q) => yr(q, lastYear) - yr(p, lastYear))
    .slice(0, 8);
  const picks = busiest.map((a) =>
    el("button", { type: "button", "data-code": a.code, "aria-pressed": "false", text: shortName(a) }),
  );
  picks.forEach((b) => b.addEventListener("click", () => selection.set(b.dataset.code)));
  $("#apt-picks").replaceChildren(el("span", { text: "Les plus fréquentés :" }), ...picks);
  const markPick = (code) =>
    picks.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.code === code)));

  const yearSel = $("#apt-year");
  yearSel.replaceChildren(
    ...[...R.years]
      .reverse()
      .map((y) => el("option", { value: y, text: `Liaisons ${y}`, selected: y === routeYear || null })),
  );
  yearSel.addEventListener("change", () => {
    routeYear = +yearSel.value;
    renderRoutes(selection.get());
  });

  // ---------------------------------------------------------------- card
  function render(code, opts = {}) {
    const a = byCode.get(code);
    if (!a) return;
    const yi = years.indexOf(lastYear);
    const pLast = yr(a, lastYear);
    const vols = a.vols?.[yi];
    const fret = a.fret?.[yi];
    const nRoutes = R.pairs.filter(
      (p) => (p.a === code || p.b === code) && p.pax[R.years.indexOf(lastYear)] > 0,
    ).length;
    const firstYear = years.find((y) => (yr(a, y) ?? 0) > 0);
    $("#apt-head").replaceChildren(
      el("h3", { style: "font-size:2rem;line-height:1.02;margin:0", text: a.nom }),
      el("p", {
        class: "note",
        style: "margin:4px 0 0",
        text: `${a.code}, ${a.zone === "OM" ? "Outre-mer" : "Métropole"}, trafic publié depuis ${firstYear}`,
      }),
    );
    const facts = [
      [fmtPax(pLast), `passagers en ${lastYear}`],
      [fmtPct(pctChange(yr(a, 2019), pLast), 0), "par rapport à 2019"],
      [rankIn(lastYear).get(code) ? ordinal(rankIn(lastYear).get(code)) : "–", "aéroport français"],
      [vols ? fmtNum(pLast / vols, 0) : "–", "passagers par vol"],
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

    const chartNode = $("#chart-apt");
    chartNode.replaceChildren();
    const avg12 = rolling12(a.pax).map((v) => (isNum(v) ? v / 12 : null));
    lineChart(chartNode, {
      dates: months.map(toDate),
      series: [
        { key: "m", label: "Chaque mois", color: "var(--axis)", values: a.pax, width: 1.2 },
        { key: "a", label: "Moyenne 12 mois", color: "var(--blue)", values: avg12, width: 2.6 },
      ],
      xDomain: [toDate(`${firstYear}-01`), toDate(months.at(-1))],
      yZero: true,
      yFormat: fmtPaxAxis,
      tipFormat: fmtPax,
      title: (i) => fmtMonth(months[i]),
      height: 230,
      endLabels: false,
    });
    renderRoutes(code);
    if (opts.scroll)
      document.getElementById("aeroport").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------------------------------------------- spider map (azimuthal equidistant)
  const mapNode = $("#apt-routes");
  function renderRoutes(code) {
    const a = byCode.get(code);
    mapNode.replaceChildren();
    if (!a) return;
    const yi = R.years.indexOf(routeYear);
    const routes = R.pairs
      .filter((p) => (p.a === code || p.b === code) && p.pax[yi] > 0)
      .map((p) => {
        const other = p.a === code ? p.b : p.a;
        return { p, other, info: R.airports[other], pax: p.pax[yi], prev: p.pax[R.years.indexOf(2019)] };
      })
      .sort((x, y) => y.pax - x.pax);
    $("#apt-routes-title").textContent = `Ses liaisons en ${routeYear}`;
    $("#apt-routes-note").textContent = routes.length
      ? `${routes.length} liaisons détaillées par la DGAC (celles qui comptent au moins trois compagnies). Les cercles indiquent la distance depuis l'aéroport.`
      : "Aucune liaison de cet aéroport n'est détaillée par la DGAC cette année-là : seules les lignes exploitées par au moins trois compagnies le sont.";
    const width = mapNode.clientWidth || 520;
    const h = Math.round(width * 0.92);
    const maxKm = d3.max(routes, (r) => r.p.dist) || 1500;
    const reach = Math.min(179, (maxKm * 1.12) / 111.2);
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
    for (const km of RINGS.filter((k) => k < maxKm * 1.12)) {
      const circle = d3
        .geoCircle()
        .center([a.lon, a.lat])
        .radius(km / 111.2)();
      svg
        .append("path")
        .attr("d", path(circle))
        .style("fill", "none")
        .style("stroke", "var(--ink-2)")
        .style("stroke-opacity", 0.25)
        .style("stroke-dasharray", "3 4");
      // label each ring to the south-west of the airport, usually the emptiest side of the map
      const [cx0, cy0] = proj([a.lon, a.lat]);
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
    const colorOf = (r) =>
      r.info.fr
        ? r.other.startsWith("LF")
          ? PARIS.has(r.other) || PARIS.has(code)
            ? "var(--magenta)"
            : "var(--teal)"
          : "var(--ochre)"
        : "var(--blue)";
    svg
      .append("g")
      .selectAll("path")
      .data([...routes].reverse())
      .join("path")
      .attr("d", (r) =>
        path({
          type: "LineString",
          coordinates: [
            [a.lon, a.lat],
            [r.info.lon, r.info.lat],
          ],
        }),
      )
      .style("fill", "none")
      .style("stroke", colorOf)
      .style("stroke-width", (r) => w(r.pax))
      .style("stroke-linecap", "round")
      .style("opacity", 0.8)
      .on("pointermove", (event, r) =>
        showTip(event, `${shortName({ code, nom: a.nom })} ↔ ${r.info.nom}`, [
          { label: `passagers en ${routeYear}`, value: fmtPax(r.pax), color: colorOf(r) },
          { label: "vols", value: fmtNum(r.p.vols[yi]) },
          { label: "distance", value: `${fmtNum(r.p.dist)} km` },
          ...(r.prev > 0 && routeYear !== 2019
            ? [{ label: "par rapport à 2019", value: fmtPct(pctChange(r.prev, r.pax), 0) }]
            : []),
        ]),
      )
      .on("pointerleave", hideTip);
    svg
      .append("g")
      .selectAll("circle")
      .data(routes)
      .join("circle")
      .attr("cx", (r) => proj([r.info.lon, r.info.lat])?.[0])
      .attr("cy", (r) => proj([r.info.lon, r.info.lat])?.[1])
      .attr("r", (r) => 1.5 + w(r.pax) * 0.6)
      .style("fill", colorOf);
    const boxes = [];
    svg
      .append("g")
      .selectAll("text")
      .data(
        routes.slice(0, 14).filter((r) => {
          const pt = proj([r.info.lon, r.info.lat]);
          if (!pt) return false;
          const label = r.info.nom.split("-")[0];
          const b = { x0: pt[0] + 4, x1: pt[0] + 8 + label.length * 6.2, y0: pt[1] - 8, y1: pt[1] + 6 };
          if (boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) || b.x1 > width)
            return false;
          boxes.push(b);
          return true;
        }),
      )
      .join("text")
      .attr("class", "end-label")
      .attr("x", (r) => proj([r.info.lon, r.info.lat])[0] + 5)
      .attr("y", (r) => proj([r.info.lon, r.info.lat])[1] + 4)
      .text((r) => r.info.nom.split("-")[0]);
    const [ox, oy] = proj([a.lon, a.lat]);
    svg
      .append("circle")
      .attr("cx", ox)
      .attr("cy", oy)
      .attr("r", 5)
      .style("fill", "var(--ink)")
      .style("stroke", "var(--card)")
      .style("stroke-width", 2);
  }

  selection.on((code, opts) => {
    markPick(code);
    render(code, opts);
  });
  onResize(mapNode, () => renderRoutes(selection.get()));
  const fromHash = selection.fromHash();
  selection.set(fromHash && byCode.has(fromHash) ? fromHash : "LFBO");
}
