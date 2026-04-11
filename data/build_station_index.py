"""Build a canonical station index from public/all-stations.geojson.

The station index is the deliberate, human-reviewable list of stations that
the walkshed bake step iterates over and the drift detector compares against
the live SDOT feed. It is derived from the processed all-stations GeoJSON.

Run from project root: python3 data/build_station_index.py
"""

import json
import os
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(ROOT, "public", "all-stations.geojson")
OUTPUT = os.path.join(ROOT, "data", "station-index.json")

INDEX_VERSION = 1


def build(stations_geojson: dict) -> dict:
    """Pure function: GeoJSON FeatureCollection -> station index dict.

    Output is deterministic — stations are sorted by (lines, stopCode) so the
    JSON file diffs cleanly.
    """
    stations: list[dict[str, Any]] = []
    for feat in stations_geojson["features"]:
        props = feat["properties"]
        lng, lat = feat["geometry"]["coordinates"]
        stations.append({
            "name": props["name"],
            "lines": props["lines"],
            "stopCode": props["stopCode"],
            "lng": lng,
            "lat": lat,
        })
    stations.sort(key=lambda s: (s["lines"], s["stopCode"]))
    return {"version": INDEX_VERSION, "stations": stations}


def main():
    with open(INPUT) as f:
        stations_geojson = json.load(f)
    index = build(stations_geojson)
    with open(OUTPUT, "w") as f:
        json.dump(index, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Wrote {OUTPUT} with {len(index['stations'])} stations")


if __name__ == "__main__":
    main()
