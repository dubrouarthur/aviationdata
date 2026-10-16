"""Routes, destination countries and the CO2 decomposition."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "etl"))

import build  # noqa: E402
import world  # noqa: E402

AIRPORTS = {
    "LFPG": {"code": "LFPG", "name": "CDG", "municipality": "Paris", "lat": "49.0", "lon": "2.55", "country": "FR"},
    "KJFK": {
        "code": "KJFK",
        "name": "JFK",
        "municipality": "New York",
        "lat": "40.64",
        "lon": "-73.78",
        "country": "US",
    },
}
COUNTRIES = {"ETATS-UNIS": {"dgac_name": "ETATS-UNIS", "iso2": "US", "label": "États-Unis", "hub": "KJFK"}}


def lsn(month, dest, pax, origin="MÉTROPOLE", seg="INTL", cont="AMÉRIQUE"):
    return {"month": month, "seg": seg, "fsc": "MET_INTL", "dest": dest, "origin": origin, "cont": cont, "pax": pax}


def test_monde_maps_countries_and_keeps_others_in_totals():
    out, warnings = world.build_monde(
        [
            lsn("2025-01", "ETATS-UNIS", 100),
            lsn("2025-01", "ETATS-UNIS", 10, origin="OUTRE-MER"),
            lsn("2025-02", "AMÉRIQUE_AUTRE", 7),
            lsn("2025-02", "PAYS IMAGINAIRE", 3),
            lsn("2025-02", "(INTÉRIEUR)", 999, seg="NAT"),
        ],
        AIRPORTS,
        COUNTRIES,
        build.pretty_name,
    )
    us = out["countries"][0]
    assert us["id"] == "US" and us["pax"] == [110, 0] and us["om"] == [10, 0]
    assert us["hub"]["code"] == "KJFK" and 5500 < us["dist"] < 6000
    assert out["autres"]["Amérique"] == [0, 10]  # unknown country lands in its continent's others
    assert any("PAYS IMAGINAIRE" in w for w in warnings)


def test_routes_aggregate_complete_years_and_report_missing_airports():
    pap = [
        {
            "month": f"2025-{m:02d}",
            "pair": "LFPG_KJFK",
            "name1": "PARIS-CDG",
            "name2": "NEW YORK-KENNEDY",
            "dist": 5840,
            "pax": 10,
            "mvt": 1,
        }
        for m in range(1, 13)
    ]
    pap.append(
        {
            "month": "2025-03",
            "pair": "LFPG_XXXX",
            "name1": "PARIS-CDG",
            "name2": "NOWHERE",
            "dist": 1,
            "pax": 5,
            "mvt": 1,
        }
    )
    out, warnings = world.build_routes(pap, AIRPORTS, build.pretty_name)
    assert out["years"] == [2025]
    assert out["pairs"] == [{"a": "LFPG", "b": "KJFK", "dist": 5840, "pax": [120], "vols": [12]}]
    assert out["airports"]["KJFK"]["nom"] == "New York-Kennedy" and out["airports"]["LFPG"]["fr"] is True
    assert any("XXXX" in w for w in warnings)


def test_co2_decomposition_adds_up_exactly():
    co2 = {
        "years": [2000, 2019, 2024],
        "segments": ["FRANCE_TOT"],
        "mt": {"FRANCE_TOT": [20.0, 23.6, 22.2]},
        "g_peqkm": {"FRANCE_TOT": [111.4, 78.7, 75.8]},
    }
    d = world.co2_decomposition(co2)
    first = d["periods"][0]
    assert (first["from"], first["to"]) == (2000, 2019)
    assert first["trafic"] + first["intensite"] == pytest.approx(23.6 - 20.0, abs=1e-3)
    assert first["trafic"] > 0 > first["intensite"]  # traffic pushed emissions up, efficiency pulled down
    assert d["periods"][-1]["to"] == 2024
