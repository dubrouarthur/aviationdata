"""Read DGAC CSV files whatever their encoding/delimiter and map them to logical fields.

Every series is resolved through aliases (case-insensitive). A missing required
column raises SchemaError listing what was found, instead of producing silent zeros.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from pathlib import Path

MONTH_ALIASES = ["ANMOIS", "AN_MOIS", "PERIODE", "DATE", "MOIS_AN"]

SERIES: dict[str, dict[str, list[str]]] = {
    "apt": {
        "code": ["APT"],
        "name": ["APT_NOM"],
        "zone": ["APT_ZON"],
        "pax_dep": ["APT_PAX_DEP"],
        "pax_arr": ["APT_PAX_ARR"],
        "pax_tr": ["APT_PAX_TR"],
        "mvt": ["APT_NMVT_MXT"],
        "mvt_cgo": ["APT_NMVT_CGO"],
        "frp_dep": ["APT_FRP_DEP"],
        "frp_arr": ["APT_FRP_ARR"],
    },
    "lsn": {
        "seg": ["LSN_SEG"],
        "fsc": ["LSN_FSC"],
        "pax": ["LSN_PAX"],
        "pkt": ["LSN_PKT"],
        "frp": ["LSN_FRP"],
        "cont": ["LSN_2_CONT", "LSN_CONT", "LSN_2_CONTINENT"],
        "origin": ["LSN_1"],
        "dest": ["LSN_2"],
    },
    "pap": {
        "pair": ["PAP"],
        "name1": ["PAP1_LABEL"],
        "name2": ["PAP2_LABEL"],
        "dist": ["PAP_DIST"],
        "pax": ["PAP_PAX"],
        "mvt": ["PAP_MVT"],
    },
    "cie": {
        "name": ["CIE_NOM"],
        "nat": ["CIE_NAT"],
        "pays": ["CIE_PAYS"],
        "pax": ["CIE_PAX"],
    },
}
OPTIONAL = {
    "apt": {"pax_tr", "zone", "mvt", "mvt_cgo", "frp_dep", "frp_arr"},
    "lsn": {"pkt", "cont", "origin", "dest", "frp"},
    "cie": {"nat", "pays"},
    "pap": {"mvt", "dist"},
}
NUMERIC = {"pax", "pax_dep", "pax_arr", "pax_tr", "pkt", "dist", "mvt", "mvt_cgo", "frp", "frp_dep", "frp_arr"}
# a column that, when present, identifies the series of a file
SIGNATURE = {"apt": "APT_PAX_DEP", "lsn": "LSN_PAX", "cie": "CIE_PAX", "pap": "PAP_PAX"}


class SchemaError(ValueError):
    pass


@dataclass
class Table:
    path: Path
    header: list[str]
    rows: list[list[str]]

    def col(self, name: str) -> int | None:
        up = [h.strip().upper() for h in self.header]
        return up.index(name.upper()) if name.upper() in up else None


def decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")


def read_table(path: Path) -> Table:
    text = decode(path.read_bytes())
    first = text.splitlines()[0] if text else ""
    delim = max([";", ",", "\t", "|"], key=first.count)
    reader = csv.reader(io.StringIO(text), delimiter=delim)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        raise SchemaError(f"{path.name}: empty file")
    header = [h.strip() for h in rows[0]]
    return Table(path, header, rows[1:])


def series_of(table: Table) -> str | None:
    for key, sig in SIGNATURE.items():
        if table.col(sig) is not None:
            return key
    return None


def to_num(value: str | None) -> float | None:
    if value is None:
        return None
    v = value.strip().replace(" ", "").replace(" ", "")
    if v in ("", "-", "NA", "nd", "s", "NaN"):
        return None
    if v.count(",") == 1 and "." not in v:
        v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


_MONTH_PATTERNS = [
    (re.compile(r"^(\d{4})(\d{2})$"), lambda m: (m[1], m[2])),
    (
        re.compile(r"^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?(?:[ T].*)?$"),
        lambda m: (m[1], m[2]),
    ),
    (re.compile(r"^(\d{1,2})[-/](\d{4})$"), lambda m: (m[2], m[1])),
    (re.compile(r"^\d{1,2}/(\d{1,2})/(\d{4})$"), lambda m: (m[2], m[1])),
]


def to_month(value: str) -> str | None:
    """Normalise a DGAC period to 'YYYY-MM' (None when unparseable)."""
    v = (value or "").strip()
    for pat, pick in _MONTH_PATTERNS:
        m = pat.match(v)
        if m:
            y, mo = pick(m)
            if 1 <= int(mo) <= 12:
                return f"{int(y):04d}-{int(mo):02d}"
    return None


def month_getter(table: Table):
    for name in MONTH_ALIASES:
        i = table.col(name)
        if i is not None:
            return lambda r, i=i: to_month(r[i]) if i < len(r) else None
    an, mois = table.col("AN"), table.col("MOIS")
    if an is not None and mois is not None:
        return lambda r: to_month(f"{r[an]}-{r[mois]}")
    raise SchemaError(
        f"{table.path.name}: no period column (looked for {MONTH_ALIASES} or AN+MOIS); found {table.header}"
    )


def resolve(table: Table, series: str) -> dict[str, int | None]:
    out: dict[str, int | None] = {}
    missing = []
    for field, aliases in SERIES[series].items():
        idx = next((table.col(a) for a in aliases if table.col(a) is not None), None)
        if idx is None and field not in OPTIONAL.get(series, set()):
            missing.append(f"{field} ({'|'.join(aliases)})")
        out[field] = idx
    if missing:
        raise SchemaError(f"{table.path.name} [{series}]: missing {', '.join(missing)}; found {table.header}")
    return out


def records(table: Table, series: str, rank: int) -> list[dict]:
    """Rows of a traffic table as dicts with logical field names + month + file rank."""
    cols = resolve(table, series)
    get_month = month_getter(table)
    out = []
    for r in table.rows:
        month = get_month(r)
        if month is None:
            continue
        rec = {"month": month, "_rank": rank}
        for field, idx in cols.items():
            raw = r[idx] if idx is not None and idx < len(r) else None
            rec[field] = to_num(raw) if field in NUMERIC else (raw or "").strip()
        out.append(rec)
    return out


def latest_per_month(recs: list[dict]) -> list[dict]:
    """When several files cover the same month, keep only the rows of the most recent file."""
    best: dict[str, int] = {}
    for r in recs:
        best[r["month"]] = max(best.get(r["month"], -1), r["_rank"])
    return [r for r in recs if r["_rank"] == best[r["month"]]]
