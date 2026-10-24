// The route explorer: any day of 2019-2022, five destinations, the 12 UTC wind at 250 hPa and the
// fastest route each way, solved in the browser (route.js, checked against the Python build).
import * as d3 from "d3";
import { $, el, onResize } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { decodeDay, drawSpeed, fieldBox, particles, plateCarree } from "./wind.js";
import { fastestRoute, routeWind, windAt } from "./route.js";
import { drawLand, line, loadLand, css, speedLegend } from "./maps.js";
import { compass, hm, kmh, longDate, minutes, shortDate } from "./fmt.js";

const FIRST = "2019-01-01";
const LAST = "2022-12-31";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ICON = {
  prev: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const shift = (iso, n) => {
  const d = new Date(`${iso}T00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Days worth a look, read from the data: records of the flights and extremes of the model. */
export function moments(flights, routing) {
  const R = flights.pair.records;
  const s = routing.summary;
  const summer = routing.days.filter((d) => [6, 7, 8].includes(+d[0].slice(5, 7)));
  const calm = d3.least(summer, (d) => Math.abs(d[3] - d[1]));
  const list = [
    { iso: s.max_w[0], text: `Le plus grand détour vers New York : ${minutes(s.max_w[1])} gagnées` },
    { iso: R.fast_e.day, text: `Le jour le plus rapide vers Paris : ${hm(R.fast_e.dur)} en médiane` },
    { iso: R.slow_w.day, text: `Le plus lent vers New York : ${hm(R.slow_w.dur)} en médiane` },
    {
      iso: R.fast_w.day,
      text:
        R.fast_w.w > 0
          ? `Le vent tourne à l'est : ${hm(R.fast_w.dur)} vers New York`
          : `Le plus rapide vers New York : ${hm(R.fast_w.dur)}`,
    },
    { iso: calm[0], text: `Un jour d'été presque sans vent sur la route` },
  ];
  const seen = new Set();
  return list.filter((m) => !seen.has(m.iso) && seen.add(m.iso));
}

export function explorer({ grid, flights, routing, onDay }) {
  const stage = $("#exp-stage");
  const svg = d3.select("#exp-svg");
  const base = $("#exp-base");
  const speedCanvas = $("#exp-speed");
  const probe = $("#exp-probe");
  const wind = particles($("#exp-wind"), { density: 1 / 300, rate: 0.04, width: 1, fade: 0.97 });
  const years = {};
  const loadYear = (y) =>
    (years[y] ||= fetch(asset(`data/jet/winds-${y}.bin`))
      .then((r) => {
        if (!r.ok) throw new Error(`winds-${y}.bin: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => new Int8Array(b)));
  const observed = {
    e: new Map(flights.pair.days.e.map((d) => [d[0], d])),
    w: new Map(flights.pair.days.w.map((d) => [d[0], d])),
  };
  const dests = Object.keys(grid.names).filter((c) => c !== "LFPG");
  const short = (c) => grid.names[c].replace(/-.*/, "");
  const origin = grid.airports.LFPG;

  // a shared link may name the day and the destination: ?jour=2020-02-08&vers=KJFK
  const q = new URLSearchParams(location.search);
  const qDay = q.get("jour");
  const qDest = q.get("vers");
  const state = {
    day: qDay && DAY.test(qDay) && qDay >= FIRST && qDay <= LAST ? qDay : "2020-02-08",
    dest: dests.includes(qDest) ? qDest : "KJFK",
    field: null,
    view: null,
    land: null,
    routes: null,
    max: 0,
  };

  /* ---------------------------------------------------------------- controls */
  const seg = $("#exp-dest");
  seg.replaceChildren(
    ...dests.map((c) =>
      el("button", {
        type: "button",
        "aria-pressed": String(c === state.dest),
        "data-code": c,
        text: short(c),
        onclick: () => setDest(c),
      }),
    ),
  );
  $("#exp-prev").innerHTML = ICON.prev;
  $("#exp-next").innerHTML = ICON.next;
  $("#exp-prev").addEventListener("click", () => step(-1));
  $("#exp-next").addEventListener("click", () => step(1));
  $("#exp-day").value = state.day;
  $("#exp-day").addEventListener("change", (e) => {
    const v = e.target.value;
    if (DAY.test(v) && v >= FIRST && v <= LAST) setDay(v);
    else e.target.value = state.day;
  });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    }
  });

  const chips = $("#exp-moments");
  const list = moments(flights, routing);
  chips.replaceChildren(
    el("span", { class: "em-title", text: "Jours remarquables" }),
    ...list.map((m) =>
      el("button", { type: "button", class: "em-chip", "data-day": m.iso, onclick: () => setDay(m.iso) }, [
        el("b", { text: shortDate(m.iso) }),
        el("span", { text: m.text }),
      ]),
    ),
  );

  const play = $("#exp-play");
  let timer = null;
  const stop = () => {
    clearInterval(timer);
    timer = null;
    play.setAttribute("aria-pressed", "false");
    play.textContent = "Faire défiler";
  };
  play.addEventListener("click", () => {
    if (timer) return stop();
    play.setAttribute("aria-pressed", "true");
    play.textContent = "Arrêter";
    timer = setInterval(() => (state.day >= LAST ? stop() : setDay(shift(state.day, 1))), 800);
  });

  const copy = $("#exp-copy");
  copy.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?jour=${state.day}&vers=${state.dest}#explorateur`;
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Lien copié";
    } catch {
      copy.textContent = url;
    }
    setTimeout(() => (copy.textContent = "Copier le lien de ce jour"), 2500);
  });

  /* ---------------------------------------------------------------- map */
  const legend = $("#exp-legend");
  const drawLegend = () => {
    const name = short(state.dest);
    legend.replaceChildren(
      el("span", { class: "el-row" }, [
        el("i", { class: "k-west" }),
        `Paris → ${name}, route la plus rapide`,
      ]),
      el("span", { class: "el-row" }, [
        el("i", { class: "k-east" }),
        `${name} → Paris, route la plus rapide`,
      ]),
      el("span", { class: "el-row" }, [el("i", { class: "k-gc" }), "route la plus courte (grand cercle)"]),
    );
  };
  speedLegend($("#exp-speed-legend"), "Vent à 10 km d'altitude, midi UTC");

  const layout = () => {
    // the whole field, never cropped: as wide as the band allows, at most 640 px high
    const box = fieldBox(grid);
    const aspect = ((box.east - box.west) * Math.cos(Math.PI / 4)) / (box.north - box.south);
    const width = Math.min(stage.parentElement.clientWidth, Math.round(640 * aspect));
    const height = Math.round(width / aspect);
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    state.view = plateCarree(box, width, height, { fit: "contain" });
    if (state.land)
      drawLand(base, state.land, state.view, { fill: css("--map-land"), stroke: css("--map-coast") });
    wind.resize(state.view);
    if (state.field) {
      drawSpeed(speedCanvas, state.field, state.view);
      draw();
    }
  };

  function draw() {
    const v = state.view;
    if (!v || !state.routes) return;
    svg.attr("viewBox", `0 0 ${v.width} ${v.height}`).attr("width", v.width).attr("height", v.height);
    svg.selectAll("*").remove();
    const L = line(v);
    const { west, east } = state.routes;
    svg.append("path").attr("d", L(west.line)).attr("class", "route-gc");
    for (const [r, cls] of [
      [east, "route-east"],
      [west, "route-west"],
    ]) {
      svg.append("path").attr("d", L(r.path)).attr("class", "route-halo");
      svg.append("path").attr("d", L(r.path)).attr("class", cls);
    }
    const dest = grid.airports[state.dest];
    for (const [[la, lo], name, anchor] of [
      [origin, "Paris", "start"],
      [dest, short(state.dest), "end"],
    ]) {
      svg.append("circle").attr("cx", v.x(lo)).attr("cy", v.y(la)).attr("r", 4).attr("class", "apt");
      svg
        .append("text")
        .attr("x", v.x(lo) + (anchor === "end" ? -8 : 8))
        .attr("y", v.y(la) + 4)
        .attr("text-anchor", anchor)
        .attr("class", "apt-label")
        .text(name);
    }
  }

  // the wind under the pointer
  stage.addEventListener("pointermove", (ev) => {
    if (!state.field || !state.view) return;
    const r = stage.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const lon = state.view.lon(x);
    const lat = state.view.lat(y);
    const b = fieldBox(state.field);
    if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) return (probe.hidden = true);
    const [u, w] = windAt(state.field, lat, lon);
    probe.hidden = false;
    probe.textContent = `${kmh(Math.hypot(u, w) * 3.6)}, ${compass(u, w)}`;
    probe.style.transform = `translate(${Math.min(x + 14, r.width - probe.offsetWidth - 4)}px, ${Math.max(4, y - 30)}px)`;
  });
  stage.addEventListener("pointerleave", () => (probe.hidden = true));

  /* ---------------------------------------------------------------- read-out */
  function readout() {
    const { west, east } = state.routes;
    const name = short(state.dest);
    const dest = grid.airports[state.dest];
    const tail = { west: routeWind(state.field, origin, dest), east: routeWind(state.field, dest, origin) };
    const isJfk = state.dest === "KJFK";
    const windTxt = (v) => `${kmh(Math.abs(v))} ${v >= 0 ? "dans le dos" : "de face"}`;
    const row = (cls, title, r, w, obs) =>
      el("div", { class: `er-row ${cls}` }, [
        el("p", { class: "er-title", text: title }),
        el("p", { class: "er-wind", text: `Vent moyen sur la ligne droite : ${windTxt(w)}` }),
        el("p", { class: "er-times" }, [
          el("span", {}, [el("small", { text: "ligne droite" }), el("b", { text: hm(r.gc) })]),
          el("span", {}, [el("small", { text: "route la plus rapide" }), el("b", { text: hm(r.best) })]),
          el("span", {}, [
            el("small", { text: "gain" }),
            el("b", { text: r.gc - r.best < 0.5 ? "aucun" : minutes(r.gc - r.best) }),
          ]),
          obs
            ? el("span", { class: "er-obs" }, [
                el("small", { text: `vols réels, médiane de ${obs[3]} vols` }),
                el("b", { text: hm(obs[1]) }),
              ])
            : null,
        ]),
      ]);
    $("#exp-read").replaceChildren(
      el("p", {
        class: "er-day",
        text: `${longDate(state.day)}, midi UTC. Vent maximal sur la carte : ${kmh(state.max * 3.6)}.`,
      }),
      row("west", `Paris → ${name}`, west, tail.west, isJfk ? observed.w.get(state.day) : null),
      row("east", `${name} → Paris`, east, tail.east, isJfk ? observed.e.get(state.day) : null),
    );
    if (isJfk)
      $("#exp-read").append(
        el("p", {
          class: "er-note",
          text: "Vols réels : durée du premier au dernier signal OpenSky, roulage compris en partie, d'où environ 25 minutes de plus que le modèle.",
        }),
      );
  }

  function solve() {
    if (!state.field) return;
    const dest = grid.airports[state.dest];
    state.routes = {
      west: fastestRoute(state.field, origin, dest),
      east: fastestRoute(state.field, dest, origin),
    };
    draw();
    drawLegend();
    readout();
  }

  function remember() {
    try {
      const u = new URL(location.href);
      u.searchParams.set("jour", state.day);
      u.searchParams.set("vers", state.dest);
      history.replaceState(null, "", u);
    } catch {
      /* sandboxed frames may refuse history access */
    }
  }

  function setDest(c) {
    state.dest = c;
    seg
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.code === c)));
    solve();
    if (started) remember();
  }

  function step(n) {
    const iso = shift(state.day, n);
    if (iso >= FIRST && iso <= LAST) setDay(iso);
  }

  // user: false when the explorer draws its first day on its own (the address bar is left alone)
  async function setDay(iso, user = true) {
    state.day = iso;
    $("#exp-day").value = iso;
    $("#exp-prev").disabled = iso <= FIRST;
    $("#exp-next").disabled = iso >= LAST;
    chips
      .querySelectorAll(".em-chip")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.day === iso)));
    if (!started) return start(user);
    const y = +iso.slice(0, 4);
    const bytes = await loadYear(y);
    if (state.day !== iso) return; // a later pick won
    const day = d3.timeDay.count(new Date(Date.UTC(y, 0, 1)), new Date(`${iso}T00:00Z`));
    state.field = decodeDay(bytes, grid, day);
    state.max = d3.max(state.field.u, (u, i) => Math.hypot(u, state.field.v[i]));
    wind.setField(state.field);
    drawSpeed(speedCanvas, state.field, state.view);
    solve();
    if (user) remember();
    onDay?.(iso);
  }

  let started = false;
  async function start(user = false) {
    if (started) return;
    started = true;
    state.land = await loadLand();
    layout();
    await setDay(state.day, user);
    wind.start();
  }
  new IntersectionObserver(([e]) => e.isIntersecting && start(), { rootMargin: "800px 0px" }).observe(stage);
  onResize(stage.parentElement, () => started && layout());
  if (qDay) start(); // a shared day: draw it at once
  return {
    setDay,
    stop,
    get day() {
      return state.day;
    },
  };
}
