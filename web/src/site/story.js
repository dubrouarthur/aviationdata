// What every investigation in chapters does on its page: number its chapters, follow the reader in the
// bar of parts, show how far they have read, and close on the author and the share buttons.
import { $, el } from "../lib/ui.js";
import { asset } from "../lib/site.js";
import { shareUrl, linkedInShare } from "../lib/datasets.js";

/** "03 / 10" above each chapter title (chapters of the given class, except the closing answer). */
export function numberChapters(chapterClass) {
  const titles = [...document.querySelectorAll(`main ${chapterClass} h2.section-title`)].filter(
    (h) => h.id !== "h-bref",
  );
  titles.forEach((h, i) => {
    if (h.previousElementSibling?.classList.contains("chapter-num")) return;
    h.before(
      el("p", { class: "chapter-num" }, [
        el("b", { text: String(i + 1).padStart(2, "0") }),
        ` / ${String(titles.length).padStart(2, "0")}`,
      ]),
    );
  });
}

/** The author and the share buttons, at the end of the story. */
export function shareBlock() {
  const url = shareUrl();
  const copy = el("button", { type: "button", class: "btn", text: "Copier le lien" });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Lien copié";
    } catch {
      copy.textContent = url;
    }
    setTimeout(() => (copy.textContent = "Copier le lien"), 2500);
  });
  $("#share").replaceChildren(
    el("div", { class: "author-card" }, [
      el("img", { src: asset("auteur.jpg"), alt: "Arthur Dubrou", width: 76, height: 76, loading: "lazy" }),
      el("div", {}, [
        el("p", { class: "ac-by", text: "Une enquête en données de" }),
        el("p", { class: "ac-name", text: "Arthur Dubrou" }),
        el("a", {
          href: "https://www.linkedin.com/in/arthur-dubrou/",
          target: "_blank",
          rel: "noopener",
          text: "Me suivre sur LinkedIn",
        }),
      ]),
    ]),
    el("div", { class: "share-box" }, [
      el("p", { text: "Cette enquête vous a appris quelque chose ? Partagez-la." }),
      el("div", { class: "share-actions" }, [
        el("a", {
          class: "btn primary",
          href: linkedInShare(url),
          target: "_blank",
          rel: "noopener",
          text: "Partager sur LinkedIn",
        }),
        copy,
      ]),
    ]),
  );
}

/**
 * The bar of parts: the last part whose start has passed the upper third of the screen is current
 * (none above the first part), and the bar scrolls to keep it in view.
 */
export function trackChapters() {
  const links = [...document.querySelectorAll(".topnav a")]
    .map((a) => ({ a, target: document.getElementById(a.hash.slice(1)) }))
    .filter((l) => l.target);
  let current = null;
  let raf = 0;
  const update = () => {
    raf = 0;
    const line = innerHeight * 0.33;
    let on = null;
    for (const l of links) if (l.target.getBoundingClientRect().top <= line) on = l;
    if (on === current) return;
    current = on;
    links.forEach((l) => l.a.setAttribute("aria-current", String(l === on)));
    const nav = on?.a.parentElement;
    if (nav && nav.scrollWidth > nav.clientWidth)
      nav.scrollTo({ left: on.a.offsetLeft - nav.offsetLeft - 24, behavior: "smooth" });
  };
  addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
  update();
}

/** The thin bar under the masthead: how far the reader is. */
export function readingProgress() {
  const bar = document.getElementById("read-progress");
  if (!bar) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0})`;
  };
  addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
  addEventListener("resize", update);
  update();
}

/** A folded box (details) opens when a link or the address points at it or at what it holds. */
export function openFoldedTargets() {
  const open = (hash) => {
    if (!hash || hash.length < 2) return;
    let target = null;
    try {
      target = document.querySelector(hash);
    } catch {
      return;
    }
    const box = target?.matches("details")
      ? target
      : (target?.querySelector(":scope details") ?? target?.closest("details"));
    if (box) box.open = true;
  };
  addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (a) open(a.getAttribute("href"));
  });
  addEventListener("hashchange", () => open(location.hash));
  open(location.hash);
}
