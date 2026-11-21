"""FAA National Wildlife Strike Database -> data/raw/wildlife/strikes.csv.

The FAA publishes the whole database as one Access file (database.zip, about 75 MB, updated every month). mdbtools
(`mdb-export`, apt install mdbtools) turns its one table, STRIKE_REPORTS, into a CSV.

    python3 etl/birds/fetch_birds.py
"""

import subprocess
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wildlife"
URL = "https://wildlife.faa.gov/assets/database.zip"


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    z = RAW / "database.zip"
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(z, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    with zipfile.ZipFile(z) as zf:
        zf.extractall(RAW / "unz")
    db = next((RAW / "unz").glob("*.accdb"))
    with open(RAW / "strikes.csv", "w") as out:
        subprocess.run(["mdb-export", str(db), "STRIKE_REPORTS"], stdout=out, check=True)
    print(f"{RAW / 'strikes.csv'} : {(RAW / 'strikes.csv').stat().st_size // 1_000_000} Mo")


if __name__ == "__main__":
    main()
