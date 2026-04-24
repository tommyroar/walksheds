#!/usr/bin/env python3
"""Build per-category POI GeoJSONs from a committed OpenStreetMap dump.

Two phases:
  1. Refresh raw dump (network): one Overpass query pulls every named node/way
     tagged with any of {amenity, tourism, leisure, shop} inside the station
     bbox, saved gzipped to data/pois/raw/osm-seattle.json.gz.
  2. Build (no network, default): reads the committed raw dump and filters it
     into one GeoJSON per CATEGORIES entry under public/pois/.

Adding a new POI category only requires editing CATEGORIES below and re-running
the default build — no network needed, as long as the tag keys are already in
the raw dump (amenity/tourism/leisure/shop).

Usage:
  python3 data/pois/fetch_pois.py                          # build all from raw dump
  python3 data/pois/fetch_pois.py --category restaurants   # build single category
  python3 data/pois/fetch_pois.py --refresh                # refetch raw dump, then build
  python3 data/pois/fetch_pois.py --validate-only          # validate existing GeoJSONs
  python3 data/pois/fetch_pois.py --dry-run                # build + validate, don't write
  python3 data/pois/fetch_pois.py --sample-station "Judkins Park"
"""

import argparse
import gzip
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATION_INDEX = os.path.join(ROOT, "data", "station-index.json")
OUTPUT_DIR = os.path.join(ROOT, "public", "pois")
RAW_DUMP = os.path.join(ROOT, "data", "pois", "raw", "osm-seattle.json.gz")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 180

# Padding around station bounding box in degrees (~1.5km ≈ 0.014°)
BBOX_PAD = 0.014

# OSM tag keys covered by the raw dump. Any category must use one of these.
RAW_KEYS = ("amenity", "tourism", "leisure", "shop")

# Category definitions: name → (osm_key, osm_values)
CATEGORIES = {
    "restaurants": ("amenity", ["restaurant", "cafe", "bar", "fast_food", "pub", "ice_cream", "bakery"]),
    "attractions": ("tourism", ["museum", "gallery", "attraction", "artwork", "viewpoint"]),
    "parks": ("leisure", ["park", "playground", "garden"]),
    "lodging": ("tourism", ["hotel", "hostel", "motel", "guest_house"]),
    "shopping": ("shop", ["supermarket", "convenience"]),
    "healthcare": ("amenity", ["pharmacy", "hospital", "clinic"]),
    "services": ("amenity", ["library", "bank", "post_office"]),
    "fitness": ("leisure", ["fitness_centre", "sports_centre", "swimming_pool"]),
}

# Valid categories for output features
VALID_CATEGORIES = set()
for _key, values in CATEGORIES.values():
    VALID_CATEGORIES.update(values)


def load_station_index():
    """Load station index and return list of {name, lng, lat}."""
    with open(STATION_INDEX) as f:
        data = json.load(f)
    return data["stations"]


def compute_bbox(stations):
    """Compute bounding box [south, west, north, east] from stations, padded."""
    lats = [s["lat"] for s in stations]
    lngs = [s["lng"] for s in stations]
    return [
        min(lats) - BBOX_PAD,
        min(lngs) - BBOX_PAD,
        max(lats) + BBOX_PAD,
        max(lngs) + BBOX_PAD,
    ]


def build_raw_query(bbox, keys=RAW_KEYS):
    """Build a single Overpass query covering every named node/way with any of the given tag keys."""
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    clauses = []
    for key in keys:
        clauses.append(f'  node["{key}"]["name"~"."]({bbox_str});')
        clauses.append(f'  way["{key}"]["name"~"."]({bbox_str});')
    return (
        f"[out:json][timeout:{OVERPASS_TIMEOUT}];\n"
        f"(\n" + "\n".join(clauses) + "\n);\n"
        f"out center tags;"
    )


def fetch_overpass(query):
    """Send a query to the Overpass API and return the JSON response."""
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=data, method="POST")
    req.add_header("User-Agent", "walksheds-poi-fetcher/1.0")

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=OVERPASS_TIMEOUT + 30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt < 2:
                wait = 2 ** (attempt + 1)
                print(f"  Retry in {wait}s after error: {e}")
                time.sleep(wait)
            else:
                raise


def refresh_raw_dump(bbox, out_path=RAW_DUMP, dry_run=False):
    """Fetch the Overpass superset for the bbox and write it gzipped to out_path."""
    query = build_raw_query(bbox)
    print("Refreshing raw OSM dump from Overpass...")
    print(f"  Keys: {', '.join(RAW_KEYS)}")
    print(f"  Bbox: {bbox}")

    result = fetch_overpass(query)
    elements = result.get("elements", [])
    print(f"  → {len(elements):,} elements")

    if dry_run:
        print("  [dry-run] Skipping write")
        return result

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    compact = json.dumps(result, separators=(",", ":")).encode("utf-8")
    with gzip.open(out_path, "wb", compresslevel=9) as f:
        f.write(compact)
    print(f"  Wrote {out_path} ({os.path.getsize(out_path):,} bytes gzipped)")
    return result


def load_raw_dump(path=RAW_DUMP):
    """Load the committed gzipped raw Overpass dump."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Raw dump not found at {path}. "
            f"Run `python3 data/pois/fetch_pois.py --refresh` to fetch it from Overpass."
        )
    with gzip.open(path, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def filter_elements(elements, osm_key, osm_values):
    """Filter raw Overpass elements to those matching osm_key in osm_values."""
    wanted = set(osm_values)
    return [el for el in elements if el.get("tags", {}).get(osm_key) in wanted]


def extract_tags(osm_tags, osm_key):
    """Extract searchable tags from OSM tag dict."""
    tags = []

    # The primary category value (e.g. "restaurant", "cafe")
    primary = osm_tags.get(osm_key, "")
    if primary:
        tags.append(primary)

    # Cuisine
    cuisine = osm_tags.get("cuisine", "")
    if cuisine:
        for c in cuisine.split(";"):
            c = c.strip().lower().replace("_", "-")
            if c:
                tags.append(c)

    # Boolean feature tags
    bool_tags = {
        "outdoor_seating": "outdoor-seating",
        "wheelchair": "wheelchair-accessible",
        "diet:vegetarian": "vegetarian",
        "diet:vegan": "vegan",
    }
    for osm_field, tag_name in bool_tags.items():
        if osm_tags.get(osm_field) in ("yes", "only"):
            tags.append(tag_name)

    # Child-friendly
    if osm_tags.get("kids_area") == "yes" or osm_tags.get("highchair") in ("yes", "available"):
        tags.append("child-friendly")

    # Lodging: star rating
    stars = osm_tags.get("stars", "")
    if stars in ("1", "2", "3", "4", "5"):
        tags.append(f"{stars}-star")

    # Lodging: wifi
    if osm_tags.get("internet_access") in ("wlan", "yes", "wifi"):
        tags.append("wifi")

    # Shopping: organic
    if osm_tags.get("organic") in ("yes", "only"):
        tags.append("organic")

    # Healthcare: emergency
    if osm_tags.get("emergency") == "yes":
        tags.append("emergency")

    # Fitness: sport type
    sport = osm_tags.get("sport", "")
    if sport:
        for s in sport.split(";"):
            s = s.strip().lower().replace("_", "-")
            if s:
                tags.append(s)

    # Deduplicate preserving order
    seen = set()
    unique = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            unique.append(t)

    return unique


def normalize_element(element, osm_key):
    """Convert an Overpass element to a GeoJSON Feature."""
    tags = element.get("tags", {})
    name = tags.get("name", "").strip()
    if not name:
        return None

    # Get coordinates — for ways, use center point
    if element["type"] == "node":
        lng, lat = element["lon"], element["lat"]
    elif "center" in element:
        lng, lat = element["center"]["lon"], element["center"]["lat"]
    else:
        return None

    category = tags.get(osm_key, "")
    extracted_tags = extract_tags(tags, osm_key)
    if not extracted_tags:
        extracted_tags = [category] if category else ["other"]

    props = {
        "id": element["id"],
        "name": name,
        "category": category,
        "tags": extracted_tags,
    }

    # Optional metadata
    if tags.get("website"):
        props["website"] = tags["website"]
    elif tags.get("contact:website"):
        props["website"] = tags["contact:website"]
    if tags.get("phone"):
        props["phone"] = tags["phone"]
    elif tags.get("contact:phone"):
        props["phone"] = tags["contact:phone"]
    if tags.get("opening_hours"):
        props["hours"] = tags["opening_hours"]

    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Point", "coordinates": [round(lng, 7), round(lat, 7)]},
    }


def build_category(elements, category_name):
    """Build a GeoJSON FeatureCollection for a category from raw Overpass elements."""
    osm_key, osm_values = CATEGORIES[category_name]
    if osm_key not in RAW_KEYS:
        raise ValueError(
            f"Category {category_name} uses osm_key '{osm_key}' which is not in the raw dump "
            f"(keys: {RAW_KEYS}). Add it to RAW_KEYS and re-run with --refresh."
        )

    matched = filter_elements(elements, osm_key, osm_values)
    print(f"  {category_name}: {len(matched)} raw elements match {osm_key} in {osm_values}")

    features = []
    seen_ids = set()
    for el in matched:
        feat = normalize_element(el, osm_key)
        if feat and feat["properties"]["id"] not in seen_ids:
            seen_ids.add(feat["properties"]["id"])
            features.append(feat)

    print(f"  → {len(features)} named features after normalization")
    return {"type": "FeatureCollection", "features": features}


def validate_geojson(fc, category_name, bbox):
    """Validate a POI FeatureCollection. Returns list of error strings."""
    errors = []
    if fc.get("type") != "FeatureCollection":
        errors.append(f"{category_name}: not a FeatureCollection")
        return errors

    features = fc.get("features", [])
    if len(features) < 10:
        errors.append(f"{category_name}: only {len(features)} features (expected >= 10)")

    ids = set()
    for i, f in enumerate(features):
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates")

        if not props.get("name"):
            errors.append(f"{category_name}[{i}]: missing name")
        if props.get("category") not in VALID_CATEGORIES:
            errors.append(f"{category_name}[{i}]: invalid category '{props.get('category')}'")
        if not isinstance(props.get("tags"), list) or len(props.get("tags", [])) == 0:
            errors.append(f"{category_name}[{i}]: missing or empty tags")

        if coords:
            lng, lat = coords
            if not (bbox[1] - 0.01 <= lng <= bbox[3] + 0.01 and bbox[0] - 0.01 <= lat <= bbox[2] + 0.01):
                errors.append(f"{category_name}[{i}]: coordinates ({lng}, {lat}) outside bbox")

        eid = props.get("id")
        if eid in ids:
            errors.append(f"{category_name}[{i}]: duplicate id {eid}")
        ids.add(eid)

    return errors


def haversine_dist(lng1, lat1, lng2, lat2):
    """Distance in meters between two points."""
    R = 6371000
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def sample_near_station(all_fcs, station_name, stations, radius=1200):
    """Print POI features within radius meters of a station."""
    station = None
    for s in stations:
        if station_name.lower() in s["name"].lower():
            station = s
            break

    if not station:
        print(f"\nStation '{station_name}' not found.")
        return

    print(f"\n{'=' * 60}")
    print(f"Sample: {station['name']} (lng={station['lng']}, lat={station['lat']})")
    print(f"Radius: {radius}m")
    print(f"{'=' * 60}")

    total = 0
    for cat_name, fc in all_fcs.items():
        nearby = []
        for f in fc["features"]:
            lng, lat = f["geometry"]["coordinates"]
            d = haversine_dist(station["lng"], station["lat"], lng, lat)
            if d <= radius:
                nearby.append((d, f))
        nearby.sort(key=lambda x: x[0])

        print(f"\n  {cat_name}: {len(nearby)} features within {radius}m")
        for dist, f in nearby:
            p = f["properties"]
            tags_str = ", ".join(p["tags"])
            extra = []
            if p.get("website"):
                extra.append(f"web: {p['website']}")
            if p.get("hours"):
                extra.append(f"hours: {p['hours']}")
            extra_str = f"  [{'; '.join(extra)}]" if extra else ""
            print(f"    {dist:6.0f}m  {p['name']:<40s}  [{tags_str}]{extra_str}")
        total += len(nearby)

    # Tag distribution
    all_tags = {}
    for fc in all_fcs.values():
        for f in fc["features"]:
            lng, lat = f["geometry"]["coordinates"]
            if haversine_dist(station["lng"], station["lat"], lng, lat) <= radius:
                for t in f["properties"].get("tags", []):
                    all_tags[t] = all_tags.get(t, 0) + 1

    print(f"\n  Tag distribution ({len(all_tags)} unique tags):")
    for tag, count in sorted(all_tags.items(), key=lambda x: -x[1])[:20]:
        print(f"    {tag:<30s}  {count}")

    print(f"\n  Total nearby: {total}")


def main():
    parser = argparse.ArgumentParser(description="Build POI GeoJSONs from committed OSM dump")
    parser.add_argument("--category", choices=list(CATEGORIES.keys()), help="Build single category")
    parser.add_argument("--refresh", action="store_true",
                        help="Refetch raw OSM dump from Overpass before building")
    parser.add_argument("--validate-only", action="store_true", help="Validate existing files only")
    parser.add_argument("--dry-run", action="store_true", help="Build + validate, don't write")
    parser.add_argument("--sample-station", type=str, help="Print sample around a station")
    args = parser.parse_args()

    stations = load_station_index()
    bbox = compute_bbox(stations)
    print(f"Bounding box: {bbox}")
    print(f"Stations: {len(stations)}")

    categories_to_build = [args.category] if args.category else list(CATEGORIES.keys())
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_fcs = {}

    if args.validate_only:
        print("\nValidating existing files...")
        all_errors = []
        for cat in categories_to_build:
            path = os.path.join(OUTPUT_DIR, f"{cat}.geojson")
            if not os.path.exists(path):
                all_errors.append(f"{cat}: file not found at {path}")
                continue
            with open(path) as f:
                fc = json.load(f)
            all_fcs[cat] = fc
            errors = validate_geojson(fc, cat, bbox)
            all_errors.extend(errors)
            print(f"  {cat}: {len(fc['features'])} features, {len(errors)} errors")

        if all_errors:
            print(f"\nValidation failed with {len(all_errors)} error(s):")
            for e in all_errors:
                print(f"  - {e}")
            sys.exit(1)
        else:
            print("\nAll files valid.")
    else:
        if args.refresh:
            refresh_raw_dump(bbox, dry_run=args.dry_run)

        print("\nLoading raw dump...")
        raw = load_raw_dump()
        elements = raw.get("elements", [])
        print(f"  {len(elements):,} elements in dump")

        print("\nBuilding categories...")
        all_errors = []
        for cat in categories_to_build:
            fc = build_category(elements, cat)
            all_fcs[cat] = fc
            errors = validate_geojson(fc, cat, bbox)
            all_errors.extend(errors)

            if errors:
                print(f"  Validation warnings for {cat}:")
                for e in errors:
                    print(f"    - {e}")

            if not args.dry_run:
                path = os.path.join(OUTPUT_DIR, f"{cat}.geojson")
                with open(path, "w") as f:
                    json.dump(fc, f)
                print(f"  Wrote {path} ({len(fc['features'])} features)")
            else:
                print(f"  [dry-run] Would write {cat}.geojson ({len(fc['features'])} features)")

        if all_errors:
            print(f"\n{len(all_errors)} validation warning(s) (see above)")

    # Summary
    print("\nSummary:")
    for cat, fc in all_fcs.items():
        print(f"  {cat}: {len(fc['features'])} features")

    # Sample station output
    if args.sample_station:
        sample_near_station(all_fcs, args.sample_station, stations)


if __name__ == "__main__":
    main()
