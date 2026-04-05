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

SHARED_COUNT = 13
SHARED_NAMES = set(LINE_1_ORDER[:SHARED_COUNT])

TACOMA_KW = [
    "Commerce", "Theater District", "Convention Center",
    "Union Station", "Tacoma Dome", "South 25th",
]

# ── Stop codes ──
STOP_CODES = {
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
    "Stadium Station": 54, "SODO Station": 55, "Beacon Hill Station": 56,
    "Mount Baker Station": 57, "Columbia City Station": 58,
    "Othello Station": 60, "Rainier Beach Station": 61,
    "Tukwila International Blvd Station": 63, "Airport / SeaTac Station": 64,
    "Angle Lake Station": 65, "Kent Des Moines Station": 66,
    "Star Lake Station": 67, "Federal Way Downtown Station": 68,
}

LINE_2_CODES = {
    "Judkins Park Station": 54, "Mercer Island Station": 55,
    "South Bellevue Station": 56, "East Main Station": 57,
    "Bellevue Downtown Station": 58, "Wilburton Station": 59,
    "Spring District/120th Station": 60, "Bel-Red/130th Station": 61,
    "Overlake Village Station": 62, "Redmond Technology Center Station": 63,
    "Marymoor Village Station": 64, "Downtown Redmond Station": 65,
}

OFFSET_METERS = 30
INTL_DISTRICT_LAT = 47.598


# ── Geometry utilities ──

def get_coords(feat):
    """Extract coordinates from a LineString or MultiLineString feature."""
    g = feat["geometry"]
    if g["type"] == "LineString":
        return list(g["coordinates"])
    elif g["type"] == "MultiLineString":
        return [c for part in g["coordinates"] for c in part]
    return []


def dist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def build_route(polylines):
    """Build a continuous route from disjoint polylines.

    1. Orient all polylines north→south
    2. Deduplicate parallel tracks (keep one per latitude band)
    3. Sort by center latitude north→south
    4. Concatenate, connecting endpoints
    """
    if not polylines:
        return []

    # Orient north→south
    for i, pl in enumerate(polylines):
        if pl[0][1] < pl[-1][1]:
            polylines[i] = list(reversed(pl))

    # Deduplicate parallel tracks: keep one polyline per latitude band
    polylines.sort(key=len, reverse=True)
    kept = []
    for pl in polylines:
        lat_min = min(p[1] for p in pl)
        lat_max = max(p[1] for p in pl)
        coverage = lat_max - lat_min
        overlaps = False
        for k in kept:
            k_min = min(p[1] for p in k)
            k_max = max(p[1] for p in k)
            overlap = min(lat_max, k_max) - max(lat_min, k_min)
            if coverage > 0 and overlap / coverage > 0.5:
                overlaps = True
                break
        if not overlaps:
            kept.append(pl)

    # Sort north→south by center latitude
    kept.sort(key=lambda pl: -(sum(p[1] for p in pl) / len(pl)))

    # Concatenate, connecting closest endpoints
    route = list(kept[0])
    for i in range(1, len(kept)):
        end = route[-1]
        d_start = dist(end, kept[i][0])
        d_end = dist(end, kept[i][-1])
        if d_end < d_start:
            kept[i] = list(reversed(kept[i]))
        route.extend(kept[i])

    return route


def build_east_route(polylines):
    """Build East Link route, sorted west→east."""
    if not polylines:
        return []

    polylines.sort(key=len, reverse=True)
    kept = []
    for pl in polylines:
        center_lng = sum(p[0] for p in pl) / len(pl)
        overlaps = False
        for k in kept:
            k_center = sum(p[0] for p in k) / len(k)
            if abs(center_lng - k_center) < 0.005 and len(pl) < len(k) * 1.5:
                overlaps = True
                break
        if not overlaps:
            kept.append(pl)

    kept.sort(key=lambda pl: sum(p[0] for p in pl) / len(pl))

    route = list(kept[0])
    for i in range(1, len(kept)):
        end = route[-1]
        d_start = dist(end, kept[i][0])
        d_end = dist(end, kept[i][-1])
        if d_end < d_start:
            kept[i] = list(reversed(kept[i]))
        route.extend(kept[i])

    return route


def offset_polyline(coords, meters, side="left"):
    """Offset a polyline perpendicular to its direction."""
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
        px = sign * dy / length
        py = sign * (-dx) / length
        lng, lat = coords[i]
        m_lng = 111320 * math.cos(math.radians(lat))
        m_lat = 110540
        result.append([lng + px * meters / m_lng, lat + py * meters / m_lat])
    return result


def main():
    with open(os.path.join(ROOT, "data/raw/light-rail-alignment.geojson")) as f:
        alignment = json.load(f)
    with open(os.path.join(ROOT, "data/raw/light-rail-stations.geojson")) as f:
        raw_stations = json.load(f)

    existing = [
        f for f in alignment["features"]
        if f["properties"].get("STATUS") == "Existing / Under Construction"
    ]

    # ── Build Line 1 route from SDOT curved segments ──
    LINE1_DESCS = {"Central Link", "University Link", "North Link", "Airport Link", "Angle Lake"}
    line1_polylines = [
        get_coords(f) for f in existing
        if f["properties"].get("DESCRIPTIO") in LINE1_DESCS and len(get_coords(f)) >= 2
    ]
    full_line1 = build_route(line1_polylines)

    # ── Build East Link route ──
    east_polylines = [
        get_coords(f) for f in existing
        if f["properties"].get("DESCRIPTIO") == "East Link" and len(get_coords(f)) >= 2
    ]
    east_route = build_east_route(east_polylines)

    # ── Split Line 1 at International District for shared/south sections ──
    split_idx = next(
        (i for i, p in enumerate(full_line1) if p[1] < INTL_DISTRICT_LAT),
        len(full_line1),
    )
    shared_section = full_line1[:split_idx]
    south_section = full_line1[split_idx - 1:]  # include junction point

    # ── Offset shared section: Line 1 west, Line 2 east ──
    line1_shared = offset_polyline(shared_section, OFFSET_METERS, "right")   # west
    line2_shared = offset_polyline(shared_section, OFFSET_METERS, "left")    # east

    line1_coords = line1_shared + south_section[1:]
    line2_coords = line2_shared + east_route

    # ── Build station index ──
    station_existing = [
        f for f in raw_stations["features"]
        if f["properties"].get("STATUS") == "Existing / Under Construction"
        and not any(kw in list(f["properties"].values())[2] for kw in TACOMA_KW)
    ]
    station_coords = {}
    for f in station_existing:
        raw_name = list(f["properties"].values())[2]
        name = NAME_MAP.get(raw_name, raw_name)
        station_coords[name] = f["geometry"]["coordinates"]
    for name, lng, lat in MISSING_STATIONS:
        if name not in station_coords:
            station_coords[name] = [lng, lat]

    # ── Build station GeoJSON ──
    def get_stop_code(name, line_id):
        if name in STOP_CODES:
            return STOP_CODES[name]
        if line_id == "1-line":
            return LINE_1_CODES.get(name)
        if line_id == "2-line":
            return LINE_2_CODES.get(name)
        return None

    features = []
    for name in LINE_1_ORDER[:SHARED_COUNT]:
        if name not in station_coords:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "name": name, "line": "1-line",
                "stopCode": get_stop_code(name, "1-line"),
                "shared": True, "lines": "1,2",
            },
            "geometry": {"type": "Point", "coordinates": station_coords[name]},
        })
    for name in LINE_1_ORDER[SHARED_COUNT:]:
        if name not in station_coords:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "name": name, "line": "1-line",
                "stopCode": get_stop_code(name, "1-line"),
                "shared": False, "lines": "1",
            },
            "geometry": {"type": "Point", "coordinates": station_coords[name]},
        })
    for name in LINE_2_ORDER[SHARED_COUNT:]:
        if name not in station_coords:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "name": name, "line": "2-line",
                "stopCode": get_stop_code(name, "2-line"),
                "shared": False, "lines": "2",
            },
            "geometry": {"type": "Point", "coordinates": station_coords[name]},
        })

    # ── Write output ──
    public = os.path.join(ROOT, "public")
    os.makedirs(public, exist_ok=True)

    for fname, coords, line_prop in [
        ("line1-alignment", line1_coords, "1-line"),
        ("line2-alignment", line2_coords, "2-line"),
    ]:
        geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {"line": line_prop},
                "geometry": {"type": "LineString", "coordinates": coords},
            }],
        }
        with open(os.path.join(public, f"{fname}.geojson"), "w") as f:
            json.dump(geojson, f)

    with open(os.path.join(public, "all-stations.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)

    unique = set(feat["properties"]["name"] for feat in features)
    print(f"Stations: {len(features)} features ({len(unique)} unique)")
    print(f"Line 1: {len(line1_coords)} pts ({len(shared_section)} shared + {len(south_section)} south)")
    print(f"Line 2: {len(line2_coords)} pts ({len(shared_section)} shared + {len(east_route)} east)")
    print(f"Shared offset: {OFFSET_METERS}m (Line 1 west, Line 2 east)")


if __name__ == "__main__":
    main()
