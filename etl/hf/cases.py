# ruff: noqa: E501  (the French labels are keyed by the full NTSB descriptions)
"""Six well-known accidents, read with the grid of the story: the findings the NTSB coded for each one, in
French, with who they name and where they sit in the models (Reason, HFACS, TEM).

The findings, their status (cause, contributing factor, outside the probable cause) and the people they
name are the NTSB's (table Findings); the French labels and the place of each finding in the diagram are
the investigation's. The summaries, probable causes and what followed live in web/src/hf/cases.js, with
their sources. A finding without a French label stops the build.
"""

from __future__ import annotations

import re

import codes as K

# the accidents, by NTSB case number, in the order of the page
CASES = [
    ("colgan", "DCA09MA027"),
    ("hudson", "DCA09MA026"),
    ("asiana", "DCA13MA120"),
    ("southwest", "DCA18MA142"),
    ("atlas", "DCA19MA086"),
    ("calabasas", "DCA20MA059"),
]

# where a finding sits in the diagram: the human chain of Reason and HFACS (organization, preconditions,
# unsafe acts), then the threats of TEM (the aircraft, the environment)
COLUMNS = [
    ("org", "Organisation et autorités"),
    ("pre", "Conditions préalables"),
    ("acts", "Actes"),
    ("aircraft", "Appareil"),
    ("env", "Environnement"),
]
LEVEL = {k: lv for k, _, lv in K.HFACS}


def column(category: int, sub: int, section: int, subsection: int) -> str | None:
    """The column of one finding; undetermined findings (category 5) are not drawn."""
    if category == 4:
        return "org"
    if category == 2:
        return "acts" if LEVEL.get(K.hfacs(2, sub, section, subsection)) == 1 else "pre"
    if category == 1:
        return "aircraft"
    if category == 3:
        return "env"
    return None


# who a personnel or organizational finding names: the last part of the NTSB description
ACTORS = {
    "Pilot": "Pilote",
    "Copilot": "Copilote",
    "Flight crew": "Équipage",
    "Cabin crew": "Équipage de cabine",
    "Passenger": "Passagers",
    "ATC personnel": "Contrôle aérien",
    "Operator": "Exploitant",
    "FAA/Regulator": "FAA (autorité)",
    "Emergency services": "Secours",
    "Airport": "Aéroport",
    "Not specified": "Non précisé",
    "Unknown/Not determined": "Non précisé",
}


def actor(category: int, description: str) -> str:
    if category == 1:
        return "Appareil"
    if category == 3:
        return "Environnement"
    if category == 5:
        return "Indéterminé"
    return ACTORS.get(description.split("-")[-1].strip(), "Non précisé")


def clean(description: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\s*-\s*", "-", str(description))).strip()


# the French label of every finding of the six accidents, keyed by the NTSB description
FR = {
    # Colgan Air 3407
    "Aircraft-Aircraft systems-Navigation system-Stall warning system-Incorrect use/operation": "Alerte de décrochage : mauvaise réponse",
    "Personnel issues-Action/decision-Action-Incorrect action selection-Pilot": "Mauvais choix d'action",
    "Personnel issues-Psychological-Attention/monitoring-Monitoring equip/instruments-Flight crew": "Surveillance des instruments",
    "Personnel issues-Task performance-Communication (personnel)-CRM/MRM techniques-Flight crew": "Travail en équipage (CRM)",
    "Personnel issues-Task performance-Workload management-(general)-Pilot": "Gestion de la charge de travail",
    "Organizational issues-Management-Policy/procedure-Adequacy of policy/proc-Operator": "Procédures inadaptées",
    "Environmental issues-Conditions/weather/phenomena-Temp/humidity/pressure-Conducive to structural icing-Not specified": "Conditions givrantes",
    "Aircraft-Aircraft systems-Indicating/recording systems-Instrument panel-Not installed/available": "Tableau de bord : équipement absent",
    "Personnel issues-Physical-Alertness/Fatigue-(general)-Unknown/Not determined": "Fatigue",
    "Organizational issues-Support/oversight/monitoring-Documentation/record keeping-Personnel records-Operator": "Dossiers des pilotes",
    "Organizational issues-Support/oversight/monitoring-Training-Recurrent training-Operator": "Formation continue",
    "Organizational issues-Support/oversight/monitoring-Oversight-Oversight of operation-FAA/Regulator": "Surveillance de l'exploitant",
    "Organizational issues-Support/oversight/monitoring-Safety programs-(general)-Operator": "Programmes de sécurité",
    "Environmental issues-Conditions/weather/phenomena-(general)-(general)-Availability of related info": "Information météo",
    # US Airways 1549
    "Environmental issues-Physical environment-Object/animal/substance-Animal(s)/bird(s)-Effect on equipment": "Oiseaux aspirés par les moteurs",
    "Organizational issues-Development-Selection/certification/testing-Equip certification/testing-FAA/Regulator": "Certification de l'appareil",
    "Aircraft-Aircraft oper/perf/capability-Performance/control parameters-(general)-Related operating info": "Paramètres de vol",
    "Aircraft-Aircraft oper/perf/capability-Performance/control parameters-Airspeed-Not attained/maintained": "Vitesse non tenue",
    "Environmental issues-Task environment-Pressures/demands-Other pressure/demand-Effect on personnel": "Pression de l'urgence sur l'équipage",
    "Aircraft-Aircraft systems-Indicating/recording systems-(general)-Not specified": "Instruments et enregistreurs",
    "Organizational issues-Management-Policy/procedure-(general)-Airport": "Procédures",
    "Aircraft-Aircraft systems-Equipment/furnishings-Passenger compartment equip-Related operating info": "Équipement de cabine",
    "Environmental issues-Operating environment-Air traffic/operating proc-(general)-Not specified": "Circulation aérienne",
    "Aircraft-Aircraft structures-Fuselage-(general)-Design": "Fuselage : conception",
    "Personnel issues-Task performance-Communication (personnel)-Following instructions-Passenger": "Respect des consignes",
    # Asiana 214
    "Personnel issues-Action/decision-Action-Incorrect action performance-Flight crew": "Geste mal exécuté",
    "Personnel issues-Action/decision-Action-Delayed action-Flight crew": "Réaction tardive",
    "Aircraft-Aircraft systems-Auto flight system-Auto throttle system-Related operating info": "Automanette : fonctionnement mal décrit",
    "Personnel issues-Action/decision-Info processing/decision-Understanding/comprehension-Flight crew": "Compréhension",
    "Personnel issues-Experience/knowledge-Training-Training with equipment-Pilot": "Formation sur l'appareil",
    "Personnel issues-Physical-Alertness/Fatigue-Circadian rhythms or jetlag-Flight crew": "Fatigue, décalage horaire",
    "Not determined-Not determined-(general)-(general)-Unknown/Not determined": "Indéterminé",
    "Aircraft-Aircraft systems-Equipment/furnishings-Escape slide-Capability exceeded": "Toboggans d'évacuation",
    "Organizational issues-Management-Policy/procedure-Adequacy of policy/proc-Emergency services": "Procédures inadaptées",
    "Organizational issues-Management-Policy/procedure-Availability of policy/proc-Emergency services": "Procédures manquantes",
    "Aircraft-Aircraft systems-Equipment/furnishings-Passenger compartment equip-Not used/operated": "Équipement de cabine non utilisé",
    "Organizational issues-Management-Resources-Availability of personnel-Emergency services": "Effectifs",
    "Organizational issues-Support/oversight/monitoring-Training-(general)-Emergency services": "Formation",
    "Environmental issues-Operating environment-Communication system-(general)-Not specified": "Communications",
    # Southwest 1380
    "Aircraft-Aircraft power plant-Engine (turbine/turboprop)-Compressor section-Fatigue/wear/corrosion": "Aube de soufflante : fissure de fatigue",
    "Aircraft-Aircraft structures-Nacelles/pylons structure-Nacelle/pylon misc structure-Damaged/degraded": "Capot du moteur arraché",
    "Aircraft-Aircraft structures-Windows-windshield system-Passenger compartment windows-Damaged/degraded": "Hublot de cabine arraché",
    "Organizational issues-Management-Resources-Availability of documents/info-FAA/Regulator": "Documents disponibles",
    "Personnel issues-Action/decision-Action-Lack of action-Cabin crew": "Absence de réaction",
    # Atlas Air 3591
    "Personnel issues-Action/decision-Action-Incorrect action performance-Copilot": "Geste mal exécuté",
    "Aircraft-Aircraft systems-Auto flight system-(general)-Unintentional use/operation": "Remise des gaz enclenchée par mégarde",
    "Personnel issues-Task performance-Use of equip/info-Use of automation-Copilot": "Usage des automatismes",
    "Organizational issues-Support/oversight/monitoring-Documentation/record keeping-Personnel records-Not specified": "Dossiers des pilotes",
    "Organizational issues-Support/oversight/monitoring-Documentation/record keeping-Personnel records-FAA/Regulator": "Base des dossiers de pilotes",
    "Personnel issues-Experience/knowledge-Experience/qualifications-Qualification/certification-Copilot": "Qualification",
    "Personnel issues-Psychological-Perception/orientation/illusion-(general)-Copilot": "Illusion sensorielle",
    "Personnel issues-Experience/knowledge-(general)-(general)-Copilot": "Expérience, connaissances",
    "Personnel issues-Psychological-Personality/attitude-Personality-Copilot": "Personnalité",
    "Personnel issues-Psychological-Attention/monitoring-Attention-Pilot": "Attention",
    "Aircraft-Aircraft systems-Indicating/recording systems-Data recorders (flight/maint)-Design": "Enregistreurs : conception",
    "Aircraft-Aircraft systems-Auto flight system-(general)-Design": "Automatismes : conception",
    # Calabasas, Island Express S-76B
    "Personnel issues-Action/decision-Info processing/decision-Decision making/judgment-Pilot": "Décision de poursuivre le vol",
    "Personnel issues-Psychological-Perception/orientation/illusion-Spatial disorientation-Pilot": "Désorientation spatiale",
    "Personnel issues-Task performance-Use of equip/info-Aircraft control-Pilot": "Contrôle de l'appareil",
    "Personnel issues-Psychological-Personality/attitude-Motivation/respond to pressure-Pilot": "Pression qu'il s'impose",
    "Organizational issues-Support/oversight/monitoring-Safety programs-Adequacy of safety program-Operator": "Système de gestion de la sécurité",
    "Environmental issues-Operating environment-Air traffic/operating proc-(general)-Compliance w/ procedure": "Respect des procédures",
    "Environmental issues-Conditions/weather/phenomena-Ceiling/visibility/precip-Clouds-Decision related to condition": "Nuages bas",
    "Aircraft-Aircraft systems-Indicating/recording systems-Data recorders (flight/maint)-Not installed/available": "Enregistreurs absents",
    "Personnel issues-Task performance-Communication (personnel)-Lack of communication-ATC personnel": "Défaut de communication",
}

# the type of investigation, the fifth character of the NTSB number (NTSB data dictionary, field ntsb_no:
# "M is major, F is regional, I is incident only, L is limited, G is government agency")
KINDS = [("M", "Enquête majeure"), ("F", "Enquête régionale"), ("L", "Enquête limitée")]
