"""How the NTSB codes what caused an accident, and how the investigation reads it.

Two coding systems coexist in the NTSB aviation database:

- since 2008 (table Findings), each finding is a 10-digit code: category (1 Aircraft, 2 Personnel issues,
  3 Environmental issues, 4 Organizational issues, 5 Not determined), subcategory, section, subsection and
  a modifier. For personnel the modifier names the person (44 Pilot, 41 Maintenance personnel...), for the
  aircraft it says what went wrong (1 Failure, 11 Incorrect use/operation, 20 Not attained/maintained...).
  Until 2020 each finding is marked C (cause) or F (contributing factor); since 2021 only the flag
  cm_inPc says whether it is cited in the probable cause. The investigation counts, every year, the
  findings cited in the probable cause (causes and factors);
- before 2008 (table seq_of_events), a subject code (10000-17999 aircraft, 19000-20999 environment,
  22000-25000 operations, 30000-69999 persons, 70000-93999 underlying conditions), a modifier and a
  person code (4000-4199: pilot in command, mechanic, controller...; 6000-6199: institutions), each
  marked C or F.

Every accident gets a set of "layers" (a bit mask): person, machine, environment, organization, undesired
aircraft state, aircraft mishandled, undetermined. The models of the story read the same mask.
"""

from __future__ import annotations

PERSON, MACHINE, ENV, ORG, STATE, HANDLING, UNDET = 1, 2, 4, 8, 16, 32, 64
BITS = {
    "person": PERSON,
    "machine": MACHINE,
    "env": ENV,
    "org": ORG,
    "state": STATE,
    "handling": HANDLING,
    "undet": UNDET,
}

# Aircraft findings (category 1): what the modifier says about the hardware
FAILURE_MODS = {1, 2, 5, 6, 7, 26}  # failure, malfunction, damaged, fatigue/wear/corrosion, design, inoperative
HANDLING_MODS = {9, 10, 11, 12, 13, 14, 15, 16, 22, 24, 25}  # use, service, inspection, fuel type/level/management
OPER_PERF = 6  # subcategory "Aircraft oper/perf/capability": a control parameter not attained or maintained


def layer(category: int, subcategory: int, modifier: int) -> int:
    """The layer bit of one finding of the modern coding (0 when it belongs to none)."""
    if category == 2:
        return PERSON
    if category == 3:
        return ENV
    if category == 4:
        return ORG
    if category == 5:
        return UNDET
    if category == 1:
        if subcategory == OPER_PERF:
            return STATE
        if modifier in FAILURE_MODS:
            return MACHINE
        if modifier in HANDLING_MODS:
            return HANDLING
    return 0


# Before 2008: aircraft and equipment modifiers that describe a failure of the hardware itself
OLD_FAILURE_MODS = {
    1105, 1109, 1112, 1116, 1117, 1121, 1124, 1129, 1134, 1135, 1137, 1150, 1151, 1154, 1158, 1159, 1160,
    1170, 1180, 1181, 1184, 1192, 1194, 1215, 1222, 1224, 1225, 1240, 1251,
}  # fmt: skip


def old_layer(subject: int, modifier: int, person: int) -> int:
    """The layer bit of one cause or factor of the pre-2008 coding."""
    if 4000 <= person < 4200:
        return PERSON
    if 6000 <= person < 6200 or 90000 <= subject < 94000:
        return ORG
    if 10000 <= subject < 18000 and person == 0 and modifier in OLD_FAILURE_MODS:
        return MACHINE
    if subject in (19001, 19200) or 20000 <= subject < 20300:
        return ENV
    if subject == 25000:
        return UNDET
    return 0


# ------------------------------------------------------------------ who: the person named by a finding
ROLES = [
    ("pilot", "Pilote aux commandes", {44, 33, 36}),
    ("training", "Instructeur ou élève", {40, 46, 35}),
    ("other_pilot", "Pilote d'un autre aéronef", {45}),
    ("maintenance", "Mécanicien ou constructeur", {41, 49}),
    ("atc", "Contrôle et information de vol", {31, 37, 34}),
    ("ground", "Sol, aéroport et régulation", {39, 48, 38, 47}),
    ("cabin", "Cabine et passagers", {32, 43}),
    ("other", "Autre ou non précisé", {0, 42, 99}),
]
ROLE_OF = {m: key for key, _, mods in ROLES for m in mods}
AT_CONTROLS = {"pilot", "training"}  # the people flying the aircraft: pilot, copilot, crew, instructor, student


def role(modifier: int) -> str:
    return ROLE_OF.get(modifier, "other")


# ------------------------------------------------------------------ what: personnel and organizational findings
# A reading of the NTSB personnel taxonomy along HFACS (Shappell and Wiegmann, 2000). The NTSB does not code
# violations as such: they fall where the finding puts them (decision, procedure). This mapping is the
# investigation's, not the NTSB's.
HFACS = [
    ("skill", "Erreurs d'exécution", 1),
    ("decision", "Erreurs de décision", 1),
    ("perception", "Erreurs de perception", 1),
    ("intent", "Actes délibérés", 1),
    ("physical", "État physique", 2),
    ("mental", "État mental", 2),
    ("experience", "Expérience et formation", 2),
    ("crew", "Communication et charge de travail", 2),
    ("supervision", "Supervision", 3),
    ("organization", "Organisation", 4),
]
HFACS_LEVELS = {
    1: "Actes dangereux",
    2: "Conditions préalables",
    3: "Supervision",
    4: "Influences de l'organisation",
}


def hfacs(category: int, sub: int, section: int, subsection: int) -> str | None:
    """The HFACS family of a personnel (category 2) or organizational (category 4) finding."""
    if category == 4:
        return "supervision" if sub == 3 else "organization"
    if category != 2:
        return None
    if sub == 1:
        return "physical"
    if sub == 3:
        return "experience"
    if sub == 5:
        return "intent"
    if sub == 2:
        if section == 15:  # attention and monitoring: attention failures are skill-based errors in HFACS
            return "skill"
        if section == 20:
            return "perception"
        return "mental"
    if sub == 4:
        if section == 15 or (section == 10 and subsection == 10):  # info processing, incorrect action selection
            return "decision"
        return "skill"
    if sub == 6:
        if section == 10:  # planning and preparation
            return "decision"
        if section == 30 and subsection in (32, 35):  # use of policy/procedure, of available resources
            return "decision"
        if section in (35, 40):  # communication, workload management (crew resource management)
            return "crew"
        return "skill"
    return None


# the most frequent personnel findings, in French, keyed by (subcategory, section, subsection)
ERRORS = {
    (6, 30, 40): "Contrôle de l'avion",
    (4, 15, 20): "Jugement, prise de décision",
    (4, 10, 15): "Geste mal exécuté",
    (6, 30, 15): "Utilisation d'un équipement",
    (4, 10, 25): "Réaction trop tardive",
    (2, 15, 45): "Surveillance de l'extérieur",
    (4, 10, 30): "Absence de réaction",
    (6, 10, 30): "Préparation du carburant",
    (6, 15, 10): "Visite avant vol",
    (4, 15, 10): "Identification d'un danger",
    (4, 10, 35): "Oubli, omission",
    (4, 10, 10): "Mauvais choix d'action",
    (6, 20, 35): "Montage d'une pièce",
    (2, 20, 25): "Désorientation spatiale",
    (2, 15, 20): "Vigilance",
    (6, 30, 30): "Usage de la check-list",
    (6, 20, 10): "Entretien courant",
    (2, 15, 40): "Surveillance des autres aéronefs",
    (2, 15, 10): "Attention",
    (2, 15, 35): "Surveillance d'une autre personne",
    (3, 10, 25): "Expérience sur l'appareil",
    (6, 30, 32): "Respect des procédures",
    (6, 10, 25): "Préparation de la navigation",
    (6, 15, 20): "Inspection programmée",
    (3, 10, 10): "Qualification, licence",
    (6, 10, 20): "Préparation météo",
    (2, 15, 25): "Surveillance des instruments",
    (6, 10, 10): "Calcul des performances",
    (2, 20, 35): "Conscience de la situation",
    (6, 10, 15): "Masse et centrage",
    (1, 20, 15): "Alcool",
    (6, 35, 10): "Défaut de communication",
    (1, 20, 25): "Médicaments sur ordonnance",
    (1, 20, 50): "Malaise cardiovasculaire",
    (1, 20, 20): "Drogues illicites",
}


def error_key(sub: int, section: int, subsection: int) -> str | None:
    k = (sub, section, subsection)
    return "-".join(map(str, k)) if k in ERRORS else None


# ------------------------------------------------------------------ the defining event of an accident (CICTT-like)
EVENTS = {
    "Loss of control on ground": "Perte de contrôle au sol",
    "Loss of control in flight": "Perte de contrôle en vol",
    "Loss of engine power (total)": "Perte totale de puissance",
    "Hard landing": "Atterrissage dur",
    "Loss of engine power (partial)": "Perte partielle de puissance",
    "Aerodynamic stall/spin": "Décrochage, vrille",
    "Collision during takeoff/land": "Collision au décollage ou à l'atterrissage",
    "Fuel exhaustion": "Panne sèche",
    "Controlled flight into terr/obj (CFIT)": "Impact sans perte de contrôle (CFIT)",
    "Abnormal runway contact": "Contact anormal avec la piste",
    "Runway excursion": "Sortie de piste",
    "Low altitude operation/event": "Vol à basse altitude",
    "Fuel starvation": "Carburant non distribué",
    "Sys/Comp malf/fail (non-power)": "Panne d'un système",
    "Collision with terr/obj (non-CFIT)": "Collision avec le relief ou un obstacle",
    "Nose over/nose down": "Capotage",
    "Landing gear collapse": "Rupture du train",
    "Unknown or undetermined": "Indéterminé",
    "Powerplant sys/comp malf/fail": "Panne du groupe motopropulseur",
    "Landing gear not configured": "Train non sorti",
    "Ground collision": "Collision au sol",
    "VFR encounter with IMC": "Vol à vue entré dans les nuages",
    "Fuel related": "Autre problème de carburant",
    "Flight control sys malf/fail": "Panne des commandes de vol",
    "Fuel contamination": "Carburant contaminé",
    "Part(s) separation from AC": "Perte d'une pièce en vol",
    "Turbulence encounter": "Turbulence",
    "Landing area overshoot": "Atterrissage long",
    "Birdstrike": "Collision avec un oiseau",
    "Midair collision": "Collision en vol",
    "Aircraft structural failure": "Rupture de la structure",
    "Cabin safety event": "Incident en cabine",
    "Ground handling event": "Incident de manutention au sol",
    "Tailstrike": "Queue touchant la piste",
    "Clear air turbulence encounter": "Turbulence en air clair",
    "Loss of lift": "Perte de portance",
    "Fire/smoke (non-impact)": "Feu ou fumée en vol",
    "Abrupt maneuver": "Manœuvre brutale",
    "Landing area undershoot": "Atterrissage trop court",
    "Windshear or thunderstorm": "Cisaillement de vent ou orage",
    "Loss of visual reference": "Perte des références visuelles",
    "Dynamic rollover": "Basculement dynamique",
    "Wildlife encounter (non-bird)": "Collision avec un animal",
    "Loss of tail rotor effectiveness": "Perte d'efficacité du rotor de queue",
    "Electrical system malf/failure": "Panne électrique",
    "Dragged wing/rotor/float/other": "Aile, rotor ou flotteur au sol",
    "AC/prop/rotor contact w person": "Personne heurtée par une hélice ou un rotor",
    "Settling with power/vortex ring state": "Vortex d'hélicoptère",
    "Inflight upset": "Perte d'assiette en vol",
    "Structural icing": "Givrage",
    "Medical event": "Malaise à bord",
    "Roll over": "Retournement",
    "External load event (Rotorcraft)": "Charge sous élingue",
    "Prop/jet/rotor blast/suction": "Souffle d'hélice ou de réacteur",
    "Airport occurrence": "Événement d'aéroport",
    "Aircraft wake turb encounter": "Turbulence de sillage",
    "Ground resonance": "Résonance sol",
    "Glider tow event": "Remorquage de planeur",
    "Security/criminal event": "Acte criminel",
    "Runway incursion veh/AC/person": "Incursion sur piste",
    "Aircraft loading event": "Chargement",
    "Explosion (non-impact)": "Explosion",
    "Missing aircraft": "Avion disparu",
    "Wrong surface or wrong airport": "Mauvaise piste ou mauvais aéroport",
    "Aircraft servicing event": "Service au sol",
    "Simulated/training event": "Exercice d'entraînement",
    "Flight instrument malf/fail": "Panne d'instrument",
    "Uncontained engine failure": "Rupture moteur non contenue",
    "Off-field or emergency landing": "Atterrissage d'urgence",
    "Wrong fuel": "Mauvais carburant",
    "Mast bumping": "Battement du mât rotor",
    "Comm system malf/failure": "Panne de radio",
    "Altitude deviation": "Écart d'altitude",
    "Navigation error": "Erreur de navigation",
    "Course deviation": "Écart de route",
    "Miscellaneous/other": "Autre",
}
