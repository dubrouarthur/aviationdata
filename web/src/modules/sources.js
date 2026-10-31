import { $, el } from "../lib/ui.js";
import { DATASETS } from "../lib/datasets.js";

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "date inconnue";

/** Facts from outside the DGAC data: dated, sourced, never given as the cause of a curve. */
export const FACTS = {
  tsba2025: {
    text: "Hausse de la taxe de solidarité sur les billets d'avion (TSBA) au 1er mars 2025, en application de l'article 30 de la loi de finances pour 2025 : de 2,63 € à 7,40 € par passager en classe économique pour un vol intérieur ou européen (×2,8).",
    source: "Wikipédia, « Solidarity tax on airplane tickets » (barèmes 2020 et 2025)",
    url: "https://en.wikipedia.org/wiki/Solidarity_tax_on_airplane_tickets",
  },
  tsba2026: {
    text: "Au 1er juin 2026, la TSBA revient de 7,40 € à 2,63 € par passager sur 26 liaisons de service public : 23 intérieures (11 en métropole continentale, 12 vers la Corse) et 3 au départ de Strasbourg vers Madrid, Munich et Copenhague.",
    source: "Air Journal, 1er juin 2026",
    url: "https://www.air-journal.fr/2026-06-01-la-tsba-reduite-de-65-sur-26-lignes-essentielles-en-france-des-le-1er-juin-5275463.html",
  },
  hormuz: {
    text: "Le détroit d'Ormuz est en pratique fermé au trafic maritime commercial depuis le 28 février 2026 ; selon l'IATA, le prix du kérosène a environ doublé depuis la fin février.",
    source: "IATA, Global Outlook for Air Transport, juin 2026",
    url: "https://www.iata.org/en/iata-repository/publications/economic-reports/global-outlook-for-air-transport-june-2026/",
  },
  ryanair2025: {
    text: "Le 30 juillet 2025, Ryanair annonce cesser ses opérations à Bergerac, Brive et Strasbourg pour l'hiver 2025, en invoquant la hausse de la taxe aérienne.",
    source: "Ryanair, communiqué du 30 juillet 2025",
    url: "https://corporate.ryanair.com/nouvelles/ryanair-supprime-750-000-sieges-arrete-ses-operations-dans-3-aeroports-et-supprime-25-lignes-pour-lhiver-2025-suite-a-lechec-du-gouvernement-francais-a-annuler-laugmentation-exces/?market=fr",
  },
  ryanair2026: {
    text: "Ryanair quitte Clermont-Ferrand à compter du 27 mars 2026, en invoquant la hausse des taxes sur les billets.",
    source: "Air Journal, 28 janvier 2026",
    url: "https://www.air-journal.fr/2026-01-28-face-aux-taxes-ryanair-claque-la-porte-de-clermont-ferrand-5272686.html",
  },
  bergerac: {
    text: "Pour l'été 2026, Ryanair programme de nouveau une ligne Bergerac–Londres-Stansted ; Brive ne figure pas à son programme.",
    source: "The Connexion, 2 octobre 2025",
    url: "https://www.connexionfrance.com/news/ryanair-summer-2026-schedule-bergerac-back-but-not-brive-nor-beziers/746527",
  },
  decret2023: {
    text: "Décret n° 2023-385 du 22 mai 2023 (Journal officiel du 23 mai) : une liaison aérienne intérieure est interdite lorsqu'une alternative en train direct de moins de 2 h 30 existe ; trois liaisons depuis Paris-Orly sont visées (Bordeaux, Nantes, Lyon).",
    source: "Banque des Territoires (Localtis), 23 mai 2023",
    url: "https://www.banquedesterritoires.fr/suppression-des-vols-interieurs-de-courte-duree-le-decret-est-paru",
  },
  easyjet: {
    text: "Création d'easyJet Europe, compagnie basée à Vienne, annoncée en juillet 2017 pour conserver les droits de vol d'easyJet dans l'Union européenne après le Brexit.",
    source: "Voyages d'affaires, 16 juillet 2017",
    url: "https://www.voyages-d-affaires.com/brexit-easyjet-autriche-20170716.html",
  },
};

const factLink = (f) => el("a", { href: f.url, text: f.source, target: "_blank", rel: "noopener" });

export function initSources(data) {
  const { meta } = data;
  const byDataset = {};
  for (const r of meta.sources || []) (byDataset[r.dataset] ||= []).push(r);
  const latest = (k) =>
    (byDataset[k] || [])
      .map((r) => r.last_modified)
      .filter(Boolean)
      .sort()
      .at(-1);

  $("#sources-body").replaceChildren(
    el("p", {
      text: "Toutes les données viennent de la Direction générale de l'aviation civile (DGAC), publiées sur data.gouv.fr. Les chiffres et les phrases de cette page sont recalculés à chaque mise à jour des fichiers.",
    }),
    el(
      "ul",
      {},
      Object.entries(DATASETS).map(([k, d]) =>
        el("li", {}, [
          el("a", { href: d.url, text: d.label, target: "_blank", rel: "noopener" }),
          `, dernière mise à jour des fichiers : ${fmtDate(latest(k))}.`,
        ]),
      ),
    ),
    el("h2", { text: "Comment lire ces chiffres" }),
    el("ul", {}, [
      el("li", {
        text: "Trafic : passagers à l'arrivée et au départ des aéroports français. Les totaux et les segments (international, Paris–province, province–province, Outre-mer) viennent de la série par liaison (LSN). Le trafic d'un aéroport additionne départs et arrivées, hors transit (série APT).",
      }),
      el("li", {
        text: "Seuils de diffusion de la DGAC : un aéroport n'est détaillé qu'au-delà de 1 000 passagers dans le mois, une compagnie au-delà de 10 000. En dessous, le trafic est regroupé : il compte dans les totaux, pas dans les classements.",
      }),
      el("li", {
        text: "Prix : indice IPTAP de la DGAC, calculé sur des billets aller-retour au départ de France, en base 100 en 2023. La série courante est complétée par la série 2012-2025 de même base.",
      }),
      el("li", {
        text: "CO2 : émissions nettes, carburants d'aviation durables inclus, en millions de tonnes et en grammes par passager-équivalent-kilomètre.",
      }),
      el("li", {}, [
        "Repères datés, qui situent les courbes dans le temps sans établir de lien de cause :",
        el(
          "ul",
          {},
          ["tsba2025", "hormuz", "tsba2026", "decret2023", "ryanair2025", "ryanair2026", "bergerac"].map(
            (k) => el("li", {}, [`${FACTS[k].text} (`, factLink(FACTS[k]), ")."]),
          ),
        ),
      ]),
      el("li", {
        text: "Trajets : les arcs du globe relient Paris à l'aéroport principal de chaque pays de destination (série par liaison et par pays, LSN, complète). Les cartes de liaisons d'aéroport à aéroport utilisent la série PAP, qui ne détaille que les lignes exploitées par au moins trois compagnies, aucune ne dépassant 85 % du trafic.",
      }),
      el("li", {
        text: "Passagers par vol : passagers des aéroports (arrivées et départs) divisés par leurs mouvements d'avions de passagers (série APT). Distance moyenne : passagers-kilomètres divisés par passagers (LSN).",
      }),
      el("li", {
        text: "Fret : tonnes de fret et de courrier transportées par avion, par continent et par segment (série par liaison, LSN). Le fret des aéroports additionne ce qui est chargé et déchargé (série APT) : un envoi intérieur y compte deux fois, au départ et à l'arrivée.",
      }),
      el("li", {}, [
        `Pavillon : nationalité de la compagnie et pays de la compagnie, tels que la DGAC les publie dans la série par compagnie ; toutes les lignes comptent, y compris celles regroupées sous le seuil de diffusion. ${FACTS.easyjet.text.replace(/\.$/, "")} (`,
        factLink(FACTS.easyjet),
        "). Le rapprochement avec les courbes est une juxtaposition, pas une mesure.",
      ]),
      el("li", {
        text: "Décomposition du CO2 : méthode LMDI. Le trafic est déduit des séries DGAC elles-mêmes (émissions divisées par les émissions par passager-équivalent-kilomètre), si bien que l'effet du trafic et celui de l'efficacité s'additionnent exactement à la variation observée.",
      }),
      el("li", {
        text: "Données ajoutées : coordonnées des aéroports d'OurAirports (domaine public), complétées à la main pour onze codes historiques ; contours du monde Natural Earth via world-atlas ; contour de la France métropolitaine via france-geojson (Grégoire David, d'après l'IGN) ; correspondance des noms de pays DGAC avec leurs codes ISO, établie pour ce projet.",
      }),
    ]),
    el("p", {}, [
      "Code source et méthode : ",
      el("a", {
        href: "https://github.com/dubrouarthur/aviationdata",
        text: "github.com/dubrouarthur/aviationdata",
        target: "_blank",
        rel: "noopener",
      }),
      `. Page générée le ${fmtDate(meta.generated_at)}.`,
    ]),
  );
}
