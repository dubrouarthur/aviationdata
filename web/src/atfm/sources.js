// @ts-check
// Sources of « Qui retarde les avions en Europe ? »: EUROCONTROL's en-route ATFM delays, and what the measure is.

export const RSOURCES = {
  atfm: {
    producer: "EUROCONTROL",
    label:
      "EUROCONTROL, Aviation Intelligence Portal, retards ATFM en route par prestataire de navigation aérienne (AUA), données quotidiennes",
    short: "retards ATFM en route par jour (Aviation Intelligence Portal)",
    url: "https://ansperformance.eu/reference/dataset/en-route-atfm-delay-aua/",
  },
};

// facts outside the numbers, dated and sourced (checked on 20 November 2026)
export const FACTS = {
  definition: {
    text: "Quand la demande de trafic dépasse la capacité d'un centre de contrôle en route, celui-ci peut demander une régulation : les avions concernés attendent au sol, à leur aéroport de départ, un créneau de décollage alloué par le gestionnaire du réseau. Le retard ATFM est l'écart entre l'heure de décollage du plan de vol et celle du créneau ; le motif de la régulation est indiqué par le centre qui la demande.",
    source: "EUROCONTROL, description du jeu de données « En-Route ATFM Delay (AUA) »",
    url: "https://ansperformance.eu/reference/dataset/en-route-atfm-delay-aua/",
  },
  method2016: {
    text: "Le 4 avril 2016, la version 20.0 du logiciel du gestionnaire du réseau a changé le calcul du retard ATFM pour le rendre plus précis : les années d'avant et d'après ne se comparent pas à la minute près.",
    source: "EUROCONTROL, description du jeu de données « En-Route ATFM Delay (AUA) »",
    url: "https://ansperformance.eu/reference/dataset/en-route-atfm-delay-aua/",
  },
};
