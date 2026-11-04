// « Comparez deux avions »: two models side by side, each figure with a bar against the other model.
// The choice lives in the address (?a=A20N&b=B38M#comparer), so a comparison can be shared.
import { el } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { groupOf, GROUPS } from "./charts.js";
import { fmt } from "./text.js";

const BANDS = [
  "moins de 1 000 km",
  "1 000 à 2 500 km",
  "2 500 à 5 000 km",
  "5 000 à 9 000 km",
  "plus de 9 000 km",
];

export function compare(node, W, U, Wf) {
  const last = String(Wf.last);
  const codes = Object.keys(W.models[last]).sort(
    (a, b) => W.models[last][b].flights - W.models[last][a].flights,
  );
  const us = new Map(U.models.map((m) => [m.code, m]));
  const name = (c) => W.types[c].name;
  const color = (c) => GROUPS.find((g) => g.key === groupOf(W.types[c])).color;
  const p = new URLSearchParams(location.search);
  let a = codes.includes(p.get("a")) ? p.get("a") : "A20N";
  let b = codes.includes(p.get("b")) ? p.get("b") : "B38M";
  if (!codes.includes(a)) a = codes[0];
  if (!codes.includes(b)) b = codes[1];

  const select = (id, label, get, set) => {
    const s = el(
      "select",
      { id },
      codes.map((c) => el("option", { value: c, text: `${name(c)}` })),
    );
    s.value = get();
    s.addEventListener("change", () => {
      set(s.value);
      render();
    });
    return el("p", { class: "cmp-field" }, [el("label", { for: id, text: label }), s]);
  };
  const out = el("div", { class: "cmp-out", id: "cmp-out", "aria-live": "polite" });
  node.replaceChildren(
    el("div", { class: "cmp-pick" }, [
      select(
        "cmp-a",
        "Premier modèle",
        () => a,
        (v) => (a = v),
      ),
      el("span", { class: "cmp-vs", "aria-hidden": "true", text: "et" }),
      select(
        "cmp-b",
        "Second modèle",
        () => b,
        (v) => (b = v),
      ),
    ]),
    out,
  );

  // one line of the table: the label, then each model's value with a bar against the larger of the two
  const line = (label, va, vb, f, note) => {
    const max = Math.max(va ?? 0, vb ?? 0) || 1;
    const cell = (v, c) =>
      el("td", {}, [
        el("b", { text: v == null ? "–" : f(v) }),
        el(
          "span",
          { class: "cmp-bar" },
          el("i", { style: `width:${v == null ? 0 : ((v / max) * 100).toFixed(1)}%;background:${color(c)}` }),
        ),
      ]);
    return el("tr", {}, [
      el("th", { scope: "row" }, [label, note ? el("small", { text: note }) : null]),
      cell(va, a),
      cell(vb, b),
    ]);
  };
  const section = (title) =>
    el("tr", { class: "cmp-sec" }, el("th", { colspan: "3", scope: "colgroup", text: title }));

  function render() {
    const A = W.models[last][a];
    const B = W.models[last][b];
    const ua = us.get(a);
    const ub = us.get(b);
    const share = (m) => m.flights / Wf.total;
    const rows = [
      section(`Dans le monde, vols suivis par OpenSky en ${last}`),
      line("Vols suivis", A.flights, B.flights, fmt.n0),
      line("Part des vols de ligne", share(A), share(B), (v) => fmt.pc(v, 1)),
      line("Avions suivis", A.aircraft, B.aircraft, fmt.n0),
      line("Distance médiane d'un vol", A.kmMedian, B.kmMedian, fmt.km),
      line("Durée médiane d'un vol", A.durMedian, B.durMedian, fmt.hm, "du premier au dernier signal"),
      line("Vols par jour de vol", A.flightsPerDay, B.flightsPerDay, (v) => fmtNum(v, 1), "avion médian"),
      ...BANDS.map((band, k) => line(`Vols de ${band}`, A.kmBands[k], B.kmBands[k], (v) => fmt.pc(v))),
      section(`Aux États-Unis, vols intérieurs de ${U.year}`),
    ];
    if (ua || ub) {
      rows.push(
        line("Vols", ua?.flights, ub?.flights, fmt.n0),
        line("À l'heure", ua?.ontime, ub?.ontime, (v) => fmt.pc(v, 1), "moins de 15 min de retard"),
        line("À l'heure, attendu de ses compagnies", ua?.ontimeExpected, ub?.ontimeExpected, (v) =>
          fmt.pc(v, 1),
        ),
        line("Retard d'une heure ou plus", ua?.late60, ub?.late60, (v) => fmt.pc(v, 1)),
        line("Vols annulés", ua?.cancelRate, ub?.cancelRate, (v) => fmt.pc(v, 2)),
        line(
          "Vols par jour de vol",
          ua?.daysFlown >= 200 ? ua.flightsPerDay : null,
          ub?.daysFlown >= 200 ? ub.flightsPerDay : null,
          (v) => fmtNum(v, 1),
        ),
      );
    } else
      rows.push(
        el(
          "tr",
          {},
          el("td", {
            colspan: "3",
            class: "cmp-none",
            text: "Aucun des deux modèles ne vole assez aux États-Unis pour être comparé.",
          }),
        ),
      );
    const top = (m) =>
      (m.countries ?? [])
        .slice(0, 5)
        .map(([cc]) => W.countryNames[cc] ?? cc)
        .join(", ");
    const airlines = (m) =>
      m
        ? m.airlines
            .slice(0, 3)
            .map((x) => x[1])
            .join(", ")
        : "–";
    out.replaceChildren(
      el("table", { class: "cmp-table" }, [
        el("caption", { class: "visually-hidden", text: `${name(a)} et ${name(b)}, comparés` }),
        el(
          "thead",
          {},
          el("tr", {}, [
            el("td"),
            ...[a, b].map((c) =>
              el("th", { scope: "col" }, [
                el("i", { class: "cmp-sw", style: `background:${color(c)}` }),
                name(c),
                el("small", { text: `${W.types[c].kindFr}, ${W.types[c].maker}` }),
              ]),
            ),
          ]),
        ),
        el("tbody", {}, [
          ...rows,
          section("Où et avec qui"),
          el("tr", {}, [
            el("th", { scope: "row", text: "Premiers pays de départ" }),
            el("td", { text: top(A) }),
            el("td", { text: top(B) }),
          ]),
          el("tr", {}, [
            el("th", { scope: "row", text: "Premières compagnies aux États-Unis" }),
            el("td", { text: airlines(ua) }),
            el("td", { text: airlines(ub) }),
          ]),
        ]),
      ]),
    );
    const q = new URLSearchParams(location.search);
    q.set("a", a);
    q.set("b", b);
    history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
  }
  render();
}
