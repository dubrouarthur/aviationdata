"""Business jets (etl/jets): the closed list of types, the box, the tallies of one month, on a handful of
made-up flights (no raw file needed)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "etl" / "jets"))
sys.path.insert(0, str(ROOT / "etl" / "avions"))

import build_jets as bj  # noqa: E402
from jets_table import JETS  # noqa: E402
from types_table import TYPES  # noqa: E402

AP = pd.DataFrame(
    [
        ("LFPB", 48.969, 2.441, "FR", "Le Bourget", "Paris"),
        ("LSGG", 46.238, 6.109, "CH", "Geneva", "Geneva"),
        ("LFMN", 43.658, 7.216, "FR", "Nice", "Nice"),
        ("KTEB", 40.850, -74.061, "US", "Teterboro", "Teterboro"),
    ],
    columns=["ident", "lat", "lon", "cc", "name", "city"],
).set_index("ident")


def flight(
    cs, icao, typ, o, d, day="2019-06-03", t0="10:00:00", t1="11:00:00", lat1=48.9, lon1=2.4, lat2=46.2, lon2=6.1
):
    return {
        "callsign": cs,
        "icao24": icao,
        "registration": None,
        "typecode": typ,
        "origin": o,
        "destination": d,
        "firstseen": f"{day} {t0}+00:00",
        "lastseen": f"{day} {t1}+00:00",
        "day": f"{day} 00:00:00+00:00",
        "latitude_1": str(lat1),
        "longitude_1": str(lon1),
        "latitude_2": str(lat2),
        "longitude_2": str(lon2),
    }


def test_the_lists_never_overlap():
    assert not set(JETS) & set(TYPES)
    assert "E135" not in JETS  # the airliner; its business version is E35L
    assert "B737" not in JETS and "A319" not in JETS  # BBJ and ACJ carry the airliner's code


def test_the_box_and_the_median_of_a_histogram():
    assert bj.in_box(pd.Series(["48.9", "10.0"]), pd.Series(["2.4", "2.4"])).tolist() == [True, False]
    h = np.zeros(10, int)
    np.add.at(h, [2, 3, 3], 1)
    assert bj.median_hist(h, 50) == 3.5 * 50
    assert 409 <= bj.haversine(48.969, 2.441, 46.238, 6.109) <= 410


def test_one_month_of_tallies():
    rows = [
        flight("FHABC", "aaa001", "C56X", "LFPB", "LSGG"),  # under its registration
        flight("VJT12", "aaa002", "CL35", "LSGG", "LFMN", lat1=46.2, lon1=6.1, lat2=43.6, lon2=7.2),
        flight("NJE3A", "aaa002", "CL35", "LFMN", None, day="2019-06-08", lat1=43.6, lon1=7.2, lat2=45.0, lon2=5.0),
        flight("N1AB", "aaa003", "GLF6", "KTEB", "LFPB", t0="00:00:00", t1="07:00:00", lat1=40.8, lon1=-74.0),
    ]
    df = pd.DataFrame(rows)
    regs = pd.Series({"aaa001": "F-HABC", "aaa002": "9H-VJA", "aaa003": "N1AB"})
    t = bj.Tally(["2019-06"])
    t.add(df, 0, 2019, AP, regs, {"C56X": "M", "CL35": "M", "GLF6": "M"})
    # placed in Europe: departure or arrival in EUROPE; France: an LF airport
    assert t.eu[0] == 4 and t.fr[0] == 4
    # callsigns: own registration (FHABC, N1AB), an operator's code (VJT12, NJE3A)
    assert t.callsign[2019] == {"registration": 2, "operator": 2, "other": 0}
    # distances only for both airports seen and different: three flights, one under 500 km (Paris-Geneva)
    assert int(t.km["eu"][2019].sum()) == 3
    assert int(t.km["eu"][2019][: 500 // 50].sum()) == 2  # Paris-Geneva 409 km, Geneva-Nice 300 km
    # the busiest route, both directions together, with its airports in order
    assert t.routes[2019]["LFPB LSGG"] == 1
    # movements by airport: Le Bourget twice (Geneva, Teterboro), Teterboro not in Europe
    assert t.airport_month["LFPB"][0] == 2 and "KTEB" not in t.airport_month
    # days seen flying, per aircraft, wherever: aircraft 2 on two days
    assert t.days[2019]["aaa002"] == 2
    # the weekday of 3 June 2019 is a Monday, of 8 June a Saturday
    assert t.weekday[2019][0] == 3 and t.weekday[2019][5] == 1
    # seen over Europe (first or last point in the box), for the fleet panel
    assert t.box_ac[0]["aaa002"] == 2 and t.box_ac[0]["aaa003"] == 1
