// Sources of « Le ciel, modèle par modèle »: the OpenSky Network's flight lists (the same record as the
// jet story) and aircraft database, the US Bureau of Transportation Statistics' on-time flights, airports.
import { JSOURCES } from "../jet/sources.js";
import { ESOURCES } from "../eu/sources.js";

export const ASOURCES = {
  opensky: { ...JSOURCES.opensky, producer: "OpenSky Network", short: "listes de vols 2019 et 2022 (Zenodo)" },
  aircraft: {
    producer: "OpenSky Network",
    label: "The OpenSky Network, base des avions (aircraft database, avril 2024)",
    short: "base des avions (avril 2024)",
    url: "https://opensky-network.org/datasets/#metadata/",
  },
  bts: {
    producer: "BTS (États-Unis)",
    label: "Bureau of Transportation Statistics, Reporting Carrier On-Time Performance (1987-present), 2025",
    short: "ponctualité des vols intérieurs (On-Time Performance)",
    url: "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ&QO_fu146_anzr=b0-gvzr",
  },
  ourairports: ESOURCES.ourairports,
  faa: {
    producer: "FAA (États-Unis)",
    label: "Federal Aviation Administration, Aircraft Characteristics Database (octobre 2024)",
    short: "dimensions des avions (Aircraft Characteristics Database)",
    url: "https://www.faa.gov/airports/engineering/aircraft_char_database/",
  },
};
