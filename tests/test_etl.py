"""ETL behaviour on small fixtures and on the synthetic demo set (no network)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "etl"))

import build
import demo
import dgac

REF = {
    "LFPG": {"code": "LFPG", "lat": "49.009", "lon": "2.5541", "municipality": "Paris"},
    "LFBE": {
        "code": "LFBE",
        "lat": "44.8253",
        "lon": "0.5186",
        "municipality": "Bergerac",
    },
    "TFFR": {
        "code": "TFFR",
        "lat": "16.2654",
        "lon": "-61.5328",
        "municipality": "Pointe-à-Pitre",
    },
}


def write(path: Path, text: str, encoding: str = "utf-8") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding=encoding)
    return path


@pytest.fixture(scope="session")
def demo_outputs(tmp_path_factory):
    raw = demo.generate(tmp_path_factory.mktemp("raw"))
    out = tmp_path_factory.mktemp("out")
    build.build(raw, out, demo=True, ref=build.load_ref_airports())
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in out.glob("*.json")}


# ---------------------------------------------------------------- parsing
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("201801", "2018-01"),
        ("2018-01", "2018-01"),
        ("01/2018", "2018-01"),
        ("2018-01-01", "2018-01"),
        ("1/2018", "2018-01"),
        ("201813", None),
        ("", None),
    ],
)
def test_month_formats(raw, expected):
    assert dgac.to_month(raw) == expected


@pytest.mark.parametrize(
    "raw,expected",
    [("1 234,5", 1234.5), ("12,0", 12.0), ("1234", 1234.0), ("", None), ("s", None)],
)
def test_numbers_french_format(raw, expected):
    assert dgac.to_num(raw) == expected


def test_reads_cp1252_semicolon_file(tmp_path):
    p = write(
        tmp_path / "x.csv",
        "ANMOIS;APT;APT_NOM;APT_PAX_dep;APT_PAX_arr\n202501;LFBE;BERGERAC-ROUMANIÈRE;10 000;9 000\n",
        "cp1252",
    )
    t = dgac.read_table(p)
    assert dgac.series_of(t) == "apt"
    rec = dgac.records(t, "apt", 0)[0]
    assert rec["name"] == "BERGERAC-ROUMANIÈRE" and rec["pax_dep"] == 10000.0 and rec["month"] == "2025-01"


def test_schema_rejects_missing_column(tmp_path):
    p = write(tmp_path / "x.csv", "ANMOIS;APT;APT_PAX_dep;APT_PAX_arr\n202501;LFBE;1;1\n")
    with pytest.raises(dgac.SchemaError, match="name"):
        dgac.records(dgac.read_table(p), "apt", 0)


def test_schema_rejects_missing_period(tmp_path):
    p = write(tmp_path / "x.csv", "APT;APT_NOM;APT_PAX_dep;APT_PAX_arr\nLFBE;B;1;1\n")
    with pytest.raises(dgac.SchemaError, match="period"):
        dgac.records(dgac.read_table(p), "apt", 0)


def test_year_and_month_columns_are_combined(tmp_path):
    p = write(tmp_path / "x.csv", "AN;MOIS;CIE_NOM;CIE_PAX\n2024;3;RYANAIR;100\n")
    assert dgac.records(dgac.read_table(p), "cie", 0)[0]["month"] == "2024-03"


# ---------------------------------------------------------------- airports
def apt_rows(*rows):
    return [
        {
            "month": m,
            "code": c,
            "name": n,
            "zone": "",
            "pax_dep": d,
            "pax_arr": a,
            "_rank": 0,
        }
        for m, c, n, d, a in rows
    ]


def test_subthreshold_rows_excluded_from_rankings():
    out = build.build_airports(
        apt_rows(
            ("2025-01", "LFPG", "PARIS-CDG", 100, 100),
            ("2025-01", "LF00", "AUTRES AERODROMES METROPOLE", 5, 5),
        ),
        REF,
    )
    assert [a["code"] for a in out["airports"]] == ["LFPG"]
    assert [a["code"] for a in out["aggregates"]] == ["LF00"]


def test_airports_without_coords_are_reported():
    out = build.build_airports(
        apt_rows(("2025-01", "LFPG", "CDG", 1, 1), ("2025-01", "LFZZ", "MYSTERE", 1, 1)),
        REF,
    )
    assert out["missing_coords"] == ["LFZZ"]


def test_gap_month_is_null_not_zero():
    out = build.build_airports(
        apt_rows(
            ("2025-01", "LFBE", "BERGERAC", 600, 600),
            ("2025-03", "LFBE", "BERGERAC", 700, 700),
        ),
        REF,
    )
    assert out["months"] == ["2025-01", "2025-02", "2025-03"]
    assert out["airports"][0]["pax"] == [1200, None, 1400]


def test_overseas_zone_from_coordinates():
    out = build.build_airports(
        apt_rows(
            ("2025-01", "TFFR", "POINTE-A-PITRE", 1, 1),
            ("2025-01", "LFPG", "CDG", 1, 1),
        ),
        REF,
    )
    assert {a["code"]: a["zone"] for a in out["airports"]} == {
        "TFFR": "OM",
        "LFPG": "MET",
    }


# ---------------------------------------------------------------- traffic files
def test_most_recent_file_wins_on_overlapping_months(tmp_path):
    head = "ANMOIS;LSN_SEG;LSN_FSC;LSN_PAX\n"
    write(tmp_path / "trafic" / "old.csv", head + "202412;NAT;MET_RAD;100\n")
    write(
        tmp_path / "trafic" / "new.csv",
        head + "202412;NAT;MET_RAD;150\n202501;NAT;MET_RAD;10\n",
    )
    write(
        tmp_path / "trafic" / "apt.csv",
        "ANMOIS;APT;APT_NOM;APT_PAX_dep;APT_PAX_arr\n202412;LFPG;CDG;1;1\n",
    )
    write(tmp_path / "trafic" / "cie.csv", "ANMOIS;CIE_NOM;CIE_PAX\n202412;AIR FRANCE;1\n")
    lsn = build.load_traffic(tmp_path)["lsn"]
    assert sorted((r["month"], r["pax"]) for r in lsn) == [
        ("2024-12", 150.0),
        ("2025-01", 10.0),
    ]


def test_missing_series_fails_loudly(tmp_path):
    write(
        tmp_path / "trafic" / "apt.csv",
        "ANMOIS;APT;APT_NOM;APT_PAX_dep;APT_PAX_arr\n202412;LFPG;CDG;1;1\n",
    )
    with pytest.raises(dgac.SchemaError, match="LSN"):
        build.load_traffic(tmp_path)


def test_annual_totals_only_for_complete_years():
    lsn = [
        {
            "month": f"2024-{m:02d}",
            "seg": "NAT",
            "fsc": "MET_RAD",
            "pax": 1.0,
            "cont": "",
        }
        for m in range(1, 13)
    ]
    lsn += [
        {
            "month": "2025-01",
            "seg": "INTL",
            "fsc": "MET_INTL",
            "pax": 5.0,
            "cont": "EUROPE",
        }
    ]
    out = build.build_fracture(lsn)
    assert out["annual"]["years"] == [2024] and out["annual"]["NAT"] == [12]


# ---------------------------------------------------------------- carriers
@pytest.mark.parametrize(
    "name,expected",
    [
        ("EASYJET EUROPE", "easyJet"),
        ("EASYJET AIRLINE COMPANY", "easyJet"),
        ("TRANSAVIA FRANCE", "Transavia"),
        ("MALTA AIR", "Ryanair"),
        ("AIR FRANCE", "Air France"),
        ("ROYAL AIR MAROC", "Royal Air Maroc"),
    ],
)
def test_brand_grouping(name, expected):
    assert build.brand(name) == expected


# ---------------------------------------------------------------- prices
def test_iptap_splices_base_2023_and_ignores_base_2017(tmp_path):
    head = "ANMOIS;FRA_ENS\n"
    y2023 = "".join(f"2023{m:02d};100,0\n" for m in range(1, 13))
    write(tmp_path / "iptap" / "current.csv", head + y2023 + "202609;104,2\n")
    write(tmp_path / "iptap" / "long.csv", head + "201201;80,0\n" + y2023 + "202609;999\n")
    write(
        tmp_path / "iptap" / "old2017.csv",
        head + "201201;94,1\n" + "".join(f"2023{m:02d};117,6\n" for m in range(1, 13)),
    )
    out = build.build_prices(tmp_path)
    s = dict(zip(out["months"], out["series"]["FRA_ENS"]))
    assert s["2012-01"] == 80.0  # history from the long base-2023 series
    assert s["2026-09"] == 104.2  # the current series wins where both exist
    assert "old2017.csv" not in out["sources"]


def test_iptap_without_base_2023_fails(tmp_path):
    write(
        tmp_path / "iptap" / "a.csv",
        "ANMOIS;FRA_ENS\n" + "".join(f"2023{m:02d};117,6\n" for m in range(1, 13)),
    )
    with pytest.raises(dgac.SchemaError, match="base 2023"):
        build.build_prices(tmp_path)


# ---------------------------------------------------------------- CO2
def test_co2_kinds_by_header(tmp_path):
    write(
        tmp_path / "co2" / "a.csv",
        "Année;Emissions nettes (Mt)\n2019;23,6\n2024;22,4\n",
        "cp1252",
    )
    write(
        tmp_path / "co2" / "b.csv",
        "Année;Emissions nettes (g CO2/Peq-km)\n2019;89\n2024;83\n",
        "cp1252",
    )
    out = build.build_co2(tmp_path)
    assert out["years"] == [2019, 2024] and out["mt"] == [23.6, 22.4] and out["g_peqkm"] == [89.0, 83.0]


def test_co2_wide_format_and_magnitude_fallback(tmp_path):
    write(
        tmp_path / "co2" / "a.csv",
        "Indicateur;2019;2020;2021;2022;2023\nEmissions;23,6;10,4;13,2;19,8;21,6\n",
    )
    out = build.build_co2(tmp_path)
    assert out["mt"][0] == 23.6 and out["years"][0] == 2019


# ---------------------------------------------------------------- contract
CONTRACT = {
    "meta": {"generated_at", "demo", "coverage", "sources", "missing_coords"},
    "fracture": {"months", "faisceaux", "annual", "continents"},
    "aeroports": {"months", "airports", "aggregates", "missing_coords"},
    "compagnies": {"years", "carriers", "rest", "aggregated", "total", "lowcost_share"},
    "prix": {"months", "base", "series", "sources"},
    "co2": {"years", "mt", "g_peqkm", "pax"},
}


def test_outputs_match_json_contract(demo_outputs):
    assert set(demo_outputs) == set(CONTRACT)
    for name, keys in CONTRACT.items():
        assert keys <= set(demo_outputs[name]), name
    assert demo_outputs["meta"]["demo"] is True


def test_series_lengths_are_aligned(demo_outputs):
    f, a, c, p, co2 = (demo_outputs[k] for k in ("fracture", "aeroports", "compagnies", "prix", "co2"))
    assert all(len(v) == len(f["months"]) for v in f["faisceaux"].values())
    assert all(len(ap["pax"]) == len(a["months"]) for ap in a["airports"])
    assert all(len(cr["pax"]) == len(c["years"]) for cr in c["carriers"])
    assert all(len(v) == len(p["months"]) for v in p["series"].values())
    assert len(co2["mt"]) == len(co2["years"]) == len(co2["pax"])


def test_demo_has_map_ready_airports(demo_outputs):
    airports = demo_outputs["aeroports"]["airports"]
    assert airports[0]["code"] == "LFPG"
    assert all(-180 <= ap["lon"] <= 180 and -90 <= ap["lat"] <= 90 for ap in airports)
    assert not demo_outputs["aeroports"]["missing_coords"]
