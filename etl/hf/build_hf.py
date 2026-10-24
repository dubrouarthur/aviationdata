"""The human factor in aviation accidents: what the NTSB cites as the probable cause.

Inputs: data/raw/ntsb/csv/ (ntsb.py), the NTSB aviation accident database.
Scope: accidents (not incidents) in the United States, the only country where the NTSB rules on the
probable cause of every civil aviation accident; years from 2008 (new coding) to the last year whose
investigations are closed (90 % of accidents and of fatal accidents with a probable cause).

Writes web/public/data/hf/:
- accidents.json: one cell per year x segment x severity x layer mask: accidents, fatal accidents, deaths;
  every share of the story is a sum of cells;
- people.json: who is named (roles), which errors (top personnel findings), HFACS families and levels,
  per segment and severity;
- events.json: the defining event of each accident (loss of control, CFIT, engine power...), per segment
  and severity, with the accidents citing a person;
- history.json: share of accidents citing a person or a hardware failure, per year, 1982-2007 (old coding)
  and 2008 onwards (new coding);
- meta.json: sources, period, completeness of the recent years.
"""

from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import codes as K
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / "data" / "raw" / "ntsb" / "csv"
OUT = ROOT / "web" / "public" / "data" / "hf"
FIRST = 2008
SEGMENTS = [
    ("ga", "Aviation générale", {"091", "091K", "103", "125"}),
    ("taxi", "Taxi aérien et vols à la demande", {"135"}),
    ("airline", "Compagnies aériennes", {"121"}),
    ("work", "Travail aérien", {"137", "133"}),
    ("other", "Autres", set()),
]
SEVERITIES = [("FATL", "Mortel"), ("SERS", "Blessés graves"), ("MINR", "Blessés légers"), ("NONE", "Sans blessé")]
SEV = {k: i for i, (k, _) in enumerate(SEVERITIES)}
COMPLETE = 0.9  # share of accidents, and of fatal accidents, with a probable cause for a year to count


def read(db: str, table: str, cols: list[str]) -> pd.DataFrame:
    return pd.read_csv(CSV / db / f"{table}.csv", usecols=cols, dtype={"ev_id": str}, low_memory=False)


def segment(part) -> int:
    p = str(part).strip()
    for i, (_, _, parts) in enumerate(SEGMENTS):
        if p in parts:
            return i
    return len(SEGMENTS) - 1


def us_accidents(db: str) -> pd.DataFrame:
    ev = read(db, "events", ["ev_id", "ev_type", "ev_country", "ev_year", "ev_highest_injury", "inj_tot_f"])
    ev = ev[(ev.ev_type == "ACC") & (ev.ev_country == "USA")].copy()
    ev["inj_tot_f"] = ev.inj_tot_f.fillna(0).astype(int)
    ev["sev"] = ev.ev_highest_injury.map(SEV)
    ev.loc[ev.sev.isna() & (ev.inj_tot_f > 0), "sev"] = SEV["FATL"]
    ev["sev"] = ev.sev.fillna(SEV["NONE"]).astype(int)
    ac = read(db, "aircraft", ["ev_id", "Aircraft_Key", "far_part"]).sort_values(["ev_id", "Aircraft_Key"])
    part = ac.drop_duplicates("ev_id").set_index("ev_id").far_part
    ev["seg"] = ev.ev_id.map(part).map(segment)
    return ev.set_index("ev_id")


def phase_names(es: pd.DataFrame) -> dict[str, str]:
    """Each phase's name, the common start of the descriptions of its occurrences ("Landing", "Enroute")."""
    names = {}
    for ph, g in es.groupby("phase_no"):
        descs = g.Occurrence_Description.dropna().astype(str).unique()
        if len(descs) < 2:
            continue
        pre = os.path.commonprefix(list(descs))
        names[ph] = pre[: pre.rfind(" ")] if " " in pre else pre
    return names


def defining_events(ev: pd.DataFrame) -> pd.Series:
    es = read(
        "avall", "Events_Sequence", ["ev_id", "Aircraft_Key", "Occurrence_Description", "phase_no", "Defining_ev"]
    )
    es = es[es.ev_id.isin(ev.index)]
    names = phase_names(es)
    d = es[es.Defining_ev == 1].sort_values(["ev_id", "Aircraft_Key"]).drop_duplicates("ev_id").copy()

    def event(r):
        desc = str(r.Occurrence_Description).strip()
        ph = names.get(r.phase_no, "")
        return desc[len(ph) :].strip() if ph and desc.startswith(ph) else desc

    d["event"] = d.apply(event, axis=1)
    return d.set_index("ev_id").event.map(lambda e: e if e in K.EVENTS else "Miscellaneous/other")


def modern() -> tuple[pd.DataFrame, pd.DataFrame, list, int]:
    """US accidents since 2008 with their layers, roles, errors and HFACS families, and completeness."""
    ev = us_accidents("avall")
    ev = ev[ev.ev_year >= FIRST]
    fi = read(
        "avall",
        "Findings",
        ["ev_id", "category_no", "subcategory_no", "section_no", "subsection_no", "modifier_no", "cm_inPc"],
    )
    fi = fi[(fi.cm_inPc == "T") & fi.ev_id.isin(ev.index)].copy()
    for c in ["category_no", "subcategory_no", "section_no", "subsection_no", "modifier_no"]:
        fi[c] = fi[c].fillna(-1).astype(int)
    fi["bit"] = [K.layer(c, s, m) for c, s, m in zip(fi.category_no, fi.subcategory_no, fi.modifier_no, strict=True)]
    mask = defaultdict(int)
    for e, b in zip(fi.ev_id, fi.bit, strict=True):
        mask[e] |= b
    ev["mask"] = ev.index.map(lambda e: mask.get(e, 0))
    ev["pc"] = ev.index.isin(fi.ev_id)

    # completeness: the last year whose investigations are (almost) all closed
    comp = []
    last = FIRST
    for y, g in ev.groupby("ev_year"):
        fat = g[g.sev == SEV["FATL"]]
        comp.append([int(y), len(g), int(g.pc.sum()), len(fat), int(fat.pc.sum())])
        if y == last and g.pc.mean() >= COMPLETE and fat.pc.mean() >= COMPLETE:
            last = y + 1
    last -= 1
    kept = ev[(ev.ev_year <= last) & ev.pc].copy()

    people = fi[fi.ev_id.isin(kept.index) & fi.category_no.isin([2, 4])].copy()
    people["role"] = [
        K.role(m) if c == 2 else None for c, m in zip(people.category_no, people.modifier_no, strict=True)
    ]
    people["family"] = [
        K.hfacs(c, s, se, ss)
        for c, s, se, ss in zip(
            people.category_no, people.subcategory_no, people.section_no, people.subsection_no, strict=True
        )
    ]
    people["error"] = [
        K.error_key(s, se, ss) if c == 2 else None
        for c, s, se, ss in zip(
            people.category_no, people.subcategory_no, people.section_no, people.subsection_no, strict=True
        )
    ]
    kept["event"] = defining_events(kept).reindex(kept.index).fillna("Unknown or undetermined")
    return kept, people, comp, last


def cells(ev: pd.DataFrame) -> list[list[int]]:
    g = ev.groupby(["ev_year", "seg", "sev", "mask"]).agg(
        n=("pc", "size"), fatal=("sev", lambda s: int((s == SEV["FATL"]).sum())), deaths=("inj_tot_f", "sum")
    )
    return [[int(y), int(s), int(v), int(m), int(r.n), int(r.deaths)] for (y, s, v, m), r in g.iterrows()]


def groups(ev: pd.DataFrame):
    """Every filter of the page: all segments or one, all severities or one."""
    for s in [None, *range(len(SEGMENTS))]:
        for v in [None, *range(len(SEVERITIES))]:
            sel = ev
            if s is not None:
                sel = sel[sel.seg == s]
            if v is not None:
                sel = sel[sel.sev == v]
            key = f"{'all' if s is None else SEGMENTS[s][0]}|{'all' if v is None else SEVERITIES[v][0]}"
            yield key, sel


def count(p: pd.DataFrame, col: str) -> dict[str, int]:
    """Accidents per value of one column (an accident counts once per value)."""
    return {k: int(v) for k, v in p.dropna(subset=[col]).groupby(col).ev_id.nunique().items()}


def people_json(ev: pd.DataFrame, people: pd.DataFrame) -> dict:
    by = {}
    level_of = {k: lv for k, _, lv in K.HFACS}
    for key, sel in groups(ev):
        p = people[people.ev_id.isin(sel.index)]
        lv = p.dropna(subset=["family"]).assign(level=lambda d: d.family.map(level_of))
        by[key] = {
            "n": len(sel),
            "person": int(((sel["mask"] & K.PERSON) > 0).sum()),
            "roles": count(p, "role"),
            "controls": int(p[p.role.isin(K.AT_CONTROLS)].ev_id.nunique()),
            "errors": count(p, "error"),
            "hfacs": count(p, "family"),
            "levels": {str(k): int(v) for k, v in lv.groupby("level").ev_id.nunique().items()},
        }
    return {
        "roles": [[k, label] for k, label, _ in K.ROLES],
        "errors": [["-".join(map(str, k)), label, K.hfacs(2, *k)] for k, label in K.ERRORS.items()],
        "hfacs": [[k, label, lv] for k, label, lv in K.HFACS],
        "levels": {str(k): v for k, v in K.HFACS_LEVELS.items()},
        "by": by,
    }


def events_json(ev: pd.DataFrame) -> dict:
    order = ev.event.value_counts()
    by = {}
    for key, sel in groups(ev):
        g = sel.groupby("event")
        by[key] = [
            [e, int(len(x)), int(((x["mask"] & K.PERSON) > 0).sum()), int((x.sev == SEV["FATL"]).sum())]
            for e, x in sorted(g, key=lambda t: -len(t[1]))
        ]
    return {"events": [[e, K.EVENTS[e]] for e in order.index], "by": by}


def history(ev_new: pd.DataFrame, last: int) -> dict:
    ev = us_accidents("Pre2008")
    ev = ev[ev.ev_year.between(1982, FIRST - 1)]
    sq = read("Pre2008", "seq_of_events", ["ev_id", "Subj_Code", "Modifier_Code", "Person_Code", "Cause_Factor"])
    sq = sq[sq.Cause_Factor.fillna("").str.strip().isin(["C", "F"]) & sq.ev_id.isin(ev.index)]
    mask = defaultdict(int)
    for e, s, m, p in zip(
        sq.ev_id, sq.Subj_Code.fillna(0), sq.Modifier_Code.fillna(0), sq.Person_Code.fillna(0), strict=True
    ):
        mask[e] |= K.old_layer(int(s), int(m), int(p))
    ev = ev[ev.index.isin(mask)]
    ev["mask"] = ev.index.map(mask.get)

    def series(e):
        g = e.groupby("ev_year")["mask"]
        return [[int(y), int(len(m)), int(((m & K.PERSON) > 0).sum()), int(((m & K.MACHINE) > 0).sum())] for y, m in g]

    return {"old": series(ev), "new": series(ev_new[ev_new.ev_year <= last]), "break": FIRST}


def release() -> str:
    """The date of the NTSB file: its last change of a record."""
    d = pd.read_csv(CSV / "avall" / "events.csv", usecols=["lchg_date"]).lchg_date
    return pd.to_datetime(d, format="%m/%d/%y %H:%M:%S", errors="coerce").max().date().isoformat()


def build() -> None:
    ev, people, comp, last = modern()
    OUT.mkdir(parents=True, exist_ok=True)
    common = {
        "period": [FIRST, last],
        "segments": [[k, label] for k, label, _ in SEGMENTS],
        "severities": [[k, label] for k, label in SEVERITIES],
        "bits": K.BITS,
    }
    files = {
        "accidents": {**common, "cells": cells(ev), "completeness": comp},
        "people": {**common, **people_json(ev, people)},
        "events": {**common, **events_json(ev)},
        "history": history(ev, last),
        "meta": {
            "built": date.today().isoformat(),
            "period": [FIRST, last],
            "accidents": len(ev),
            "source": "NTSB, aviation accident database (avall.mdb, Pre2008.mdb), https://data.ntsb.gov/avdata",
            "release": release(),
        },
    }
    for name, obj in files.items():
        (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        print(f"wrote hf/{name}.json ({(OUT / f'{name}.json').stat().st_size // 1024} kB)")
    print(f"{len(ev)} accidents, {FIRST}-{last}; layers:", Counter(m & K.PERSON > 0 for m in ev["mask"]))


if __name__ == "__main__":
    build()
