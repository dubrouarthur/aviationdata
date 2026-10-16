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
        text: "CO2 : émissions nettes, carburants d'aviation durables inclus, en millions de tonnes et en grammes par passager-équivalent-kilomètre. Le trafic du graphique trafic-CO2 est celui de la série LSN.",
      }),
      el("li", {
        text: "Repères datés : triplement de la taxe de solidarité sur les billets d'avion (TSBA) au 1er mars 2025, fermeture du détroit d'Ormuz fin février 2026, retour de la TSBA à 2,63 € sur 26 liaisons intérieures au 1er juin 2026, interdiction de vols intérieurs courts en mai 2023. Ils situent les courbes dans le temps sans établir de lien de cause.",
      }),
      el("li", {
        text: "Coordonnées des aéroports : OurAirports (domaine public), complétées à la main pour quatre aéroports fermés. Fond de carte : france-geojson (Grégoire David), d'après les contours administratifs de l'IGN.",
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
