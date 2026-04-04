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
    "1-line": Line(id="1-line", name="1 Line", color="#0054A6", agency_id="sound-transit"),
    "2-line": Line(id="2-line", name="2 Line", color="#F3901D", agency_id="sound-transit"),
}

STATIONS: dict[str, Station] = {}

_LINE_1_STATIONS = [
    ("northgate", "Northgate", 47.7063, -122.3281),
    ("roosevelt", "Roosevelt", 47.6897, -122.3166),
    ("u-district", "U District", 47.6614, -122.3118),
    ("uw", "University of Washington", 47.6498, -122.3038),
    ("capitol-hill", "Capitol Hill", 47.6192, -122.3225),
    ("westlake", "Westlake", 47.6115, -122.3375),
    ("university-street", "University Street", 47.6076, -122.3362),
    ("pioneer-square", "Pioneer Square", 47.6021, -122.3320),
    ("intl-district", "International District / Chinatown", 47.5982, -122.3270),
    ("stadium", "Stadium", 47.5910, -122.3280),
    ("sodo", "SODO", 47.5800, -122.3274),
    ("beacon-hill", "Beacon Hill", 47.5685, -122.3118),
    ("mount-baker", "Mount Baker", 47.5763, -122.2976),
    ("columbia-city", "Columbia City", 47.5594, -122.2929),
    ("othello", "Othello", 47.5383, -122.2812),
    ("rainier-beach", "Rainier Beach", 47.5221, -122.2687),
    ("tukwila", "Tukwila International Blvd", 47.4876, -122.2882),
    ("seatac", "SeaTac / Airport", 47.4449, -122.2967),
    ("angle-lake", "Angle Lake", 47.4322, -122.2978),
]

_LINE_2_STATIONS = [
    ("south-bellevue", "South Bellevue", 47.5882, -122.1805),
    ("east-main", "East Main", 47.6018, -122.1842),
    ("bellevue-downtown", "Bellevue Downtown", 47.6152, -122.1985),
    ("wilburton", "Wilburton", 47.6223, -122.1878),
    ("spring-district", "Spring District / 120th", 47.6270, -122.1780),
    ("belred", "BelRed / 130th", 47.6280, -122.1651),
    ("overlake-village", "Overlake Village", 47.6311, -122.1487),
    ("redmond-tech", "Redmond Technology", 47.6434, -122.1291),
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
