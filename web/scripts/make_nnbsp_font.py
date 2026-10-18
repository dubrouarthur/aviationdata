"""Build web/src/fonts/nnbsp.woff: a one-glyph font holding a wider narrow no-break space (U+202F).

Archivo draws U+202F at 0.1 em, so in its condensed bold "146 354" reads "146354" and "2 404 km"
reads "2404km". style.css declares this font under the "Archivo Variable" family with
unicode-range U+202F, after Fontsource's faces, so the browser takes only that one character from it.

python3 web/scripts/make_nnbsp_font.py [width_in_em]
"""

import sys
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
width = round(float(sys.argv[1] if len(sys.argv) > 1 else 0.15) * UPM)
out = Path(__file__).resolve().parents[1] / "src" / "fonts" / "nnbsp.woff"

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder([".notdef", "uni202F"])
fb.setupCharacterMap({0x202F: "uni202F"})
empty = TTGlyphPen(None).glyph()
fb.setupGlyf({".notdef": empty, "uni202F": empty})
fb.setupHorizontalMetrics({".notdef": (width, 0), "uni202F": (width, 0)})
# small vertical metrics: the space never makes a line taller than the text around it
fb.setupHorizontalHeader(ascent=700, descent=-200)
fb.setupNameTable({"familyName": "Ciel NNBSP", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=700, sTypoDescender=-200, usWinAscent=700, usWinDescent=200)
fb.setupPost()
fb.font.flavor = "woff"
out.parent.mkdir(parents=True, exist_ok=True)
fb.save(str(out))
print(f"{out} ({out.stat().st_size} bytes, U+202F = {width / UPM:.2f} em)")
