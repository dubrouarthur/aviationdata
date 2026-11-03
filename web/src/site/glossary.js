// The words of the trade, explained where they first appear. The first occurrence of each term in the
// story's prose becomes a button; it opens a short definition in a single popover kept outside the text,
// so the prose (and every number the check scripts read in it) is unchanged. All the definitions of a
// story are also written out in its method box ("Les mots de l'enquête").
import { el } from "../lib/ui.js";

const S = "[\\s\\u00a0\\u202f]+"; // a space, as watchFrenchSpacing may have rewritten it
const rx = (words, flags = "i") => new RegExp(words.replace(/ /g, S), flags);

export const TERMS = {
  common: [],
  dgac: [
    {
      re: rx("DGAC", ""),
      t: "DGAC",
      d: "Direction générale de l'Aviation civile, l'administration française de l'aviation. Elle publie chaque mois le trafic de chaque aéroport, de chaque liaison et de chaque compagnie.",
    },
    {
      re: rx("passagers?-kilomètres?"),
      t: "Passager-kilomètre",
      d: "Un passager transporté sur un kilomètre. Dix passagers qui font 100 km comptent pour 1 000 passagers-kilomètres : la mesure tient compte de la distance.",
    },
    {
      re: rx("bas coûts?"),
      t: "Compagnie à bas coûts",
      d: "Compagnie qui vend moins cher en réduisant ses coûts : un seul type d'avion, peu de services compris dans le billet, des avions qui repartent vite.",
    },
    {
      re: rx("fret"),
      t: "Fret",
      d: "Les marchandises et le courrier transportés en avion, comptés en tonnes, dans la soute des avions de passagers ou dans des avions tout-cargo.",
    },
    {
      re: rx("taxe de solidarité|taxe sur les billets|TSBA"),
      t: "Taxe sur les billets",
      d: "La taxe de solidarité sur les billets d'avion (TSBA), payée sur chaque billet au départ de la France. Son montant a été relevé en mars 2025.",
    },
  ],
  jet: [
    {
      re: rx("courant-jet"),
      t: "Courant-jet",
      d: "Un couloir de vent très fort qui souffle d'ouest en est autour de la planète, vers 10 km d'altitude, là où volent les avions de ligne. Il forcit et descend vers le sud en hiver.",
    },
    {
      re: /FL\d{3}/,
      t: "Niveau de vol (FL)",
      d: "L'altitude des avions, en centaines de pieds. FL340 = 34 000 pieds, soit environ 10,4 km.",
    },
    {
      re: rx("ligne droite"),
      t: "Ligne droite",
      d: "Ici, le plus court chemin entre deux villes à la surface de la Terre (un arc de grand cercle). Sur une carte à plat, il paraît courbé.",
    },
    {
      re: rx("Mach"),
      t: "Mach",
      d: "La vitesse d'un avion rapportée à celle du son dans l'air qui l'entoure. Le son va moins vite dans l'air froid : à Mach égal, l'avion va moins vite en km/h là où l'air est plus froid.",
    },
    {
      re: rx("ERA5", ""),
      t: "ERA5",
      d: "La « réanalyse » du centre européen de prévision météorologique (ECMWF) : une reconstitution, heure par heure, du temps qu'il a fait partout sur la planète, calculée à partir de toutes les observations disponibles.",
    },
    {
      re: rx("hPa", ""),
      t: "Hectopascal (hPa)",
      d: "Unité de pression. Les météorologues repèrent l'altitude par la pression de l'air : 250 hPa, c'est environ 10 km d'altitude, le niveau du courant-jet.",
    },
    {
      re: rx("ballons?-sondes?"),
      t: "Ballon-sonde",
      d: "Un ballon lâché à heure fixe qui mesure, en montant, la pression, la température, l'humidité et le vent. Sa dérive donne la vitesse et la direction du vent à chaque altitude.",
    },
    {
      re: rx("OpenSky", ""),
      t: "OpenSky Network",
      d: "Un réseau de récepteurs au sol, tenu par des chercheurs et des bénévoles, qui capte les positions que les avions émettent eux-mêmes. On en tire la durée réelle de chaque vol.",
    },
    {
      re: rx("oscillation nord-atlantique"),
      t: "Oscillation nord-atlantique",
      d: "Le balancement de pression entre l'anticyclone des Açores et la dépression d'Islande. Plus l'écart est grand, plus les vents d'ouest sur l'Atlantique sont forts.",
    },
    {
      re: rx("Pangu-Weather", ""),
      t: "Pangu-Weather",
      d: "Un modèle de prévision météorologique par intelligence artificielle, publié par Huawei en 2023 et entraîné sur ERA5.",
    },
  ],
  hf: [
    {
      re: rx("cause probable"),
      t: "Cause probable",
      d: "La conclusion officielle d'une enquête du NTSB : ce qui, selon les enquêteurs, a le plus probablement provoqué l'accident, et les facteurs qui y ont contribué.",
    },
    {
      re: rx("NTSB", ""),
      t: "NTSB",
      d: "National Transportation Safety Board, l'agence fédérale américaine indépendante qui enquête sur les accidents de transport, dont tous les accidents d'aviation civile survenus aux États-Unis.",
    },
    {
      re: rx("facteur humain"),
      t: "Facteur humain",
      d: "Tout ce qui, dans un accident, tient aux personnes : leurs gestes, leurs décisions, leur fatigue, leur formation, et les conditions de travail que leur organisation leur donne.",
    },
    {
      re: rx("aviation générale"),
      t: "Aviation générale",
      d: "Les vols civils qui ne sont ni des vols de ligne ni du transport à la demande : aéroclubs, vols privés, écoles de pilotage, voyages d'affaires en avion personnel.",
    },
    {
      re: rx("HFACS", ""),
      t: "HFACS",
      d: "Human Factors Analysis and Classification System : une grille née dans l'aviation militaire américaine, qui range les causes humaines sur quatre étages, de l'acte dangereux jusqu'à l'organisation.",
    },
    {
      re: rx("fromage suisse"),
      t: "Fromage suisse",
      d: "Le modèle de James Reason : chaque barrière de sécurité a des trous ; l'accident arrive quand les trous de plusieurs barrières s'alignent.",
    },
    {
      re: rx("TEM", ""),
      t: "TEM",
      d: "Threat and Error Management, la gestion des menaces et des erreurs : un vol se lit en trois temps, des menaces extérieures, des erreurs de l'équipage, puis un état indésirable de l'avion.",
    },
  ],
  eu: [
    {
      re: rx("Eurostat", ""),
      t: "Eurostat",
      d: "L'office statistique de l'Union européenne. Il publie, pays par pays et aéroport par aéroport, les chiffres que lui transmettent les États.",
    },
    {
      re: rx("passagers transportés"),
      t: "Passagers transportés",
      d: "Un passager compte une fois par vol. Celui qui reste à bord pendant une escale n'est pas recompté.",
    },
    {
      re: rx("centre de gravité"),
      t: "Centre de gravité",
      d: "Le point moyen de tous les aéroports, chacun pesant autant que ses passagers : là où l'Europe aérienne tiendrait en équilibre.",
    },
    {
      re: rx("AELE", ""),
      t: "AELE",
      d: "L'Association européenne de libre-échange : Norvège, Suisse, Islande et Liechtenstein, hors de l'Union mais liés à elle.",
    },
    {
      re: rx("45e parallèle"),
      t: "45e parallèle",
      d: "La ligne à mi-chemin entre l'équateur et le pôle Nord. En France, elle passe juste au nord de Bordeaux et de Valence.",
    },
  ],
  sea: [
    {
      re: rx("Eurostat", ""),
      t: "Eurostat",
      d: "L'office statistique de l'Union européenne. Il publie, pays par pays et mois par mois, les chiffres que lui transmettent les États.",
    },
    {
      re: rx("écart saisonnier"),
      t: "Écart saisonnier",
      d: "Les passagers par jour du mois le plus chargé, divisés par ceux du mois le plus creux. ×2 : deux fois plus de monde au pic qu'au creux.",
    },
    {
      re: rx("par jour"),
      t: "Passagers par jour",
      d: "Les passagers d'un mois divisés par son nombre de jours, pour qu'un mois de 31 jours ne paraisse pas plus chargé qu'un mois de 28.",
    },
  ],
  billet: [
    {
      re: rx("DGAC", ""),
      t: "DGAC",
      d: "Direction générale de l'Aviation civile, l'administration française de l'aviation. Elle publie chaque mois un indice du prix des billets d'avion au départ de France.",
    },
    {
      re: rx("indice"),
      t: "Indice",
      d: "Un prix ramené à 100 une année de référence. À 130, ce qui coûtait 100 euros l'année de référence en coûte 130 : l'indice dit de combien les prix ont bougé, pas combien coûte un billet.",
    },
    {
      re: rx("inflation"),
      t: "Inflation",
      d: "La hausse de l'ensemble des prix payés par les ménages : alimentation, logement, énergie, transports, loisirs. Un prix qui monte autant que l'inflation ne pèse pas plus lourd dans le budget.",
    },
    {
      re: rx("long-courriers?"),
      t: "Long-courrier",
      d: "Un vol vers une destination lointaine, au-delà de l'Europe, du Maghreb et du Proche-Orient : l'Amérique, l'Asie, l'Afrique subsaharienne.",
    },
    {
      re: rx("Eurostat", ""),
      t: "Eurostat",
      d: "L'office statistique de l'Union européenne. Il publie l'indice des prix à la consommation harmonisé, calculé de la même façon dans chaque pays.",
    },
  ],
  carbone: [
    {
      re: rx("DGAC", ""),
      t: "DGAC",
      d: "Direction générale de l'Aviation civile, l'administration française de l'aviation. Elle calcule chaque année le CO2 de tous les vols commerciaux de France.",
    },
    {
      re: rx("CO2", ""),
      t: "CO2",
      d: "Le dioxyde de carbone, gaz rejeté quand on brûle du kérosène : environ 3,16 kg de CO2 par kilo de carburant. C'est le principal gaz à effet de serre émis par les avions.",
    },
    {
      re: rx("long-courriers?"),
      t: "Long-courrier",
      d: "Pour la DGAC, un vol de plus de 4 h 30 : vers l'outre-mer, ou hors d'Europe et du bassin méditerranéen.",
    },
    {
      re: rx("trafic"),
      t: "Trafic",
      d: "Ici, le nombre de passagers multiplié par les kilomètres qu'ils parcourent : dix passagers sur 1 000 km font autant de trafic que cent sur 100 km.",
    },
    {
      re: rx("à vol d'oiseau"),
      t: "Distance à vol d'oiseau",
      d: "Le plus court chemin entre deux aéroports à la surface de la Terre. Un avion fait un peu plus, à cause des routes aériennes et du vent.",
    },
  ],
};

let pop;
let owner;

function close() {
  if (!owner) return;
  owner.setAttribute("aria-expanded", "false");
  owner = null;
  pop.hidden = true;
}

function open(btn, term) {
  if (owner === btn) return close();
  close();
  owner = btn;
  btn.setAttribute("aria-expanded", "true");
  pop.replaceChildren(el("b", { text: term.t }), el("span", { text: term.d }));
  pop.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = Math.min(360, document.documentElement.clientWidth - 32);
  const x = Math.max(16, Math.min(r.left, document.documentElement.clientWidth - 16 - w));
  pop.style.width = `${w}px`;
  pop.style.left = `${x + scrollX}px`;
  pop.style.top = `${r.bottom + scrollY + 8}px`;
}

function setupPop() {
  if (pop) return;
  pop = el("div", { class: "gloss-pop", id: "gloss-pop", role: "note", "aria-live": "polite", hidden: true });
  document.body.append(pop);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && owner) {
      const b = owner;
      close();
      b.focus();
    }
  });
  addEventListener("click", (e) => {
    if (owner && !e.target.closest(".gloss, .gloss-pop")) close();
  });
  addEventListener("resize", close);
}

/** Wrap the first occurrence of each term in the prose; returns the terms found. */
export function glossary(key, root = document.querySelector("main")) {
  const terms = [...TERMS.common, ...(TERMS[key] ?? [])];
  if (!root || !terms.length) return [];
  setupPop();
  const zones = root.querySelectorAll(".open-dek, .hero .lede, .prose, .chapter-lede > p, .part-dek");
  const todo = new Set(terms);
  const found = [];
  for (const zone of zones) {
    const walk = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest("a, button, b, strong, figure, .note, .gloss, .story-aside")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    for (let node of nodes) {
      let again = true;
      while (again && todo.size) {
        again = false;
        for (const term of todo) {
          const m = term.re.exec(node.nodeValue);
          if (!m) continue;
          // the term must be a whole word
          const before = node.nodeValue[m.index - 1] ?? " ";
          const after = node.nodeValue[m.index + m[0].length] ?? " ";
          if (/[\p{L}\d-]/u.test(before) || /[\p{L}\d]/u.test(after)) continue;
          const word = node.splitText(m.index);
          const rest = word.splitText(m[0].length);
          const btn = el("button", {
            type: "button",
            class: "gloss",
            "aria-expanded": "false",
            "aria-controls": "gloss-pop",
          });
          word.replaceWith(btn);
          btn.append(word);
          btn.addEventListener("click", () => open(btn, term));
          todo.delete(term);
          found.push(term);
          node = rest;
          again = true;
          break;
        }
      }
      if (!todo.size) break;
    }
    if (!todo.size) break;
  }
  return found;
}

/** All the terms of a story, as a definition list (for the method box). */
export function glossaryList(key) {
  const terms = [...TERMS.common, ...(TERMS[key] ?? [])];
  return el(
    "dl",
    { class: "gloss-list" },
    terms.flatMap((t) => [el("dt", { text: t.t }), el("dd", { text: t.d })]),
  );
}

/** The story's glossary, its full list in the method box, and one line under the byline on how to use it. */
export function storyGuide() {
  const how = document.getElementById("comment");
  const key = how?.dataset.gloss;
  if (!key) return;
  const box = document.getElementById("how-words");
  if (box && !box.firstChild) box.append(glossaryList(key));
  const found = glossary(key);
  const by = document.querySelector("main .article-meta");
  if (found.length && by && !document.querySelector(".read-guide"))
    by.after(
      el("p", { class: "read-guide" }, [
        "Les mots soulignés en pointillés s'expliquent d'un clic. ",
        el("a", { href: "#comment", text: "Comment nous avons fait" }),
        document.body.classList.contains("court") ? ", en fin d'article." : ", en fin d'enquête.",
      ]),
    );
}
