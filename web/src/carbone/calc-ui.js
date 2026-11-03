// « Calculez votre vol », the interface. The reader picks two airports in a search box (ARIA combobox:
// type a city, an airport or its code, arrows and Enter, or click), or a direct destination proposed
// from the departure, then a month and one way or return. The answer is a boarding card: the CO2 per
// passenger, then the cabin of an average flight of that route in that season, seat by seat.
// The choice lives in the address (?de=NCE&vers=CDG&mois=8&trajet=ar#calculer): a result can be shared.
import { el } from "../lib/ui.js";
import { fmtNum, monthShort } from "../lib/format.js";
import { flightFacts, destinations, searchAirports, MONTHS } from "./calc.js";

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

export function calculator(node, L, co2) {
  const byCode = new Map(L.airports.flatMap((a) => [[a.code, a], ...(a.iata ? [[a.iata, a]] : [])]));
  const state = { from: null, to: null, month: 6, back: true };

  const out = el("div", { class: "calc-out", id: "calc-result", "aria-live": "polite" });
  const suggest = el("div", { class: "calc-suggest", id: "calc-suggest" });
  const update = () => {
    render();
    // the choice in the address, so that a result can be shared
    const p = new URLSearchParams(location.search);
    for (const [k, v] of [
      ["de", state.from && code(state.from)],
      ["vers", state.to && code(state.to)],
      ["mois", String(state.month + 1)],
      ["trajet", state.back ? "ar" : "aller"],
    ])
      v ? p.set(k, v) : p.delete(k);
    history.replaceState(null, "", `${location.pathname}?${p}${location.hash}`);
  };
  const from = combobox({ id: "calc-from", label: "Départ", L, onPick: (a) => ((state.from = a), update()) });
  const to = combobox({ id: "calc-to", label: "Arrivée", L, onPick: (a) => ((state.to = a), update()) });
  const swap = el("button", {
    type: "button",
    class: "calc-swap",
    "aria-label": "Inverser le départ et l'arrivée",
  });
  swap.innerHTML = SWAP;
  swap.addEventListener("click", () => {
    [state.from, state.to] = [state.to, state.from];
    from.set(state.from, { silent: true });
    to.set(state.to, { silent: true });
    update();
  });

  const months = el(
    "div",
    { class: "calc-months", role: "radiogroup", "aria-label": "Mois du voyage" },
    MONTHS.map((m, i) =>
      el("button", {
        type: "button",
        role: "radio",
        "aria-checked": String(i === state.month),
        "aria-label": m,
        "data-m": String(i),
        text: monthShort(i),
      }),
    ),
  );
  months.addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    state.month = +b.dataset.m;
    for (const x of months.children) x.setAttribute("aria-checked", String(x === b));
    update();
  });
  const trip = el("div", { class: "calc-trip seg", role: "group", "aria-label": "Trajet" }, [
    el("button", { type: "button", "data-back": "1", "aria-pressed": "true", text: "Aller-retour" }),
    el("button", { type: "button", "data-back": "0", "aria-pressed": "false", text: "Aller simple" }),
  ]);
  trip.addEventListener("click", (e) => {
    const b = e.target.closest("[data-back]");
    if (!b) return;
    state.back = b.dataset.back === "1";
    for (const x of trip.children) x.setAttribute("aria-pressed", String(x === b));
    update();
  });

  node.replaceChildren(
    el("div", { class: "calc-in" }, [
      el("div", { class: "calc-route" }, [from.box, swap, to.box]),
      suggest,
      el("div", { class: "calc-when" }, [
        el("div", {}, [el("p", { class: "calc-lab", text: "Mois du voyage" }), months]),
        el("div", {}, [el("p", { class: "calc-lab", text: "Trajet" }), trip]),
      ]),
    ]),
    out,
  );

  const chip = (text, onClick, extra = {}) => {
    const b = el("button", { type: "button", class: "calc-chip", ...extra }, text);
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

  function render() {
    const { from: A, to: B } = state;
    // proposals: famous trips with nothing chosen, the busiest direct destinations once a departure is
    if (A && !B) {
      const d = destinations(L, A.code).slice(0, 8);
      suggest.replaceChildren(
        el("p", {
          class: "calc-lab",
          text: `Lignes directes les plus fréquentées depuis ${short(A)}`,
        }),
        el(
          "div",
          { class: "calc-chips" },
          d.map((x) => {
            const b = byCode.get(x.code);
            return chip([el("b", { text: code(b) }), ` ${short(b)}`], () =>
              pick(A, b),
            );
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
        el(
          "div",
          { class: "calc-chips" },
          ex.map(([x, y]) => chip(`${short(x)} → ${short(y)}`, () => pick(x, y))),
        ),
      );
    } else suggest.replaceChildren();

    if (!A || !B) {
      out.replaceChildren(
        el("div", { class: "calc-empty" }, [
          el("p", { class: "calc-empty-t", text: !A ? "D'où partez-vous ?" : "Où allez-vous ?" }),
          el("p", {
            text: "Les aéroports reliés à la France par des vols de ligne, en métropole, en outre-mer et à l'étranger.",
          }),
        ]),
      );
      return;
    }
    if (A === B) {
      out.replaceChildren(
        el("div", { class: "calc-empty" }, [
          el("p", { class: "calc-empty-t", text: "Le départ et l'arrivée sont le même aéroport." }),
        ]),
      );
      return;
    }
    const F = flightFacts(L, co2, A.code, B.code, state.month, state.back);
    const head = el("div", { class: "bp-head" }, [
      el("div", { class: "bp-end" }, [el("b", { text: code(A) }), el("span", { text: `${short(A)}, ${A.country}` })]),
      el("div", { class: "bp-line", "aria-hidden": "true" }, [
        el("i"),
        el("span", { class: "bp-plane" }),
        el("i"),
      ]),
      el("div", { class: "bp-end to" }, [el("b", { text: code(B) }), el("span", { text: `${short(B)}, ${B.country}` })]),
    ]);
    head.querySelector(".bp-plane").innerHTML = PLANE;
    const meta = el("p", {
      class: "bp-meta",
      id: "calc-basis",
      text: `${fmtNum(F.km, 0)} km à vol d'oiseau · ${F.segmentLabel.toLowerCase()} · ${F.month} · ${F.trips === 2 ? "aller-retour" : "aller simple"}`,
    });
    const big = el("div", { class: "bp-co2" }, [
      el("p", { class: "bp-kg", id: "calc-kg", text: kg10(F.kg) }),
      el("p", { class: "bp-kg-l" }, [
        "de CO2 par passager",
        el("small", {
          text: `${fmtNum(F.g, 0)} g par passager et par kilomètre, moyenne des vols de ce type (DGAC, ${F.co2Year})`,
        }),
      ]),
    ]);

    let flight;
    if (F.status === "route") {
      const trend =
        F.loadPrev == null || Math.round(F.load * 100) === Math.round(F.loadPrev * 100)
          ? ""
          : ` (${pct(F.loadPrev)} un an plus tôt)`;
      const fuller = Math.round(F.load * 100) - Math.round(F.segLoad * 100);
      flight = el("div", { class: "bp-flight" }, [
        el("p", { class: "bp-h", text: `Dans l'avion, d'après ${F.quarter} ${F.year}` }),
        cabin(F.seatsPerFlight, F.perFlight),
        el("ul", { class: "bp-stats", id: "calc-stats" }, [
          el("li", {}, [
            el("b", { text: fmtNum(Math.round(F.perFlight), 0) }),
            el("span", {
              text: `passagers par vol en moyenne, pour ${fmtNum(Math.round(F.seatsPerFlight), 0)} sièges`,
            }),
          ]),
          el("li", {}, [el("b", { text: pct(F.load) }), el("span", { text: `des sièges occupés${trend}` })]),
          el("li", {}, [
            el("b", { text: fmtNum(Math.round(F.perWeek), 0) }),
            el("span", { text: "vols par semaine dans chaque sens, toutes compagnies" }),
          ]),
        ]),
        el("p", { class: "bp-season" }, [
          "Sièges occupés selon la saison : ",
          ...F.loads.flatMap((v, k) => [
            k ? " · " : "",
            el(k === Math.floor(state.month / 3) ? "b" : "span", {
              text: `${["hiver", "printemps", "été", "automne"][k]} ${v == null ? "–" : pct(v)}`,
            }),
          ]),
          ".",
        ]),
        el("p", { class: "bp-note", id: "calc-adjusted" }, [
          fuller === 0
            ? "Cette ligne est remplie comme la moyenne des vols de ce type : l'estimation tient."
            : `Cette ligne est ${fuller > 0 ? "plus" : "moins"} remplie que la moyenne des vols de ce type (${pct(F.segLoad)}) : partagé entre ses vrais passagers, le CO2 de chacun serait d'environ `,
          fuller === 0 ? null : el("b", { text: kg10(F.kgAdjusted) }),
          fuller === 0 ? null : ".",
        ]),
      ]);
    } else {
      flight = el("div", { class: "bp-flight" }, [
        el("p", {
          class: "bp-note",
          id: "calc-noroute",
          text:
            F.status === "secret"
              ? "Eurostat ne publie pas les chiffres de cette ligne : ils révéleraient ceux d'une seule compagnie (secret statistique). Le CO2 ci-dessus reste une moyenne."
              : `Eurostat ne compte pas de vol direct entre ces deux aéroports en ${F.year}. Avec une escale, la distance et le CO2 augmentent.`,
        }),
      ]);
    }
    const share = el("button", {
      type: "button",
      class: "btn calc-share",
      text: "Copier le lien de ce calcul",
    });
    share.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        share.textContent = "Lien copié";
      } catch {
        share.textContent = location.href;
      }
      setTimeout(() => (share.textContent = "Copier le lien de ce calcul"), 2500);
    });
    out.replaceChildren(
      el("article", { class: "bp", "aria-label": `Votre vol ${code(A)}–${code(B)}` }, [
        head,
        meta,
        big,
        flight,
        share,
      ]),
    );
  }

  // from the address, or an example the reader can change at once
  const p = new URLSearchParams(location.search);
  const m = +(p.get("mois") ?? 7);
  if (m >= 1 && m <= 12) {
    state.month = m - 1;
    for (const x of months.children) x.setAttribute("aria-checked", String(+x.dataset.m === state.month));
  }
  if (p.get("trajet") === "aller") trip.children[1].click();
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
