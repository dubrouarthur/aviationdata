// Six well-known accidents: what happened, the probable cause and the factors the NTSB retained, and what
// followed, each with its source. These are facts from outside the data, dated and sourced; the findings
// themselves come from the NTSB database (web/public/data/hf/cases.json, etl/hf/cases.py).

const ntsb = (id, report) => ({
  label: `NTSB, rapport ${report}`,
  url: `https://www.ntsb.gov/investigations/Pages/${id}.aspx`,
});

export const CASES = {
  colgan: {
    name: "Colgan Air 3407",
    when: "12 février 2009",
    where: "Clarence Center, près de Buffalo (New York)",
    aircraft: "Bombardier DHC-8-400 de Colgan Air, vol Continental Connection",
    toll: "49 morts à bord, 1 au sol",
    what: "Vers 22 h 17, à environ 5 milles nautiques de l'aéroport de Buffalo, l'avion décroche et s'écrase sur Clarence Center.",
    cause:
      "La réaction inappropriée du commandant au déclenchement du vibreur de manche, l'alerte de décrochage, qui a mené à un décrochage dont l'avion ne s'est pas rétabli.",
    factors: [
      "l'équipage n'a pas surveillé la vitesse face à la montée du repère de basse vitesse ;",
      "il n'a pas respecté la règle du cockpit silencieux, qui proscrit les conversations sans rapport avec le vol dans les phases critiques ;",
      "le commandant n'a pas conduit le vol efficacement ;",
      "les procédures de Colgan Air pour choisir et gérer la vitesse en approche dans le givre étaient inadaptées.",
    ],
    report: ntsb("DCA09MA027", "AAR-10/01"),
    followed: [
      {
        text: "Le 10 juillet 2013, la FAA impose aux copilotes des compagnies américaines la licence de pilote de ligne, qui demande 1 500 heures de vol. La règle applique une loi votée en 2010 et découle « en partie » de cet accident, selon l'annonce.",
        source: "FAA, annonce reprise par International Airport Review, 10 juillet 2013",
        url: "https://www.internationalairportreview.com/news/13248/faa-boosts-aviation-safety-with-new-pilot-qualification-standards",
      },
    ],
  },
  hudson: {
    name: "US Airways 1549",
    when: "15 janvier 2009",
    where: "fleuve Hudson, New York",
    aircraft: "Airbus A320 d'US Airways",
    toll: "aucun mort, 5 blessés graves",
    what: "Des oiseaux privent les deux moteurs de presque toute leur poussée ; l'équipage amerrit sur l'Hudson, à environ 8,5 milles de l'aéroport de LaGuardia. Les 150 passagers et les 5 membres d'équipage sont évacués.",
    cause:
      "L'ingestion de gros oiseaux dans chaque moteur, qui a provoqué une perte presque totale de poussée des deux moteurs, puis l'amerrissage.",
    factors: [
      "pour les dégâts au fuselage : la certification de l'amerrissage par la FAA, sans vérifier que les pilotes pouvaient tenir les paramètres prévus sans moteurs ;",
      "le manque de formation et de consignes sur l'amerrissage dans le secteur ;",
      "la difficulté du commandant à tenir sa vitesse en finale, débordé par l'urgence.",
    ],
    saved:
      "Ce qui a favorisé la survie, selon le NTSB : les décisions et le travail en équipage des pilotes, un avion équipé par chance pour le survol de l'eau, l'évacuation menée par les hôtesses et stewards, et la réponse rapide des secours.",
    report: ntsb("DCA09MA026", "AAR-10/03"),
    followed: [
      {
        text: "Le rapport adresse ses recommandations à la FAA, au ministère américain de l'Agriculture et à l'Agence européenne de la sécurité aérienne ; il décrit un groupe de travail de la FAA et de l'agence européenne qui réévalue les normes de certification des moteurs à l'ingestion d'oiseaux.",
        source: "NTSB, rapport AAR-10/03, p. xv et 20",
        url: "https://www.ntsb.gov/investigations/AccidentReports/Reports/AAR1003.pdf",
      },
    ],
  },
  asiana: {
    name: "Asiana Airlines 214",
    when: "6 juillet 2013",
    where: "aéroport de San Francisco",
    aircraft: "Boeing 777-200ER d'Asiana Airlines",
    toll: "3 morts, 49 blessés graves",
    what: "Vers 11 h 28, en approche à vue de la piste 28L, l'avion passe sous le plan de descente et sous la vitesse acceptables ; la remise des gaz vient trop tard.",
    cause:
      "La mauvaise gestion de la descente par l'équipage pendant l'approche à vue, la désactivation involontaire du contrôle automatique de la vitesse par le pilote aux commandes, une surveillance insuffisante de la vitesse et une remise des gaz trop tardive.",
    factors: [
      "la complexité de l'automanette et du directeur de vol, mal décrite dans la documentation de Boeing et dans la formation d'Asiana, qui rendait une erreur de mode plus probable ;",
      "une communication et une coordination non conformes aux standards sur l'usage des automatismes ;",
      "la formation insuffisante du pilote aux commandes aux approches à vue ;",
      "la supervision insuffisante par le pilote instructeur ;",
      "la fatigue de l'équipage, qui a probablement dégradé ses performances.",
    ],
    report: ntsb("DCA13MA120", "AAR-14/01"),
    followed: [
      {
        text: "Le rapport adresse ses recommandations à la FAA, à Asiana et à Boeing, notamment ; parmi ses enjeux, une alerte de vitesse basse adaptée à l'approche, et des automatismes moins complexes et mieux enseignés.",
        source: "NTSB, rapport AAR-14/01, p. xiii et xv",
        url: "https://www.ntsb.gov/investigations/AccidentReports/Reports/AAR1401.pdf",
      },
    ],
  },
  southwest: {
    name: "Southwest Airlines 1380",
    when: "17 avril 2018",
    where: "en montée après LaGuardia, posé à Philadelphie",
    aircraft: "Boeing 737-700 de Southwest Airlines",
    toll: "1 mort",
    what: "Une aube de soufflante se détache dans un moteur ; des pièces du capot frappent le fuselage, un hublot cède et la cabine se dépressurise. L'avion se pose à Philadelphie.",
    cause:
      "Une fissure de fatigue dans le pied de l'aube de soufflante n° 13, qui s'est détachée en vol et a frappé le carter à un endroit critique pour la tenue du capot ; des pièces arrachées ont brisé un hublot, provoquant la dépressurisation et la mort d'un passager.",
    factors: [],
    report: ntsb("DCA18MA142", "AAR-19/03"),
    followed: [
      {
        text: "Le 20 avril 2018, la FAA ordonne en urgence l'inspection des aubes de soufflante des moteurs CFM56-7B : 352 moteurs aux États-Unis, 681 dans le monde.",
        source: "UPI, 20 avril 2018",
        url: "https://www.upi.com/Top_News/US/2018/04/20/FAA-orders-inspection-of-fan-blades-after-Southwest-failure/7461524266801/",
      },
    ],
  },
  atlas: {
    name: "Atlas Air 3591",
    when: "23 février 2019",
    where: "baie de Trinity, près de Houston (Texas)",
    aircraft: "Boeing 767 cargo d'Atlas Air, pour Amazon",
    toll: "3 morts",
    what: "L'avion plonge et s'écrase dans un marais peu profond de la baie de Trinity, à 41 milles de l'aéroport de Houston. Les deux pilotes et un pilote passager meurent.",
    cause:
      "La réaction inappropriée du copilote, aux commandes, au déclenchement involontaire du mode de remise des gaz, qui a entraîné sa désorientation spatiale et des actions à piquer : l'avion est parti dans une descente dont l'équipage ne l'a pas sorti.",
    factors: [
      "le commandant n'a pas surveillé la trajectoire ni repris les commandes ;",
      "les pratiques du secteur pour sélectionner et évaluer les pilotes n'ont pas traité les faiblesses du copilote ni sa mauvaise réponse au stress ;",
      "la FAA n'a pas mis en place à temps une base des dossiers de pilotes assez complète.",
    ],
    report: ntsb("DCA19MA086", "AAR-20/02"),
    followed: [
      {
        text: "Le 26 mai 2021, la FAA finalise la base électronique des dossiers de pilotes : les compagnies doivent y verser les données de leurs pilotes et la consulter avant d'embaucher.",
        source: "FAA, 26 mai 2021",
        url: "https://www.faa.gov/newsroom/pilot-records-database-final-rule",
      },
    ],
  },
  calabasas: {
    name: "Hélicoptère de Calabasas",
    when: "26 janvier 2020",
    where: "Calabasas (Californie)",
    aircraft: "Sikorsky S-76B d'Island Express Helicopters, vol à la demande",
    toll: "9 morts",
    what: "Vers 9 h 46, l'hélicoptère s'écrase à Calabasas. Le pilote et ses huit passagers meurent, dont le basketteur Kobe Bryant.",
    cause:
      "La décision du pilote de poursuivre le vol à vue dans des conditions qui imposaient le vol aux instruments, qui a entraîné sa désorientation spatiale et la perte de contrôle.",
    factors: [
      "la pression que le pilote s'imposait probablement, et son biais de poursuite du plan, qui ont pesé sur ses décisions ;",
      "l'examen et la surveillance insuffisants, par Island Express, de ses processus de gestion de la sécurité.",
    ],
    report: ntsb("DCA20MA059", "AAR-21/01"),
    followed: [
      {
        text: "En avril 2024, la FAA impose un système de gestion de la sécurité aux compagnies charter et de navettes régionales, aux hélicoptères sanitaires et aux vols touristiques. Dans son communiqué, le NTSB cite l'accident de Calabasas.",
        source: "NTSB, communiqué du 23 avril 2024",
        url: "https://www.ntsb.gov/news/press-releases/Pages/NR20240423A.aspx",
      },
    ],
    extra: {
      text: "Mort de Kobe Bryant : Halldale, 12 février 2021.",
      url: "https://www.halldale.com/civil-aviation/18117-pilots-poor-decision-making-led-to-kobe-bryant-helicopter-crash-ntsb",
    },
  },
};

// how each column of the diagram reads in the models of the story
export const COLUMN_NOTES = {
  org: "Influences de l'organisation et supervision (HFACS) : les conditions latentes de Reason, posées loin du cockpit.",
  pre: "Conditions préalables (HFACS) : état physique ou mental, expérience, formation, travail en équipage.",
  acts: "Actes dangereux (HFACS) : erreurs d'exécution, de décision ou de perception, les défaillances actives de Reason.",
  aircraft:
    "L'appareil : une panne, un appareil mal utilisé, un paramètre de vol non tenu ou une conception en cause. Une menace ou un état indésirable dans le modèle TEM.",
  env: "L'environnement : météo, faune, relief, circulation. Une menace extérieure à l'équipage dans le modèle TEM.",
};

export const COLUMN_COLORS = {
  org: "var(--org)",
  pre: "var(--pre)",
  acts: "var(--human)",
  aircraft: "var(--machine)",
  env: "var(--env)",
};
