"""Jet-stream investigation: geometry, winds and routing on synthetic fields."""

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "etl" / "jet"))
import analysis as A  # noqa: E402
import radiosonde  # noqa: E402

CDG = (49.0097, 2.5479)
JFK = (40.6413, -73.7781)
LATS = np.arange(15, 76.5, 1.5)
LONS = np.arange(-100.5, 21, 1.5)


def field(u=0.0, v=0.0):
    return np.full((len(LATS), len(LONS)), u), np.full((len(LATS), len(LONS)), v)


def test_paris_new_york_distance():
    assert A.haversine(*CDG, *JFK) == pytest.approx(5834, abs=15)


def test_great_circle_ends_on_both_airports_and_bows_north():
    la, lo = A.great_circle(*CDG, *JFK, 50)
    assert (la[0], lo[0]) == pytest.approx(CDG, abs=1e-6)
    assert (la[-1], lo[-1]) == pytest.approx(JFK, abs=1e-6)
    assert la.max() > 51  # the shortest path passes north of both airports


def test_ground_speed_tail_head_and_cross_winds():
    assert A.ground_speed(100 / 3.6, 0, 90) == pytest.approx(1000)  # 100 km/h tailwind, flying east
    assert A.ground_speed(100 / 3.6, 0, 270) == pytest.approx(800)  # same wind, flying west
    # a pure crosswind costs a little: the heading points into it
    assert A.ground_speed(0, 100 / 3.6, 90) == pytest.approx(math_sqrt(900**2 - 100**2))


def math_sqrt(x):
    return x**0.5


def test_route_wind_sign_follows_direction():
    u, v = field(u=30.0)  # uniform westerly 108 km/h
    east = A.route_wind(u, v, LATS, LONS, JFK, CDG)
    west = A.route_wind(u, v, LATS, LONS, CDG, JFK)
    assert east > 90 and west < -90
    assert east == pytest.approx(-west, rel=1e-6)


def test_route_wind_on_a_stack_of_fields():
    u = np.stack([field(u=k)[0] for k in (0.0, 10.0, -10.0)])
    w = A.route_wind(u, np.zeros_like(u), LATS, LONS, JFK, CDG)
    assert w.shape == (3,) and w[0] == pytest.approx(0) and w[1] == pytest.approx(-w[2]) and w[1] > 30


def test_in_box():
    assert A.in_box(JFK, CDG, LATS, LONS)
    assert not A.in_box((33.94, -118.41), CDG, LATS, LONS)  # Los Angeles is west of the grid


def test_fastest_route_without_wind_is_the_great_circle():
    u, v = field()
    gc, best, path = A.fastest_route(u, v, LATS, LONS, CDG, JFK)
    route = A.route_coords(CDG, JFK, path)
    assert best == pytest.approx(gc, rel=1e-3)
    assert gc == pytest.approx(5834 / A.TAS * 60, rel=0.01)
    assert route[0] == pytest.approx(list(CDG), abs=0.01) and route[-1] == pytest.approx(list(JFK), abs=0.01)


def test_fastest_route_bends_into_a_jet():
    # an easterly-free world with a 300 km/h westerly jet along 40 N: eastbound flights dip south to ride it
    u = np.where(np.abs(LATS - 40)[:, None] < 4, 300 / 3.6, 0.0) * np.ones((1, len(LONS)))
    v = np.zeros_like(u)
    gc, best, path = A.fastest_route(u, v, LATS, LONS, JFK, CDG)
    route = A.route_coords(JFK, CDG, path)
    assert best < gc - 10  # more than ten minutes saved
    assert min(p[0] for p in route[5:-5]) < 45  # the route goes down towards the jet


def test_fastest_route_on_a_stack_matches_one_by_one():
    rng = np.random.default_rng(1)
    u = rng.normal(15, 20, (3, len(LATS), len(LONS)))
    v = rng.normal(0, 10, (3, len(LATS), len(LONS)))
    gc, best, path = A.fastest_route(u, v, LATS, LONS, CDG, JFK)
    for t in range(3):
        g1, b1, p1 = A.fastest_route(u[t], v[t], LATS, LONS, CDG, JFK)
        assert (gc[t], best[t]) == pytest.approx((g1, b1)) and (path[t] == p1).all()
        assert best[t] <= g1 + 1e-9


def test_ols_recovers_a_line():
    x = np.arange(20.0)
    s, i, ci, r = A.ols(x, 3 * x + 2)
    assert (s, i) == pytest.approx((3, 2)) and r == pytest.approx(1)


def test_igra_parser_reads_the_250_hpa_wind():
    lines = [  # a real Trappes sounding (storm Ciara), IGRA 2 fixed-width format
        "#FRM00007145 2020 02 09 00 2315   48 ncdc-gts           487744    20097",
        "10 -9999  30000  9170B -477B-9999    70   325   290 ",
        "20 -9999  27000 -9999  -520B-9999    70 -9999 -9999 ",
        "10 -9999  25000 10340B -575B-9999    60   330   330 ",
    ]
    assert list(radiosonde.parse(lines)) == [("2020-02-09", 0, 330, 118.8, 104.4, None)]
    assert list(radiosonde.profiles(lines)) == [
        ("2020-02-09", 0, 300, 9170, 104.4),
        ("2020-02-09", 0, 250, 10340, 118.8),
    ]


def test_nao_parser():
    import nao

    assert nao.parse(" 1950    1    0.9200\n 2026    9   -0.5334\n") == {(1950, 1): 0.92, (2026, 9): -0.5334}
    with pytest.raises(ValueError):
        nao.parse("<html>moved</html>")


def test_aircraft_effect_is_what_is_left_once_the_wind_is_removed():
    import build_jet as B
    import pandas as pd

    rng = np.random.default_rng(3)
    rows = []
    for east, sign in ((True, 1), (False, -1)):
        for t, offset in (("A388", -8.0), ("A333", 9.0)):
            w = rng.uniform(20, 200, 400) * sign
            for wi in w:
                rows.append(
                    {
                        "origin": "KJFK" if east else "LFPG",
                        "destination": "LFPG" if east else "KJFK",
                        "east": east,
                        "w": wi,
                        "dur": 420 - 0.3 * wi + offset,
                        "typecode": t,
                        "airline": "AFR",
                        "month": "2019-01",
                    }
                )
    df = pd.DataFrame(rows)
    df["res"] = B.residuals(df)
    eff = {r["code"]: r for r in B.effects(df, "typecode", B.TYPES)}
    assert eff["A388"]["e"] == pytest.approx(-8.5, abs=0.6) and eff["A333"]["w"] == pytest.approx(8.5, abs=0.6)
    assert eff["A388"]["e"] < eff["A333"]["e"]
    assert B.calendar(df[df.east])[0] is not None and B.calendar(df[df.east])[5] is None
