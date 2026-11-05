"""The airliners the investigation compares, by ICAO type designator (ICAO Doc 8643, the code the OpenSky
Network and the aircraft registries carry): a reader's name, a family, a maker and a size class.

Only these types are counted as airliners; every other type (business jets, light aircraft, military,
helicopters) is left out of the comparisons. A type absent from this table never reaches the page.
"""

# code: (name, family, maker, kind)  kind: "regional" (≤ 100 seats), "narrow" (single aisle), "wide"
TYPES: dict[str, tuple[str, str, str, str]] = {
    # Airbus single aisle
    "A318": ("Airbus A318", "A320", "Airbus", "narrow"),
    "A319": ("Airbus A319", "A320", "Airbus", "narrow"),
    "A320": ("Airbus A320", "A320", "Airbus", "narrow"),
    "A321": ("Airbus A321", "A320", "Airbus", "narrow"),
    "A19N": ("Airbus A319neo", "A320neo", "Airbus", "narrow"),
    "A20N": ("Airbus A320neo", "A320neo", "Airbus", "narrow"),
    "A21N": ("Airbus A321neo", "A320neo", "Airbus", "narrow"),
    "BCS1": ("Airbus A220-100", "A220", "Airbus", "narrow"),
    "BCS3": ("Airbus A220-300", "A220", "Airbus", "narrow"),
    # Airbus wide body
    "A306": ("Airbus A300-600", "A300", "Airbus", "wide"),
    "A332": ("Airbus A330-200", "A330", "Airbus", "wide"),
    "A333": ("Airbus A330-300", "A330", "Airbus", "wide"),
    "A338": ("Airbus A330-800neo", "A330neo", "Airbus", "wide"),
    "A339": ("Airbus A330-900neo", "A330neo", "Airbus", "wide"),
    "A343": ("Airbus A340-300", "A340", "Airbus", "wide"),
    "A346": ("Airbus A340-600", "A340", "Airbus", "wide"),
    "A359": ("Airbus A350-900", "A350", "Airbus", "wide"),
    "A35K": ("Airbus A350-1000", "A350", "Airbus", "wide"),
    "A388": ("Airbus A380", "A380", "Airbus", "wide"),
    # Boeing single aisle
    "B712": ("Boeing 717", "717", "Boeing", "narrow"),
    "B733": ("Boeing 737-300", "737 Classic", "Boeing", "narrow"),
    "B734": ("Boeing 737-400", "737 Classic", "Boeing", "narrow"),
    "B735": ("Boeing 737-500", "737 Classic", "Boeing", "narrow"),
    "B736": ("Boeing 737-600", "737 NG", "Boeing", "narrow"),
    "B737": ("Boeing 737-700", "737 NG", "Boeing", "narrow"),
    "B738": ("Boeing 737-800", "737 NG", "Boeing", "narrow"),
    "B739": ("Boeing 737-900", "737 NG", "Boeing", "narrow"),
    "B37M": ("Boeing 737 MAX 7", "737 MAX", "Boeing", "narrow"),
    "B38M": ("Boeing 737 MAX 8", "737 MAX", "Boeing", "narrow"),
    "B39M": ("Boeing 737 MAX 9", "737 MAX", "Boeing", "narrow"),
    "B3XM": ("Boeing 737 MAX 10", "737 MAX", "Boeing", "narrow"),
    "B752": ("Boeing 757-200", "757", "Boeing", "narrow"),
    "B753": ("Boeing 757-300", "757", "Boeing", "narrow"),
    # Boeing wide body
    "B744": ("Boeing 747-400", "747", "Boeing", "wide"),
    "B748": ("Boeing 747-8", "747", "Boeing", "wide"),
    "B762": ("Boeing 767-200", "767", "Boeing", "wide"),
    "B763": ("Boeing 767-300", "767", "Boeing", "wide"),
    "B764": ("Boeing 767-400", "767", "Boeing", "wide"),
    "B772": ("Boeing 777-200", "777", "Boeing", "wide"),
    "B77L": ("Boeing 777-200LR", "777", "Boeing", "wide"),
    "B773": ("Boeing 777-300", "777", "Boeing", "wide"),
    "B77W": ("Boeing 777-300ER", "777", "Boeing", "wide"),
    "B788": ("Boeing 787-8", "787", "Boeing", "wide"),
    "B789": ("Boeing 787-9", "787", "Boeing", "wide"),
    "B78X": ("Boeing 787-10", "787", "Boeing", "wide"),
    "MD11": ("McDonnell Douglas MD-11", "MD-11", "Boeing", "wide"),
    # regional jets
    "CRJ2": ("Bombardier CRJ200", "CRJ", "Bombardier", "regional"),
    "CRJ7": ("Bombardier CRJ700", "CRJ", "Bombardier", "regional"),
    "CRJ9": ("Bombardier CRJ900", "CRJ", "Bombardier", "regional"),
    "CRJX": ("Bombardier CRJ1000", "CRJ", "Bombardier", "regional"),
    "E170": ("Embraer 170", "E-Jet", "Embraer", "regional"),
    "E75L": ("Embraer 175", "E-Jet", "Embraer", "regional"),
    "E190": ("Embraer 190", "E-Jet", "Embraer", "regional"),
    "E195": ("Embraer 195", "E-Jet", "Embraer", "regional"),
    "E290": ("Embraer 190-E2", "E-Jet E2", "Embraer", "regional"),
    "E295": ("Embraer 195-E2", "E-Jet E2", "Embraer", "regional"),
    "E145": ("Embraer 145", "ERJ", "Embraer", "regional"),
    "SU95": ("Sukhoï Superjet 100", "Superjet", "Sukhoï", "regional"),
    # turboprops
    "AT43": ("ATR 42-300", "ATR", "ATR", "regional"),
    "AT45": ("ATR 42-500", "ATR", "ATR", "regional"),
    "AT46": ("ATR 42-600", "ATR", "ATR", "regional"),
    "AT72": ("ATR 72", "ATR", "ATR", "regional"),
    "AT75": ("ATR 72-500", "ATR", "ATR", "regional"),
    "AT76": ("ATR 72-600", "ATR", "ATR", "regional"),
    "DH8A": ("Dash 8-100", "Dash 8", "De Havilland Canada", "regional"),
    "DH8B": ("Dash 8-200", "Dash 8", "De Havilland Canada", "regional"),
    "DH8C": ("Dash 8-300", "Dash 8", "De Havilland Canada", "regional"),
    "DH8D": ("Dash 8-400", "Dash 8", "De Havilland Canada", "regional"),
    # others
    "C919": ("Comac C919", "C919", "Comac", "narrow"),
    "AJ27": ("Comac ARJ21", "ARJ21", "Comac", "regional"),
}

KIND_FR = {"regional": "régional", "narrow": "monocouloir", "wide": "gros-porteur"}

# type designators that are one model for the reader (the short-wing Embraer 175)
ALIAS = {"E75S": "E75L"}

# Where the engines hang, for the drawings (etl/avions/build_dims.py): under the wings unless listed here.
# "rear": two engines on the rear fuselage (CRJ, ERJ 145, Boeing 717); "tri": two under the wings and one
# in the tail (MD-11).
MOUNT: dict[str, str] = {
    "CRJ2": "rear",
    "CRJ7": "rear",
    "CRJ9": "rear",
    "CRJX": "rear",
    "E145": "rear",
    "B712": "rear",
    "MD11": "tri",
}
