import * as d3 from "d3";
import { $, el, showTip, hideTip, onResize, cssVar } from "../lib/ui.js";
import { lineChart } from "../lib/linechart.js";
import { rolling12, yearSum, pctChange, seasonality, toDate, isNum } from "../lib/series.js";
import { fmtPax, fmtPaxAxis, fmtPct, fmtNum, fmtMonth, monthShort, ordinal } from "../lib/format.js";
import { selection, eventMarks } from "../lib/data.js";

export function initAirport(data) {
  const { months, airports } = data.aeroports;
  const dates = months.map(toDate);
  const years = d3.range(+months[0].slice(0, 4), +months.at(-1).slice(0, 4) + 1);
  const lastYear = years.at(-1);
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const yr = (a, y) => yearSum(months, a.pax, y);
  const ranked = (y) => airports.filter((a) => (yr(a, y) ?? 0) > 0).sort((p, q) => yr(q, y) - yr(p, y));
  const rankLast = new Map(ranked(lastYear).map((a, i) => [a.code, i + 1]));
  const nationalLast =
    d3.sum(airports, (a) => yr(a, lastYear) ?? 0) +
    d3.sum(data.aeroports.aggregates, (a) => yearSum(months, a.pax, lastYear) ?? 0);

  // ---------------------------------------------------------------- search
  const input = $("#apt-input");
  const sortedForList = [...airports].sort((p, q) => (yr(q, lastYear) ?? 0) - (yr(p, lastYear) ?? 0));
  $("#apt-list").replaceChildren(
    ...sortedForList.map((a) => el("option", { value: `${a.nom} (${a.code})` })),
  );
  const pick = () => {
    const v = input.value.trim();
    const code = /\(([A-Z]{4})\)\s*$/.exec(v)?.[1] || (/^[a-z]{4}$/i.test(v) ? v.toUpperCase() : null);
    const found =
      (code && byCode.get(code)) ||
      airports.find((a) => a.nom.toLowerCase() === v.toLowerCase()) ||
      airports.find((a) => a.nom.toLowerCase().includes(v.toLowerCase()) && v.length >= 3);
    if (found) {
      selection.set(found.code);
      input.value = "";
      input.blur();
    }
  };
  input.addEventListener("change", pick);
  input.addEventListener("keydown", (e) => e.key === "Enter" && pick());

  // ---------------------------------------------------------------- card
  const root = $("#airport-card");
  let lineCh = null;
  let seasonYears = [2019, lastYear];

  function render(code, { scroll } = {}) {
    const a = byCode.get(code);
    if (!a) return;
    const pLast = yr(a, lastYear);
    const p19 = yr(a, 2019);
    const peakYear = d3.greatest(years, (y) => yr(a, y) ?? -1);
    const firstYear = years.find((y) => (yr(a, y) ?? 0) > 0);
    const lastActive = [...years].reverse().find((y) => (yr(a, y) ?? 0) > 0);
    const facts = [
      [fmtPax(pLast), `passagers en ${lastYear}`],
      [fmtPct(pctChange(p19, pLast)), "par rapport à 2019"],
      [rankLast.get(code) ? ordinal(rankLast.get(code)) : "–", `aéroport français en ${lastYear}`],
      [fmtPax(yr(a, peakYear)), `record, en ${peakYear}`],
    ];
    if (!pLast) facts.splice(0, 3, [String(lastActive ?? "–"), "dernière année avec du trafic publié"]);
    if (pLast && nationalLast)
      facts.push([`${fmtNum((pLast / nationalLast) * 100, 1)} %`, "du trafic des aéroports français"]);

    const lineNode = el("div", {
      class: "chart",
      tabindex: 0,
      "aria-label": `Passagers mensuels de ${a.nom}`,
    });
    const seasonNode = el("div", { class: "chart" });
    const selA = yearSelect(0);
    const selB = yearSelect(1);
    const preview = el("div", { class: "share-preview" });
    const copyBtn = el("button", { type: "button", class: "btn", text: "Copier le lien" });
    const shareBtn = el("button", { type: "button", class: "btn primary", text: "Créer l'image à partager" });

    root.replaceChildren(
      el("div", { class: "card-head" }, [
        el("h3", { text: a.nom }),
        el("span", { class: "code", text: a.code }),
        el("span", {
          class: "note",
          text: `${a.zone === "OM" ? "Outre-mer" : "Métropole"}, trafic publié de ${firstYear} à ${lastActive}`,
        }),
      ]),
      el(
        "div",
        { class: "facts" },
        facts.map(([b, s]) => el("div", { class: "fact" }, [el("b", { text: b }), el("span", { text: s })])),
      ),
      el("h3", { class: "h3", text: "Passagers par mois depuis " + firstYear }),
      el("p", {
        class: "note",
        text: "Trait fin : chaque mois. Trait épais : moyenne des 12 derniers mois. Un trou signale un mois sous le seuil de diffusion de la DGAC (1 000 passagers).",
      }),
      lineNode,
      el("h3", { class: "h3", text: "Saisonnalité : comparer deux années" }),
      el("div", { class: "controls" }, [selA, el("span", { class: "note", text: "contre" }), selB]),
      seasonNode,
      el("div", { class: "card-actions" }, [shareBtn, copyBtn]),
      preview,
    );

    const raw = a.pax;
    const avg12 = rolling12(raw).map((v) => (isNum(v) ? v / 12 : null));
    lineCh = lineChart(lineNode, {
      dates,
      series: [
        { key: "m", label: "Mensuel", color: "var(--muted)", values: raw, width: 1.2 },
        { key: "a", label: "Moyenne 12 mois", color: "var(--ink)", values: avg12, width: 2.5 },
      ],
      xDomain: [toDate(`${firstYear}-01`), dates.at(-1)],
      yZero: true,
      yFormat: fmtPaxAxis,
      tipFormat: fmtPax,
      title: (i) => fmtMonth(months[i]),
      events: eventMarks(),
      height: 260,
      endLabels: false,
    });

    const drawSeason = (width) => drawSeasonality(seasonNode, width, a);
    onResize(seasonNode, drawSeason);
    drawSeason(seasonNode.clientWidth || 800);

    function yearSelect(which) {
      const s = el(
        "select",
        {
          class: "seg",
          "aria-label": which ? "Seconde année" : "Première année",
          style: "padding:6px 10px;font:inherit;color:inherit;background:var(--land)",
        },
        years
          .filter((y) => (yr(a, y) ?? 0) > 0)
          .map((y) => el("option", { value: y, text: y, selected: y === seasonYears[which] || null })),
      );
      if (!(yr(a, seasonYears[which]) > 0)) seasonYears[which] = +s.value;
      s.addEventListener("change", () => {
        seasonYears[which] = +s.value;
        drawSeasonality(seasonNode, seasonNode.clientWidth, a);
      });
      return s;
    }

    copyBtn.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}#aeroport=${a.code}`;
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = "Lien copié";
      } catch {
        preview.replaceChildren(
          el("input", {
            value: url,
            readonly: true,
            style: "width:min(520px,100%);font:inherit;padding:8px",
          }),
        );
        preview.querySelector("input").select();
      }
    });
    shareBtn.addEventListener("click", () => shareImage(a, preview));

    if (scroll) document.getElementById("aeroport").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawSeasonality(node, width, a) {
    node.replaceChildren();
    const [ya, yb] = seasonYears;
    const sa = seasonality(months, a.pax, ya);
    const sb = seasonality(months, a.pax, yb);
    const m = { top: 10, right: 12, bottom: 24, left: 52 };
    const h = 220;
    const x = d3
      .scaleBand()
      .domain(d3.range(12))
      .range([m.left, width - m.right])
      .padding(0.22);
    const xi = d3.scaleBand().domain([0, 1]).range([0, x.bandwidth()]).padding(0.12);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max([...sa, ...sb].filter(isNum)) || 1])
      .nice()
      .range([h - m.bottom, m.top]);
    const svg = d3.select(node).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("height", h);
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
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtPaxAxis).tickSize(0).tickPadding(8))
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((i) => (width < 520 ? monthShort(i).slice(0, 1).toUpperCase() : monthShort(i)))
          .tickSizeOuter(0),
      );
    const colors = ["var(--axis)", "var(--glow)"];
    const g = svg
      .append("g")
      .selectAll("g")
      .data(d3.range(12))
      .join("g")
      .attr("transform", (i) => `translate(${x(i)},0)`);
    [sa, sb].forEach((s, k) => {
      g.append("rect")
        .attr("x", xi(k))
        .attr("width", xi.bandwidth())
        .attr("y", (i) => (isNum(s[i]) ? y(s[i]) : y(0)))
        .attr("height", (i) => (isNum(s[i]) ? Math.max(0, y(0) - y(s[i])) : 0))
        .attr("rx", 3)
        .style("fill", colors[k]);
    });
    g.append("rect")
      .attr("width", x.step())
      .attr("x", -x.step() * 0.11)
      .attr("y", m.top)
      .attr("height", h - m.top - m.bottom)
      .attr("fill", "transparent")
      .on("pointermove", (event, i) =>
        showTip(event, `${monthShort(i)} — ${a.nom}`, [
          { label: String(yb), value: fmtPax(sb[i]), color: colors[1] },
          { label: String(ya), value: fmtPax(sa[i]), color: colors[0] },
          { label: "évolution", value: fmtPct(pctChange(sa[i], sb[i])) },
        ]),
      )
      .on("pointerleave", hideTip);
    node.append(
      el("div", { class: "map-legend" }, [
        el("span", {
          style: "display:inline-block;width:14px;height:10px;border-radius:3px;background:var(--axis)",
        }),
        el("span", { text: String(ya) }),
        el("span", {
          style: "display:inline-block;width:14px;height:10px;border-radius:3px;background:var(--glow)",
        }),
        el("span", { text: String(yb) }),
      ]),
    );
  }

  // ---------------------------------------------------------------- share image (SVG -> PNG)
  function shareImage(a, preview) {
    const W = 1200;
    const H = 630;
    const ink = cssVar("--ink");
    const bg = cssVar("--surface");
    const muted = cssVar("--muted");
    const accent = cssVar("--glow");
    const down = cssVar("--div-down");
    const up = cssVar("--div-up");
    const pLast = yr(a, lastYear);
    const delta = pctChange(yr(a, 2019), pLast);
    const series = years.map((y) => yr(a, y) ?? 0);
    const x = d3
      .scaleBand()
      .domain(years)
      .range([80, W - 80])
      .padding(0.18);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(series) || 1])
      .range([H - 70, H - 250]);
    const bars = years
      .map(
        (yy, i) =>
          `<rect x="${x(yy)}" y="${y(series[i])}" width="${x.bandwidth()}" height="${H - 70 - y(series[i])}" rx="3" fill="${yy === lastYear ? accent : yy === 2019 ? muted : ink}" fill-opacity="${yy === lastYear || yy === 2019 ? 1 : 0.28}"/>`,
      )
      .join("");
    const esc = (s) =>
      String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const font = "Archivo Narrow, Arial Narrow, Helvetica Neue, Arial, sans-serif";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="${bg}"/>
      <text x="80" y="86" font-family="${font}" font-size="26" fill="${muted}">Le ciel à deux vitesses, trafic ${lastYear}</text>
      <text x="80" y="170" font-family="${font}" font-weight="700" font-size="76" fill="${ink}">${esc(a.nom)}</text>
      <text x="80" y="262" font-family="${font}" font-weight="700" font-size="64" fill="${ink}">${esc(fmtPax(pLast))} passagers</text>
      <text x="80" y="320" font-family="${font}" font-weight="700" font-size="40" fill="${isNum(delta) && delta < 0 ? down : up}">${esc(fmtPct(delta))} par rapport à 2019${rankLast.get(a.code) ? `, ${ordinal(rankLast.get(a.code))} aéroport français` : ""}</text>
      ${bars}
      <text x="80" y="${H - 34}" font-family="${font}" font-size="20" fill="${muted}">${years[0]}</text>
      <text x="${W - 80}" y="${H - 34}" text-anchor="end" font-family="${font}" font-size="20" fill="${muted}">Source : DGAC, data.gouv.fr</text>
    </svg>`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const url = canvas.toDataURL("image/png");
      const file = `trafic-${a.code}-${lastYear}.png`;
      preview.replaceChildren(
        el("img", {
          src: url,
          alt: `Fiche partageable : ${a.nom}`,
          style: "width:min(600px,100%);margin-top:16px;border:1px solid var(--hairline);border-radius:8px",
        }),
        el("p", {}, el("a", { href: url, download: file, class: "btn", text: "Télécharger l'image" })),
      );
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  selection.on((code, opts) => render(code, opts));
}
