// The words of « Le billet d'avion est-il plus cher ? ». Every number comes from billetFacts() (facts.js)
// and is recomputed by web/scripts/check_billet.py. House rules (CLAUDE.md): a figure title states a
// finding, the « Lecture » line says how to read it, at most two numbers in a sentence, no cause asserted.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { link } from "../court/sources.js";
import { BSOURCES, METHOD } from "./sources.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(Math.abs(v), 0);
const pc = (v) => `${n0(v)} %`;
const signed = (v) => fmtPct(v, 0);

/** The short answer, first thing under the question. */
export function writeAnswer(F) {
  $("#court-answer").replaceChildren(
    el("p", { class: "ca-yes", text: "Oui," }),
    p([
      "mais pas comme on le croit. En ",
      String(F.last),
      ", un billet au départ de France coûte ",
      { b: `${pc(F.total)} de plus` },
      ` qu'en ${F.first}. Presque toute la hausse tient en deux ans, ${F.flatEnd + 1} et ${F.flatEnd + 2}, après dix ans de prix immobiles.`,
    ]),
    p(["Retirée l'inflation, le billet n'a pris que ", { b: pc(F.real) }, "."]),
  );
}

export function writeSteps(F) {
  // 1. ten years, then a jump
  $("#prix-prose").replaceChildren(
    p([
      "Pour suivre le prix des billets, la DGAC relève chaque mois ",
      { b: `${METHOD.fares} tarifs` },
      " au départ de France, sur les mêmes trajets d'une année à l'autre. Elle en tire un indice : un seul nombre qui monte quand le même voyage coûte plus cher.",
    ]),
  );
  $("#h-prix-fig").textContent = "Dix ans de prix immobiles, puis un bond";
  $("#prix-note").textContent =
    `Prix des billets d'avion au départ de France et ensemble des prix en France, moyenne de chaque année, base 100 en ${F.first}.`;
  lecture(
    "#chart-prix",
    `chaque ligne part de 100 en ${F.first} ; à 130, ce qui coûtait 100 euros en ${F.first} en coûte 130.`,
  );
  $("#prix-after").replaceChildren(
    p([
      `De ${F.first} à ${F.flatEnd}, l'indice des billets ne bouge presque pas : `,
      { b: signed(F.flat) },
      ". Dans le même temps, l'ensemble des prix monte de ",
      { b: pc(F.flatInflation) },
      " : à pouvoir d'achat égal, l'avion devenait moins cher.",
    ]),
    p([
      `Puis tout change. De ${F.flatEnd} à ${F.flatEnd + 2}, le prix des billets bondit de `,
      { b: pc(F.jump) },
      `. Depuis, il ne bouge presque plus : `,
      { b: signed(F.since) },
      ` de ${F.flatEnd + 2} à ${F.last}.`,
    ]),
    p([
      `Au bout du compte, de ${F.first} à ${F.last}, le billet prend `,
      { b: pc(F.total) },
      " et l'ensemble des prix ",
      { b: pc(F.inflation) },
      `. L'écart, une fois l'inflation retirée, est de ${pc(F.real)}.`,
    ]),
  );

  // 2. the season
  $("#saison-prose").replaceChildren(
    p([
      "Le prix d'un même voyage change aussi avec le mois du départ. L'indice de la DGAC suit les voyages de chaque mois : il dit quand partir coûte le plus cher.",
    ]),
  );
  $("#h-saison-fig").textContent = `Partir en ${F.peak} coûte un tiers de plus qu'en ${F.low}`;
  $("#saison-note").textContent =
    `Prix des billets d'avion au départ de France pour les voyages de chaque mois de ${F.last}, écart à la moyenne de l'année, en %.`;
  lecture(
    "#chart-saison",
    `une barre au-dessus de la ligne, un mois plus cher que la moyenne de l'année ; en dessous, moins cher.`,
  );
  $("#saison-after").replaceChildren(
    p([
      `En ${F.last}, les voyages de ${F.peak} coûtent `,
      { b: `${pc(F.peakUp)} de plus` },
      ` que la moyenne de l'année, ceux de ${F.low} `,
      { b: `${pc(F.lowDown)} de moins` },
      ".",
    ]),
    p([
      `D'un mois à l'autre, l'écart atteint `,
      { b: pc(F.peakVsLow) },
      ` : le même billet, pris pour ${F.peak} plutôt que pour ${F.low}, coûte un tiers de plus.`,
    ]),
  );

  // 3. by kind of flight
  const top = F.segments[0];
  const bottom = F.segments.at(-1);
  $("#vols-prose").replaceChildren(
    p([
      `Tous les billets n'ont pas suivi la même pente. Depuis ${F.ref}, dernière année avant le Covid, l'ensemble prend `,
      { b: pc(F.all2019) },
      ", mais l'écart est grand d'un type de vol à l'autre.",
    ]),
  );
  $("#h-vols-fig").textContent = "Les vols intérieurs ont le plus augmenté";
  $("#vols-note").textContent =
    `Évolution du prix des billets d'avion de ${F.ref} à ${F.last}, selon le type de vol, en %.`;
  lecture("#chart-vols", "chaque barre compare la moyenne des douze mois des deux années.");
  $("#vols-after").replaceChildren(
    p([
      `Un billet pour un vol intérieur, entre deux villes de métropole, coûte `,
      { b: `${pc(top.value)} de plus` },
      ` qu'en ${F.ref}. Pour un long-courrier, la hausse est de `,
      { b: pc(bottom.value) },
      ".",
    ]),
    p([
      "Ces chiffres disent de combien les prix ont monté, pas pourquoi. L'enquête ",
      { a: "« Le ciel à deux vitesses »", href: "../le-ciel-a-deux-vitesses#prix" },
      " montre que les vols intérieurs sont aussi ceux qui ont perdu le plus de passagers.",
    ]),
  );

  // 4. plane and train
  $("#train-prose").replaceChildren(
    p([
      "L'Insee et Eurostat suivent eux aussi le prix des billets, dans l'indice des prix à la consommation qui mesure l'inflation. Leur indice de l'avion est construit autrement que celui de la DGAC, mais il se compare au train et à tout le reste.",
    ]),
  );
  $("#h-train-fig").textContent = `L'avion a monté ${F.airVsRail >= 2 ? "plus de deux fois " : ""}plus vite que le train`;
  $("#train-note").textContent =
    `Évolution des prix à la consommation en France de ${F.ref} à ${F.last}, en %.`;
  lecture("#chart-train", "la barre du milieu, l'ensemble des prix, est l'inflation de la période.");
  $("#train-after").replaceChildren(
    p([
      `De ${F.ref} à ${F.last}, les billets d'avion prennent `,
      { b: pc(F.air) },
      " dans l'indice des prix, ceux du train ",
      { b: pc(F.rail) },
      ".",
    ]),
    p([
      "L'ensemble des prix, lui, monte de ",
      { b: pc(F.modes[1].value) },
      " : depuis le Covid, le train suit l'inflation, l'avion la dépasse.",
    ]),
  );
}

/** The answer, at the end, with this year so far. */
export function writeReponse(F) {
  const ytd = F.ytd
    ? [
        p([
          `Et ${F.ytd.year} ? De janvier à ${F.ytd.month}, les billets coûtent `,
          { b: `${pc(F.ytd.change)} de plus` },
          ` qu'aux mêmes mois de ${F.ytd.year - 1}.`,
        ]),
      ]
    : [];
  $("#reponse-prose").replaceChildren(
    p([
      `Oui, le billet d'avion est plus cher qu'avant ${F.flatEnd + 1} : `,
      { b: pc(F.jump) },
      ` de plus en deux ans, après dix ans sans hausse.`,
    ]),
    p([
      `Sur toute la période, de ${F.first} à ${F.last}, il ne dépasse l'inflation que de `,
      { b: pc(F.real) },
      `. C'est en partant en ${F.peak}, sur un vol intérieur, que la hausse se sent le plus.`,
    ]),
    ...ytd,
  );
}

/** Method and sources, at the foot of the page. */
export function writeSources(F, hicp) {
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(BSOURCES.iptap, BSOURCES.iptap.label),
        ", DGAC, sur data.gouv.fr : l'indice des prix des billets d'avion au départ de France, chaque mois depuis 2012, base 100 en 2023.",
      ]),
      li([
        link(BSOURCES.hicp, BSOURCES.hicp.label),
        `, mise à jour d'Eurostat du ${hicp.updated.slice(8, 10)}/${hicp.updated.slice(5, 7)}/${hicp.updated.slice(0, 4)} : l'ensemble des prix, le transport de voyageurs par avion et par train, en France. Réutilisation : `,
        link(BSOURCES.copyright, "source citée, modifications signalées"),
        ". Les évolutions et les bases 100 de cette page sont des calculs d'aviationdata.",
      ]),
    ]),
    el("h3", { text: "Ce que mesure l'indice de la DGAC" }),
    el("ul", {}, [
      li([
        `D'après la DGAC (`,
        link(BSOURCES.bulletin),
        `), l'indice suit ${METHOD.routes} liaisons de ${METHOD.carriers} compagnies, directes ou avec escale. Chaque mois, ${METHOD.fares} tarifs aller-retour, taxes et frais compris, sont relevés dans un système de réservation et sur les sites des compagnies.`,
      ]),
      li([
        "Les liaisons sont pondérées par le trafic de l'année précédente. L'indice mesure donc le prix d'un même panier de voyages : ni le prix moyen payé, ni la recette des compagnies.",
      ]),
      li([
        `Les années se comparent par la moyenne de leurs douze mois. ${F.last} est la dernière année complète dans les deux sources.`,
      ]),
    ]),
    el("h3", { text: "Ce que cette page ne dit pas" }),
    el("ul", {}, [
      li([
        "Les causes. Le prix du kérosène, les taxes, la demande ou l'offre des compagnies jouent tous ; ces indices mesurent des prix, pas leurs raisons, et le texte ne les affirme pas.",
      ]),
      li([
        "Le prix d'un billet précis. Selon la date d'achat, la classe ou la compagnie, un billet s'écarte beaucoup de l'indice.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=billet", text: "la page des données" }),
      ".",
    ]),
  );
}
