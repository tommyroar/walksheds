"""Walksheds API — Flask backend.

Serves station data, computes walksheds (isochrone polygons),
and returns nearby attractions within a walkshed.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from models import Line, Station, Walkshed

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Seed data — Seattle Link Light Rail
# ---------------------------------------------------------------------------

LINES = {
    "1-line": Line(id="1-line", name="1 Line", color="#4CAF50", agency_id="sound-transit"),
    "2-line": Line(id="2-line", name="2 Line", color="#0082C8", agency_id="sound-transit"),
}

STATIONS: dict[str, Station] = {}

# Line 1: Lynnwood → Federal Way Downtown
_LINE_1_STATIONS = [
    ("lynnwood", "Lynnwood City Center", 47.8156, -122.2948),
    ("mountlake-terrace", "Mountlake Terrace", 47.7850, -122.3148),
    ("shoreline-north", "Shoreline North/185th", 47.7641, -122.3229),
    ("shoreline-south", "Shoreline South/148th", 47.7361, -122.3252),
    ("northgate", "Northgate", 47.7030, -122.3283),
    ("roosevelt", "Roosevelt", 47.6766, -122.3160),
    ("u-district", "U District", 47.6603, -122.3141),
    ("uw", "University of Washington", 47.6498, -122.3038),
    ("capitol-hill", "Capitol Hill", 47.6191, -122.3202),
    ("westlake", "Westlake", 47.6116, -122.3367),
    ("symphony", "Symphony", 47.6078, -122.3360),
    ("pioneer-square", "Pioneer Square", 47.6026, -122.3312),
    ("intl-district", "International District / Chinatown", 47.5984, -122.3280),
    ("stadium", "Stadium", 47.5911, -122.3272),
    ("sodo", "SODO", 47.5811, -122.3274),
    ("beacon-hill", "Beacon Hill", 47.5793, -122.3115),
    ("mount-baker", "Mount Baker", 47.5766, -122.2977),
    ("columbia-city", "Columbia City", 47.5597, -122.2927),
    ("othello", "Othello", 47.5380, -122.2816),
    ("rainier-beach", "Rainier Beach", 47.5224, -122.2794),
    ("tukwila", "Tukwila International Blvd", 47.4640, -122.2880),
    ("seatac", "SeaTac / Airport", 47.4454, -122.2969),
    ("angle-lake", "Angle Lake", 47.4227, -122.2977),
    ("kent-des-moines", "Kent Des Moines", 47.4110, -122.2953),
    ("star-lake", "Star Lake", 47.3940, -122.2930),
    ("federal-way", "Federal Way Downtown", 47.3170, -122.3120),
]

# Line 2: east-only stations (shared stations loaded from Line 1)
_LINE_2_STATIONS = [
    ("judkins-park", "Judkins Park", 47.5903, -122.3045),
    ("mercer-island", "Mercer Island", 47.5882, -122.2332),
    ("south-bellevue", "South Bellevue", 47.5866, -122.1904),
    ("east-main", "East Main", 47.6082, -122.1911),
    ("bellevue-downtown", "Bellevue Downtown", 47.6152, -122.1921),
    ("wilburton", "Wilburton", 47.6180, -122.1838),
    ("spring-district", "Spring District/120th", 47.6238, -122.1786),
    ("belred", "Bel-Red/130th", 47.6244, -122.1656),
    ("overlake-village", "Overlake Village", 47.6363, -122.1389),
    ("redmond-tech", "Redmond Technology Center", 47.6448, -122.1336),
    ("marymoor-village", "Marymoor Village", 47.6620, -122.1180),
    ("downtown-redmond", "Downtown Redmond", 47.6732, -122.1248),
]

for sid, name, lat, lng in _LINE_1_STATIONS:
    STATIONS[sid] = Station(id=sid, name=name, line_id="1-line", latitude=lat, longitude=lng)

for sid, name, lat, lng in _LINE_2_STATIONS:
    STATIONS[sid] = Station(id=sid, name=name, line_id="2-line", latitude=lat, longitude=lng)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/lines")
def list_lines():
    return jsonify(
        [
            {"id": line.id, "name": line.name, "color": line.color, "agency_id": line.agency_id}
            for line in LINES.values()
        ]
    )


@app.route("/api/stations")
def list_stations():
    line_id = request.args.get("line_id")
    stations = STATIONS.values()
    if line_id:
        stations = [s for s in stations if s.line_id == line_id]
    return jsonify(
        {
            "type": "FeatureCollection",
            "features": [s.to_geojson_feature() for s in stations],
        }
    )


@app.route("/api/stations/<station_id>")
def get_station(station_id):
    station = STATIONS.get(station_id)
    if not station:
        return jsonify({"error": f"Station '{station_id}' not found"}), 404
    return jsonify(station.to_geojson_feature())


@app.route("/api/stations/<station_id>/walkshed")
def get_walkshed(station_id):
    station = STATIONS.get(station_id)
    if not station:
        return jsonify({"error": f"Station '{station_id}' not found"}), 404

    minutes = request.args.get("minutes", 15, type=int)
    minutes = max(1, min(minutes, 60))

    # Approximate walkshed as a circle: avg walking speed ~5 km/h
    # 1 degree lat ≈ 111 km, 1 degree lon ≈ 111 km * cos(lat)
    import math

    radius_km = (5.0 * minutes) / 60.0
    lat_offset = radius_km / 111.0
    lon_offset = radius_km / (111.0 * math.cos(math.radians(station.latitude)))

    # Generate a 32-point polygon approximation
    n_points = 32
    coords = []
    for i in range(n_points + 1):
        angle = 2 * math.pi * i / n_points
        coords.append(
            [
                station.longitude + lon_offset * math.cos(angle),
                station.latitude + lat_offset * math.sin(angle),
            ]
        )

    walkshed = Walkshed(
        station_id=station_id,
        minutes=minutes,
        geometry={"type": "Polygon", "coordinates": [coords]},
    )
    return jsonify(walkshed.to_geojson_feature())


@app.route("/api/stations/<station_id>/attractions")
def get_attractions(station_id):
    station = STATIONS.get(station_id)
    if not station:
        return jsonify({"error": f"Station '{station_id}' not found"}), 404

    # Placeholder: return empty collection until real data source is connected
    # Future: filter by request.args.get("category") and sort by request.args.get("sort")
    return jsonify({"type": "FeatureCollection", "features": []})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    app.run(host="0.0.0.0", port=port, debug=True)
