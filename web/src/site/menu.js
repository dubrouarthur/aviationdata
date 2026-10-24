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

  // a story in parts (the jet stream): the parts and their chapters, read from the page itself
  const fillFromParts = () => {
    const nodes = [...document.querySelectorAll("main > .part, main > section.chapter")];
    const line = innerHeight * 0.33;
    let current = null;
    const out = [];
    for (const n of nodes) {
      if (n.classList.contains("part")) {
        const head = document.createElement("li");
        head.className = "mc-part";
        head.textContent = n.querySelector(".part-label")?.textContent.replace(/\s+/g, " ").trim() ?? "";
        out.push(head);
        continue;
      }
      const h = n.querySelector("h2.section-title");
      if (!n.id || !h || n.hidden) continue;
      const link = document.createElement("a");
      link.href = `#${n.id}`;
      const no = document.createElement("span");
      no.className = "mc-no";
      no.textContent = String(+(n.querySelector(".chapter-num b")?.textContent ?? "") || "");
      const title = document.createElement("span");
      title.className = "mc-t";
      title.textContent = h.innerText.replace(/\s+/g, " ").trim();
      link.append(no, title);
      if (n.getBoundingClientRect().top <= line) current = link;
      const li = document.createElement("li");
      li.append(link);
      out.push(li);
    }
    current?.setAttribute("aria-current", "true");
    list.replaceChildren(...out);
  };

  const fillChapters = () => {
    if (!list || !nav) return;
    if (document.querySelector("main > .part")) return fillFromParts();
    const current = nav.querySelector('a[aria-current="true"]')?.getAttribute("href");
    const items = [...nav.querySelectorAll("a")].map((a) => {
      const id = a.getAttribute("href");
      const link = document.createElement("a");
      link.href = id;
      const no = document.createElement("span");
      no.className = "mc-no";
      // the chapter's own number, as printed above its title (the opening and the closing have none)
      const target = id.startsWith("#") ? document.getElementById(id.slice(1)) : null;
      no.textContent = String(+(target?.querySelector(".chapter-num b")?.textContent ?? "") || "");
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
    // a story in parts: a heading before the first chapter of each part (data-part on the chapter bar)
    let part = null;
    const grouped = [];
    [...nav.querySelectorAll("a")].forEach((a, i) => {
      const n = a.dataset.part;
      const label = n && document.querySelector(`#partie-${n} .part-label`);
      if (n && n !== part && label) {
        const head = document.createElement("li");
        head.className = "mc-part";
        head.textContent = label.textContent.replace(/\s+/g, " ").trim();
        grouped.push(head);
      }
      part = n ?? part;
      grouped.push(items[i]);
    });
    list.replaceChildren(...grouped);
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
