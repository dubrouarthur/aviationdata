// Small UI helpers shared by every module. All text goes through textContent.

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) n.append(c);
  return n;
}

/** Inline text with <strong class="num"> parts: rich(["Le trafic a ", {b: "+7 %"}, "."]).
 * A number stays glued to the word after it ("22,2 millions", "11,3 Mt") and a long bold
 * phrase may still wrap, so it never leaves a one-word line before it on a phone. */
export function rich(parts) {
  const frag = document.createDocumentFragment();
  for (const p of parts)
    frag.append(
      typeof p === "string" ? p : el("strong", { class: "num", text: p.b.replace(/(\d) /g, "$1 ") }),
    );
  return frag;
}

/** French typography: a narrow no-break space before ? ! : ; » and after «, so the mark
 * never starts a line on its own, and between a number and its unit ("41 %", "713 kt"). */
export const frSpace = (s) =>
  s
    .replace(/(^|\S)[ \t\n]+([?!:;»])/g, "$1\u202f$2")
    .replace(/«[ \t\n]+/g, "«\u202f")
    .replace(/(\d)[ \u00a0](%|Mt|kt|km|M|k|g)(?![\p{L}\d])/gu, "$1\u202f$2");

/** Apply frSpace to every text node under root (HTML and SVG). */
export function applyFrenchSpacing(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) fixText(n);
}

function fixText(n) {
  const tag = n.parentNode?.nodeName;
  if (tag === "SCRIPT" || tag === "STYLE") return;
  const v = frSpace(n.nodeValue);
  if (v !== n.nodeValue) n.nodeValue = v; // unchanged text is not rewritten, so the observer settles
}

/** Keep the spacing right on text the charts write later (tooltips, year changes, sorting). */
export function watchFrenchSpacing(root) {
  applyFrenchSpacing(root);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") fixText(r.target);
      else
        for (const n of r.addedNodes)
          n.nodeType === Node.TEXT_NODE
            ? fixText(n)
            : n.nodeType === Node.ELEMENT_NODE && applyFrenchSpacing(n);
    }
  }).observe(root, { childList: true, characterData: true, subtree: true });
}

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Segmented control: buttons with data-v (or data-mode/data-theme); calls onChange(value). */
export function segmented(root, initial, onChange, attr = "v") {
  const buttons = [...root.querySelectorAll("button")];
  const set = (v, fire = true) => {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === v)));
    if (fire) onChange(v);
  };
  buttons.forEach((b) => b.addEventListener("click", () => set(b.dataset[attr])));
  set(initial, false);
  return { set };
}

/**
 * Preset views ("moments") shown as tabs: the reader clicks instead of scrolling through steps.
 * items: [{key, label, hint}]; returns {select(key, fire = true), mark(key)}; mark(null) clears the selection.
 */
export function moments(root, items, onPick) {
  root.setAttribute("role", "tablist");
  const buttons = items.map((it) =>
    el("button", { type: "button", role: "tab", "aria-selected": "false", "data-k": it.key }, [
      el("b", { text: it.label }),
      it.hint ? el("span", { text: it.hint }) : null,
    ]),
  );
  const mark = (key) =>
    buttons.forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.k === key));
      b.tabIndex = b.dataset.k === key || (key === null && b === buttons[0]) ? 0 : -1;
    });
  const select = (key, fire = true) => {
    mark(key);
    if (fire) onPick(key);
  };
  buttons.forEach((b, i) => {
    b.addEventListener("click", () => select(b.dataset.k));
    b.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = buttons[(i + step + buttons.length) % buttons.length];
      next.focus();
      select(next.dataset.k);
    });
  });
  root.replaceChildren(...buttons);
  return { select, mark };
}

/**
 * Table view of a chart ("Voir les chiffres"), placed right after the chart node; values stay reachable without
 * hovering. Calling it again refreshes the table and keeps the open/closed state.
 * head: column labels; rows: arrays of already formatted cells (first cell is the row label).
 */
export function dataTable(anchor, { head, rows, summary = "Voir les chiffres" }) {
  let box = anchor._dataTable;
  if (!box) {
    box = el("details", { class: "data" }, [
      el("summary", { text: summary }),
      el("div", { class: "table-scroll" }),
    ]);
    anchor.after(box);
    anchor._dataTable = box;
  }
  const table = el("table", {}, [
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        head.map((h) => el("th", { scope: "col", text: h })),
      ),
    ),
    el(
      "tbody",
      {},
      rows.map((r) =>
        el(
          "tr",
          {},
          r.map((c, k) => el(k ? "td" : "th", k ? { text: c } : { scope: "row", text: c })),
        ),
      ),
    ),
  ]);
  box.lastElementChild.replaceChildren(table);
  return box;
}

/** A chapter's key figures: [{value, label, color}] -> big number in ink, label with a colour swatch. */
export function keyFigures(node, items) {
  node.replaceChildren(
    ...items.map(({ value, label, color }) =>
      el("div", { class: "kf" }, [
        el("b", { text: value }),
        el("span", {}, [el("i", { style: `--c:${color || "var(--ink)"}` }), label]),
      ]),
    ),
  );
}

/** Toggle chips doubling as the legend. items: [{key, label, color, dashed, on}] */
export function chips(root, items, onChange) {
  root.replaceChildren();
  const state = new Map(items.map((d) => [d.key, d.on !== false]));
  for (const d of items) {
    const key = el("span", { class: `key${d.dashed ? " dashed" : ""}`, style: `--c:${d.color}` });
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(state.get(d.key)) }, [
      key,
      d.label,
    ]);
    b.addEventListener("click", () => {
      const on = !state.get(d.key);
      // never allow an empty chart
      if (!on && [...state.values()].filter(Boolean).length === 1) return;
      state.set(d.key, on);
      b.setAttribute("aria-pressed", String(on));
      onChange(new Set([...state].filter(([, v]) => v).map(([k]) => k)));
    });
    root.append(b);
  }
  return new Set([...state].filter(([, v]) => v).map(([k]) => k));
}

/* ------------------------------------------------------------------ tooltip */
const tip = () => document.getElementById("tooltip");

/** rows: [{label, value, color, dashed}] ; title: string */
export function showTip(event, title, rows) {
  const t = tip();
  if (!t) return;
  t.replaceChildren();
  if (title) t.append(el("div", { class: "t-title", text: title }));
  for (const r of rows) {
    t.append(
      el("div", { class: "t-row" }, [
        el("span", {
          class: "t-key",
          style: `--c:${r.color || "transparent"};${r.dashed ? "border-top-style:dashed" : ""}`,
        }),
        el("span", { class: "t-val", text: r.value }),
        el("span", { class: "t-lab", text: r.label }),
      ]),
    );
  }
  t.classList.add("on");
  placeTip(event);
}

export function placeTip(event) {
  const t = tip();
  if (!t) return;
  const pad = 14;
  let x;
  let y;
  if (event && "clientX" in event && event.clientX) {
    x = event.clientX;
    y = event.clientY;
  } else if (event?.anchor) {
    const r = event.anchor.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top;
  } else return;
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  let left = x + pad;
  if (left + w > window.innerWidth - 8) left = x - pad - w;
  let top = y - h - pad;
  if (top < 8) top = y + pad;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}

export function hideTip() {
  tip()?.classList.remove("on");
}

/** Re-render on width change (debounced via rAF). */
export function onResize(node, fn) {
  let w = 0;
  let raf = 0;
  const ro = new ResizeObserver((entries) => {
    const nw = Math.round(entries[0].contentRect.width);
    if (nw === w || nw === 0) return;
    w = nw;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => fn(nw));
  });
  ro.observe(node);
}

export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
