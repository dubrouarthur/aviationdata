// The figures of the human-factor story. Most are bars in HTML (labels wrap on a phone, every value is
// written, nothing hides behind a hover); the forty-year series is an SVG line chart.
import * as d3 from "d3";
import { el, onResize, showTip, hideTip } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { BIT, CHEESE } from "./facts.js";

const pct = (v, d = 0) => `${fmtNum(v, d)} %`;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A horizontal bar: label, track with its fill, value. rows: [{label, value (0-100 or count), color, text}] */
function barRow({ label, value, max, color, text, sub, head }) {
  return el("div", { class: `hb-row${head ? " hb-head" : ""}${sub ? " hb-sub" : ""}` }, [
    el("span", { class: "hb-label", text: label }),
    el(
      "span",
      { class: "hb-track" },
      el("i", { style: `width:${Math.max(0, (100 * value) / max)}%;--c:${color}` }),
    ),
    el("b", { class: "hb-val", text }),
  ]);
}

/** Bars of shares (%) or counts. */
export function bars(node, rows, { max, fmt = (v) => pct(v), legend } = {}) {
  const top = max ?? d3.max(rows, (r) => r.value) ?? 1;
  node.replaceChildren(
    ...(legend ? [legendRow(legend)] : []),
    el(
      "div",
      { class: "hb" },
      rows.map((r) =>
        barRow({ ...r, max: top, color: r.color ?? "var(--human)", text: r.text ?? fmt(r.value) }),
      ),
    ),
  );
}

function legendRow(items) {
  return el(
    "p",
    { class: "hb-legend" },
    items.map(({ label, color }) => el("span", {}, [el("i", { style: `--c:${color}` }), label])),
  );
}

/** The pyramid of severity: each floor as wide as its accidents, the human part in orange, centred. */
export function pyramid(node, rows) {
  const max = d3.max(rows, (r) => r.n);
  node.replaceChildren(
    el(
      "div",
      { class: "pyr" },
      rows.map((r) =>
        el("div", { class: "pyr-row" }, [
          el("span", { class: "pyr-label" }, [
            el("b", { text: r.label }),
            el("small", { text: `${fmtNum(r.n)} accidents` }),
          ]),
          el("span", { class: "pyr-track" }, [
            el("i", { class: "pyr-all", style: `width:${(100 * r.n) / max}%` }),
            el("i", { class: "pyr-human", style: `width:${(100 * r.person) / max}%` }),
          ]),
          el("b", { class: "pyr-val", text: pct(r.share) }),
        ]),
      ),
    ),
  );
}

/** The TEM chain: threats, errors, undesired states, then what the states come with. */
export function chainDiagram(node, c) {
  const share = (k) => pct((100 * k) / c.n);
  const stage = (cls, title, n, text) =>
    el("div", { class: `ch-stage ${cls}` }, [
      el("span", { class: "ch-title", text: title }),
      el("b", { class: "ch-n", text: share(n) }),
      el("span", { class: "ch-text", text }),
    ]);
  node.replaceChildren(
    el("div", { class: "ch-row" }, [
      stage(
        "ch-threat",
        "Menaces",
        c.threat,
        `${fmtNum(c.threat)} accidents citent l'environnement ou une panne`,
      ),
      el("span", { class: "ch-arrow", "aria-hidden": "true" }),
      stage("ch-error", "Erreurs", c.error, `${fmtNum(c.error)} accidents citent une personne`),
      el("span", { class: "ch-arrow", "aria-hidden": "true" }),
      stage(
        "ch-state",
        "États indésirables",
        c.state,
        `${fmtNum(c.state)} accidents citent un paramètre de vol non maintenu`,
      ),
    ]),
    el("div", { class: "ch-split" }, [
      el("p", {}, [
        "Parmi ces états indésirables, ",
        el("b", { text: pct((100 * c.stateError) / c.state) }),
        " s'accompagnent d'une erreur citée, ",
        el("b", { text: pct((100 * c.stateThreat) / c.state) }),
        " d'une menace.",
      ]),
      el("span", { class: "ch-bar", "aria-hidden": "true" }, [
        el("i", { class: "ch-bar-err", style: `width:${(100 * c.stateError) / c.state}%` }),
      ]),
    ]),
  );
}

/** Swiss cheese, UpSet style: one row per combination of the four layers, dots for the layers cited. */
export function cheeseChart(node, rows, n = 9) {
  const shown = rows.filter((r) => r.mask).slice(0, n);
  const none = rows.find((r) => r.mask === 0);
  const max = d3.max(shown, (r) => r.share);
  const dots = (mask) =>
    el(
      "span",
      { class: "ck-dots" },
      CHEESE.map((l) =>
        el("i", { class: mask & l.bit ? `on ck-${l.key}` : "", title: l.label, "aria-hidden": "true" }),
      ),
    );
  const name = (mask) =>
    CHEESE.filter((l) => mask & l.bit)
      .map((l) => l.label)
      .join(" + ");
  node.replaceChildren(
    el("div", { class: "ck-head" }, [
      el(
        "span",
        { class: "ck-dots" },
        CHEESE.map((l) => el("span", { class: "ck-col", text: l.label })),
      ),
    ]),
    el(
      "div",
      { class: "ck" },
      shown.map((r) =>
        el("div", { class: "ck-row" }, [
          dots(r.mask),
          el("span", { class: "ck-name", text: name(r.mask) }),
          el(
            "span",
            { class: "hb-track" },
            el("i", {
              style: `width:${(100 * r.share) / max}%;--c:${r.mask & BIT.person ? "var(--human)" : "var(--ink-2)"}`,
            }),
          ),
          el("b", { class: "hb-val", text: pct(r.share, r.share < 1 ? 1 : 0) }),
        ]),
      ),
    ),
    none
      ? el("p", {
          class: "note ck-none",
          text: `Aucune des quatre couches : ${pct(none.share)} des accidents (cause indéterminée, ou seulement un état indésirable de l'appareil).`,
        })
      : "",
  );
}

/** Defining events: the bar is the accidents, its orange part those citing a person. */
export function eventsChart(node, rows, n = 16) {
  const shown = rows.filter((r) => r.key !== "Miscellaneous/other").slice(0, n);
  const max = d3.max(shown, (r) => r.n);
  node.replaceChildren(
    el("p", { class: "hb-legend" }, [
      el("span", {}, [el("i", { style: "--c:var(--human)" }), "une personne citée"]),
      el("span", {}, [el("i", { style: "--c:var(--rule-strong)" }), "aucune personne"]),
      el("span", { class: "ev-fatal-key", text: "† accidents mortels" }),
    ]),
    el(
      "div",
      { class: "hb ev" },
      shown.map((r) =>
        el("div", { class: "hb-row ev-row" }, [
          el("span", { class: "hb-label" }, [
            r.label,
            el("small", { text: ` ${fmtNum(r.n)} · † ${fmtNum(r.fatal)}` }),
          ]),
          el("span", { class: "hb-track ev-track" }, [
            el("i", { class: "ev-all", style: `width:${(100 * r.n) / max}%` }),
            el("i", { class: "ev-human", style: `width:${(100 * r.person) / max}%` }),
          ]),
          el("b", { class: "hb-val", text: pct(r.share) }),
        ]),
      ),
    ),
  );
}

/** Segments: three bars each, person, environment, aircraft failure. */
export function segmentsChart(node, segs) {
  const keys = [
    ["person", "Personne", "var(--human)"],
    ["env", "Environnement", "var(--env)"],
    ["machine", "Panne", "var(--machine)"],
  ];
  node.replaceChildren(
    legendRow(keys.map(([, label, color]) => ({ label, color }))),
    el(
      "div",
      { class: "sg" },
      segs.map((s) =>
        el("div", { class: `sg-row${s.key === "airline" ? " sg-hi" : ""}` }, [
          el("span", { class: "sg-name" }, [
            el("b", { text: s.label }),
            el("small", { text: `${fmtNum(s.n)} accidents` }),
          ]),
          el(
            "span",
            { class: "sg-bars" },
            keys.map(([k, label, color]) =>
              el("span", { class: "sg-bar", title: label }, [
                el("span", { class: "hb-track" }, el("i", { style: `width:${s[k]}%;--c:${color}` })),
                el("b", { class: "hb-val", text: pct(s[k]) }),
              ]),
            ),
          ),
        ]),
      ),
    ),
  );
}

/** Forty years: share of accidents citing a person, and an aircraft failure, with the 2008 change of coding. */
export function historyChart(node, history) {
  const rows = (k) => history[k].map(([y, n, p, m]) => ({ y, p: (100 * p) / n, m: (100 * m) / n }));
  const parts = [rows("old"), rows("new")];
  const draw = () => {
    const width = node.clientWidth || 640;
    const narrow = width < 520;
    const height = narrow ? 300 : 340;
    const m = { top: 22, right: narrow ? 12 : 150, bottom: 30, left: 40 };
    const svg = d3
      .select(node)
      .selectAll("svg")
      .data([0])
      .join("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);
    svg.selectAll("*").remove();
    const all = parts.flat();
    const x = d3
      .scaleLinear()
      .domain(d3.extent(all, (d) => d.y))
      .range([m.left, width - m.right]);
    const y = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height - m.bottom, m.top]);
    const c = {
      human: css("--human"),
      machine: css("--machine"),
      grid: css("--grid"),
      muted: css("--muted"),
      ink: css("--ink-2"),
      paper: css("--card"),
    };
    const g = svg.append("g");
    g.append("g")
      .attr("transform", `translate(${m.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((v) => `${v} %`)
          .tickSize(-(width - m.left - m.right)),
      )
      .call((a) => {
        a.selectAll(".domain").remove();
        a.selectAll("line").attr("stroke", c.grid);
        a.selectAll("text").attr("fill", c.muted).attr("font-size", 12);
      });
    g.append("g")
      .attr("transform", `translate(0,${height - m.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(narrow ? [1982, 1995, 2008, 2023] : [1982, 1990, 2000, 2008, 2015, 2023])
          .tickFormat(String)
          .tickSize(0)
          .tickPadding(8),
      )
      .call((a) => {
        a.selectAll(".domain").remove();
        a.selectAll("text").attr("fill", c.muted).attr("font-size", 12);
      });
    const bx = (x(history.break - 1) + x(history.break)) / 2;
    g.append("line")
      .attr("x1", bx)
      .attr("x2", bx)
      .attr("y1", m.top - 6)
      .attr("y2", height - m.bottom)
      .attr("stroke", c.muted)
      .attr("stroke-dasharray", "3 3");
    g.append("text")
      .attr("x", bx + 6)
      .attr("y", m.top + 4)
      .attr("font-size", 12)
      .attr("fill", c.muted)
      .text("nouvelle grille du NTSB");
    for (const [k, color] of [
      ["p", c.human],
      ["m", c.machine],
    ]) {
      for (const rs of parts) {
        g.append("path")
          .datum(rs)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2.5)
          .attr(
            "d",
            d3
              .line()
              .x((d) => x(d.y))
              .y((d) => y(d[k])),
          );
        g.selectAll(null)
          .data(rs)
          .join("circle")
          .attr("cx", (d) => x(d.y))
          .attr("cy", (d) => y(d[k]))
          .attr("r", 3.2)
          .attr("fill", color)
          .on("pointermove", (ev, d) =>
            showTip(ev, String(d.y), [
              { label: "une personne citée", value: pct(d.p), color: c.human },
              { label: "une panne de l'appareil", value: pct(d.m), color: c.machine },
            ]),
          )
          .on("pointerleave", hideTip);
      }
    }
    const last = parts[1].at(-1);
    const lab = (t, yy, color) =>
      narrow
        ? g
            .append("text")
            .attr("x", x(1983))
            .attr("y", yy)
            .attr("font-size", 12.5)
            .attr("font-weight", 650)
            .attr("fill", color)
            .attr("paint-order", "stroke")
            .attr("stroke", c.paper)
            .attr("stroke-width", 4)
            .text(t)
        : g
            .append("text")
            .attr("x", x(last.y) + 10)
            .attr("y", yy + 4)
            .attr("font-size", 13)
            .attr("font-weight", 650)
            .attr("fill", color)
            .text(t);
    if (narrow) {
      lab("Une personne citée", y(parts[0][0].p) - 10, c.human);
      lab("Une panne de l'appareil", y(parts[0][0].m) - 10, c.machine);
    } else {
      lab("Une personne citée", y(last.p), c.human);
      lab("Une panne de l'appareil", y(last.m), c.machine);
    }
  };
  draw();
  onResize(node, draw);
}

/* ------------------------------------------------------------------ the HFACS building */
/** A fixed shuffle of 0..n-1, so the same windows light up on every visit. */
function shuffled(n, seed) {
  const a = d3.range(n);
  let s = seed;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Light the windows when the figure comes into view, floor after floor (once; at once if motion is reduced). */
function lightOnView(node, cls) {
  const done = () => node.classList.add(cls);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return done();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        done();
        io.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(node);
}

/** HFACS as a building at night: four floors of 100 windows, one lit per 1 % of the accidents reaching it.
 * floors: [{ no, name, share, text, tone, families: [{label, share, text}] }], ground floor first. */
export function building(node, floors) {
  const floorEl = (f, k) => {
    const lit = f.share > 0 ? Math.max(1, Math.round(f.share)) : 0;
    const order = shuffled(100, 7 + 31 * f.no);
    const on = new Set(order.slice(0, lit));
    return el("div", { class: `bld-floor bld-${f.tone}` }, [
      el("div", { class: "bld-label" }, [
        el("span", { class: "bld-no", text: `Étage ${f.no}` }),
        el("span", { class: "bld-name" }, [el("b", { text: f.name }), el("span", { class: "bld-val", text: f.text })]),
        f.families.length
          ? el(
              "ul",
              { class: "bld-fam" },
              f.families.map((m) =>
                el("li", {}, [
                  el("span", { text: m.label }),
                  el("i", { style: `--w:${m.share}%` }),
                  el("b", { text: m.text }),
                ]),
              ),
            )
          : "",
      ]),
      el(
        "div",
        {
          class: "bld-win",
          role: "img",
          "aria-label": `${f.name} : ${f.text} des accidents, ${lit} fenêtre${lit > 1 ? "s" : ""} allumée${lit > 1 ? "s" : ""} sur 100.`,
        },
        d3.range(100).map((i) =>
          el("i", on.has(i) ? { class: "on", style: `--d:${k * 0.35 + (order.indexOf(i) / 100) * 0.9}s` } : {}),
        ),
      ),
    ]);
  };
  const top = [...floors].reverse();
  const box = el("div", { class: "bld" }, [
    el("div", { class: "bld-roof", "aria-hidden": "true" }),
    ...top.map((f, i) => floorEl(f, floors.length - 1 - i)),
    el("div", { class: "bld-ground" }, [el("span", { text: "L'accident" })]),
  ]);
  node.replaceChildren(box);
  lightOnView(box, "bld-lit");
}

/* ------------------------------------------------------------------ Swiss cheese slices */
/** Four slices of cheese per group; in each group, as many slices as layers cited have their hole
 * on the line of the accident. groups: [{ k, label, share, text }] */
export function cheeseSlices(node, groups) {
  const W = 200;
  const H = 128;
  const xs = [38, 80, 122, 164];
  const mid = 64;
  // A slice seen at an angle: a parallelogram with rounded feel, lit on its left edge.
  const slice = (x) =>
    `M${x - 9},${mid - 46} L${x + 9},${mid - 52} L${x + 9},${mid + 40} L${x - 9},${mid + 46} Z`;
  const decoys = [
    [-3, -30, 3.2],
    [3, 22, 2.6],
    [-2, 34, 2],
    [4, -14, 2.2],
  ];
  const svg = (k) => {
    const s = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "cz-svg").attr("aria-hidden", "true");
    s.append("line")
      .attr("class", "cz-axis")
      .attr("x1", 6)
      .attr("x2", W - 10)
      .attr("y1", mid)
      .attr("y2", mid);
    s.append("path").attr("class", "cz-head").attr("d", `M${W - 12},${mid - 5} L${W - 4},${mid} L${W - 12},${mid + 5} Z`);
    xs.forEach((x, i) => {
      const g = s.append("g").attr("class", `cz-slice${i < k ? " cz-hit" : ""}`);
      g.append("path").attr("d", slice(x));
      decoys
        .filter((_, j) => (i + j) % 2 === 0 || j === 0)
        .forEach(([dx, dy, r], j) =>
          g
            .append("ellipse")
            .attr("class", "cz-hole")
            .attr("cx", x + dx * (j % 2 ? -1 : 1))
            .attr("cy", mid + dy - (i % 2) * 6)
            .attr("rx", r * 0.8)
            .attr("ry", r * 1.4),
        );
      if (i < k)
        g.append("ellipse").attr("class", "cz-pierced").attr("cx", x).attr("cy", mid).attr("rx", 4.6).attr("ry", 8);
    });
    // The line of the accident shows through the holes the verdict retains.
    xs.slice(0, k).forEach((x) =>
      s.append("line").attr("class", "cz-thru").attr("x1", x - 4).attr("x2", x + 4).attr("y1", mid).attr("y2", mid),
    );
    return s.node();
  };
  node.replaceChildren(
    el(
      "div",
      { class: "cz" },
      groups.map((g) =>
        el("div", { class: `cz-group${g.k === 1 ? " cz-main" : ""}` }, [
          svg(g.k),
          el("b", { class: "cz-val", text: g.text }),
          el("span", { class: "cz-label", text: g.label }),
        ]),
      ),
    ),
  );
}
