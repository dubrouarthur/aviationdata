// @ts-check
// Sources of « Le ciel des jets privés »: the OpenSky Network's flight lists (the record of the jet stream
// and of the aircraft models), its aircraft database, ICAO's aircraft type designators, airports.
import { ASOURCES } from "../avions/sources.js";

export const JPSOURCES = {
  opensky: { ...ASOURCES.opensky, short: "listes de vols 2019-2022 (Zenodo)" },
  aircraft: ASOURCES.aircraft,
  icao: {
    producer: "OACI",
    label: "Organisation de l'aviation civile internationale, Doc 8643, indicatifs de types d'avions",
    short: "types d'avions et catégories de turbulence (Doc 8643)",
    url: "https://www.icao.int/publications/DOC8643/Pages/default.aspx",
  },
  ourairports: ASOURCES.ourairports,
};

// facts outside the data, dated and sourced (checked on 16 November 2026)
export const FACTS = {
  adsb: {
    text: "Règlement d'exécution (UE) n° 1207/2011 modifié par le règlement (UE) 2020/587 du 29 avril 2020 : les avions de plus de 5 700 kg au décollage ou de plus de 250 nœuds en croisière, certifiés depuis le 7 juin 1995, doivent émettre leur position (ADS-B) au 7 décembre 2020 au lieu du 7 juin 2020, ou au 7 juin 2023 avec un programme de mise à niveau.",
    source: "EASA, « Amendment to the Airspace Requirements on ADS-B and Mode S », 2020",
    url: "https://www.easa.europa.eu/en/newsroom-and-events/news/amendment-airspace-requirements-ads-b-and-mode-s",
  },
};
