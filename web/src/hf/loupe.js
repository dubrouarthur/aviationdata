// "À la loupe": six well-known accidents, finding by finding, as the NTSB coded them (cases.json). The table
// picks an accident and shows, at a glance, which layers each one pierced; the diagram lays its findings
// out along the models of the story (organization, preconditions, acts, then the aircraft and the
// environment) and ties every one to the accident; the panel reads the selected finding and what the
// investigation concluded and changed.
import { $, el, rich, onResize } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { CASES, COLUMN_COLORS, COLUMN_NOTES } from "./cases.js";

// a finding of cases.json: [in probable cause, "C" | "F" | "", column, layer bit, HFACS family, actor, French, NTSB]
const F = { pc: 0, cf: 1, col: 2, bit: 3, family: 4, actor: 5, fr: 6, en: 7 };
const SVG = "http://www.w3.org/2000/svg";

/** Each column of one accident: "cited" (a finding in the probable cause), "other" (findings outside it) or null. */
export function caseColumns(c, columns) {
  return Object.fromEntries(
    columns.map(([k]) => {
      const fs = c.findings.filter((f) => f[F.col] === k);
      return [k, fs.some((f) => f[F.pc]) ? "cited" : fs.length ? "other" : null];
    }),
  );
}

/** The status of a finding, in words. */
export function status(f) {
  if (!f[F.pc]) return "Relevé par l'enquête, hors de la cause probable";
  if (f[F.cf] === "C") return "Retenu dans la cause probable, comme cause";
  if (f[F.cf] === "F") return "Retenu dans la cause probable, comme facteur contributif";
  return "Retenu dans la cause probable";
}

export function loupe(root, { cases: data, people }) {
  const columns = data.columns;
  const family = Object.fromEntries(people.hfacs.map(([k, label]) => [k, label]));
  const state = { key: data.cases[0].key, sel: null, others: true };
  const byKey = Object.fromEntries(data.cases.map((c) => [c.key, c]));

  /* ---------------------------------------------------------------- the table: pick an accident */
  const pick = $("#lp-pick", root);
  const dot = (v, k) =>
    v
      ? el("i", {
          class: `lp-dot ${v}`,
          style: `--c:${COLUMN_COLORS[k]}`,
          title: v === "cited" ? "retenu dans la cause probable" : "relevé hors de la cause probable",
        })
      : el("i", { class: "lp-dot none", "aria-hidden": "true" });
  pick.replaceChildren(
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col", text: "Accident" }),
        ...columns.map(([k, label]) =>
          el("th", { scope: "col", class: `lp-th lp-th-${k}` }, el("span", { text: label })),
        ),
      ]),
    ]),
    el(
      "tbody",
      {},
      data.cases.map((c) => {
        const meta = CASES[c.key];
        const cols = caseColumns(c, columns);
        return el("tr", { "data-key": c.key }, [
          el(
            "th",
            { scope: "row" },
            el("button", { type: "button", class: "lp-case", "data-key": c.key, "aria-pressed": "false" }, [
              el("b", { text: meta.name }),
              el("small", { text: `${c.year}, ${meta.toll}` }),
            ]),
          ),
          ...columns.map(([k, label]) =>
            el("td", { "data-label": label }, [
              dot(cols[k], k),
              el("span", {
                class: "visually-hidden",
                text: cols[k] === "cited" ? "cité" : cols[k] === "other" ? "relevé" : "rien",
              }),
            ]),
          ),
        ]);
      }),
    ),
  );
  pick.addEventListener("click", (e) => {
    const b = e.target.closest("tr[data-key]");
    if (!b) return;
    state.key = b.dataset.key;
    state.sel = null;
    paint();
  });

  /* ---------------------------------------------------------------- the diagram */
  const diagram = $("#lp-diagram", root);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "lp-links");
  svg.setAttribute("aria-hidden", "true");
  const cols = el("div", { class: "lp-cols" });
  const accident = el("div", { class: "lp-accident" });
  diagram.replaceChildren(svg, cols, accident);

  const toggle = $("#lp-others", root);
  toggle.addEventListener("click", () => {
    state.others = !state.others;
    paint();
  });

  function chip(f, i) {
    const b = el(
      "button",
      {
        type: "button",
        class: `lp-chip${f[F.pc] ? " cited" : " other"}${f[F.cf] === "C" ? " cause" : ""}`,
        style: `--c:${COLUMN_COLORS[f[F.col]]}`,
        "data-i": String(i),
        "aria-pressed": String(state.sel === i),
      },
      [el("span", { class: "lp-chip-label", text: f[F.fr] }), el("small", { text: f[F.actor] })],
    );
    b.addEventListener("click", () => {
      state.sel = i;
      paint();
    });
    b.addEventListener("pointerenter", () => highlight(i));
    b.addEventListener("pointerleave", () => highlight(null));
    b.addEventListener("focus", () => highlight(i));
    b.addEventListener("blur", () => highlight(null));
    return b;
  }

  function drawDiagram(c) {
    const meta = CASES[c.key];
    cols.replaceChildren(
      ...columns.map(([k, label]) => {
        const items = c.findings
          .map((f, i) => [f, i])
          .filter(([f]) => f[F.col] === k && (state.others || f[F.pc]));
        return el("div", { class: `lp-col lp-col-${k}`, style: `--c:${COLUMN_COLORS[k]}`, "data-col": k }, [
          el("p", { class: "lp-col-head", text: label }),
          items.length
            ? el(
                "div",
                { class: "lp-chips" },
                items.map(([f, i]) => chip(f, i)),
              )
            : el("p", { class: "lp-empty", text: "Aucun constat" }),
        ]);
      }),
    );
    accident.replaceChildren(
      el("p", { class: "lp-acc-kicker", text: "L'accident" }),
      el("b", { text: meta.name }),
      el("span", { text: c.event_fr }),
      el("small", { text: `${meta.when}, ${meta.toll}` }),
    );
    requestAnimationFrame(links);
  }

  // every finding tied to the accident by its column's rail, never to another finding (the NTSB codes no link
  // between findings): a stub from the chip to the rail, thick for a cause, solid for a factor, dashed
  // outside the probable cause; the rail runs down to the accident, solid when the column is cited
  function links() {
    svg.replaceChildren();
    const box = diagram.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.setAttribute("width", box.width);
    svg.setAttribute("height", box.height);
    const wide = getComputedStyle(diagram).getPropertyValue("--lp-links").trim() === "on";
    const end = accident.getBoundingClientRect().top - box.top;
    const c = byKey[state.key];
    const path = (d, cls, color, extra = {}) => {
      const p = document.createElementNS(SVG, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", cls);
      p.setAttribute("style", `--c:${color}`);
      for (const [k, v] of Object.entries(extra)) p.dataset[k] = v;
      svg.append(p);
    };
    [...cols.querySelectorAll(".lp-col")].forEach((col, n) => {
      const key = col.dataset.col;
      const chips = [...col.querySelectorAll(".lp-chip")];
      if (!chips.length) return;
      const cr = col.getBoundingClientRect();
      const x = wide ? cr.left - box.left - 11 : 7 + 7 * n;
      const color = COLUMN_COLORS[key];
      const cited = chips.some((b) => c.findings[+b.dataset.i][F.pc]);
      const top = chips[0].getBoundingClientRect();
      const y0 = top.top + top.height / 2 - box.top;
      path(`M${x},${y0} V${end - 3}`, `lp-rail${cited ? " cited" : " other"}`, color, { col: key });
      const tip = document.createElementNS(SVG, "circle");
      tip.setAttribute("cx", x);
      tip.setAttribute("cy", end - 3);
      tip.setAttribute("r", 3.5);
      tip.setAttribute("class", `lp-tip${cited ? " cited" : " other"}`);
      tip.setAttribute("style", `--c:${color}`);
      svg.append(tip);
      for (const b of chips) {
        const r = b.getBoundingClientRect();
        const f = c.findings[+b.dataset.i];
        const y = r.top + r.height / 2 - box.top;
        path(
          `M${x},${y} H${r.left - box.left}`,
          `lp-link${f[F.pc] ? " cited" : " other"}${f[F.cf] === "C" ? " cause" : ""}`,
          color,
          { i: b.dataset.i, col: key },
        );
      }
    });
    highlight(state.sel);
  }

  function highlight(i) {
    const on = i ?? state.sel;
    diagram.classList.toggle("focus", on !== null && on !== undefined);
    const col = on === null || on === undefined ? null : byKey[state.key].findings[on]?.[F.col];
    for (const p of svg.querySelectorAll(".lp-link")) p.classList.toggle("on", +p.dataset.i === on);
    for (const p of svg.querySelectorAll(".lp-rail")) p.classList.toggle("on", p.dataset.col === col);
    for (const b of cols.querySelectorAll(".lp-chip")) b.classList.toggle("on", +b.dataset.i === on);
  }

  /* ---------------------------------------------------------------- the reading: a finding, then the case */
  function detail(c) {
    const box = $("#lp-detail", root);
    const i = state.sel ?? c.findings.findIndex((f) => f[F.pc] && f[F.cf] === "C");
    const f = c.findings[i >= 0 ? i : c.findings.findIndex((x) => x[F.pc])];
    if (!f) return box.replaceChildren();
    const fam = f[F.family] ? family[f[F.family]] : null;
    const col = columns.find(([k]) => k === f[F.col]);
    box.replaceChildren(
      el("p", { class: "lp-d-kicker", style: `--c:${COLUMN_COLORS[f[F.col]] ?? "var(--muted)"}` }, [
        col ? col[1] : "Indéterminé",
        fam ? `, ${fam.toLowerCase()} (HFACS)` : "",
      ]),
      el("h4", { text: f[F.fr] }),
      el("p", {}, [el("b", { text: status(f) }), `. Désigne : ${f[F.actor].toLowerCase()}.`]),
      el("p", { class: "lp-d-note", text: COLUMN_NOTES[f[F.col]] ?? "" }),
      el("p", { class: "lp-d-code" }, ["Code du NTSB : ", el("span", { lang: "en", text: f[F.en] })]),
    );
  }

  function verdict(c) {
    const meta = CASES[c.key];
    const n = c.findings.length;
    const pc = c.findings.filter((f) => f[F.pc]).length;
    const pierced = Object.values(caseColumns(c, columns)).filter((v) => v === "cited").length;
    $("#lp-head", root).replaceChildren(
      el("h4", { text: meta.name }),
      el("p", {
        class: "lp-meta",
        text: `${meta.when}, ${meta.where}. ${meta.aircraft}. ${meta.toll[0].toUpperCase()}${meta.toll.slice(1)}.`,
      }),
      el("p", { class: "lp-what", text: meta.what }),
    );
    $("#lp-count", root).replaceChildren(
      rich([
        "Le NTSB a codé ",
        { b: fmtNum(n) },
        ` constats, dont ${fmtNum(pc)} retenus dans la cause probable. Ils touchent `,
        { b: `${fmtNum(pierced)} ${pierced > 1 ? "couches" : "couche"}` },
        " sur cinq.",
      ]),
    );
    const src = (s) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.source ?? s.label });
    $("#lp-ntsb", root).replaceChildren(
      el("h5", { text: "La cause probable" }),
      el("p", { text: meta.cause }),
      ...(meta.factors.length
        ? [
            el("p", { class: "lp-sub", text: "Facteurs contributifs :" }),
            el(
              "ul",
              {},
              meta.factors.map((t) => el("li", { text: t })),
            ),
          ]
        : [el("p", { class: "lp-sub", text: "Aucun facteur contributif retenu." })]),
      ...(meta.saved ? [el("p", { class: "lp-saved", text: meta.saved })] : []),
      el("p", { class: "lp-src" }, ["Source : ", src(meta.report), "."]),
      el("h5", { text: "Ce qui a suivi" }),
      ...meta.followed.map((x) =>
        el("p", {}, [x.text, " ", el("span", { class: "lp-src" }, ["(", src(x), ")"])]),
      ),
      ...(meta.extra
        ? [el("p", { class: "lp-src" }, [src({ source: meta.extra.text, url: meta.extra.url })])]
        : []),
    );
  }

  function paint() {
    const c = byKey[state.key];
    for (const tr of pick.querySelectorAll("tbody tr")) {
      const on = tr.dataset.key === state.key;
      tr.classList.toggle("on", on);
      tr.querySelector(".lp-case").setAttribute("aria-pressed", String(on));
    }
    toggle.setAttribute("aria-pressed", String(state.others));
    toggle.textContent = state.others
      ? "Masquer les constats hors cause probable"
      : "Afficher les constats hors cause probable";
    verdict(c);
    drawDiagram(c);
    detail(c);
  }

  paint();
  onResize(diagram, () => requestAnimationFrame(links));
  document.fonts?.ready.then(() => requestAnimationFrame(links));
  return {
    select: (key) => {
      state.key = key;
      state.sel = null;
      paint();
    },
  };
}
