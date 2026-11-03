// « Calculez votre vol », the interface. The reader picks two airports in a search box (ARIA combobox:
// a city, an airport or its code), or a direct line proposed from the departure, then the season, the
// cabin class, one way or return, and whether to count the effects other than CO2. The answer: the
// route on a globe, the CO2 per passenger and what it weighs against a year of a French person's
// footprint, the same trip in every class, the cabin of an average flight seat by seat, and the
// calculation step by step. The choice lives in the address, so a result can be shared:
// ?de=NCE&vers=CDG&saison=ete&classe=economy&trajet=ar&hors-co2=1#calculer
import * as d3 from "d3";
import { feature } from "topojson-client";
import { el } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { fmtNum } from "../lib/format.js";
import { flightFacts, destinations, searchAirports, SEASONS, SEASON_MONTHS, CLASSES, FOOTPRINT, classesOf, haulOf, segmentOf, greatCircle } from "./calc.js";

const kg10 = (v) => `${fmtNum(Math.round(v / 10) * 10, 0)} kg`;
const pct = (v) => `${fmtNum(v * 100, 0)} %`;
const short = (a) => a.label;
const code = (a) => a.iata || a.code;
const PLANE =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 15.5v-1.7l-8-5V3.6a1.4 1.4 0 0 0-2.8 0v5.2l-8 5v1.7l8-2.4v4.6L8 19.2v1.3l3.6-1 3.6 1v-1.3l-2.2-1.5v-4.6z" fill="currentColor"/></svg>';
const SWAP =
  '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 7h11m0 0-3-3m3 3-3 3M15 13H4m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLEAR =
  '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** An airport search box. onPick(airport|null). */
function combobox({ id, label, L, onPick }) {
  let chosen = null;
  let options = [];
  let active = -1;
  const input = el("input", {
    id,
    type: "text",
    role: "combobox",
    autocomplete: "off",
    spellcheck: "false",
    "aria-autocomplete": "list",
    "aria-expanded": "false",
    "aria-controls": `${id}-list`,
    placeholder: "Ville, aéroport ou code",
  });
  const list = el("ul", {
    id: `${id}-list`,
    role: "listbox",
    class: "cb-list",
    hidden: true,
    "aria-label": label,
  });
  const clear = el("button", {
    type: "button",
    class: "cb-clear",
    "aria-label": `Effacer : ${label.toLowerCase()}`,
    hidden: true,
  });
  clear.innerHTML = CLEAR;
  const tag = el("span", { class: "cb-code", "aria-hidden": "true" });
  const box = el("div", { class: "cb" }, [
    el("label", { for: id, text: label }),
    el("div", { class: "cb-field" }, [tag, input, clear]),
    list,
  ]);

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const mark = (k) => {
    active = k;
    [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === k)));
    if (k >= 0) {
      input.setAttribute("aria-activedescendant", list.children[k].id);
      list.children[k].scrollIntoView({ block: "nearest" });
    }
  };
  const render = () => {
    options = searchAirports(L, input.value);
    list.replaceChildren(
      ...options.map((a, i) =>
        el("li", { id: `${id}-o${i}`, role: "option", "aria-selected": "false", "data-code": a.code }, [
          el("b", { text: code(a) }),
          el("span", {}, [short(a), el("small", { text: a.name !== a.label ? `${a.name} · ${a.country}` : a.country })]),
        ]),
      ),
    );
    if (!options.length && input.value.trim())
      list.append(el("li", { class: "cb-none", role: "option", "aria-disabled": "true", "aria-selected": "false", text: "Aucun aéroport relié à la France ne correspond." }));
    list.hidden = !input.value.trim();
    input.setAttribute("aria-expanded", String(!list.hidden));
    mark(options.length ? 0 : -1);
  };
  const set = (a, { silent = false } = {}) => {
    chosen = a;
    input.value = a ? short(a) : "";
    tag.textContent = a ? code(a) : "";
    box.classList.toggle("has", !!a);
    clear.hidden = !a && !input.value;
    close();
    if (!silent) onPick(a);
  };

  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    if (chosen) {
      chosen = null;
      tag.textContent = "";
      box.classList.remove("has");
      onPick(null);
    }
    clear.hidden = !input.value;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      if (list.hidden) render();
      mark(Math.min(options.length - 1, active + 1));
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      mark(Math.max(0, active - 1));
    } else if (e.key === "Enter") {
      if (!list.hidden && options[active]) {
        e.preventDefault();
        set(options[active]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  });
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      // a single match, or the first match of a code typed whole, is taken without a click
      if (!chosen && options.length === 1) set(options[0]);
      else close();
    }, 120),
  );
  list.addEventListener("pointerdown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const li = e.target.closest("[data-code]");
    if (li) set(options.find((a) => a.code === li.dataset.code));
  });
  clear.addEventListener("click", () => {
    set(null);
    input.focus();
  });
  return { box, set, get: () => chosen, focus: () => input.focus() };
}

/** The cabin of an average flight: one square per seat, the occupied ones in ink, aisles between. */
function cabin(seats, taken) {
  const n = Math.max(1, Math.round(seats));
  const full = Math.min(n, Math.round(taken));
  const across = n > 230 ? 9 : n > 110 ? 6 : 4; // wide-body 3-3-3, narrow-body 3-3, regional 2-2
  const aisles = across === 9 ? [3, 6] : [across / 2];
  const rows = Math.ceil(n / across);
  const S = 7;
  const G = 2;
  const A = 5;
  const W = rows * (S + G);
  const H = across * (S + G) + aisles.length * A;
  // which seats are taken: spread over the cabin, the same every time
  const order = Array.from({ length: n }, (_, i) => i);
  let x = 7;
  for (let i = n - 1; i > 0; i--) {
    x = (x * 16807) % 2147483647;
    const j = x % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const on = new Set(order.slice(0, full));
  let rects = "";
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / across);
    const c = k % across;
    const y = c * (S + G) + aisles.filter((a) => c >= a).length * A;
    rects += `<rect x="${r * (S + G)}" y="${y}" width="${S}" height="${S}" rx="1.5" class="${on.has(k) ? "s-on" : "s-off"}"/>`;
  }
  const svg = el("div", {
    class: "cabin",
    role: "img",
    "aria-label": `Un vol moyen : ${fmtNum(full, 0)} passagers pour ${fmtNum(n, 0)} sièges.`,
  });
  svg.innerHTML = `<svg viewBox="-6 -6 ${W + 12} ${H + 12}" preserveAspectRatio="xMinYMid meet"><rect class="hull" x="-6" y="-6" width="${W + 12}" height="${H + 12}" rx="${(H + 12) / 2}"/>${rects}</svg>`;
  return svg;
}

/* ------------------------------------------------------------------ the route on a globe */
let landP = null;
const loadLand = () =>
  (landP ||= fetch(asset("geo/world-110m.json"))
    .then((r) => r.json())
    .then((t) => feature(t, t.objects.land)));

/** An orthographic globe turned to the middle of the route, zoomed so that the route fills it. */
function globe(node) {
  const W = 520;
  const H = 440;
  const svg = d3
    .select(node)
    .append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("class", "globe")
    .attr("role", "img");
  const proj = d3.geoOrthographic().clipAngle(90).translate([W / 2, H / 2]);
  const path = d3.geoPath(proj);
  const gSphere = svg.append("path").attr("class", "gl-sphere");
  const gGrat = svg.append("path").attr("class", "gl-grat");
  const gLand = svg.append("path").attr("class", "gl-land");
  const gArc = svg.append("path").attr("class", "gl-arc");
  const gEnds = svg.append("g");
  let land = null;
  let last = null;
  loadLand().then((l) => {
    land = l;
    if (last) draw(...last);
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function draw(A, B, label) {
    last = [A, B, label];
    svg.attr("aria-label", label);
    const a = [A.lon, A.lat];
    const b = [B.lon, B.lat];
    const mid = d3.geoInterpolate(a, b)(0.5);
    const theta = d3.geoDistance(a, b); // radians
    proj.rotate([-mid[0], -mid[1]]);
    // an end point lands at 38 % of the width from the centre; never smaller than the whole globe
    const R = Math.max(H * 0.46, Math.min(W * 6, (W * 0.38) / Math.max(1e-3, Math.sin(theta / 2))));
    proj.scale(R);
    gSphere.attr("d", path({ type: "Sphere" }));
    gGrat.attr("d", path(d3.geoGraticule10()));
    if (land) gLand.attr("d", path(land));
    const line = { type: "LineString", coordinates: [a, b] };
    gArc.attr("d", path(line));
    const len = gArc.node().getTotalLength();
    gArc.interrupt().attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", reduce ? 0 : len);
    if (!reduce) gArc.transition().duration(900).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
    const ends = [
      [A, a, "start"],
      [B, b, "end"],
    ].map(([ap, p, k]) => ({ ap, xy: proj(p), k }));
    gEnds
      .selectAll("g")
      .data(ends)
      .join((e) => {
        const g = e.append("g");
        g.append("circle").attr("r", 5.5);
        g.append("text").attr("class", "gl-code");
        g.append("text").attr("class", "gl-name");
        return g;
      })
      .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]})`)
      .each(function (d) {
        // the label on the side with room: left of a point in the right half, right of it otherwise
        const right = d.xy[0] < W / 2;
        const g = d3.select(this);
        g.select(".gl-code")
          .attr("x", right ? 10 : -10)
          .attr("y", -6)
          .attr("text-anchor", right ? "start" : "end")
          .text(d.ap.iata || d.ap.code);
        g.select(".gl-name")
          .attr("x", right ? 10 : -10)
          .attr("y", 12)
          .attr("text-anchor", right ? "start" : "end")
          .text(d.ap.label.length > 26 ? `${d.ap.label.slice(0, 25)}…` : d.ap.label);
      });
  }
  return { draw };
}

/* ------------------------------------------------------------------ a year of footprint, day by day */
function yearGrid(days) {
  const n = Math.min(365, Math.round(days));
  const C = 53; // weeks
  const S = 6;
  const G = 1.6;
  let cells = "";
  for (let d = 0; d < 365; d++) {
    const x = Math.floor(d / 7) * (S + G);
    const y = (d % 7) * (S + G);
    cells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${S}" height="${S}" rx="1" class="${d < n ? "d-on" : "d-off"}"/>`;
  }
  const box = el("div", { class: "yr", role: "img", "aria-label": `${fmtNum(n, 0)} jours sur 365` });
  box.innerHTML = `<svg viewBox="0 0 ${C * (S + G)} ${7 * (S + G)}">${cells}</svg>`;
  return box;
}

/* ------------------------------------------------------------------ the calculator */
const SEASON_KEYS = ["hiver", "printemps", "ete", "automne"];

export function calculator(node, L, co2, C) {
  const byCode = new Map(L.airports.flatMap((a) => [[a.code, a], ...(a.iata ? [[a.iata, a]] : [])]));
  const state = { from: null, to: null, season: 2, back: true, cls: "economy", rf: false };

  const seg = (label, items, get, set, cls = "") => {
    const g = el(
      "div",
      { class: `calc-seg ${cls}`, role: "radiogroup", "aria-label": label },
      items.map((it) =>
        el("button", { type: "button", role: "radio", "data-v": it.v, "aria-checked": "false" }, [
          el("span", { text: it.label }),
          it.small ? el("small", { text: it.small }) : null,
        ]),
      ),
    );
    g.addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b || b.disabled) return;
      set(b.dataset.v);
      update();
    });
    g.sync = () => {
      for (const b of g.children) b.setAttribute("aria-checked", String(b.dataset.v === String(get())));
    };
    return g;
  };
  const seasons = seg(
    "Saison du voyage",
    SEASONS.map((s, i) => ({ v: String(i), label: s[0].toUpperCase() + s.slice(1), small: SEASON_MONTHS[i].replace(" à ", "–") })),
    () => state.season,
    (v) => (state.season = +v),
    "seasons",
  );
  const classes = seg(
    "Classe",
    CLASSES.map((c) => ({ v: c.key, label: c.label })),
    () => state.cls,
    (v) => (state.cls = v),
    "classes",
  );
  const trip = seg(
    "Trajet",
    [
      { v: "1", label: "Aller-retour" },
      { v: "0", label: "Aller simple" },
    ],
    () => (state.back ? "1" : "0"),
    (v) => (state.back = v === "1"),
  );
  const rfBox = el("input", { type: "checkbox", id: "calc-rf" });
  rfBox.addEventListener("change", () => {
    state.rf = rfBox.checked;
    update();
  });
  const rf = el("label", { class: "calc-rf", for: "calc-rf" }, [
    rfBox,
    el("span", {}, [
      "Compter aussi les traînées et autres effets hors CO2",
      el("small", { text: "Comme le gouvernement britannique : environ ×1,7" }),
    ]),
  ]);

  const from = combobox({ id: "calc-from", label: "Départ", L, onPick: (a) => ((state.from = a), update()) });
  const to = combobox({ id: "calc-to", label: "Arrivée", L, onPick: (a) => ((state.to = a), update()) });
  const swap = el("button", { type: "button", class: "calc-swap", "aria-label": "Inverser le départ et l'arrivée" });
  swap.innerHTML = SWAP;
  swap.addEventListener("click", () => {
    [state.from, state.to] = [state.to, state.from];
    from.set(state.from, { silent: true });
    to.set(state.to, { silent: true });
    update();
  });
  const suggest = el("div", { class: "calc-suggest", id: "calc-suggest" });
  const mapBox = el("div", { class: "calc-map" });
  const out = el("div", { class: "calc-out", id: "calc-result", "aria-live": "polite" });
  const plane = el("div", { class: "calc-plane", id: "calc-plane" });

  node.replaceChildren(
    el("div", { class: "calc-top" }, [
      el("div", { class: "calc-route" }, [from.box, swap, to.box]),
      suggest,
      el("div", { class: "calc-opts" }, [
        el("div", { class: "calc-opt" }, [el("p", { class: "calc-lab", text: "Saison" }), seasons]),
        el("div", { class: "calc-opt" }, [el("p", { class: "calc-lab", text: "Classe" }), classes]),
        el("div", { class: "calc-opt" }, [el("p", { class: "calc-lab", text: "Trajet" }), trip]),
        el("div", { class: "calc-opt" }, [rf]),
      ]),
    ]),
    el("div", { class: "calc-stage" }, [mapBox, out]),
    plane,
  );
  const map = globe(mapBox);

  const chip = (content, onClick) => {
    const b = el("button", { type: "button", class: "calc-chip" }, content);
    b.addEventListener("click", onClick);
    return b;
  };
  const pick = (a, b) => {
    state.from = a;
    state.to = b;
    from.set(a, { silent: true });
    to.set(b, { silent: true });
    update();
  };

  function update() {
    render();
    const p = new URLSearchParams(location.search);
    for (const [k, v] of [
      ["de", state.from && code(state.from)],
      ["vers", state.to && code(state.to)],
      ["saison", SEASON_KEYS[state.season]],
      ["classe", state.cls],
      ["trajet", state.back ? "ar" : "aller"],
      ["hors-co2", state.rf ? "1" : null],
    ])
      v ? p.set(k, v) : p.delete(k);
    history.replaceState(null, "", `${location.pathname}?${p}${location.hash}`);
  }

  function render() {
    const { from: A, to: B } = state;
    for (const g of [seasons, trip]) g.sync();
    // the classes a band offers: short-haul has economy and business only
    const haul = A && B && A !== B ? haulOf(segmentOf(A, B, greatCircle(A, B))) : "long";
    const offered = classesOf(C, haul).map((c) => c.key);
    if (!offered.includes(state.cls)) state.cls = "economy";
    for (const b of classes.children) {
      b.disabled = !offered.includes(b.dataset.v);
      b.title = b.disabled ? "Pas de cette classe sur les vols courts dans les facteurs du gouvernement britannique" : "";
    }
    classes.sync();

    if (A && !B) {
      const d = destinations(L, A.code).slice(0, 8);
      suggest.replaceChildren(
        el("p", { class: "calc-lab", text: `Lignes directes les plus fréquentées depuis ${short(A)}` }),
        el(
          "div",
          { class: "calc-chips" },
          d.map((x) => {
            const b = byCode.get(x.code);
            return chip([el("b", { text: code(b) }), ` ${short(b)}`], () => pick(A, b));
          }),
        ),
      );
    } else if (!A && !B) {
      const ex = [
        ["CDG", "JFK"],
        ["ORY", "PTP"],
        ["LYS", "NTE"],
        ["CDG", "MAD"],
        ["NCE", "CDG"],
      ]
        .map(([x, y]) => [byCode.get(x), byCode.get(y)])
        .filter(([x, y]) => x && y);
      suggest.replaceChildren(
        el("p", { class: "calc-lab", text: "Pour essayer" }),
        el("div", { class: "calc-chips" }, ex.map(([x, y]) => chip(`${short(x)} → ${short(y)}`, () => pick(x, y)))),
      );
    } else suggest.replaceChildren();

    if (!A || !B || A === B) {
      mapBox.hidden = true;
      plane.replaceChildren();
      out.replaceChildren(
        el("div", { class: "calc-empty" }, [
          el("p", {
            class: "calc-empty-t",
            text: !A ? "D'où partez-vous ?" : !B ? "Où allez-vous ?" : "Le départ et l'arrivée sont le même aéroport.",
          }),
          el("p", { text: "Les aéroports reliés à la France par des vols de ligne, en métropole, en outre-mer et à l'étranger." }),
        ]),
      );
      return;
    }
    const F = flightFacts(L, co2, C, A.code, B.code, state.season, { back: state.back, cls: state.cls, rf: state.rf });
    mapBox.hidden = false;
    map.draw(A, B, `Le trajet de ${short(A)} à ${short(B)}, ${fmtNum(F.km, 0)} km à vol d'oiseau.`);

    const tripText = `${F.trips === 2 ? "aller-retour" : "aller simple"}, en ${F.klass.label.toLowerCase()}`;
    const days = Math.round(F.days);
    const maxClass = Math.max(...F.byClass.map((c) => c.kg));
    out.replaceChildren(
      el("p", { class: "co-route" }, [
        el("b", { text: `${code(A)} → ${code(B)}` }),
        ` ${fmtNum(F.km, 0)} km à vol d'oiseau · ${F.segmentLabel.toLowerCase()}`,
      ]),
      el("p", { class: "co-kg", id: "calc-kg", text: kg10(F.kg) }),
      el("p", { class: "co-kg-l", text: `de CO2 par passager, ${tripText}${F.rf ? ", effets hors CO2 compris" : ""}` }),
      el("div", { class: "co-days" }, [
        el("p", {}, [
          "Autant que ",
          el("b", { id: "calc-days", text: `${fmtNum(days, 0)} jour${days > 1 ? "s" : ""}` }),
          ` de l'empreinte carbone moyenne d'un Français, qui est de ${fmtNum(FOOTPRINT.t, 1)} tonnes par an.`,
        ]),
        yearGrid(F.days),
      ]),
      el("div", { class: "co-classes" }, [
        el("p", { class: "calc-lab", text: "Le même voyage, selon la classe" }),
        el(
          "ul",
          { class: "co-cls", id: "calc-classes" },
          F.byClass.map((c) => {
            const b = el(
              "button",
              { type: "button", class: c.key === F.klass.key ? "on" : "", "aria-pressed": String(c.key === F.klass.key) },
              [
                el("span", { class: "cc-l", text: c.label }),
                el("span", { class: "cc-bar" }, el("i", { style: `width:${((c.kg / maxClass) * 100).toFixed(1)}%` })),
                el("b", { text: kg10(c.kg) }),
              ],
            );
            b.addEventListener("click", () => {
              state.cls = c.key;
              update();
            });
            return el("li", {}, b);
          }),
        ),
      ]),
      steps(F),
    );

    // the cabin of an average flight of the route, in the chosen season
    if (F.status === "route") {
      const trend =
        F.loadPrev == null || Math.round(F.load * 100) === Math.round(F.loadPrev * 100) ? "" : ` (${pct(F.loadPrev)} un an plus tôt)`;
      const sb = el(
        "div",
        { class: "pl-seasons", role: "group", "aria-label": `Sièges occupés selon la saison, ${F.year}` },
        F.loads.map((v, k) => {
          const b = el("button", { type: "button", class: k === state.season ? "on" : "", "aria-pressed": String(k === state.season) }, [
            el("span", { class: "ps-bar" }, el("i", { style: `height:${v == null ? 0 : (v * 100).toFixed(1)}%` })),
            el("b", { text: v == null ? "–" : pct(v) }),
            el("small", { text: SEASONS[k] }),
          ]);
          b.addEventListener("click", () => {
            state.season = k;
            update();
          });
          return b;
        }),
      );
      plane.replaceChildren(
        el("div", { class: "pl-head" }, [
          el("p", { class: "pl-h", text: `Dans l'avion, en ${F.season}` }),
          el("p", { class: "pl-sub", text: `Un vol moyen de la ligne ${code(A)}–${code(B)}, ${F.quarter} ${F.year}, toutes compagnies (Eurostat).` }),
        ]),
        el("div", { class: "pl-body" }, [
          cabin(F.seatsPerFlight, F.perFlight),
          el("ul", { class: "pl-stats", id: "calc-stats" }, [
            el("li", {}, [el("b", { text: fmtNum(Math.round(F.perFlight), 0) }), el("span", { text: `passagers pour ${fmtNum(Math.round(F.seatsPerFlight), 0)} sièges` })]),
            el("li", {}, [el("b", { text: pct(F.load) }), el("span", { text: `des sièges occupés${trend}` })]),
            el("li", {}, [el("b", { text: fmtNum(Math.round(F.perWeek), 0) }), el("span", { text: "vols par semaine dans chaque sens" })]),
          ]),
          el("div", { class: "pl-season-box" }, [el("p", { class: "calc-lab", text: "Remplissage selon la saison" }), sb]),
        ]),
      );
    } else {
      plane.replaceChildren(
        el("p", {
          class: "pl-none",
          id: "calc-noroute",
          text:
            F.status === "secret"
              ? "Eurostat ne publie pas les chiffres de cette ligne : ils révéleraient ceux d'une seule compagnie (secret statistique). Le CO2 ci-dessus suppose un remplissage moyen."
              : `Eurostat ne compte pas de vol direct entre ces deux aéroports en ${F.year}. Avec une escale, la distance et le CO2 augmentent.`,
        }),
      );
    }
  }

  /** The calculation, step by step, folded. */
  function steps(F) {
    const x = (f) => `×${fmtNum(f, 2)}`;
    const rows = [
      [
        `${fmtNum(F.km, 0)} km${F.trips === 2 ? " × 2" : ""} × ${fmtNum(F.g, 0)} g, la moyenne d'un passager de ${F.segmentLabel.toLowerCase()} (DGAC, ${F.co2Year})`,
        F.steps[0].kg,
      ],
      [`${x(F.classRatio)} pour un siège en ${F.klass.label.toLowerCase()} plutôt qu'une place moyenne (gouvernement britannique, ${C.year})`, F.steps[1].kg],
      [
        F.status === "route"
          ? `${x(F.loadRatio)} car la ligne est remplie à ${pct(F.load)} en ${F.season}, contre ${pct(F.segLoad)} pour les vols du même type (Eurostat, ${F.year})`
          : "×1 : sans chiffres de la ligne, un remplissage moyen",
        F.steps[2].kg,
      ],
    ];
    if (F.rf) rows.push([`${x(F.rfRatio)} pour les traînées et autres effets hors CO2 (gouvernement britannique, ${C.year})`, F.steps[3].kg]);
    return el("details", { class: "co-steps", id: "calc-steps" }, [
      el("summary", { text: "Le calcul, étape par étape" }),
      el(
        "ol",
        {},
        rows.map(([t, v]) => el("li", {}, [el("span", { text: t }), el("b", { text: kg10(v) })])),
      ),
    ]);
  }

  // from the address, or an example the reader can change at once
  const p = new URLSearchParams(location.search);
  const si = SEASON_KEYS.indexOf(p.get("saison") ?? "");
  if (si >= 0) state.season = si;
  if (CLASSES.some((c) => c.key === p.get("classe"))) state.cls = p.get("classe");
  if (p.get("trajet") === "aller") state.back = false;
  if (p.get("hors-co2") === "1") state.rf = rfBox.checked = true;
  state.from = byCode.get((p.get("de") ?? "").toUpperCase()) ?? null;
  state.to = byCode.get((p.get("vers") ?? "").toUpperCase()) ?? null;
  if (!p.has("de") && !p.has("vers")) {
    state.from = byCode.get("CDG") ?? null;
    state.to = byCode.get("JFK") ?? null;
  }
  from.set(state.from, { silent: true });
  to.set(state.to, { silent: true });
  render();
  if (p.has("de") && location.hash === "#calculer") node.closest("section")?.scrollIntoView();
}
