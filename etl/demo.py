"""Synthetic raw files in the DGAC formats, for developing the UI without network.

The numbers are FICTITIOUS (plausible orders of magnitude only). build.py flags
the output with meta.demo = true and the UI shows a banner. Never publish them.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

# code, name, pax 2019 (millions), 2025/2019 ratio, seasonal amplitude
AIRPORTS = [
    ("LFPG", "PARIS-CHARLES DE GAULLE", 76.0, 0.95, 0.12),
    ("LFPO", "PARIS-ORLY", 31.8, 0.98, 0.12),
    ("LFMN", "NICE-COTE D'AZUR", 14.5, 1.04, 0.30),
    ("LFLL", "LYON-SAINT EXUPERY", 11.7, 0.89, 0.18),
    ("LFML", "MARSEILLE-PROVENCE", 10.1, 1.03, 0.25),
    ("LFBO", "TOULOUSE-BLAGNAC", 9.6, 0.80, 0.15),
    ("LFSB", "BALE-MULHOUSE", 9.0, 0.96, 0.20),
    ("LFBD", "BORDEAUX-MERIGNAC", 7.7, 0.84, 0.22),
    ("LFRS", "NANTES ATLANTIQUE", 7.2, 0.94, 0.25),
    ("LFOB", "BEAUVAIS-TILLE", 3.9, 1.45, 0.20),
    ("LFQQ", "LILLE-LESQUIN", 2.2, 1.05, 0.25),
    ("LFMT", "MONTPELLIER-MEDITERRANEE", 2.0, 0.85, 0.30),
    ("LFKJ", "AJACCIO-NAPOLEON BONAPARTE", 1.6, 1.12, 0.55),
    ("LFKB", "BASTIA-PORETTA", 1.4, 1.12, 0.55),
    ("LFST", "STRASBOURG-ENTZHEIM", 1.3, 0.72, 0.15),
    ("LFBZ", "BIARRITZ-PAYS BASQUE", 1.2, 0.98, 0.35),
    ("LFRB", "BREST-BRETAGNE", 1.1, 0.78, 0.20),
    ("LFRN", "RENNES-SAINT JACQUES", 0.86, 0.80, 0.20),
    ("LFKF", "FIGARI-SUD CORSE", 0.70, 1.10, 0.80),
    ("LFBP", "PAU-PYRENEES", 0.62, 0.62, 0.15),
    ("LFLC", "CLERMONT-FERRAND AUVERGNE", 0.45, 0.66, 0.15),
    ("LFMP", "PERPIGNAN-RIVESALTES", 0.45, 0.78, 0.35),
    ("LFTH", "TOULON-HYERES", 0.50, 0.60, 0.40),
    ("LFMK", "CARCASSONNE-SALVAZA", 0.40, 0.85, 0.45),
    ("LFBE", "BERGERAC-ROUMANIERE", 0.32, 0.70, 0.70),
    ("LFLB", "CHAMBERY-SAVOIE", 0.25, 0.90, -0.80),
    ("LFJL", "METZ-NANCY-LORRAINE", 0.25, 0.80, 0.25),
    ("LFBH", "LA ROCHELLE-ILE DE RE", 0.24, 0.85, 0.45),
    ("LFTW", "NIMES-GARONS", 0.20, 0.75, 0.40),
    ("LFSL", "BRIVE-SOUILLAC", 0.10, 0.55, 0.40),
    ("TFFR", "POINTE-A-PITRE LE RAIZET", 2.5, 1.00, 0.15),
    ("FMEE", "LA REUNION-ROLAND GARROS", 2.6, 1.06, 0.15),
    ("TFFF", "FORT-DE-FRANCE LE LAMENTIN", 1.9, 1.00, 0.15),
    ("NTAA", "TAHITI-FAAA", 1.7, 1.05, 0.10),
    ("SOCA", "CAYENNE-FELIX EBOUE", 0.55, 1.02, 0.10),
    ("NWWW", "NOUMEA-LA TONTOUTA", 0.50, 0.95, 0.10),
]
COVID = {2020: 0.38, 2021: 0.50, 2022: 0.84, 2023: 0.94, 2024: 0.98}
# faisceau: (1990, 2005, 2019, 2025) annual millions
FSC = {
    "MET_RAD": (12.0, 15.5, 13.0, 9.2),
    "MET_TRA": (3.0, 4.6, 6.6, 6.1),
    "MET_OM": (2.6, 3.5, 4.4, 4.5),
    "OM_OM": (1.6, 2.0, 2.4, 2.4),
    "MET_INTL": (44.0, 88.0, 145.0, 156.0),
    "OM_INTL": (0.6, 0.9, 1.2, 1.3),
}
CONTINENTS = {
    "EUROPE": 0.56,
    "AFRIQUE": 0.18,
    "AMERIQUE": 0.13,
    "ASIE": 0.10,
    "OCEANIE": 0.03,
}
CARRIERS = [  # name, nat, 2010, 2019, 2025 (millions)
    ("AIR FRANCE", "F", 50.0, 55.0, 47.0),
    ("EASYJET EUROPE", "E", 10.0, 20.0, 22.5),
    ("RYANAIR", "E", 8.0, 16.0, 12.5),
    ("TRANSAVIA FRANCE", "F", 2.0, 9.0, 12.8),
    ("HOP", "F", 9.0, 10.0, 3.2),
    ("VUELING AIRLINES", "E", 3.5, 6.0, 6.8),
    ("VOLOTEA", "E", 0.0, 3.6, 5.4),
    ("LUFTHANSA", "E", 3.8, 3.9, 3.4),
    ("BRITISH AIRWAYS", "E", 3.3, 3.2, 2.9),
    ("ROYAL AIR MAROC", "E", 1.9, 2.6, 3.3),
    ("KLM", "E", 2.9, 3.1, 2.8),
    ("WIZZ AIR", "E", 0.2, 1.4, 2.6),
    ("EMIRATES", "E", 1.2, 2.0, 2.3),
    ("CORSAIR", "F", 2.3, 1.6, 1.4),
    ("AIR CORSICA", "F", 1.5, 1.9, 2.1),
]


def _interp(points: list[tuple[int, float]], year: float) -> float:
    for (y0, v0), (y1, v1) in zip(points, points[1:]):
        if y0 <= year <= y1:
            return v0 + (v1 - v0) * (year - y0) / (y1 - y0)
    return points[-1][1] if year > points[-1][0] else points[0][1]


def _season(month: int, amp: float) -> float:
    return 1 + amp * math.sin((month - 4) / 12 * 2 * math.pi)


def _num(v: float, decimals: int = 0) -> str:
    return f"{v:.{decimals}f}".replace(".", ",") if decimals else str(int(round(v)))


def generate(out: Path, last_year: int = 2025, seed: int = 7) -> Path:
    rnd = random.Random(seed)
    (out / "trafic").mkdir(parents=True, exist_ok=True)
    (out / "iptap").mkdir(exist_ok=True)
    (out / "co2").mkdir(exist_ok=True)
    months = [(y, m) for y in range(1990, last_year + 1) for m in range(1, 13)]

    # APT -----------------------------------------------------------------
    lines = ["ANMOIS;APT;APT_NOM;APT_ZON;APT_PAX_dep;APT_PAX_arr;APT_PAX_tr"]
    for y, m in months:
        small = 0.0
        for code, name, p19, ratio, amp in AIRPORTS:
            pre = p19 * (0.45 + 0.55 * (y - 1990) / 29) if y <= 2019 else p19 * _interp([(2019, 1), (2025, ratio)], y)
            level = pre * COVID.get(y, 1.0) * 1e6 / 12 * _season(m, amp) * rnd.uniform(0.96, 1.04)
            if code == "LFBE" and (y > 2025 or (y == 2025 and m >= 11)):
                level *= 0.25  # winter without the low-cost base
            if level < 1000:
                small += level
                continue
            zone = "OM" if not code.startswith("LF") else "M"
            lines.append(f"{y}{m:02d};{code};{name};{zone};{_num(level / 2)};{_num(level / 2)};0")
        lines.append(
            f"{y}{m:02d};LF00;AUTRES AERODROMES METROPOLE;M;{_num(small / 2 + 4000)};{_num(small / 2 + 4000)};0"
        )
    (out / "trafic" / "demo__ASP_APT_2025.csv").write_text("\n".join(lines), encoding="cp1252")

    # LSN -----------------------------------------------------------------
    lines = ["ANMOIS;LSN;LSN_SEG;LSN_FSC;LSN_2_CONT;LSN_PAX;LSN_PKT"]
    for y, m in months:
        cov = COVID.get(y, 1.0)
        for fsc, (a, b, c, d) in FSC.items():
            base = _interp([(1990, a), (2005, b), (2019, c), (2025, d)], y)
            if fsc.endswith("INTL"):
                base *= cov * (0.97 if y == 2024 else 1.0)
            elif y >= 2020:
                base *= max(cov, 0.55)
            total = base * 1e6 / 12 * _season(m, 0.22 if "INTL" in fsc else 0.10) * rnd.uniform(0.97, 1.03)
            seg = "INTL" if fsc.endswith("INTL") else "NAT"
            parts = CONTINENTS.items() if seg == "INTL" else [("FRANCE", 1.0)]
            for cont, share in parts:
                pax = total * share
                dist = {
                    "EUROPE": 1100,
                    "AFRIQUE": 1900,
                    "AMERIQUE": 6500,
                    "ASIE": 9000,
                    "OCEANIE": 16000,
                }.get(cont, 650)
                lines.append(f"{y}{m:02d};{fsc}_{cont};{seg};{fsc};{cont};{_num(pax)};{_num(pax * dist)}")
    (out / "trafic" / "demo__ASP_LSN_2025.csv").write_text("\n".join(lines), encoding="cp1252")

    # CIE -----------------------------------------------------------------
    lines = ["ANMOIS;CIE;CIE_NOM;CIE_NAT;CIE_PAYS;CIE_PAX"]
    for y, m in months:
        if y < 2010:
            continue
        for name, nat, v10, v19, v25 in CARRIERS:
            v = _interp([(2010, v10), (2019, v19), (2025, v25)], y) * COVID.get(y, 1.0) * 1e6 / 12 * _season(m, 0.18)
            if v >= 10000:
                lines.append(f"{y}{m:02d};{name[:3]};{name};{nat};;{_num(v)}")
        lines.append(f"{y}{m:02d};ZZF;AUTRES COMPAGNIES FRANCAISES;F;;{_num(150000)}")
        lines.append(f"{y}{m:02d};ZZE;AUTRES COMPAGNIES ETRANGERES;E;;{_num(2200000 * COVID.get(y, 1.0))}")
    (out / "trafic" / "demo__ASP_CIE_2025.csv").write_text("\n".join(lines), encoding="cp1252")

    # IPTAP: current series (base 2023) + long series base 2023 + old base 2017 --
    def iptap(y: int, m: int, col: str) -> float:
        lvl = _interp(
            [
                (2012, 86),
                (2017, 85),
                (2019, 88),
                (2020, 84),
                (2021, 82),
                (2022, 95),
                (2023, 100),
                (2024, 101),
                (2025, 102),
                (2026, 105.5),
            ],
            y + (m - 1) / 12,
        )
        shift = {
            "MET_INTER_MET": -4,
            "MET_INTER_OM": 3,
            "MET_INTAL_MC": -2,
            "MET_INTAL_LC": 5,
            "DOM_ENS": 1,
        }.get(col, 0)
        boost = 6 if (col == "MET_INTAL_LC" and (y, m) >= (2026, 3)) else 0
        return (lvl + shift * (y - 2023) / 3 + boost) * _season(m, 0.06) / 1.0

    cols = [
        "MET_INTER_MET",
        "MET_INTER_OM",
        "MET_INTER_TOT",
        "MET_INTAL_MC",
        "MET_INTAL_LC",
        "MET_INTAL_TOT",
        "MET_ENS",
        "DOM_ENS",
        "FRA_ENS",
    ]

    def write_iptap(name: str, start: int, end: tuple[int, int], factor: float = 1.0) -> None:
        rows = [";".join(["ANMOIS", *cols])]
        for y in range(start, end[0] + 1):
            for m in range(1, 13):
                if (y, m) > end:
                    break
                rows.append(
                    ";".join(
                        [
                            f"{y}{m:02d}",
                            *[_num(iptap(y, m, c) * factor, 1) for c in cols],
                        ]
                    )
                )
        (out / "iptap" / name).write_text("\n".join(rows), encoding="utf-8")

    write_iptap("demo_courant.csv", 2017, (2026, 9))
    write_iptap("demo_2012_2025.csv", 2012, (2025, 12))
    write_iptap("demo_2012_2024_base2017.csv", 2012, (2024, 12), factor=100 / 85)

    # CO2 -----------------------------------------------------------------
    mt = [
        (2000, 19.5),
        (2008, 21.5),
        (2019, 23.6),
        (2020, 10.4),
        (2021, 13.2),
        (2022, 19.8),
        (2023, 21.6),
        (2024, 22.4),
    ]
    g = [
        (2000, 131),
        (2010, 108),
        (2019, 89),
        (2020, 104),
        (2021, 98),
        (2022, 88),
        (2023, 85),
        (2024, 83),
    ]
    (out / "co2" / "demo_mt.csv").write_text(
        "Année;Emissions nettes de CO2 (Mt)\n" + "\n".join(f"{y};{_num(_interp(mt, y), 2)}" for y in range(2000, 2025)),
        encoding="cp1252",
    )
    (out / "co2" / "demo_g.csv").write_text(
        "Année;Emissions nettes de CO2 (g/Peq-km)\n"
        + "\n".join(f"{y};{_num(_interp(g, y), 1)}" for y in range(2000, 2025)),
        encoding="cp1252",
    )
    return out
