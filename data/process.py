"""Process SDOT raw data into app-ready GeoJSON.

Reads:
  data/raw/light-rail-alignment.geojson
  data/raw/light-rail-stations.geojson

Writes:
  public/line1-alignment.geojson
  public/line2-alignment.geojson
  public/all-stations.geojson

Run from project root: python3 data/process.py
"""

import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Station name corrections (SDOT → Sound Transit current names) ──
NAME_MAP = {
    "NE 145th Station": "Shoreline South/148th Station",
    "University Street Station": "Symphony Station",
}

# ── Missing stations with approximate coordinates ──
MISSING_STATIONS = [
    ("Lynnwood City Center Station", -122.2948, 47.8156),
    ("Mountlake Terrace Station", -122.3148, 47.7850),
    ("Shoreline North/185th Station", -122.3229, 47.7641),
    ("Kent Des Moines Station", -122.2953, 47.4110),
    ("Star Lake Station", -122.2930, 47.3940),
    ("Federal Way Downtown Station", -122.3120, 47.3170),
    ("Marymoor Village Station", -122.1180, 47.6620),
    ("Downtown Redmond Station", -122.1248, 47.6732),
]

# ── Official station orders ──
LINE_1_ORDER = [
    "Lynnwood City Center Station",
    "Mountlake Terrace Station",
    "Shoreline North/185th Station",
    "Shoreline South/148th Station",
    "Northgate Station",
    "Roosevelt Station",
    "U District Station",
    "University of Washington Station",
    "Capitol Hill Station",
    "Westlake Station",
    "Symphony Station",
    "Pioneer Square Station",
    "International District Station",
    "Stadium Station",
    "SODO Station",
    "Beacon Hill Station",
    "Mount Baker Station",
    "Columbia City Station",
    "Othello Station",
    "Rainier Beach Station",
    "Tukwila International Blvd Station",
    "Airport / SeaTac Station",
    "Angle Lake Station",
    "Kent Des Moines Station",
    "Star Lake Station",
    "Federal Way Downtown Station",
]

LINE_2_ORDER = [
    "Lynnwood City Center Station",
    "Mountlake Terrace Station",
    "Shoreline North/185th Station",
    "Shoreline South/148th Station",
    "Northgate Station",
    "Roosevelt Station",
    "U District Station",
    "University of Washington Station",
    "Capitol Hill Station",
    "Westlake Station",
    "Symphony Station",
    "Pioneer Square Station",
    "International District Station",
    "Judkins Park Station",
    "Mercer Island Station",
    "South Bellevue Station",
    "East Main Station",
    "Bellevue Downtown Station",
    "Wilburton Station",
    "Spring District/120th Station",
    "Bel-Red/130th Station",
    "Overlake Village Station",
    "Redmond Technology Center Station",
    "Marymoor Village Station",
    "Downtown Redmond Station",
]

# Shared segment: first 13 stations (Lynnwood through Intl District)
SHARED_COUNT = 13
SHARED_NAMES = set(LINE_1_ORDER[:SHARED_COUNT])

TACOMA_KW = [
    "Commerce",
    "Theater District",
    "Convention Center",
    "Union Station",
    "Tacoma Dome",
    "South 25th",
]

# ── Stop codes (from Sound Transit website) ──
# Shared stations use the same code for both lines
# Line-specific stations use line-prefixed codes (1xx for Line 1, 2xx for Line 2)
STOP_CODES = {
    # Shared
    "Lynnwood City Center Station": 40,
    "Mountlake Terrace Station": 41,
    "Shoreline South/148th Station": 42,
    "Shoreline North/185th Station": 42,
    "Northgate Station": 43,
    "Roosevelt Station": 45,
    "U District Station": 46,
    "University of Washington Station": 47,
    "Capitol Hill Station": 48,
    "Westlake Station": 49,
    "Symphony Station": 50,
    "Pioneer Square Station": 51,
    "International District Station": 52,
}

LINE_1_CODES = {
    "Stadium Station": 54,
    "SODO Station": 55,
    "Beacon Hill Station": 56,
    "Mount Baker Station": 57,
    "Columbia City Station": 58,
    "Othello Station": 60,
    "Rainier Beach Station": 61,
    "Tukwila International Blvd Station": 63,
    "Airport / SeaTac Station": 64,
    "Angle Lake Station": 65,
    "Kent Des Moines Station": 66,
    "Star Lake Station": 67,
    "Federal Way Downtown Station": 68,
}

LINE_2_CODES = {
    "Judkins Park Station": 54,
    "Mercer Island Station": 55,
    "South Bellevue Station": 56,
    "East Main Station": 57,
    "Bellevue Downtown Station": 58,
    "Wilburton Station": 59,
    "Spring District/120th Station": 60,
    "Bel-Red/130th Station": 61,
    "Overlake Village Station": 62,
    "Redmond Technology Center Station": 63,
    "Marymoor Village Station": 64,
    "Downtown Redmond Station": 65,
}

# Offset distance for parallel lines in shared segment
OFFSET_METERS = 30


def offset_polyline(coords, meters, side="left"):
    """Offset a polyline perpendicular to its travel direction.
    'left' = left of travel direction (west for a south-bound line).
    'right' = right of travel direction (east for a south-bound line).
    Line 1 is always left/west, Line 2 is always right/east.
    """
    sign = -1 if side == "left" else 1
    result = []
    n = len(coords)

    for i in range(n):
        if i == 0:
            dx = coords[1][0] - coords[0][0]
            dy = coords[1][1] - coords[0][1]
        elif i == n - 1:
            dx = coords[-1][0] - coords[-2][0]
            dy = coords[-1][1] - coords[-2][1]
        else:
            dx = coords[i + 1][0] - coords[i - 1][0]
            dy = coords[i + 1][1] - coords[i - 1][1]

        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            result.append(list(coords[i]))
            continue

        # Perpendicular vector (90° clockwise for 'right')
        px = sign * dy / length
        py = sign * (-dx) / length

        lng, lat = coords[i]
        lat_rad = math.radians(lat)
        m_per_deg_lng = 111320 * math.cos(lat_rad)
        m_per_deg_lat = 110540

        result.append([
            lng + px * meters / m_per_deg_lng,
            lat + py * meters / m_per_deg_lat,
        ])
    return result


def main():
    # Load raw SDOT data
    with open(os.path.join(ROOT, "data/raw/light-rail-stations.geojson")) as f:
        raw_stations = json.load(f)

    # ── Build station coordinate index ──
    existing = [
        feat
        for feat in raw_stations["features"]
        if feat["properties"].get("STATUS") == "Existing / Under Construction"
        and not any(kw in list(feat["properties"].values())[2] for kw in TACOMA_KW)
    ]

    station_coords = {}
    for feat in existing:
        raw_name = list(feat["properties"].values())[2]
        name = NAME_MAP.get(raw_name, raw_name)
        station_coords[name] = feat["geometry"]["coordinates"]

    for name, lng, lat in MISSING_STATIONS:
        if name not in station_coords:
            station_coords[name] = [lng, lat]

    # ── Build continuous line geometries from station coordinates ──
    shared_coords = [station_coords[n] for n in LINE_1_ORDER[:SHARED_COUNT] if n in station_coords]
    line1_south_coords = [station_coords[n] for n in LINE_1_ORDER[SHARED_COUNT - 1 :] if n in station_coords]
    line2_east_coords = [station_coords[n] for n in LINE_2_ORDER[SHARED_COUNT - 1 :] if n in station_coords]

    # Offset shared segment: Line 1 west, Line 2 east
    # Stations are ordered north→south, so "right" of travel = west, "left" = east
    line1_shared = offset_polyline(shared_coords, OFFSET_METERS, side="right")  # west
    line2_shared = offset_polyline(shared_coords, OFFSET_METERS, side="left")   # east

    # Full line coordinates (join shared + exclusive, skip duplicate junction point)
    line1_full = line1_shared + line1_south_coords[1:]
    line2_full = line2_shared + line2_east_coords[1:]

    line1_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"line": "1-line"},
                "geometry": {"type": "LineString", "coordinates": line1_full},
            }
        ],
    }

    line2_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"line": "2-line"},
                "geometry": {"type": "LineString", "coordinates": line2_full},
            }
        ],
    }

    # ── Build station GeoJSON ──
    # Shared stations get a SINGLE marker centered between the two offset lines.
    # Exclusive stations use their actual coordinates.
    features = []

    def get_stop_code(name, line_id):
        if name in STOP_CODES:
            return STOP_CODES[name]
        if line_id == "1-line" and name in LINE_1_CODES:
            return LINE_1_CODES[name]
        if line_id == "2-line" and name in LINE_2_CODES:
            return LINE_2_CODES[name]
        return None

    # Shared stations: single centered marker
    for name in LINE_1_ORDER[:SHARED_COUNT]:
        if name not in station_coords:
            print(f"WARNING: Missing coords for {name}")
            continue
        # Center between the two offset positions
        coords = station_coords[name]  # original centerline position
        code = get_stop_code(name, "1-line")
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "line": "1-line",
                "stopCode": code,
                "shared": True,
                "lines": "1,2",
            },
            "geometry": {"type": "Point", "coordinates": coords},
        })

    # Line 1 exclusive stations (south of junction)
    for name in LINE_1_ORDER[SHARED_COUNT:]:
        if name not in station_coords:
            print(f"WARNING: Missing coords for {name}")
            continue
        code = get_stop_code(name, "1-line")
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "line": "1-line",
                "stopCode": code,
                "shared": False,
                "lines": "1",
            },
            "geometry": {"type": "Point", "coordinates": station_coords[name]},
        })

    # Line 2 exclusive stations (east of junction)
    for name in LINE_2_ORDER[SHARED_COUNT:]:
        if name not in station_coords:
            print(f"WARNING: Missing coords for {name}")
            continue
        code = get_stop_code(name, "2-line")
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "line": "2-line",
                "stopCode": code,
                "shared": False,
                "lines": "2",
            },
            "geometry": {"type": "Point", "coordinates": station_coords[name]},
        })

    stations_geojson = {"type": "FeatureCollection", "features": features}

    # ── Write output ──
    public = os.path.join(ROOT, "public")
    os.makedirs(public, exist_ok=True)

    for name, data in [
        ("line1-alignment", line1_geojson),
        ("line2-alignment", line2_geojson),
        ("all-stations", stations_geojson),
    ]:
        path = os.path.join(public, f"{name}.geojson")
        with open(path, "w") as f:
            json.dump(data, f)

    unique = set(feat["properties"]["name"] for feat in features)
    print(f"Stations: {len(features)} features ({len(unique)} unique)")
    print(f"Line 1: {len(line1_full)} points")
    print(f"Line 2: {len(line2_full)} points")
    print(f"Shared offset: {OFFSET_METERS}m (Line 1 west, Line 2 east)")


if __name__ == "__main__":
    main()
