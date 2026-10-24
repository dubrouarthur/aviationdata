"""Download the NTSB aviation accident database and export the tables the investigation reads.

The NTSB publishes its database as Microsoft Access files (public domain, U.S. Government work):
- avall.mdb: events since 2008, coded with Findings and Events_Sequence;
- Pre2008.mdb: events from 1982 to 2007, coded with seq_of_events.
https://data.ntsb.gov/avdata

Writes data/raw/ntsb/csv/<database>/<table>.csv with mdb-export (package mdbtools). Usage:
    python3 etl/hf/ntsb.py            # download, unzip, export
    python3 etl/hf/ntsb.py --export   # export again from the .mdb already in data/raw/ntsb/
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "ntsb"
URL = "https://data.ntsb.gov/avdata/FileDirectory/DownloadFile?fileID={}"
DATABASES = {"avall": "avall.zip", "Pre2008": "Pre2008.zip"}
TABLES = ["events", "aircraft", "Findings", "Events_Sequence", "seq_of_events", "ct_seqevt", "eADMSPUB_DataDictionary"]
DOCS = ["codman.pdf", "eadmspub.pdf"]


def download(name: str, to: Path) -> None:
    print(f"downloading {name}")
    with urllib.request.urlopen(URL.format(name), timeout=600) as r, open(to, "wb") as f:
        shutil.copyfileobj(r, f)


def export(db: str) -> None:
    if not shutil.which("mdb-export"):
        sys.exit("mdb-export not found: install mdbtools (apt install mdbtools, brew install mdbtools)")
    out = RAW / "csv" / db
    out.mkdir(parents=True, exist_ok=True)
    for t in TABLES:
        with open(out / f"{t}.csv", "w") as f:
            subprocess.run(["mdb-export", str(RAW / f"{db}.mdb"), t], stdout=f, check=True)
        print(f"  {db}/{t}.csv")


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    if "--export" not in sys.argv:
        for z in DATABASES.values():
            zp = RAW / z
            download(z, zp)
            with zipfile.ZipFile(zp) as zf:
                zf.extractall(RAW)
            zp.unlink()
        for d in DOCS:
            download(d, RAW / d)
    for db in DATABASES:
        export(db)


if __name__ == "__main__":
    main()
