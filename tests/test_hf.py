"""Human-factor investigation: how NTSB findings are read (layers, roles, HFACS), and the build on real data."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "etl" / "hf"))
import codes as K  # noqa: E402

OUT = ROOT / "web" / "public" / "data" / "hf"


def test_personnel_findings_are_the_person_layer_whoever_the_person_is():
    for person in (44, 41, 31, 43):  # pilot, mechanic, controller, passenger
        assert K.layer(2, 6, person) == K.PERSON


def test_a_parameter_not_maintained_is_an_undesired_state_not_a_hardware_failure():
    # 106202020: Aircraft - oper/perf/capability - Directional control - Not attained/maintained
    assert K.layer(1, 6, 20) == K.STATE


def test_aircraft_findings_split_between_failure_and_mishandling():
    assert K.layer(1, 5, 1) == K.MACHINE  # power plant, failure
    assert K.layer(1, 3, 6) == K.MACHINE  # structure, fatigue/wear/corrosion
    assert K.layer(1, 2, 11) == K.HANDLING  # system, incorrect use/operation
    assert K.layer(1, 5, 13) == K.HANDLING  # power plant, incorrect service/maintenance
    assert K.layer(1, 7, 24) == K.HANDLING  # fuel, fluid level (exhaustion)
    assert K.layer(1, 2, 99) == 0  # not specified: no layer


def test_environment_organization_and_undetermined():
    assert K.layer(3, 3, 99) == K.ENV
    assert K.layer(4, 2, 99) == K.ORG
    assert K.layer(5, 0, 0) == K.UNDET


def test_old_coding_names_a_person_through_the_person_code():
    assert K.old_layer(24200, 3100, 4000) == K.PERSON  # aircraft control, not maintained, pilot in command
    assert K.old_layer(24200, 3100, 4107) == K.PERSON  # company maintenance personnel
    assert K.old_layer(14000, 1135, 0) == K.MACHINE  # engine assembly, total failure
    assert K.old_layer(17000, 1131, 0) == 0  # fluid, exhaustion: not a hardware failure
    assert K.old_layer(20000, 2201, 0) == K.ENV  # weather condition
    assert K.old_layer(91000, 0, 6114) == K.ORG  # insufficient standards, FAA


def test_roles_group_the_people_named():
    assert K.role(44) == "pilot"
    assert K.role(46) == "training"
    assert K.role(41) == "maintenance"
    assert K.role(31) == "atc"
    assert K.role(77) == "other"


def test_hfacs_reading_of_personnel_findings():
    assert K.hfacs(2, 6, 30, 40) == "skill"  # aircraft control
    assert K.hfacs(2, 4, 15, 20) == "decision"  # decision making/judgment
    assert K.hfacs(2, 4, 10, 10) == "decision"  # incorrect action selection
    assert K.hfacs(2, 4, 10, 15) == "skill"  # incorrect action performance
    assert K.hfacs(2, 2, 20, 25) == "perception"  # spatial disorientation
    assert K.hfacs(2, 2, 15, 45) == "skill"  # monitoring environment: an attention failure
    assert K.hfacs(2, 6, 10, 30) == "decision"  # fuel planning
    assert K.hfacs(2, 1, 20, 15) == "physical"  # alcohol
    assert K.hfacs(2, 3, 10, 25) == "experience"
    assert K.hfacs(2, 6, 35, 40) == "crew"  # CRM
    assert K.hfacs(4, 3, 20, 0) == "supervision"
    assert K.hfacs(4, 2, 10, 15) == "organization"
    assert K.hfacs(1, 6, 20, 20) is None


def test_every_error_label_reads_into_an_hfacs_family():
    families = {k for k, _, _ in K.HFACS}
    for key in K.ERRORS:
        assert K.hfacs(2, *key) in families


real = pytest.mark.skipif(not (OUT / "accidents.json").exists(), reason="hf data not built")


@real
def test_cells_add_up_to_the_accidents_counted():
    acc = json.loads((OUT / "accidents.json").read_text())
    meta = json.loads((OUT / "meta.json").read_text())
    assert sum(c[4] for c in acc["cells"]) == meta["accidents"]
    first, last = acc["period"]
    assert {c[0] for c in acc["cells"]} == set(range(first, last + 1))


@real
def test_people_and_events_agree_with_the_cells():
    acc = json.loads((OUT / "accidents.json").read_text())
    people = json.loads((OUT / "people.json").read_text())
    events = json.loads((OUT / "events.json").read_text())
    person = sum(c[4] for c in acc["cells"] if c[3] & K.PERSON)
    assert people["by"]["all|all"]["person"] == person
    assert sum(r[1] for r in events["by"]["all|all"]) == sum(c[4] for c in acc["cells"])
    assert sum(r[2] for r in events["by"]["all|all"]) == person
