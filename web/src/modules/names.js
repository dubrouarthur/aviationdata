// Short airport names for labels.
const SHORT = {
  LFPG: "Roissy-CDG",
  LFPO: "Orly",
  LFOB: "Beauvais",
  LFSB: "Bâle-Mulhouse",
  LFML: "Marseille",
  FMEE: "La Réunion",
  TFFR: "Guadeloupe",
  TFFF: "Martinique",
  NTAA: "Tahiti",
  SOCA: "Cayenne",
  NWWW: "Nouméa",
};

export function shortName(a) {
  if (SHORT[a.code]) return SHORT[a.code];
  const parts = a.nom.split(/-| \(/);
  return /^Sainte?$/.test(parts[0]) && parts[1] ? `${parts[0]}-${parts[1]}` : parts[0];
}
