"""Scene list shared by capture.py and render.py (the captions live in scenes.json, read by film.html too)."""

import json
from pathlib import Path

DATA = json.loads((Path(__file__).parent / "scenes.json").read_text())
FPS = DATA["fps"]
SCENES = DATA["scenes"]
