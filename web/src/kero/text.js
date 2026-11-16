// The words of « D'où vient le kérosène des avions européens ? ». Every number comes from keroFacts() (facts.js)
// and is recomputed by web/scripts/check_kero.py. House rules (CLAUDE.md): a chapter title and a figure title state
// findings, a « Lecture » line says how to read a figure, at most two numbers in a sentence, no cause asserted:
// Eurostat counts tonnes by origin, not the reasons of the buyers; the closure of Hormuz is a dated fact, and the
// text says what changed after it, not that it was the only reason.
import { $, el, rich, lecture } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { link } from "../court/sources.js";
import { essentialSteps } from "../site/story.js";
import { KSOURCES, FACTS } from "./sources.js";
import { monthLabel, spanLabel } from "./facts.js";

const p = (parts) => el("p", {}, rich(parts));
const n0 = (v) => fmtNum(v, 0);
const pc = (v, d = 0) => `${fmtNum(v * 100, d)} %`;
const chg = (r) => `${r >= 0 ? "+" : "−"}${fmtNum(Math.abs(r) * 100, 0)} %`;
/** thousand tonnes -> "1,4 million de tonnes" or "860 000 tonnes" */
const tonnes = (kt) =>
  kt >= 1000
    ? `${fmtNum(kt / 1000, 1)} million${kt >= 2000 ? "s" : ""} de tonnes`
    : `${n0(Math.round(kt) * 1000)} tonnes`;
const WORDS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
/** "près de six sur dix", for a share */
const onTen = (v) => {
  const n = Math.round(v * 10);
  const q = v < n / 10 - 0.005 ? "près de " : v > n / 10 + 0.005 ? "plus de " : "";
  return `${q}${WORDS[n]} sur dix`;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const fmt = { n0, pc, chg, tonnes, onTen };

/** « de l'Inde », « du Koweït », « des États-Unis » */
const DE = {
  US: "des États-Unis",
  AE: "des Émirats arabes unis",
  IN: "de l'Inde",
  EG: "de l'Égypte",
  IQ: "de l'Irak",
  IR: "de l'Iran",
  OM: "d'Oman",
  IL: "d'Israël",
  AO: "de l'Angola",
  DZ: "de l'Algérie",
  UK: "du Royaume-Uni",
};
const de = (p) => DE[p.key] ?? `du ${p.label}`;
/** « le Koweït », « l'Inde », « les États-Unis » */
const LE = {
  US: "les États-Unis",
  AE: "les Émirats arabes unis",
  IN: "l'Inde",
  EG: "l'Égypte",
  OM: "Oman",
  IL: "Israël",
  UK: "le Royaume-Uni",
  AO: "l'Angola",
  DZ: "l'Algérie",
  IQ: "l'Irak",
};
const le = (p) => LE[p.key] ?? `le ${p.label}`;

export function writeOpening(F) {
  $("#kr-h0").replaceChildren(
    el("b", { text: cap(spanLabel(F.before)) }),
    el("span", { text: `${tonnes(F.totB)} par mois, ${pc(F.groups.golfe.before)} du Golfe` }),
  );
  $("#kr-h1").replaceChildren(
    el("b", { text: cap(spanLabel(F.after)) }),
    el("span", { class: "up", text: `${tonnes(F.totA)} par mois, ${pc(F.groups.golfe.after)} du Golfe` }),
  );
  $("#kr-open-cap").textContent =
    `Kérosène importé par les pays de l'Union depuis l'extérieur, chaque mois en moyenne, par pays d'origine ; épaisseur des flèches proportionnelle aux tonnes, même échelle pour les deux cartes ; en magenta, les pays du Golfe. Les mêmes mois d'une année sur l'autre, avant et après la fermeture du détroit d'Ormuz, le 28 février 2026.`;
  $("#open-dek").replaceChildren(
    rich([
      `Avant la fermeture du détroit d'Ormuz, la moitié du kérosène que l'Europe achetait hors de ses frontières venait des pays du Golfe. En ${spanLabel(F.after)}, `,
      { b: pc(F.groups.golfe.after) },
      `. ${cap(le(F.byAfter[0]))} ${F.byAfter[0].key === "US" ? "sont devenus" : "est devenu"} le premier fournisseur, et la tonne payée à la frontière a augmenté de ${pc(F.eurA / F.eurB - 1)}.`,
    ]),
  );
}

export function writeEssentiel(F) {
  const [a1, a2] = F.byAfter;
  essentialSteps([
    {
      id: "dependance",
      q: "L'Europe produit-elle son kérosène ?",
      n: pc(F.refineryShare),
      lead: `de ce qui est livré en 2025 sort des raffineries de l'Union.`,
      more: [`Elle en a importé `, { b: tonnes(F.tot25 * 12) }, " de l'extérieur dans l'année."],
    },
    {
      id: "fournisseurs",
      q: "D'où vient ce qu'elle importe ?",
      n: pc(F.golfe25),
      lead: "des pays du Golfe en 2025.",
      more: [
        `Le Koweït à lui seul, ${pc(F.partners25[0].y25)}. Puis l'Inde, ${pc(F.partners25.find((p) => p.key === "IN").y25)}.`,
      ],
    },
    {
      id: "ormuz",
      q: "Qu'a changé la fermeture d'Ormuz ?",
      n: pc(F.groups.golfe.after),
      lead: `des importations viennent encore du Golfe en ${spanLabel(F.after)}.`,
      more: [
        `Contre ${pc(F.groups.golfe.before)} un an plus tôt. Les importations ont baissé de `,
        { b: pc(-F.totChange) },
        ".",
      ],
    },
    {
      id: "relais",
      q: "Qui a pris le relais ?",
      n: pc(a1.after),
      lead: `des importations viennent ${de(a1)}.`,
      more: [
        `Puis ${le(a2)}, `,
        { b: pc(a2.after) },
        `, contre ${pc(a1.before)} et ${pc(a2.before)} un an plus tôt.`,
      ],
    },
    {
      id: "prix",
      q: "Combien ça coûte ?",
      n: chg(F.eurA / F.eurB - 1),
      lead: `sur le prix de la tonne payé à la frontière de l'Union, d'une année sur l'autre.`,
      more: [
        `${n0(F.eurB)} € la tonne en ${spanLabel(F.before)}, `,
        { b: `${n0(F.eurA)} €` },
        ` en ${spanLabel(F.after)}.`,
      ],
    },
  ]);
}

export function writeOu(F) {
  // ------------------------------------------------------------ chapter 1: what Europe refines
  $("#h-dependance").textContent =
    `L'Europe raffine ${onTen(F.refineryShare)} tonnes de kérosène qu'elle livre`;
  $("#dependance-prose").replaceChildren(
    p([
      `En 2025, les raffineries de l'Union ont produit `,
      { b: tonnes(F.refinery) },
      ` de kérosène. Les livraisons, aux aéroports surtout, ont atteint ${tonnes(F.deliveries)}.`,
    ]),
  );
  $("#h-gap-fig").textContent = "Un écart que les raffineries ne comblent pas";
  $("#gap-note").textContent =
    `Kérosène produit par les raffineries de l'Union et kérosène livré dans l'Union, chaque mois depuis ${F.first.slice(0, 4)}, en millions de tonnes.`;
  lecture(
    "#chart-gap",
    "la zone colorée est ce qui est livré en plus de ce que l'Europe raffine : il vient d'importations ou des stocks. Le creux de 2020 est celui du Covid.",
  );
  $("#dependance-after").replaceChildren(
    p([
      `Le reste s'achète ailleurs. En 2025, l'Union a importé `,
      { b: tonnes(F.tot25 * 12) },
      " de kérosène depuis l'extérieur de ses frontières.",
    ]),
    p([
      "Ses pays en revendent aussi une partie, et s'en échangent entre eux : un chargement arrivé à Rotterdam peut finir dans un avion à Francfort. L'enquête ne compte que ce qui entre dans l'Union, une seule fois.",
    ]),
  );
  $("#dependance-aside").replaceChildren(
    rich([
      "Les postes du bilan d'Eurostat (production, importations, exportations, stocks) ne s'additionnent pas au kilo près : une part du kérosène vient de transferts entre produits pétroliers, et les pays ne déclarent pas tous de la même façon. L'enquête ne les additionne donc jamais ; elle compare ce que produisent les raffineries à ce qui est livré, et suit les importations par pays d'origine.",
    ]),
  );

  // ------------------------------------------------------------ chapter 2: the suppliers of 2025
  const [s1, s2, s3] = F.partners25;
  $("#h-fournisseurs").textContent = `En 2025, la moitié venait du Golfe`;
  $("#fournisseurs-prose").replaceChildren(
    p([
      `Sur ce que l'Union a importé de l'extérieur en 2025, les pays du Golfe ont fourni `,
      { b: pc(F.golfe25) },
      ".",
    ]),
  );
  $("#h-map25-fig").textContent = `${cap(le(s1))}, premier fournisseur de l'Europe`;
  $("#map25-note").textContent =
    `Kérosène importé par les pays de l'Union depuis l'extérieur en 2025, par pays d'origine, en milliers de tonnes par mois.`;
  lecture(
    "#chart-map25",
    "chaque flèche part d'un pays fournisseur ; son épaisseur dit les tonnes livrées chaque mois. En magenta, les pays du Golfe.",
  );
  $("#fournisseurs-after").replaceChildren(
    p([
      `${cap(le(s1))} pèse à lui seul `,
      { b: pc(s1.y25) },
      ` des importations. Viennent ensuite ${le(s2)}, ${pc(s2.y25)}, et ${le(s3)}, ${pc(s3.y25)}.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 3: ten years
  $("#h-histoire").textContent =
    `Depuis ${F.golfeYears[0].year}, entre ${pc(F.gMin.share)} et ${pc(F.gMax.share)} venaient du Golfe`;
  $("#histoire-prose").replaceChildren(
    p([
      `Chaque année depuis ${F.golfeYears[0].year}, les pays du Golfe ont fourni entre ${pc(F.gMin.share)} et `,
      { b: pc(F.gMax.share) },
      " du kérosène importé par l'Union.",
    ]),
  );
  $("#h-stream-fig").textContent = "Dix ans de fournisseurs, et une rupture";
  $("#stream-note").textContent =
    `Part de chaque région d'origine dans le kérosène importé par l'Union depuis l'extérieur, chaque mois de ${F.first.slice(0, 4)} à ${F.last.slice(0, 4)}, moyenne sur trois mois, en %.`;
  lecture(
    "#chart-stream",
    "chaque bande est une région d'origine ; son épaisseur, sa part des importations du mois. Les traits marquent l'embargo sur les produits pétroliers russes et la fermeture d'Ormuz.",
  );
  $("#histoire-after").replaceChildren(
    p([
      `La Russie n'a jamais pesé lourd : `,
      { b: pc(F.russia19, 1) },
      ` en 2019, ${pc(F.russia23, 1)} en 2023, l'année de l'embargo européen sur ses produits pétroliers.`,
    ]),
    p([
      `Les parts bougent d'une année à l'autre : ${pc(F.gMin.share)} en ${F.gMin.year}, ${pc(F.gMax.share)} en ${F.gMax.year}. Jamais aussi vite qu'en 2026.`,
    ]),
  );
}

export function writeOrmuz(F) {
  // ------------------------------------------------------------ chapter 4: month by month
  $("#h-ormuz").textContent = F.kwZero ? `Le Koweït à zéro en ${monthLabel(F.kwZero)}` : "Le Golfe s'efface";
  $("#ormuz-prose").replaceChildren(
    p([
      `Le détroit d'Ormuz est fermé au trafic commercial depuis le 28 février 2026. En ${spanLabel(F.after)}, les pays du Golfe ne fournissent plus que `,
      { b: pc(F.groups.golfe.after) },
      ` du kérosène importé par l'Union, contre ${pc(F.groups.golfe.before)} un an plus tôt.`,
    ]),
  );
  $("#h-heat-fig").textContent = "Les fournisseurs du Golfe s'éteignent, d'autres s'allument";
  $("#heat-note").textContent =
    `Kérosène importé par les pays de l'Union depuis chacun de leurs principaux fournisseurs, chaque mois de 2025 à ${monthLabel(F.last)}, en milliers de tonnes.`;
  lecture(
    "#chart-heat",
    "chaque ligne est un pays fournisseur, chaque case un mois ; plus la case est foncée, plus il a livré. Le trait marque la fermeture du détroit.",
  );
  $("#ormuz-after").replaceChildren(
    p([
      `Les livraisons de mars sont encore celles de cargaisons parties avant la fermeture. C'est pourquoi l'enquête compare les mois d'avril à ${monthLabel(F.after[1]).split(" ")[0]}, d'une année sur l'autre.`,
    ]),
    p([
      `Au total, l'Union a importé `,
      { b: pc(-F.totChange) },
      ` de kérosène en moins sur ces mois : ${tonnes(F.totA)} par mois, contre ${tonnes(F.totB)}.`,
    ]),
  );

  // ------------------------------------------------------------ chapter 5: who took over
  const [a1, a2] = F.byAfter;
  $("#h-relais").textContent = `${cap(le(a1))} et ${le(a2)} prennent le relais`;
  $("#relais-prose").replaceChildren(
    p([
      `En ${spanLabel(F.after)}, ${le(a1)} ${a1.key === "US" ? "fournissent" : "fournit"} `,
      { b: pc(a1.after) },
      ` du kérosène importé par l'Union, contre ${pc(a1.before)} un an plus tôt.`,
    ]),
  );
  $("#h-shift-fig").textContent = "Le Golfe et l'Inde reculent, l'Atlantique avance";
  $("#shift-note").textContent =
    `Part de chaque région d'origine dans le kérosène importé par l'Union depuis l'extérieur, ${spanLabel(F.before)} et ${spanLabel(F.after)}, en %.`;
  lecture(
    "#chart-shift",
    "le rond vide est la part un an plus tôt, le rond plein la part après la fermeture d'Ormuz ; le chiffre est la part après.",
  );
  $("#relais-after").replaceChildren(
    p([
      `${cap(le(a2))} ${a2.key === "US" ? "passent" : "passe"} de ${pc(a2.before)} à `,
      { b: pc(a2.after) },
      `.`,
    ]),
    p([
      `L'Inde recule aussi : ${pc(F.groups.inde.before)} des importations avant, ${pc(F.groups.inde.after)} après. Eurostat compte des tonnes et des origines, pas les raisons des acheteurs.`,
    ]),
  );
}

export function writePrix(F, minute) {
  // ------------------------------------------------------------ chapter 6: the price
  $("#h-prix").textContent = `La tonne de kérosène ${pc(F.eurA / F.eurB - 1)} plus chère à la frontière`;
  $("#prix-prose").replaceChildren(
    p([
      `Les douanes de l'Union enregistrent les tonnes et les euros de chaque cargaison. En ${spanLabel(F.after)}, une tonne de kérosène importée coûtait en moyenne `,
      { b: `${n0(F.eurA)} €` },
      `, contre ${n0(F.eurB)} € un an plus tôt.`,
    ]),
  );
  $("#h-price-fig").textContent = "Le kérosène a doublé, le pétrole brut moins";
  $("#price-note").textContent =
    `Prix au comptant du kérosène aviation (côte américaine du golfe du Mexique) et du pétrole brut de la mer du Nord (Brent), moyenne de chaque mois, base 100 = janvier-février 2026, jusqu'au ${F.jetLastDate.split("-").reverse().join("/")}.`;
  lecture(
    "#chart-price",
    "à 200, le prix a doublé depuis janvier-février 2026. Ce sont des prix américains, en dollars, faute de prix européen public.",
  );
  $("#prix-after").replaceChildren(
    p([
      `Le kérosène américain coûtait ${fmtNum(F.jetPre, 2)} $ le gallon en janvier-février 2026, et `,
      { b: `${fmtNum(F.jetLast, 2)} $` },
      ` le ${F.jetLastDate.split("-").reverse().join("/")}. Le Brent est passé de ${n0(F.brentPre)} à ${n0(F.brentLast)} $ le baril.`,
    ]),
    minute
      ? p([
          `Pour un avion de ligne en croisière, une minute de vol brûle environ ${n0(minute.kg)} kg de kérosène : `,
          { b: `${n0(minute.after)} €` },
          ` au prix de ${spanLabel(F.after)}, contre ${n0(minute.before)} € un an plus tôt.`,
        ])
      : null,
  );
  $("#prix-aside").replaceChildren(
    rich([
      "Le prix des douanes est une valeur moyenne : la valeur déclarée des cargaisons divisée par leur poids, tous fournisseurs confondus. Il suit les contrats d'achat, avec un décalage sur le marché au comptant. La minute de vol vient de l'enquête sur le courant-jet : le kérosène d'un long-courrier moyen selon la DGAC, ramené à une minute de croisière.",
    ]),
  );

  // ------------------------------------------------------------ chapter 7: country by country
  const c = F.countries;
  const fr = c.FR;
  const sh = (x, k) => (x[k].total ? x[k].golfe / x[k].total : 0);
  $("#h-pays").textContent = `La France tirait ${pc(sh(fr, "before"))} de ses importations du Golfe`;
  $("#pays-prose").replaceChildren(
    p([
      `Avant la fermeture d'Ormuz, la France achetait au Golfe `,
      { b: pc(sh(fr, "before")) },
      ` du kérosène qu'elle importait hors de l'Union. En ${spanLabel(F.after)}, ${pc(sh(fr, "after"))}.`,
    ]),
  );
  $("#h-grids-fig").textContent = "Chaque pays a ses fournisseurs";
  $("#grids-note").textContent =
    `Origine du kérosène importé hors de l'Union par cinq pays, ${spanLabel(F.before)} et ${spanLabel(F.after)}, cent cases pour cent pour cent.`;
  lecture(
    "#chart-grids",
    "chaque grille compte cent cases ; chaque couleur est une région d'origine, en magenta le Golfe.",
  );
  const others = ["NL", "ES", "IT", "BE"].map((k) => ({ k, label: c[k].label, b: sh(c[k], "before") }));
  const hi = others.reduce((a, b) => (b.b > a.b ? b : a));
  const lo = others.reduce((a, b) => (b.b < a.b ? b : a));
  $("#pays-after").replaceChildren(
    p([
      `Parmi ses voisins, ${hi.label === "Pays-Bas" ? "les Pays-Bas" : hi.label === "Italie" ? "l'Italie" : hi.label === "Espagne" ? "l'Espagne" : "la Belgique"} dépendaient le plus du Golfe, ${pc(hi.b)}, ${lo.label === "Pays-Bas" ? "les Pays-Bas" : lo.label === "Italie" ? "l'Italie" : lo.label === "Espagne" ? "l'Espagne" : "la Belgique"} le moins, `,
      { b: pc(lo.b) },
      ".",
    ]),
    p([
      "L'Allemagne importe très peu de kérosène directement hors de l'Union : l'essentiel de ce qu'elle reçoit lui vient d'autres pays membres. Elle n'apparaît donc pas ici.",
    ]),
  );
}

export function writeReponse(F, minute) {
  const [a1, a2] = F.byAfter;
  $("#reponse-prose").replaceChildren(
    p([
      `L'Europe raffine ${onTen(F.refineryShare)} tonnes de kérosène qu'elle livre, et achète le reste ailleurs. Jusqu'en février 2026, la moitié de ses importations venait des pays du Golfe, `,
      { b: pc(F.golfe25) },
      " en 2025.",
    ]),
    p([
      `Depuis la fermeture du détroit d'Ormuz, le Golfe n'en fournit plus que ${pc(F.groups.golfe.after)}. ${cap(le(a1))} et ${le(a2)} ont pris le relais, et l'Union importe `,
      { b: pc(-F.totChange) },
      " de moins.",
    ]),
    p([
      `La tonne coûte ${pc(F.eurA / F.eurB - 1)} de plus à la frontière${minute ? ` : une minute de croisière, environ ${n0(minute.after)} € de kérosène, contre ${n0(minute.before)} €` : ""}. Les données disent d'où vient le kérosène, pas pourquoi les acheteurs ont choisi leurs fournisseurs.`,
    ]),
  );
}

export function writeSources(K, F) {
  const li = (parts) => el("li", {}, parts);
  $("#sources-body").replaceChildren(
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(KSOURCES.imports, KSOURCES.imports.label),
        `, kérosène type carburéacteur (code SIEC O4661), en milliers de tonnes, de ${monthLabel(F.first)} à ${monthLabel(F.last)}, pour l'Union et ses principaux importateurs.`,
      ]),
      li([
        link(KSOURCES.balance, KSOURCES.balance.label),
        " : production des raffineries, importations, exportations, variation de stocks, livraisons.",
      ]),
      li([
        link(KSOURCES.comext, KSOURCES.comext.label),
        `, tonnes et valeur en euros par pays d'origine, jusqu'en ${monthLabel(K.comext.months.at(-1))}.`,
      ]),
      li([
        link(KSOURCES.eia, KSOURCES.eia.label),
        `, prix quotidiens jusqu'au ${F.jetLastDate.split("-").reverse().join("/")}, domaine public.`,
      ]),
      li([link(KSOURCES.naturalearth, KSOURCES.naturalearth.label), " : les contours des cartes."]),
    ]),
    el("h3", { text: "Les définitions" }),
    el("ul", {}, [
      li([
        "Importations : celles venues d'un pays hors de l'Union, déclarées par chaque pays membre, additionnées. Un chargement revendu d'un pays membre à un autre n'est compté qu'à son entrée dans l'Union.",
      ]),
      li([
        `Avant et après : ${spanLabel(F.before)} contre ${spanLabel(F.after)}, les mêmes mois d'une année sur l'autre, pour que les saisons ne pèsent pas. Mars 2026 est écarté : des cargaisons chargées avant la fermeture du détroit y arrivent encore.`,
      ]),
      li([
        `Régions d'origine : pays du Golfe (Koweït, Arabie saoudite, Émirats arabes unis, Bahreïn, Qatar, Oman, Irak, Iran), Inde, Asie de l'Est (Corée du Sud, Chine, Japon, Singapour, Taïwan, Malaisie, Thaïlande, Indonésie), Amériques, Afrique, Europe hors Union (dont le Royaume-Uni, la Norvège et la Turquie), Russie, autres. Oman, les Émirats et l'Arabie saoudite ont aussi des ports hors du détroit d'Ormuz.`,
      ]),
      li([
        "Prix à la frontière : valeur déclarée en douane divisée par le poids, moyenne pondérée de tous les fournisseurs hors de l'Union.",
      ]),
      li([
        "Minute de croisière : le kérosène d'un long-courrier moyen selon la DGAC, ramené à une minute de vol sans vent (enquête sur le courant-jet), multiplié par le prix à la frontière.",
      ]),
    ]),
    el("h3", { text: "Les faits extérieurs aux données" }),
    el("ul", {}, [
      li([
        `${FACTS.hormuz.text} (`,
        el("a", { href: FACTS.hormuz.url, target: "_blank", rel: "noopener", text: FACTS.hormuz.source }),
        ").",
      ]),
      li([
        `${FACTS.russia.text} (`,
        el("a", { href: FACTS.russia.url, target: "_blank", rel: "noopener", text: FACTS.russia.source }),
        ").",
      ]),
    ]),
    el("h3", { text: "Ce que cette enquête ne dit pas" }),
    el("ul", {}, [
      li([
        "Pourquoi les acheteurs ont changé de fournisseurs. Eurostat compte des tonnes et des origines ; les prix, les contrats, l'assurance des navires et les routes maritimes jouent, mais les données ne les séparent pas.",
      ]),
      li([
        "D'où vient le pétrole brut raffiné en Europe. L'enquête suit le kérosène déjà raffiné ; le brut des raffineries européennes a ses propres fournisseurs.",
      ]),
      li([
        "Le prix payé par chaque compagnie. Il dépend de ses contrats et de ses couvertures ; le prix des douanes est une moyenne à l'entrée de l'Union.",
      ]),
    ]),
    el("p", {}, [
      "Toutes les sources du magazine, leurs conditions et les fichiers publiés : ",
      el("a", { href: "../donnees?enquete=kero", text: "la page des données" }),
      ".",
    ]),
  );
}
