import { $, el } from "../lib/ui.js";

// one card per chapter, built from what the chapters already computed (their first key figure),
// so the summary can never disagree with the story
const CARDS = [
  { id: "monde", from: "#hero-kpis .kpi", title: "Le monde vu de France" },
  { id: "france", from: "#kf-france .kf", title: "La France intérieure" },
  { id: "prix", from: "#kf-prix .kf", title: "Le prix du billet" },
  { id: "compagnies", from: "#kf-cie .kf", title: "Les compagnies" },
  { id: "pavillon", from: "#kf-pav .kf", title: "Le pavillon français" },
  { id: "co2", from: "#kf-co2 .kf", title: "Le CO2" },
  { id: "fret", from: "#kf-fret .kf", title: "Le fret" },
  { id: "aeroport", from: "#kf-apt .kf", title: "Les aéroports" },
];

/** Closing summary: the key figure of each chapter, with a link back to it, and ways to share the page. */
export function initResume() {
  const cards = CARDS.map(({ id, from, title }) => {
    const src = document.querySelector(from);
    if (!src) return null;
    const value = src.querySelector("b")?.textContent || "";
    const label = src.querySelector("span")?.textContent || "";
    const color = src.querySelector("i")?.style.getPropertyValue("--c") || "var(--ink)";
    return el("a", { class: "resume-card", href: `#${id}` }, [
      el("span", { class: "rc-title" }, [el("i", { style: `--c:${color}` }), title]),
      el("b", { text: value }),
      el("span", { class: "rc-label", text: label }),
      el("span", { class: "rc-go", text: "Revoir le chapitre →" }),
    ]);
  }).filter(Boolean);
  $("#resume-grid").replaceChildren(...cards);

  // share: the canonical address when the build knows it, else this page
  const og = document.querySelector('meta[property="og:url"]')?.content || "";
  const url = /^https?:\/\//.test(og) ? og : location.href.split("#")[0];
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
    el("p", { text: "Ce travail vous a appris quelque chose ? Partagez-le." }),
    el("div", { class: "share-actions" }, [
      el("a", {
        class: "btn primary",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        target: "_blank",
        rel: "noopener",
        text: "Partager sur LinkedIn",
      }),
      copy,
    ]),
  );
}
