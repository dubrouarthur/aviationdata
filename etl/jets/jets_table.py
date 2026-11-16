"""The business jets the investigation counts, by ICAO type designator (ICAO Doc 8643, the code that the
OpenSky Network and the aircraft registries carry): a reader's name and a maker.

A closed list, like etl/avions/types_table.py for the airliners: only these types are business jets. Left
out on purpose:
- airliners flown as business jets (Boeing Business Jet, Airbus ACJ, Embraer Lineage): their type code
  is the airliner's (B737, A319, E190), the data cannot tell them apart;
- the Embraer ERJ-135 (E135), an airliner; its business version, the Legacy 600/650, has its own code
  (E35L) and is counted;
- turboprops (King Air, Pilatus PC-12, TBM): private aviation, but not jets.

Size: the ICAO wake turbulence category of Doc 8643, « L » (light, up to 7 t at take-off) or « M » (7 to
136 t), read from data/raw/aircraft/doc8643AircraftTypes.csv, never typed here.
"""

# code: (name, maker)
JETS: dict[str, tuple[str, str]] = {
    # Cessna Citation
    "C500": ("Citation I", "Cessna"),
    "C501": ("Citation I/SP", "Cessna"),
    "C510": ("Citation Mustang", "Cessna"),
    "C525": ("Citation CJ1", "Cessna"),
    "C25A": ("Citation CJ2", "Cessna"),
    "C25B": ("Citation CJ3", "Cessna"),
    "C25C": ("Citation CJ4", "Cessna"),
    "C25M": ("Citation M2", "Cessna"),
    "C550": ("Citation II", "Cessna"),
    "C551": ("Citation II/SP", "Cessna"),
    "C55B": ("Citation Bravo", "Cessna"),
    "C560": ("Citation V, Ultra, Encore", "Cessna"),
    "C56X": ("Citation Excel/XLS", "Cessna"),
    "C650": ("Citation III, VI, VII", "Cessna"),
    "C680": ("Citation Sovereign", "Cessna"),
    "C68A": ("Citation Latitude", "Cessna"),
    "C700": ("Citation Longitude", "Cessna"),
    "C750": ("Citation X", "Cessna"),
    # Embraer
    "E50P": ("Phenom 100", "Embraer"),
    "E55P": ("Phenom 300", "Embraer"),
    "E545": ("Legacy 450, Praetor 500", "Embraer"),
    "E550": ("Legacy 500, Praetor 600", "Embraer"),
    "E35L": ("Legacy 600, 650", "Embraer"),
    # Bombardier
    "CL30": ("Challenger 300", "Bombardier"),
    "CL35": ("Challenger 350", "Bombardier"),
    "CL60": ("Challenger 600 à 650", "Bombardier"),
    "GLEX": ("Global Express, 6000", "Bombardier"),
    "GL5T": ("Global 5000, 5500", "Bombardier"),
    "GL6T": ("Global 6500", "Bombardier"),
    "GL7T": ("Global 7500", "Bombardier"),
    "LJ31": ("Learjet 31", "Bombardier"),
    "LJ35": ("Learjet 35", "Bombardier"),
    "LJ40": ("Learjet 40", "Bombardier"),
    "LJ45": ("Learjet 45", "Bombardier"),
    "LJ55": ("Learjet 55", "Bombardier"),
    "LJ60": ("Learjet 60", "Bombardier"),
    "LJ70": ("Learjet 70", "Bombardier"),
    "LJ75": ("Learjet 75", "Bombardier"),
    "LJ85": ("Learjet 85", "Bombardier"),
    # Dassault
    "FA10": ("Falcon 10", "Dassault"),
    "FA20": ("Falcon 20", "Dassault"),
    "FA50": ("Falcon 50", "Dassault"),
    "F900": ("Falcon 900", "Dassault"),
    "F2TH": ("Falcon 2000", "Dassault"),
    "FA5X": ("Falcon 5X", "Dassault"),
    "FA6X": ("Falcon 6X", "Dassault"),
    "FA7X": ("Falcon 7X", "Dassault"),
    "FA8X": ("Falcon 8X", "Dassault"),
    # Gulfstream
    "ASTR": ("Astra, G100", "Gulfstream"),
    "G150": ("G150", "Gulfstream"),
    "GALX": ("Galaxy, G200", "Gulfstream"),
    "G280": ("G280", "Gulfstream"),
    "GLF2": ("Gulfstream II", "Gulfstream"),
    "GLF3": ("Gulfstream III", "Gulfstream"),
    "GLF4": ("Gulfstream IV, G450", "Gulfstream"),
    "GLF5": ("Gulfstream V, G550", "Gulfstream"),
    "GLF6": ("G650", "Gulfstream"),
    "GA5C": ("G500", "Gulfstream"),
    "GA6C": ("G600", "Gulfstream"),
    "GA7C": ("G700", "Gulfstream"),
    "GA8C": ("G800", "Gulfstream"),
    # Hawker, Beechcraft, Raytheon
    "H25A": ("Hawker 125", "Hawker"),
    "H25B": ("Hawker 700 à 900", "Hawker"),
    "H25C": ("Hawker 1000", "Hawker"),
    "HA4T": ("Hawker 4000", "Hawker"),
    "BE40": ("Beechjet 400, Hawker 400", "Hawker"),
    "PRM1": ("Premier I", "Hawker"),
    "MU30": ("Diamond", "Mitsubishi"),
    # the others
    "HDJT": ("HondaJet", "Honda"),
    "PC24": ("PC-24", "Pilatus"),
    "SF50": ("Vision Jet", "Cirrus"),
    "EA50": ("Eclipse 500", "Eclipse"),
    "SJ30": ("SJ30", "SyberJet"),
    "WW24": ("Westwind", "IAI"),
}
