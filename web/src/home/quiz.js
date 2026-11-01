// Four questions on the home page, one per investigation: the reader guesses, the data answer, and the
// chapter that explains it is one click away. Each answer and each number of its sentence is copied
// from what its investigation shows (its key figures, its opening): check_site.py reads them on the
// story page and compares, so a change in the data that moves a number makes the check fail.
import { el } from "../lib/ui.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { issueByKey } from "../site/issues.js";

const NNBSP = " ";
const hm = (m) =>
  m < 60 ? `${m}${NNBSP}min` : `${Math.floor(m / 60)}${NNBSP}h${NNBSP}${String(m % 60).padStart(2, "0")}`;
const pct = (v) => `${fmtNum(v)}${NNBSP}%`;
const points = (d) => `${fmtNum(d, Number.isInteger(d) ? 0 : 1)}${NNBSP}point${d >= 2 ? "s" : ""}`;

export const QUIZ = [
  {
    issue: "eu",
    q: "En 2025, sur les trente pays de l'Union et de l'AELE, combien comptaient plus de passagers aériens qu'en 2019, avant le Covid ?",
    min: 0,
    max: 30,
    step: 1,
    start: 15,
    format: (v) => `${v} sur 30`,
    ends: String,
    by: (d) => fmtNum(d),
    answer: 23,
    near: 1,
    then: "Sept restent en dessous, dont la Finlande (−20 %) et l'Allemagne (−9 %).",
    hash: "sud",
  },
  {
    issue: "hf",
    q: "Une personne (pilote, mécanicien, contrôleur…) est citée dans la cause probable de 77 % des accidents aériens survenus aux États-Unis de 2008 à 2023. Et dans les accidents des compagnies aériennes ?",
    min: 0,
    max: 100,
    step: 1,
    start: 77,
    format: pct,
    by: points,
    answer: 49,
    near: 3,
    then: "L'environnement y est cité aussi souvent, dans 50 % : 37 % de leurs accidents sont des turbulences.",
    hash: "compagnies",
  },
  {
    issue: "jet",
    q: "Paris-CDG → New York-JFK, puis le retour : même distance. En médiane, de combien le vol vers New York est-il plus long ?",
    min: 0,
    max: 180,
    step: 1,
    start: 0,
    format: hm,
    by: (d) => (d < 60 ? `${d}${NNBSP}minute${d >= 2 ? "s" : ""}` : hm(d)),
    answer: 68,
    near: 5,
    then: "Et il brûle environ 6,7 t de kérosène de plus. En cause, le courant-jet, qui souffle d'ouest en est à l'altitude des avions de ligne.",
    hash: "ecart",
  },
  {
    issue: "ciel",
    q: "De 2019 à 2025, comment a évolué le nombre de passagers des vols intérieurs en France ?",
    min: -50,
    max: 50,
    step: 1,
    start: 0,
    origin: 0,
    format: (v) => (v === 0 ? `0${NNBSP}%` : fmtPct(v, Number.isInteger(v) ? 0 : 1)),
    by: points,
    answer: -20.9,
    near: 3,
    then: "Dans le même temps, les vols internationaux ont gagné 7,3 % et battent des records.",
    hash: "france",
  },
];

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where a value sits on the slider's track, for a mark drawn over it (the thumb is --t wide). */
const at = (Q, v) => (v - Q.min) / (Q.max - Q.min);
const left = (f) => `calc(var(--t) / 2 + (100% - var(--t)) * ${f.toFixed(4)})`;

function card(Q, i, root) {
  const issue = issueByKey(Q.issue);
  const id = `quiz-q${i + 1}`;
  const story = `${root}${issue.slug}`;
  const value = el("output", { class: "quiz-value", for: `${id}-range`, text: Q.format(Q.start) });
  const range = el("input", {
    type: "range",
    id: `${id}-range`,
    min: Q.min,
    max: Q.max,
    step: Q.step,
    value: Q.start,
    "aria-labelledby": id,
    "aria-valuetext": Q.format(Q.start),
  });
  const track = el("div", { class: "quiz-track" }, [range]);
  // a signed scale fills from its zero, marked on the track
  const origin = at(Q, Q.origin ?? Q.min);
  range.style.setProperty("--o", origin.toFixed(4));
  if (origin > 0 && origin < 1) {
    const zero = el("span", { class: "quiz-zero", "aria-hidden": "true" });
    zero.style.left = left(origin);
    track.append(zero);
  }
  const go = el("button", { type: "button", class: "quiz-go", text: "Valider" });
  const answer = el("div", { class: "quiz-answer", "aria-live": "polite" });
  const box = el("li", { class: `quiz-card${origin > 0 ? " signed" : ""}`, style: `--c: ${issue.accent}` }, [
    el("p", { class: "quiz-from" }, [
      el("a", { href: story, text: issue.title }),
      el("span", { text: `n° ${issue.no}` }),
    ]),
    el("h3", { class: "quiz-q", id, text: Q.q }),
    el("div", { class: "quiz-io" }, [
      value,
      track,
      el("div", { class: "quiz-ends", "aria-hidden": "true" }, [
        el("span", { text: (Q.ends ?? Q.format)(Q.min) }),
        el("span", { text: (Q.ends ?? Q.format)(Q.max) }),
      ]),
      go,
    ]),
    answer,
  ]);

  const show = () => {
    const v = +range.value;
    value.textContent = Q.format(v);
    range.setAttribute("aria-valuetext", Q.format(v));
    range.style.setProperty("--f", at(Q, v).toFixed(4));
  };
  range.addEventListener("input", show);
  show();

  const reveal = () => {
    if (box.classList.contains("done")) return;
    const guess = +range.value;
    const d = Math.round(Math.abs(guess - Q.answer) * 10) / 10;
    box.classList.add("done");
    range.disabled = true;
    go.remove();
    // the band from the reader's guess to the answer, and the answer's mark
    const [a, b] = [at(Q, guess), at(Q, Q.answer)].sort((x, y) => x - y);
    const band = el("span", { class: "quiz-band", "aria-hidden": "true" });
    band.style.left = left(a);
    band.style.width = `calc((100% - var(--t)) * ${(b - a).toFixed(4)})`;
    const mark = el("span", { class: "quiz-mark", "aria-hidden": "true" }, [el("b", { text: "réponse" })]);
    mark.style.left = left(at(Q, Q.answer));
    track.append(band, mark);
    // the big number runs from the guess to the answer, once
    const t0 = performance.now();
    const ms = reduced() ? 0 : 700;
    const tick = (t) => {
      const k = ms ? Math.min(1, (t - t0) / ms) : 1;
      const e = 1 - (1 - k) ** 3;
      const v = guess + (Q.answer - guess) * e;
      value.textContent = Q.format(k < 1 ? Math.round(v) : Q.answer);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    value.classList.add("is-answer");
    const verdict =
      d === 0 ? ", tout juste." : d <= Q.near ? `, à ${Q.by(d)} près : bien vu.` : `, à ${Q.by(d)} près.`;
    answer.replaceChildren(
      el("p", { class: "quiz-you" }, [
        "Réponse : ",
        el("b", { class: "quiz-n", text: Q.format(Q.answer) }),
        `. La vôtre : ${Q.format(guess)}${verdict}`,
      ]),
      el("p", { class: "quiz-then", text: Q.then }),
      el("a", { class: "quiz-read", href: `${story}#${Q.hash}`, text: `Lire « ${issue.title} »` }),
    );
  };
  go.addEventListener("click", reveal);
  range.addEventListener("keydown", (e) => {
    if (e.key === "Enter") reveal();
  });
  return box;
}

/** The four questions, in the list `node`; `root` is the path from this page to the site's root. */
export function quiz(node, root = "") {
  node.replaceChildren(...QUIZ.map((Q, i) => card(Q, i, root)));
}
