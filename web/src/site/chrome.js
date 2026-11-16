// @ts-check
// The masthead's tools on every page (buttons written by the partial "menu-button"):
// - the theme: light (chart paper) or dark (night), the reader's choice saved, else the system's; the
//   head script of partials.js sets it before the first paint, this file only switches it;
// - the search (⌘K, Ctrl+K or /): one dialog over search.json (src/site/search-index.js), loaded the
//   first time it opens;
// - the offline copy: a service worker (public/sw.js) on the production site only.
import "./chrome.css";
import { search } from "./search-index.js";

const ROOT = document.querySelector('meta[name="site-root"]')?.getAttribute("content") ?? "./";
const html = document.documentElement;

// ------------------------------------------------------------------ theme
const isDark = () => html.dataset.theme === "dark";

/** @param {boolean} dark @param {boolean} [save] */
export function setTheme(dark, save = true) {
  if (dark) html.dataset.theme = "dark";
  else delete html.dataset.theme;
  if (save) {
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* private browsing: the choice lasts for the page */
    }
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#08111c" : "#0e1b2c");
  for (const b of document.querySelectorAll("[data-theme-toggle]")) {
    b.setAttribute("aria-pressed", String(dark));
    const label = dark ? "Mode clair" : "Mode sombre";
    b.setAttribute("aria-label", label);
    b.setAttribute("title", label);
  }
}

function initTheme() {
  setTheme(isDark(), false);
  for (const b of document.querySelectorAll("[data-theme-toggle]")) {
    b.addEventListener("click", () => {
      const go = () => setTheme(!isDark());
      // a cross-fade where the browser can, an instant switch elsewhere
      const vt = /** @type {any} */ (document).startViewTransition;
      if (vt && !matchMedia("(prefers-reduced-motion: reduce)").matches) vt.call(document, go);
      else go();
    });
  }
  // the system changes (evening) and the reader never chose: follow it
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    let saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {
      /* none */
    }
    if (!saved) setTheme(e.matches, false);
  });
}

// ------------------------------------------------------------------ search
/** @type {Promise<any[]> | null} */
let indexPromise = null;
const loadIndex = () =>
  (indexPromise ??= fetch(`${ROOT}search.json`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []));

const ICON =
  '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.4 12.4L17 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

function buildDialog() {
  const d = document.createElement("dialog");
  d.className = "site-search";
  d.id = "site-search";
  d.setAttribute("aria-labelledby", "ss-title");
  d.innerHTML = `
    <div class="ss-box" role="search">
      <h2 class="visually-hidden" id="ss-title">Rechercher dans le magazine</h2>
      ${ICON}
      <input id="ss-input" type="text" role="combobox" aria-expanded="true" aria-controls="ss-list"
        aria-autocomplete="list" aria-label="Rechercher une enquête, un chapitre, un outil, une donnée ou un mot"
        placeholder="Une enquête, un chapitre, un outil, un mot…" autocomplete="off" spellcheck="false" />
      <button class="ss-close" type="button" aria-label="Fermer la recherche">Échap</button>
    </div>
    <p class="ss-hint" id="ss-status" aria-live="polite"></p>
    <ul class="ss-list" id="ss-list" role="listbox" aria-label="Résultats"></ul>
    <p class="ss-foot" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> choisir · <kbd>Entrée</kbd> ouvrir · <kbd>Échap</kbd> fermer</p>`;
  document.body.append(d);
  return d;
}

function initSearch() {
  const openers = [...document.querySelectorAll("[data-search-open]")];
  if (!openers.length) return;
  /** @type {HTMLDialogElement | null} */
  let dialog = null;
  /** @type {any[]} */
  let results = [];
  let active = 0;
  /** @type {Element | null} */
  let opener = null;

  const render = (input, list, status, index) => {
    results = search(index, input.value);
    active = 0;
    list.replaceChildren(
      ...results.map((e, n) => {
        const li = document.createElement("li");
        li.id = `ss-o-${n}`;
        li.setAttribute("role", "option");
        li.dataset.href = `${ROOT}${e.h}`;
        const k = document.createElement("span");
        k.className = "ss-k";
        k.textContent = e.k;
        const t = document.createElement("span");
        t.className = "ss-t";
        t.textContent = e.t;
        li.append(k, t);
        if (e.s) {
          const s = document.createElement("span");
          s.className = "ss-s";
          s.textContent = e.k === "Mot" ? `Dans « ${e.s} »` : e.s;
          li.append(s);
        }
        if (e.k === "Mot" && e.d) {
          const d = document.createElement("span");
          d.className = "ss-d";
          d.textContent = e.d;
          li.append(d);
        }
        return li;
      }),
    );
    status.textContent = input.value.trim()
      ? results.length
        ? `${results.length} résultat${results.length > 1 ? "s" : ""}`
        : "Rien ne correspond. Essayez un autre mot : CO2, retard, Airbus, saisons…"
      : "Les dernières publications";
    mark(input, list);
  };
  const mark = (input, list) => {
    [...list.children].forEach((li, n) => li.setAttribute("aria-selected", String(n === active)));
    const cur = list.children[active];
    if (cur) {
      input.setAttribute("aria-activedescendant", cur.id);
      cur.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };
  const go = (href) => {
    dialog?.close();
    location.href = href;
  };

  const open = async (ev) => {
    opener = ev?.currentTarget ?? document.activeElement;
    if (!dialog) {
      dialog = buildDialog();
      const input = /** @type {HTMLInputElement} */ (dialog.querySelector("#ss-input"));
      const list = /** @type {HTMLElement} */ (dialog.querySelector("#ss-list"));
      const status = /** @type {HTMLElement} */ (dialog.querySelector("#ss-status"));
      const index = await loadIndex();
      input.addEventListener("input", () => render(input, list, status, index));
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = results.length;
          if (!n) return;
          active = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
          mark(input, list);
        } else if (e.key === "Enter" && results[active]) {
          e.preventDefault();
          go(/** @type {HTMLElement} */ (list.children[active]).dataset.href);
        }
      });
      list.addEventListener("click", (e) => {
        const li = /** @type {HTMLElement} */ (e.target).closest("li");
        if (li?.dataset.href) go(li.dataset.href);
      });
      list.addEventListener("mousemove", (e) => {
        const li = /** @type {HTMLElement} */ (e.target).closest("li");
        const n = li ? [...list.children].indexOf(li) : -1;
        if (n >= 0 && n !== active) {
          active = n;
          mark(input, list);
        }
      });
      dialog.querySelector(".ss-close")?.addEventListener("click", () => dialog?.close());
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog?.close();
      });
      dialog.addEventListener("close", () => {
        html.classList.remove("search-is-open");
        for (const b of openers) b.setAttribute("aria-expanded", "false");
        if (opener instanceof HTMLElement) opener.focus();
      });
      render(input, list, status, index);
    }
    if (dialog.open) return;
    html.classList.add("search-is-open");
    for (const b of openers) b.setAttribute("aria-expanded", "true");
    dialog.showModal();
    const input = /** @type {HTMLInputElement} */ (dialog.querySelector("#ss-input"));
    input.select();
    input.focus();
  };

  for (const b of openers) {
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", open);
  }
  document.addEventListener("keydown", (e) => {
    const typing = /** @type {HTMLElement} */ (e.target).closest?.(
      "input, textarea, select, [contenteditable]",
    );
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (dialog?.open) dialog.close();
      else open();
    } else if (e.key === "/" && !typing && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      open();
    }
  });
}

// ------------------------------------------------------------------ offline copy
function initOffline() {
  // production only: a cached page must never hide a rebuild from the check scripts on 127.0.0.1
  if (!import.meta.env.PROD || import.meta.env.MODE === "artifact") return;
  if (location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register(`${ROOT}sw.js`).catch(() => {});
  });
}

let started = false;
/** Called by initSiteMenu() on every page. */
export function initChrome() {
  if (started) return;
  started = true;
  initTheme();
  initSearch();
  initOffline();
}
