"""The European dashboard's data (etl/eu/build_eu.py): its contract with the page, and its values read again
from Eurostat's own files. The raw checks are skipped when data/raw/eurostat/ is empty."""

import csv
import json
import math
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data" / "eu" / "eu.json"
RAW = ROOT / "data" / "raw" / "eurostat"
D = json.loads(OUT.read_text())
raw = pytest.mark.skipif(not (RAW / "avia_paoc_A.json").exists(), reason="no Eurostat files in data/raw/eurostat")


def test_contract():
    assert set(D) == {"meta", "years", "zones", "airportYears", "airports", "barycentre"}
    assert D["years"] == list(range(D["meta"]["first"], D["meta"]["last"] + 1))
    assert D["airportYears"] == list(range(D["meta"]["cross"], D["meta"]["last"] + 1))
    assert D["zones"][0]["code"] == "EU27_2020" and len(D["zones"]) == 31
    for z in D["zones"]:
        assert set(z) >= {
            "code",
            "name",
            "iso",
            "first",
            "total",
            "nat",
            "intl",
            "ieu",
            "xeu",
            "monthStart",
            "monthLast",
            "monthly",
        }
        for k in ("total", "nat", "intl", "ieu", "xeu"):
            assert len(z[k]) == len(D["years"])
        assert set(z["monthly"]) == {"total", "nat", "intl"}
    for a in D["airports"]:
        assert len(a["pax"]) == len(D["airportYears"]) and -180 <= a["lon"] <= 180
    assert [b["y"] for b in D["barycentre"]] == D["airportYears"]


def test_months_make_the_year():
    for z in D["zones"]:
        y, m = map(int, z["monthStart"].split("-"))
        series = z["monthly"]["total"]
        by_year = {}
        for v in series:
            by_year.setdefault(y, []).append(v)
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        for year, vals in by_year.items():
            if len(vals) == 12 and None not in vals:
                total = z["total"][D["years"].index(year)]
                assert abs(sum(vals) - total) <= 2, (z["code"], year)


def test_no_airport_system_or_unknown_code():
    assert all(a["code"].isalpha() and len(a["code"]) == 4 for a in D["airports"])
    assert not {"LF90", "LF96"} & {a["code"] for a in D["airports"]}


def jsonstat(name):
    d = json.loads((RAW / name).read_text())
    ids, size = d["id"], d["size"]
    cats = [[c for c, _ in sorted(d["dimension"][k]["category"]["index"].items(), key=lambda x: x[1])] for k in ids]
    out = {}
    for k, v in d["value"].items():
        i, key = int(k), []
        for j in range(len(size)):
            key.append(cats[j][(i // math.prod(size[j + 1 :])) % size[j]])
        out[tuple(key)] = v
    return ids, out


@raw
def test_values_are_eurostat_values():
    ids, out = jsonstat("avia_paoc_A.json")
    g, c, t = ids.index("geo"), ids.index("tra_cov"), ids.index("time")
    want = {(k[g], k[c], int(k[t])): v for k, v in out.items()}
    cov = {"total": "TOTAL", "nat": "NAT", "ieu": "INTL_IEU27_2020", "xeu": "INTL_XEU27_2020"}
    for z in D["zones"]:
        for k, code in cov.items():
            for i, y in enumerate(D["years"]):
                if z[k][i] is not None:
                    assert z[k][i] == want[(z["code"], code, y)], (z["code"], k, y)


@raw
def test_barycentre_from_the_raw_files():
    """Every airport of Eurostat's file with a position in the box, not only those the page draws."""
    coords = {}
    with open(RAW / "ourairports.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            for c in (r["ident"], r["gps_code"], r["icao_code"]):
                if c and len(c) == 4 and c not in coords:
                    coords[c] = (float(r["latitude_deg"]), float(r["longitude_deg"]))
    with open(ROOT / "data" / "ref" / "eu_airports.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["lat"]:
                coords[r["code"]] = (float(r["lat"]), float(r["lon"]))
    countries = {z["code"] for z in D["zones"][1:]}
    s, n, w, e = D["meta"]["box"]
    ids, out = jsonstat("avia_paoa_A.json")
    a_i, t_i = ids.index("rep_airp"), ids.index("time")
    for b in D["barycentre"]:
        x = y = z = tot = 0.0
        for k, v in out.items():
            cc, code = k[a_i].split("_", 1)
            if int(k[t_i]) != b["y"] or cc not in countries or not code.isalpha() or code not in coords or not v:
                continue
            la, lo = coords[code]
            if not (s <= la <= n and w <= lo <= e):
                continue
            la, lo = math.radians(la), math.radians(lo)
            x += v * math.cos(la) * math.cos(lo)
            y += v * math.cos(la) * math.sin(lo)
            z += v * math.sin(la)
            tot += v
        lat = math.degrees(math.atan2(z, math.hypot(x, y)))
        lon = math.degrees(math.atan2(y, x))
        assert abs(lat - b["lat"]) < 1e-3 and abs(lon - b["lon"]) < 1e-3, b["y"]
