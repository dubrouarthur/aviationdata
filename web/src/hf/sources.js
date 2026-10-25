// Sources of the human-factor story: the NTSB database, and the dated references of the risk models
// the story reads it with. Used for the line under each figure (data-hsource) and the method section.
import { $, el } from "../lib/ui.js";
import { fmtNum } from "../lib/format.js";
import { CASES } from "./cases.js";

export const HSOURCES = {
  ntsb: {
    short: "NTSB",
    label: "NTSB, base des accidents d'aviation (avall.mdb, depuis 2008), domaine public",
    url: "https://data.ntsb.gov/avdata",
  },
  ntsbold: {
    short: "NTSB (base 1982-2007)",
    label: "NTSB, base des accidents d'aviation de 1982 à 2007 (Pre2008.mdb) et son manuel de codage",
    url: "https://data.ntsb.gov/avdata",
  },
  heinrich: {
    short: "Heinrich (1931)",
    label: "Herbert W. Heinrich, Industrial Accident Prevention, A Scientific Approach, 1931",
    url: "https://en.wikipedia.org/wiki/Herbert_William_Heinrich",
  },
  hfacs: {
    short: "HFACS (Shappell et Wiegmann, 2000)",
    label:
      "Scott A. Shappell et Douglas A. Wiegmann, The Human Factors Analysis and Classification System (HFACS), FAA, rapport DOT/FAA/AM-00/7, février 2000",
    url: "https://www.faa.gov/data_research/research/med_humanfacs/oamtechreports/2000s/2000/0007",
  },
  reason: {
    short: "Reason (1990)",
    label: "James Reason, Human Error, Cambridge University Press, 1990",
    url: "https://en.wikipedia.org/wiki/Swiss_cheese_model",
  },
  tem: {
    short: "TEM (SKYbrary)",
    label: "Threat and Error Management (TEM), SKYbrary",
    url: "https://skybrary.aero/index.php/TEM",
  },
};

/** "Source : ..." under every element carrying data-hsource="ntsb reason". */
export function addSourceLines(root = document) {
  for (const node of root.querySelectorAll("[data-hsource]")) {
    if (node.querySelector(":scope > .source-line")) continue;
    const keys = node.dataset.hsource.split(/\s+/).filter((k) => HSOURCES[k]);
    const links = [];
    keys.forEach((k, i) => {
      if (i) links.push(i === keys.length - 1 ? " et " : ", ");
      links.push(
        el("a", { href: HSOURCES[k].url, target: "_blank", rel: "noopener", text: HSOURCES[k].short }),
      );
    });
    node.append(
      el("div", { class: "source-line" }, el("p", {}, ["Source : ", ...links, ". Calculs aviationdata."])),
    );
  }
}

/** References from outside the data: dated, sourced. */
export const FACTS = {
  cfr: {
    text: "Un accident d'aviation est un événement lié à l'exploitation d'un aéronef, entre l'embarquement et le débarquement, au cours duquel une personne est tuée ou gravement blessée, ou l'aéronef subit des dommages importants (49 CFR 830.2, réglementation fédérale américaine).",
    source: "U.S. Government Publishing Office, Code of Federal Regulations, titre 49, section 830.2",
    url: "https://www.govinfo.gov/content/pkg/CFR-2019-title49-vol7/pdf/CFR-2019-title49-vol7-sec830-2.pdf",
  },
  heinrich: {
    text: "Herbert W. Heinrich, Industrial Accident Prevention, A Scientific Approach (1931) : pour un accident causant une blessure grave, 29 accidents à blessures légères et 300 sans blessure ; 88 % des accidents dus à l'homme. Ses dossiers de recherche n'existent plus et ces ratios n'ont jamais pu être vérifiés (Manuele, 2002).",
    source: "Wikipédia, « Herbert William Heinrich »",
    url: "https://en.wikipedia.org/wiki/Herbert_William_Heinrich",
  },
  shell: {
    text: "Le modèle SHEL, proposé par Edwards en 1972 et illustré sous sa forme SHELL par Hawkins en 1975, décrit les relations entre l'humain (Liveware) et les procédures (Software), la machine (Hardware), l'environnement (Environment) et les autres humains.",
    source: "SKYbrary, « ICAO SHELL Model »",
    url: "https://skybrary.aero/articles/icao-shell-model",
  },
  reason: {
    text: "James Reason, université de Manchester : The Contribution of Latent Human Failures to the Breakdown of Complex Systems, Philosophical Transactions of the Royal Society B, avril 1990, et Human Error, Cambridge University Press, 1990. Les défaillances actives sont les actes dangereux liés directement à l'accident ; les défaillances latentes peuvent rester en sommeil des jours, des semaines ou des mois.",
    source: "Wikipédia, « Swiss cheese model »",
    url: "https://en.wikipedia.org/wiki/Swiss_cheese_model",
  },
  hfacs: {
    text: "Shappell et Wiegmann, The Human Factors Analysis and Classification System (HFACS), FAA, février 2000 : « Human error has been implicated in 70 to 80% of all civil and military aviation accidents. »",
    source: "FAA, Office of Aerospace Medicine, rapport DOT/FAA/AM-00/7",
    url: "https://www.faa.gov/data_research/research/med_humanfacs/oamtechreports/2000s/2000/0007",
  },
  tem: {
    text: "Le modèle TEM distingue les menaces (événements hors de l'influence de l'équipage), les erreurs (actions ou omissions de l'équipage) et les états indésirables (situations qui réduisent les marges de sécurité). Il vient des audits de vols de ligne (LOSA) nés en 1994 d'un partenariat entre l'université du Texas et Delta Air Lines ; le premier audit complet fondé sur TEM a eu lieu chez Continental Airlines en 1996.",
    source: "SKYbrary, « Threat and Error Management (TEM) »",
    url: "https://skybrary.aero/index.php/TEM",
  },
  dekker: {
    text: "Sidney Dekker, The Field Guide to Understanding 'Human Error', 3e édition, CRC Press (Routledge), 2014 : la vision qui blâme les individus suppose que le système est sûr, à quelques personnes peu fiables près.",
    source: "Routledge",
    url: "https://www.routledge.com/The-Field-Guide-to-Understanding-Human-Error-3rd-Edition/Dekker/p/book/9781472439055",
  },
};

const link = (s) => el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.label || s.source });

export function initSources({ accidents: acc, meta, history }) {
  const li = (children) => el("li", {}, children);
  const comp = acc.completeness;
  const after = comp.filter(([y]) => y > acc.period[1]);
  const p = acc.period;
  $("#sources-body").replaceChildren(
    el("p", {}, [
      "Toutes les données de cette enquête sont publiques. Les chiffres du texte sont calculés à partir d'elles par le code publié sur ",
      el("a", {
        href: "https://github.com/dubrouarthur/aviationdata",
        target: "_blank",
        rel: "noopener",
        text: "GitHub",
      }),
      ", et un script vérifie chaque nombre cité avant publication.",
    ]),
    el("h3", { text: "Les données" }),
    el("ul", {}, [
      li([
        link(HSOURCES.ntsb),
        `. Fichier mis à jour le ${meta.release}. Accidents (et non incidents) survenus aux États-Unis de ${p[0]} à ${p[1]} : ${fmtNum(meta.accidents)} accidents dont l'enquête est close par une cause probable.`,
      ]),
      li([
        link(HSOURCES.ntsbold),
        `. Accidents survenus aux États-Unis de ${history.old[0][0]} à ${history.old.at(-1)[0]}, causes et facteurs codés selon l'ancienne grille.`,
      ]),
    ]),
    el("h3", { text: "La méthode" }),
    el("ul", {}, [
      li([
        "Ce qui compte comme cité : un constat retenu dans la cause probable, comme cause ou comme facteur contributif. Depuis 2021, la base ne distingue plus les deux : elle signale seulement les constats retenus dans la cause probable. Pour comparer les années, l'enquête compte donc partout causes et facteurs.",
      ]),
      li([
        "Les familles : une personne (catégorie « Personnel issues » du NTSB, qui nomme la personne : pilote, mécanicien, contrôleur, passager...) ; l'environnement (« Environmental issues » : météo, relief, faune, lumière, infrastructures) ; l'organisation (« Organizational issues ») ; dans la catégorie « Aircraft », une panne ou un défaut (rupture, dysfonctionnement, usure, corrosion, conception, élément hors service), un appareil mal utilisé ou mal entretenu (mauvaise utilisation, entretien ou inspection, carburant épuisé, mal géré ou inadapté) et les états indésirables (paramètre de vol non atteint ou non maintenu).",
      ]),
      li([
        `Les années récentes : une enquête peut durer plus d'un an. La période s'arrête en ${p[1]}, dernière année où au moins 90 % des accidents, et des accidents mortels, ont une cause probable. Au-delà : ${after
          .map(
            ([y, n, pc, f, fpc]) =>
              `${y}, ${fmtNum(pc)} accidents sur ${fmtNum(n)} et ${fmtNum(fpc)} accidents mortels sur ${fmtNum(f)}`,
          )
          .join(" ; ")}.`,
      ]),
      li([
        "Le type de vol est celui du premier aéronef impliqué : aviation générale (partie 91 de la réglementation américaine, dont l'aviation d'affaires et les ULM), taxi aérien et vols à la demande (partie 135), compagnies aériennes (partie 121), travail aérien (épandage, partie 137, et charges externes, partie 133). La gravité est celle de la blessure la plus grave, à bord ou au sol.",
      ]),
      li([
        "Avant 2008 : une cause ou un facteur désigne une personne quand il porte un code de personne (pilote, mécanicien, contrôleur...), une panne de l'appareil quand il porte sur un élément de l'appareil, sans personne, avec un mode de défaillance (rupture, usure, fatigue, fuite, grippage...). Les deux grilles ne donnent pas les mêmes niveaux : les courbes ne se raccordent pas en 2008.",
      ]),
      li([
        "HFACS : les constats du NTSB sur les personnes et les organisations sont rapprochés des familles de HFACS par l'auteur (contrôle de l'appareil, gestes, attention : erreurs d'exécution ; jugement, préparation, choix d'action : erreurs de décision ; désorientation, illusions : erreurs de perception ; état physique ou mental, expérience, communication : conditions préalables ; encadrement et surveillance : supervision ; gestion, procédures, conception : organisation). Le NTSB ne code pas les violations en tant que telles.",
      ]),
      li([
        "TEM : une menace est un constat d'environnement ou de panne, une erreur un constat sur une personne, un état indésirable un paramètre de vol non maintenu. Fromage suisse : quatre couches, une personne, l'appareil (panne), l'environnement, l'organisation.",
      ]),
      li([
        "Événement déterminant : celui que le NTSB désigne comme tel dans la séquence des événements de chaque accident (champ Defining_ev).",
      ]),
      li([
        "Ce que ces chiffres ne disent pas : la cause probable dit ce que les enquêteurs retiennent, pas tout ce qui a joué. Les accidents ne sont pas rapportés au nombre de vols, qui n'est pas connu pour l'aviation générale : ces parts comparent des causes, pas des risques.",
      ]),
      li([
        "Le type d'enquête : la cinquième lettre du numéro de dossier du NTSB, selon le dictionnaire des données de la base (M pour une enquête majeure, F régionale, L limitée ; les autres lettres sont regroupées).",
      ]),
      li([
        "Les six accidents : tous les constats que le NTSB a codés pour chacun, avec leur statut (cause, facteur contributif, ou relevé hors de la cause probable) et la personne qu'ils désignent. Leur traduction et leur place dans le schéma sont celles de l'auteur : organisation et autorités (constats sur l'organisation), conditions préalables et actes (constats sur les personnes, selon la famille HFACS), appareil, environnement. Un constat indéterminé n'est pas dessiné.",
      ]),
    ]),
    el("h3", { text: "Les six accidents" }),
    el(
      "ul",
      {},
      Object.values(CASES).map((c) =>
        li([
          `${c.name}, ${c.when} : `,
          link({ label: c.report.label, url: c.report.url }),
          ...c.followed.flatMap((x) => [" ; ", link({ label: x.source, url: x.url })]),
          ...(c.extra ? [" ; ", link({ label: c.extra.text, url: c.extra.url })] : []),
          ".",
        ]),
      ),
    ),
    el("h3", { text: "Les modèles et les faits extérieurs aux données" }),
    el(
      "ul",
      {},
      Object.values(FACTS).map((f) => li([f.text, " Source : ", link(f), "."])),
    ),
    el("p", { class: "note", text: `Données traitées le ${meta.built}.` }),
  );
}
