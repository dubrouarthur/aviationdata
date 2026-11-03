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
};
