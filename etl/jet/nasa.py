"""True-colour satellite image of the North Atlantic from NASA GIBS (Worldview imagery).

Source: NASA Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and
Information System (ESDIS); layer VIIRS_SNPP_CorrectedReflectance_TrueColor (Suomi NPP),
plate carrée (EPSG:4326). NASA imagery is free to use with credit: "NASA Worldview / GIBS".

    python3 etl/jet/nasa.py [--date 2020-02-08] [--layer VIIRS_SNPP_CorrectedReflectance_TrueColor]
Writes data/raw/nasa/<layer>-<date>.jpg, latitudes 20-70 N, longitudes 90 W-20 E, 20 px/degree.
"""

import sys
import urllib.parse
import urllib.request
from pathlib import Path

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "nasa"
BBOX = (20, -90, 70, 20)  # south, west, north, east (WMS 1.3.0 axis order for EPSG:4326)


def url(date: str, layer: str) -> str:
    s, w, n, e = BBOX
    q = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": layer,
        "CRS": "EPSG:4326",
        "BBOX": f"{s},{w},{n},{e}",
        "WIDTH": (e - w) * 20,
        "HEIGHT": (n - s) * 20,
        "FORMAT": "image/jpeg",
        "TIME": date,
    }
    return f"{WMS}?{urllib.parse.urlencode(q)}"


if __name__ == "__main__":
    arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d  # noqa: E731
    date = arg("--date", "2020-02-08")
    layer = arg("--layer", "VIIRS_SNPP_CorrectedReflectance_TrueColor")
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{layer}-{date}.jpg"
    with urllib.request.urlopen(url(date, layer), timeout=120) as r:
        body = r.read()
    if not body.startswith(b"\xff\xd8"):
        raise SystemExit(f"GIBS did not return a JPEG: {body[:200]!r}")
    dest.write_bytes(body)
    print(f"{dest.name}: {len(body) // 1024} KB")
