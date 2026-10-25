import { $, el } from "../lib/ui.js";
import { shareUrl, linkedInShare } from "../lib/datasets.js";
import { asset } from "../lib/site.js";
import { summary } from "../lib/summary.js";

// one card per chapter, in the order of the story: the opening's first figure, then the card each
// chapter handed over (lib/summary.js) with the numbers it computed
const CARDS = [
  ["monde", "Le monde vu de France"],
  ["france", "La France intérieure"],
  ["prix", "Le prix du billet"],
  ["compagnies", "Les compagnies"],
  ["pavillon", "Le pavillon français"],
  ["co2", "Le CO2"],
  ["fret", "Le fret"],
  ["aeroport", "Les aéroports"],
];

/** The opening's first figure, read from the page. */
function openingCard() {
  const src = document.querySelector("#hero-kpis .kpi");
  if (!src) return null;
  return {
    value: src.querySelector("b")?.textContent || "",
    label: src.querySelector("span")?.textContent || "",
    color: src.querySelector("i")?.style.getPropertyValue("--c") || "var(--ink)",
  };
}

/** Closing summary: the key figure of each chapter, with a link back to it, and ways to share the page. */
export function initResume() {
  const cards = CARDS.map(([id, title]) => {
    const card = id === "monde" ? openingCard() : summary.get(id);
    if (!card) return null;
    return el("a", { class: "resume-card", href: `#${id}` }, [
      el("span", { class: "rc-title" }, [el("i", { style: `--c:${card.color}` }), title]),
      el("b", { text: card.value }),
      el("span", { class: "rc-label", text: card.label }),
      el("span", { class: "rc-go", text: "Revoir le chapitre" }),
    ]);
  }).filter(Boolean);
  $("#resume-grid").replaceChildren(...cards);

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
  const LI = "https://www.linkedin.com/in/arthur-dubrou/";
  $("#share").replaceChildren(
    el("div", { class: "author-card" }, [
      el("img", { src: asset("auteur.jpg"), alt: "Arthur Dubrou", width: 76, height: 76, loading: "lazy" }),
      el("div", {}, [
        el("p", { class: "ac-by", text: "Une enquête en données de" }),
        el("p", { class: "ac-name", text: "Arthur Dubrou" }),
        el("a", { href: LI, target: "_blank", rel: "noopener", text: "Me suivre sur LinkedIn" }),
      ]),
    ]),
    el("div", { class: "share-box" }, [
      el("p", { text: "Ce travail vous a appris quelque chose ? Partagez-le." }),
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
