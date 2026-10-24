// The "Sommaire" panel opened from the masthead of every page: the chapters of the story being read
// (copied from its chapter bar, the current one marked), every investigation and the magazine's pages.
import "./site.css";

export function initSiteMenu() {
  const dialog = document.getElementById("site-menu");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const root = document.documentElement;
  const list = document.getElementById("menu-chapters");
  const nav = document.querySelector(".topnav");
  let opener = null;

  const fillChapters = () => {
    if (!list || !nav) return;
    const current = nav.querySelector('a[aria-current="true"]')?.getAttribute("href");
    const items = [...nav.querySelectorAll("a")].map((a, i) => {
      const id = a.getAttribute("href");
      const link = document.createElement("a");
      link.href = id;
      const no = document.createElement("span");
      no.className = "mc-no";
      no.textContent = String(i + 1);
      const title = document.createElement("span");
      title.className = "mc-t";
      title.textContent = a.textContent.trim();
      link.append(no, title);
      // the chapter's full heading under its short name, when they differ
      const h = id.startsWith("#") ? document.getElementById(id.slice(1))?.querySelector("h2") : null;
      // innerText keeps the line break of a two-part heading as a space
      const full = h?.innerText.replace(/\s+/g, " ").trim();
      if (full && full !== title.textContent) {
        const small = document.createElement("small");
        small.textContent = full;
        link.append(small);
      }
      if (id === current) link.setAttribute("aria-current", "true");
      const li = document.createElement("li");
      li.append(link);
      return li;
    });
    list.replaceChildren(...items);
  };

  const open = (ev) => {
    opener = ev.currentTarget;
    fillChapters();
    root.classList.add("menu-is-open");
    dialog.showModal();
    opener.setAttribute("aria-expanded", "true");
    (
      dialog.querySelector('#menu-chapters a[aria-current="true"]') ||
      dialog.querySelector("[data-menu-close]")
    ).focus();
  };
  const close = () => dialog.open && dialog.close();

  document.querySelectorAll("[data-menu-open]").forEach((b) => {
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", open);
  });
  dialog.querySelector("[data-menu-close]")?.addEventListener("click", close);
  dialog.addEventListener("close", () => {
    root.classList.remove("menu-is-open");
    opener?.setAttribute("aria-expanded", "false");
  });
  // a click on the backdrop (outside the panel) or on any link closes the panel; links then go on
  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside =
        ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) close();
    }
    if (ev.target.closest("a")) close();
  });
}
