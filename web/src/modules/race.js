import * as d3 from "d3";
import { $, el, rich, onResize, reducedMotion } from "../lib/ui.js";
import { addSummary } from "../lib/summary.js";
import { player, whileVisible } from "../lib/scrolly.js";
import { ranksByYear, pctChange } from "../lib/series.js";
import { fmtPax, fmtPctAbs, fmtNum } from "../lib/format.js";

const TOP = 10;

/** Bar chart race of carriers by passengers (CIE series), 2010 -> today. */
export function initRace(data) {
  const { years, carriers, lowcost_share: share } = data.compagnies;
  const L = years.length - 1;
  const ranks = ranksByYear(carriers);
  const leader = [...carriers].sort((a, b) => b.pax[L] - a.pax[L])[0];
  const ryanair = carriers.find((c) => c.nom === "Ryanair");
  const top3 = [...carriers].sort((a, b) => b.pax[L] - a.pax[L]).slice(1, 4);

  $("#cie-text").replaceChildren(
    el(
      "p",
      {},
      rich([
        `En ${years[0]}, les compagnies à bas coûts transportaient `,
        { b: `${fmtNum(share[0] * 100, 0)} %` },
        ` des passagers. En ${years[L]}, `,
        { b: `${fmtNum(share[L] * 100, 0)} %` },
        `. ${leader.nom} reste en tête avec ${fmtPax(leader.pax[L])} de passagers, suivie de ${top3.map((c) => c.nom).join(", ")}.`,
        ...(ryanair
          ? [
              ` Ryanair, qui réduit son offre en France depuis la hausse des taxes, ${
                pctChange(ryanair.pax[L - 1], ryanair.pax[L]) < 0 ? "recule" : "progresse"
              } de `,
              { b: fmtPctAbs(pctChange(ryanair.pax[L - 1], ryanair.pax[L]), 1) },
              ` sur un an.`,
            ]
          : []),
      ]),
    ),
  );
  addSummary("compagnies", {
    value: `${fmtNum(share[L] * 100, 0)} %`,
    label: `des passagers voyagent en low-cost en ${years[L]}, contre ${fmtNum(share[0] * 100, 0)} % en ${years[0]}`,
    color: "var(--teal)",
  });
  $("#cie-note").textContent =
    "Compagnies regroupées par marque (Malta Air avec Ryanair, par exemple). Classées à bas coûts : easyJet, Ryanair, Transavia, Volotea, Vueling, Wizz Air, Eurowings, Norwegian, Jet2 (choix éditorial). Passagers au départ et à l'arrivée de la France.";

  $("#race-legend").replaceChildren(
    el("span", { class: "lg" }, [
      el("i", { class: "sq", style: "--c:var(--teal)" }),
      "Compagnie à bas coûts",
    ]),
    el("span", { class: "lg" }, [el("i", { class: "sq", style: "--c:var(--blue)" }), "Autre compagnie"]),
  );
  const node = $("#chart-race");
  let width = node.clientWidth || 900;
  let current = L;
  const svg = d3.select(node).append("svg");
  const gBars = svg.append("g");
  const yearText = svg.append("text").attr("class", "race-year").attr("text-anchor", "end");
  const shareText = svg
    .append("text")
    .attr("class", "end-label")
    .attr("text-anchor", "end")
    .style("font-size", "14px");

  function frame(i, dur) {
    const h = 44 + TOP * 34;
    svg.attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
    const m = { top: 10, right: 70, bottom: 10, left: width < 560 ? 104 : 140 };
    const rows = carriers
      .filter((c) => ranks.get(c.nom)[i] && ranks.get(c.nom)[i] <= TOP)
      .sort((a, b) => ranks.get(a.nom)[i] - ranks.get(b.nom)[i]);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (c) => c.pax[i]) || 1])
      .range([m.left, width - m.right]);
    const y = (r) => m.top + (r - 1) * 34;
    const t = svg.transition().duration(dur).ease(d3.easeLinear);
    const color = (c) => (c.lowcost ? "var(--teal)" : "var(--blue)");

    const g = gBars.selectAll("g.bar").data(rows, (c) => c.nom);
    const enter = g
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr("transform", `translate(0,${y(TOP + 1)})`)
      .style("opacity", 0);
    enter
      .append("rect")
      .attr("class", "race-bar")
      .attr("x", m.left)
      .attr("height", 24)
      .attr("rx", 4)
      .attr("width", 0);
    enter
      .append("text")
      .attr("class", "race-label")
      .attr("y", 16.5)
      .attr("x", m.left - 10)
      .attr("text-anchor", "end");
    enter.append("text").attr("class", "race-value").attr("y", 16.5);
    const all = enter.merge(g);
    all.select("rect").style("fill", color).attr("x", m.left);
    all
      .transition(t)
      .attr("transform", (c) => `translate(0,${y(ranks.get(c.nom)[i])})`)
      .style("opacity", 1);
    all
      .select("rect")
      .transition(t)
      .attr("width", (c) => Math.max(2, x(c.pax[i]) - m.left));
    all
      .select(".race-label")
      .text((c) => (width < 560 && c.nom.length > 14 ? `${c.nom.slice(0, 13)}…` : c.nom))
      .attr("x", m.left - 10)
      .style("fill", "var(--ink)");
    all
      .select(".race-value")
      .transition(t)
      .attr("x", (c) => x(c.pax[i]) + 8)
      .tween("text", function (c) {
        const node = this;
        const from = +(node.dataset.v || 0);
        const interp = d3.interpolateNumber(from, c.pax[i]);
        node.dataset.v = c.pax[i];
        return (tt) => (node.textContent = fmtPax(interp(tt)));
      });
    g.exit()
      .transition(t)
      .attr("transform", `translate(0,${y(TOP + 1)})`)
      .style("opacity", 0)
      .remove();
    yearText
      .attr("x", width - 14)
      .attr("y", h - 40)
      .style("font-size", `${Math.min(140, width * 0.14)}px`)
      .text(years[i]);
    shareText
      .attr("x", width - 14)
      .attr("y", h - 14)
      .text(`Part des compagnies à bas coûts : ${fmtNum(share[i] * 100, 0)} %`);
    yearText.lower();
  }

  const timeline = player({
    button: $("#race-play"),
    slider: $("#race-slider"),
    output: $("#race-out"),
    values: years,
    interval: 1150,
    labels: { play: "Lancer la course de 2010 à aujourd'hui", pause: "Mettre la course en pause" },
    onChange: (_, i) => {
      current = i;
      frame(i, reducedMotion() ? 0 : 1050);
    },
  });
  frame(L, 0);
  let autoplayed = false;
  whileVisible(
    node,
    () => {
      if (autoplayed || reducedMotion()) return;
      autoplayed = true;
      timeline.set(years[0]);
      setTimeout(() => $("#race-play").click(), 400);
    },
    () => {},
  );
  onResize(node, (w) => {
    width = w;
    frame(current, 0);
  });
}
