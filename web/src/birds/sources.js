// @ts-check
// Sources of « Quand les avions heurtent-ils des oiseaux ? »: the FAA National Wildlife Strike Database, and the
// facts outside the data, dated and sourced.

export const WSOURCES = {
  nwsd: {
    producer: "FAA",
    label: "Federal Aviation Administration, National Wildlife Strike Database (base publique, mise à jour mensuelle)",
    short: "impacts d'animaux déclarés depuis 1990",
    url: "https://wildlife.faa.gov/home",
  },
};

// facts outside the data (checked on 21 November 2026)
export const FACTS = {
  voluntary: {
    text: "Aux États-Unis, la déclaration d'un impact d'animal à la FAA est volontaire : pilotes, aéroports, compagnies et mécaniciens remplissent le formulaire 5200-7. La base compte les impacts déclarés, pas tous les impacts.",
    source: "FAA et USDA, Wildlife Strikes to Civil Aircraft in the United States, 1990-2024",
    url: "https://www.faa.gov/airports/airport_safety/wildlife/wildlife-strike-report-1990-2024",
  },
  public2009: {
    text: "Le 24 avril 2009, trois mois après l'amerrissage de l'Hudson, le ministère américain des Transports a rendu publique la base des impacts, avec les aéroports, que la FAA voulait garder confidentielle.",
    source: "General Aviation News, « FAA makes bird strike data public », 24 avril 2009",
    url: "https://generalaviationnews.com/2009/04/24/faa-makes-bird-strike-data-public",
  },
  migration: {
    text: "Les passereaux migrent en général de nuit ; d'autres oiseaux, comme les rapaces, les oiseaux d'eau et les hirondelles, migrent de jour. Selon BirdCast, programme du Cornell Lab, environ 80 % des oiseaux migrateurs d'Amérique du Nord font au moins une partie de leur voyage de nuit.",
    short: "la plupart des oiseaux migrateurs d'Amérique du Nord voyagent au moins en partie de nuit",
    source: "Cornell Lab of Ornithology, All About Birds, « The Basics: How, Why, and Where of Bird Migration »",
    url: "https://www.allaboutbirds.org/news/the-basics-how-why-and-where-of-bird-migration/",
  },
  speed: {
    text: "Aux États-Unis, sauf autorisation, un avion ne peut voler à plus de 250 nœuds (environ 460 km/h) de vitesse indiquée sous 10 000 pieds d'altitude ; au-dessus, cette limite ne s'applique plus.",
    short: "sous 10 000 pieds d'altitude, la réglementation américaine limite sa vitesse à 250 nœuds, environ 460 km/h",
    source: "14 CFR 91.117, Aircraft speed",
    url: "https://www.law.cornell.edu/cfr/text/14/91.117",
  },
  hudson: {
    text: "Le 15 janvier 2009, l'Airbus A320 du vol US Airways 1549 perd la poussée de ses deux moteurs après avoir heurté un vol de bernaches du Canada, peu après son décollage de New York-LaGuardia, et amerrit sur l'Hudson ; les 155 personnes à bord survivent. Chaque moteur a ingéré au moins deux bernaches.",
    source: "NTSB, rapport AAR-10/03, adopté le 4 mai 2010",
    url: "https://www.faa.gov/sites/faa.gov/files/2025-04/usair_a320.pdf",
  },
};
