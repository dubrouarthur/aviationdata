"""Turn dist-artifact/index.html into an Artifact page (the host adds doctype/html/head/body).

    cd web && npx vite build --mode artifact && python3 scripts/artifact_page.py
Writes dist-artifact/page.html and prints the files map to publish beside it.
"""

import json
import re
from pathlib import Path

dist = Path(__file__).resolve().parent.parent / "dist-artifact"
html = (dist / "index.html").read_text(encoding="utf-8")
html = re.sub(r"<!doctype html>\s*", "", html, flags=re.I)
html = re.sub(r"</?(html|body)(\s[^>]*)?>\s*", "", html, flags=re.I)
html = re.sub(r"</?head>\s*", "", html, flags=re.I)
# the host skeleton provides charset and viewport
html = re.sub(r'\s*<meta charset="utf-8"\s*/?>', "", html, flags=re.I)
html = re.sub(r'\s*<meta name="viewport"[^>]*>', "", html, flags=re.I)
html = html.strip() + "\n"
assert html.lstrip().lower().startswith("<title>"), "title must open the page"
(dist / "page.html").write_text(html, encoding="utf-8")

files = {}
for p in sorted(dist.rglob("*")):
    if p.is_file() and p.name not in ("index.html", "page.html"):
        files[p.relative_to(dist).as_posix()] = str(p)
print(json.dumps(files, indent=1))
print(f"page.html: {len(html)} chars, {len(files)} supporting files")
