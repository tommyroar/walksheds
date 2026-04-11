#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx"]
# ///
"""Bake walking-distance isochrones for every station × duration.

Reads data/station-index.json, calls the Mapbox Isochrone API once per
(station, minutes) pair, and writes a single consolidated
public/walksheds.geojson keyed by "{lines}-{stopCode}-{minutes}".

Coordinates are rounded to 6 decimal places (~11 cm precision) before
serialization to keep diffs minimal between bakes.

Usage: MAPBOX_ACCESS_TOKEN=... python data/bake_walksheds.py [--dry-run]
"""

import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "data" / "station-index.json"
OUTPUT_PATH = ROOT / "public" / "walksheds.geojson"

ISOCHRONE_URL = "https://api.mapbox.com/isochrone/v1/mapbox/walking/{lng},{lat}"
DEFAULT_OPTIONS = (5, 10, 15)
DEFAULT_DELAY_S = 0.05
TIMEOUT_S = 30
COORD_PRECISION = 6
BAKE_VERSION = 1

KEY_RE = re.compile(r"^[12](,[12])?-\d+-\d+$")


def make_key(lines: str, stop_code: int, minutes: int) -> str:
    return f"{lines}-{stop_code}-{minutes}"


def _round_coords(obj):
    """Recursively round all numeric coordinates in a GeoJSON-ish structure."""
    if isinstance(obj, list):
        if obj and all(isinstance(x, (int, float)) for x in obj):
            return [round(float(x), COORD_PRECISION) if isinstance(x, float) else x for x in obj]
        return [_round_coords(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _round_coords(v) for k, v in obj.items()}
    return obj


def bake_one(client: httpx.Client, lng: float, lat: float, minutes: int, token: str) -> dict:
    """Fetch one isochrone polygon. Raises on non-200."""
    url = ISOCHRONE_URL.format(lng=lng, lat=lat)
    resp = client.get(
        url,
        params={
            "contours_minutes": minutes,
            "polygons": "true",
            "access_token": token,
        },
        timeout=TIMEOUT_S,
    )
    resp.raise_for_status()
    fc = resp.json()
    if fc.get("type") != "FeatureCollection":
        raise ValueError(f"Expected FeatureCollection, got: {fc.get('type')}")
    return _round_coords(fc)


def bake(
    index: dict,
    token: str,
    delay: float = DEFAULT_DELAY_S,
    options: tuple[int, ...] = DEFAULT_OPTIONS,
    client: httpx.Client | None = None,
) -> dict:
    """Bake every (station, minutes) combo. Returns the full output dict."""
    walksheds: dict[str, dict] = {}
    own_client = client is None
    if own_client:
        client = httpx.Client()
    try:
        first = True
        for station in index["stations"]:
            for minutes in options:
                if not first:
                    time.sleep(delay)
                first = False
                key = make_key(station["lines"], station["stopCode"], minutes)
                if not KEY_RE.match(key):
                    raise ValueError(f"Bad key: {key}")
                fc = bake_one(client, station["lng"], station["lat"], minutes, token)
                walksheds[key] = fc
                print(f"  baked {key} ({station['name']})")
    finally:
        if own_client:
            client.close()

    return {
        "version": BAKE_VERSION,
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "walksheds": walksheds,
    }


def write_atomic(output_path: Path, data: dict) -> None:
    """Write a JSON file atomically (.tmp then rename)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = output_path.with_suffix(output_path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, sort_keys=True)
    tmp.replace(output_path)


def main():
    dry_run = "--dry-run" in sys.argv
    token = os.environ.get("MAPBOX_ACCESS_TOKEN") or os.environ.get("VITE_MAPBOX_ACCESS_TOKEN")
    if not token:
        sys.exit("Error: MAPBOX_ACCESS_TOKEN env var not set")

    with open(INDEX_PATH) as f:
        index = json.load(f)

    if dry_run:
        index = {**index, "stations": index["stations"][:1]}
        print(f"Dry run — baking only {index['stations'][0]['name']}")

    print(f"Baking {len(index['stations'])} stations × {len(DEFAULT_OPTIONS)} durations...")
    output = bake(index, token=token)

    # Sanity check: token must not appear in serialized output.
    serialized = json.dumps(output)
    if token in serialized:
        sys.exit("Error: Mapbox token leaked into bake output, aborting write")

    if dry_run:
        print(f"\nDry run — skipping write. Baked {len(output['walksheds'])} entries.")
        return

    write_atomic(OUTPUT_PATH, output)
    print(f"\nWrote {OUTPUT_PATH} with {len(output['walksheds'])} walksheds")


if __name__ == "__main__":
    main()
