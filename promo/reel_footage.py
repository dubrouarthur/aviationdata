"""Reel, pass 1: cut the background footage of every beat into 1080x1350 JPEG frames.

The clips are free Pexels videos (licence: https://www.pexels.com/license/), listed with their
authors in reel.json. They are downloaded to promo/out/footage/ (not versioned: the repository
must not redistribute them) and cut to promo/out/reel/bg/<beat>/0000.jpg ...

    python3 promo/reel_footage.py [--only hook,cta]
"""

import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
REEL = json.loads((ROOT / "reel.json").read_text(encoding="utf-8"))
FPS = REEL["fps"]
W, H = REEL["size"]
FOOTAGE = ROOT / "out" / "footage"
BG = ROOT / "out" / "reel" / "bg"
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None


def clip_file(name):
    path = FOOTAGE / f"{name}.mp4"
    if not path.exists():
        FOOTAGE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name}")
        urllib.request.urlretrieve(REEL["clips"][name]["file"], path)
    return path


def size_of(path):
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            str(path),
        ]
    )
    w, h = map(int, out.decode().strip().split(","))
    return w, h


def crop_filter(beat, w, h):
    """A 4:5 window: centred on cx/cy (fractions), or panning between pan[0] and pan[1]."""
    if w / h > W / H:  # landscape: full height, slide horizontally
        cw, ch = round(h * W / H) // 2 * 2, h
        a, b = beat.get("pan", [beat.get("cx", 0.5)] * 2)
        span = beat["dur"] * beat.get("speed", 1)
        x = f"max(0,min({w - cw},({a}+({b}-{a})*t/{span:.3f})*{w}-{cw / 2}))"
        return f"crop={cw}:{ch}:'{x}':0"
    cw, ch = w, round(w * H / W) // 2 * 2  # portrait: full width, a band of the height
    y = max(0, min(h - ch, round(beat.get("cy", 0.5) * h - ch / 2)))
    return f"crop={cw}:{ch}:0:{y}"


def cut(beat):
    src = clip_file(beat["clip"])
    w, h = size_of(src)
    speed = beat.get("speed", 1)
    out = BG / beat["id"]
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    trim = f"trim=start={beat['from']}:duration={beat['dur'] * speed + 0.2},setpts=(PTS-STARTPTS)/{speed}"
    if beat.get("fit") == "blurpad":  # a wide shot kept whole: sharp in the middle, blurred copy around it
        fw = W * 1.55
        graph = (
            f"[0:v]{trim},split[a][b];"
            f"[a]scale=-2:{H},crop={W}:{H},boxblur=30:2[bg];"
            f"[b]scale={fw:.0f}:-2,crop={W}:ih:(iw-{W})/2:0[fg];"
            f"[bg][fg]overlay=0:{beat.get('fgY', '(H-h)/2')},fps={FPS}"
        )
    else:
        graph = f"[0:v]{trim},{crop_filter(beat, w, h)},scale={W}:{H},fps={FPS}"
    n = round(beat["dur"] * FPS)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", graph, "-frames:v", str(n),
         "-q:v", "3", str(out / "%04d.jpg")],
        check=True,
    )  # fmt: skip
    # ffmpeg numbers from 1: shift to 0 so frame f of the beat is f.jpg
    for f in range(1, n + 1):
        (out / f"{f:04d}.jpg").rename(out / f"{f - 1:04d}.jpg.tmp")
    for p in out.glob("*.tmp"):
        p.rename(p.with_suffix(""))
    print(f"{beat['id']}: {n} frames from {beat['clip']}")


for beat in REEL["beats"]:
    if not only or beat["id"] in only:
        cut(beat)
