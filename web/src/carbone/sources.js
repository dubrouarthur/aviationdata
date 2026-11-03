// Sources of « Combien de CO2 pour un vol en avion ? »: the DGAC's emissions (the same dataset as the
// first investigation), the DGAC's 2024 report for its method, OurAirports for the distances.
import { DATASETS as DGAC } from "../lib/datasets.js";
import { ESOURCES } from "../eu/sources.js";

export const CSOURCES = {
  co2: { ...DGAC.co2, producer: "DGAC" },
  bilan: {
    producer: "DGAC",
    label: "DGAC, Bilan des émissions de CO2 du transport aérien en France, année 2024",
    short: "bilan des émissions de CO2 2024",
    url: "https://www.ecologie.gouv.fr/sites/default/files/documents/Bilan_emissions_CO2_transport_aerien_2024.pdf",
  },
  ourairports: ESOURCES.ourairports,
  routes: {
    producer: "Eurostat",
    label: "Eurostat, transport aérien de passagers entre les principaux aéroports de France et leurs partenaires (avia_par_fr)",
    short: "liaisons aériennes de la France (avia_par_fr)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/avia_par_fr/default/table?lang=fr",
  },
  copyright: ESOURCES.copyright,
  desnz: {
    producer: "Gouvernement britannique (DESNZ)",
    label: "DESNZ, Greenhouse gas reporting: conversion factors 2025 (Open Government Licence v3.0), voyages d'affaires en avion",
    short: "facteurs de conversion 2025 (DESNZ)",
    url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
  },
  sdes: {
    producer: "SDES",
    label: "SDES (ministère de la Transition écologique), L'empreinte carbone de la France de 1990 à 2024, 16 octobre 2025",
    short: "empreinte carbone de la France (SDES)",
    url: "https://www.statistiques.developpement-durable.gouv.fr/lempreinte-carbone-de-la-france-de-1990-2024",
  },
};
