"""Checks on the REAL DGAC files against figures the DGAC published (bilan 2025).

Skipped when data/raw/ has not been fetched (e.g. in a sandbox without network).
Reference: DGAC provisional 2025 results — 183 M passengers, domestic 26.9 M,
international 156 M (relayed by voyages-d-affaires.com, Jan 2026).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
sys.path.insert(0, str(ROOT / "etl"))
import build

pytestmark = pytest.mark.skipif(not (RAW / "manifest.json").exists(), reason="real DGAC data not fetched")
TOL = 0.015  # provisional vs final figures


@pytest.fixture(scope="module")
def out(tmp_path_factory):
    return build.build(RAW, tmp_path_factory.mktemp("real"))


def annual(out, key, year):
    a = out["fracture"]["annual"]
    return a[key][a["years"].index(year)]


def test_total_pax_2025(out):
    assert annual(out, "TOTAL", 2025) == pytest.approx(183e6, rel=TOL)


def test_domestic_2025(out):
    assert annual(out, "NAT", 2025) == pytest.approx(26.9e6, rel=TOL)


def test_international_2025(out):
    assert annual(out, "INTL", 2025) == pytest.approx(156e6, rel=TOL)


def test_iptap_mean_2023_is_100(out):
    p = out["prix"]
    vals = [v for m, v in zip(p["months"], p["series"]["FRA_ENS"]) if m.startswith("2023") and v is not None]
    assert len(vals) == 12 and sum(vals) / 12 == pytest.approx(100, abs=0.5)


def test_co2_starts_2000(out):
    assert out["co2"]["years"][0] == 2000


def test_major_airports_on_map(out):
    codes = {a["code"] for a in out["aeroports"]["airports"]}
    assert {"LFPG", "LFPO", "LFMN", "LFLL", "LFML", "LFBO"} <= codes
