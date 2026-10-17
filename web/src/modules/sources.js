import { $, el } from "../lib/ui.js";

const DATASETS = {
  trafic: {
    label: "Trafic aérien commercial mensuel français",
    url: "https://www.data.gouv.fr/datasets/trafic-aerien-commercial-mensuel-francais-par-paire-daeroports-par-sens-depuis-1990",
  },
  iptap: {
    label: "Indices des prix du transport aérien de passagers (IPTAP)",
    url: "https://www.data.gouv.fr/datasets/indices-des-prix-du-transport-aerien-de-passagers",
  },
  co2: {
    label: "Émissions nettes annuelles de CO2 du trafic aérien commercial en France",
    url: "https://www.data.gouv.fr/datasets/emissions-nettes-annuelles-de-co2-du-trafic-aerien-commercial-en-france",
  },
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "date inconnue";

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
      el("li", {
        text: "Repères datés : hausse de la taxe de solidarité sur les billets d'avion (TSBA) au 1er mars 2025, de 2,63 € à 7,40 € en classe économique pour un vol intérieur ou européen (×2,8) ; quasi-fermeture du détroit d'Ormuz fin février 2026 ; retour de la TSBA à 2,63 € au 1er juin 2026 sur 26 liaisons d'aménagement du territoire, dont 23 intérieures ; interdiction des vols intérieurs remplaçables par moins de 2 h 30 de train, en mai 2023. Ils situent les courbes dans le temps sans établir de lien de cause. Le départ de Ryanair de plusieurs aéroports régionaux est rapporté par la presse (hiver 2025-2026).",
      }),
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
        "Pavillon : nationalité de la compagnie et pays de la compagnie, tels que la DGAC les publie dans la série par compagnie ; toutes les lignes comptent, y compris celles regroupées sous le seuil de diffusion. Création d'easyJet Europe, compagnie basée à Vienne, annoncée en juillet 2017 pour conserver les droits de vol d'easyJet dans l'Union européenne après le Brexit (",
        el("a", {
          href: "https://www.voyages-d-affaires.com/brexit-easyjet-autriche-20170716.html",
          text: "Voyages d'affaires, 16 juillet 2017",
          target: "_blank",
          rel: "noopener",
        }),
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
