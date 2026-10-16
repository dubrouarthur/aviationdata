"""Download the three DGAC datasets from data.gouv.fr into data/raw/.

Resources are discovered through the data.gouv.fr API (not hard-coded ids),
because the DGAC replaces files when it publishes a new year. Documentation
resources (PDF/XLSX notices) are skipped. A manifest records what was fetched.

Needs network access to data.gouv.fr: run it locally or in GitHub Actions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

API = "https://www.data.gouv.fr/api/1/datasets/{slug}/"
DATASETS = {
    "trafic": "trafic-aerien-commercial-mensuel-francais-par-paire-daeroports-par-sens-depuis-1990",
    "iptap": "indices-des-prix-du-transport-aerien-de-passagers",
    "co2": "emissions-nettes-annuelles-de-co2-du-trafic-aerien-commercial-en-france",
}
KEEP_FORMATS = {"csv", "zip"}
UA = {"User-Agent": "aviationdata-etl (+https://github.com/dubrouarthur/aviationdata)"}


def _get(url: str, retries: int = 3) -> bytes:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read()
        except Exception as exc:  # network errors are retried, then re-raised
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"download failed after {retries} tries: {url}: {last}")


def fetch(out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "resources": [],
    }
    for key, slug in DATASETS.items():
        meta = json.loads(_get(API.format(slug=slug)))
        target = out / key
        target.mkdir(exist_ok=True)
        kept = 0
        for res in meta.get("resources", []):
            fmt = (res.get("format") or "").lower().strip(".")
            if fmt not in KEEP_FORMATS or res.get("type") == "documentation":
                continue
            payload = _get(res["url"])
            name = f"{res['id'][:8]}.{fmt}"
            path = target / name
            path.write_bytes(payload)
            extracted: list[str] = []
            if fmt == "zip":
                with zipfile.ZipFile(path) as zf:
                    for member in zf.namelist():
                        # flatten, refuse path traversal
                        base = Path(member).name
                        if not base or member.endswith("/"):
                            continue
                        dest = target / f"{res['id'][:8]}__{base}"
                        dest.write_bytes(zf.read(member))
                        extracted.append(dest.name)
            manifest["resources"].append(
                {
                    "dataset": key,
                    "id": res["id"],
                    "title": res.get("title"),
                    "type": res.get("type"),
                    "format": fmt,
                    "last_modified": res.get("last_modified"),
                    "file": f"{key}/{name}",
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "bytes": len(payload),
                    "extracted": extracted,
                }
            )
            kept += 1
        if kept == 0:
            raise RuntimeError(f"no csv/zip resource found for {key} ({slug})")
        print(f"{key}: {kept} resource(s)")
    (out / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False)
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "raw",
    )
    args = parser.parse_args(argv)
    fetch(args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
