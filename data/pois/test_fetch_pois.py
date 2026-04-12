"""Tests for the POI data fetch pipeline."""

import json
import os
import sys

import pytest

# Add the pois directory to the path so we can import fetch_pois
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_pois import (
    compute_bbox,
    build_overpass_query,
    extract_tags,
    normalize_element,
    validate_geojson,
    haversine_dist,
    CATEGORIES,
    VALID_CATEGORIES,
)


# ── Fixtures ──

SAMPLE_STATIONS = [
    {"name": "Westlake Station", "lng": -122.3367, "lat": 47.6116, "stopCode": 50, "lines": "1,2"},
    {"name": "Judkins Park Station", "lng": -122.3045, "lat": 47.5903, "stopCode": 54, "lines": "2"},
    {"name": "Federal Way Downtown Station", "lng": -122.312, "lat": 47.317, "stopCode": 68, "lines": "1"},
    {"name": "Downtown Redmond Station", "lng": -122.1248, "lat": 47.6732, "stopCode": 65, "lines": "2"},
]


def _make_node(node_id=1, name="Test Place", amenity="restaurant", extra_tags=None):
    tags = {"name": name, "amenity": amenity}
    if extra_tags:
        tags.update(extra_tags)
    return {
        "type": "node",
        "id": node_id,
        "lat": 47.59,
        "lon": -122.30,
        "tags": tags,
    }


def _make_way(way_id=100, name="Test Park", leisure="park"):
    return {
        "type": "way",
        "id": way_id,
        "center": {"lat": 47.59, "lon": -122.30},
        "tags": {"name": name, "leisure": leisure},
    }


def _make_fc(features):
    return {"type": "FeatureCollection", "features": features}


def _make_feature(fid=1, name="Test", category="restaurant", tags=None, lng=-122.30, lat=47.59):
    return {
        "type": "Feature",
        "properties": {
            "id": fid,
            "name": name,
            "category": category,
            "tags": tags or ["restaurant"],
        },
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
    }


# ── compute_bbox ──


class TestComputeBbox:
    def test_basic_bbox(self):
        bbox = compute_bbox(SAMPLE_STATIONS)
        south, west, north, east = bbox
        assert south < 47.317  # south of Federal Way
        assert north > 47.6732  # north of Redmond
        assert west < -122.3367  # west of Westlake
        assert east > -122.1248  # east of Redmond

    def test_bbox_has_padding(self):
        bbox = compute_bbox(SAMPLE_STATIONS)
        # Padding should push bounds beyond raw min/max
        assert bbox[0] < min(s["lat"] for s in SAMPLE_STATIONS)
        assert bbox[2] > max(s["lat"] for s in SAMPLE_STATIONS)


# ── build_overpass_query ──


class TestBuildOverpassQuery:
    def test_query_contains_bbox(self):
        bbox = [47.3, -122.35, 47.7, -122.1]
        query = build_overpass_query(bbox, "amenity", ["restaurant", "cafe"])
        assert "47.3,-122.35,47.7,-122.1" in query

    def test_query_contains_tags(self):
        bbox = [47.3, -122.35, 47.7, -122.1]
        query = build_overpass_query(bbox, "amenity", ["restaurant", "cafe"])
        assert '"amenity"' in query
        assert "restaurant|cafe" in query

    def test_query_requires_name(self):
        bbox = [47.3, -122.35, 47.7, -122.1]
        query = build_overpass_query(bbox, "amenity", ["restaurant"])
        assert '"name"~"."' in query


# ── extract_tags ──


class TestExtractTags:
    def test_basic_category(self):
        tags = extract_tags({"amenity": "restaurant"}, "amenity")
        assert "restaurant" in tags

    def test_cuisine_split(self):
        tags = extract_tags({"amenity": "restaurant", "cuisine": "pizza;italian"}, "amenity")
        assert "pizza" in tags
        assert "italian" in tags

    def test_outdoor_seating(self):
        tags = extract_tags({"amenity": "cafe", "outdoor_seating": "yes"}, "amenity")
        assert "outdoor-seating" in tags

    def test_wheelchair(self):
        tags = extract_tags({"amenity": "restaurant", "wheelchair": "yes"}, "amenity")
        assert "wheelchair-accessible" in tags

    def test_vegetarian_vegan(self):
        tags = extract_tags({"amenity": "restaurant", "diet:vegetarian": "yes", "diet:vegan": "only"}, "amenity")
        assert "vegetarian" in tags
        assert "vegan" in tags

    def test_child_friendly(self):
        tags = extract_tags({"amenity": "restaurant", "highchair": "yes"}, "amenity")
        assert "child-friendly" in tags

        tags2 = extract_tags({"amenity": "restaurant", "kids_area": "yes"}, "amenity")
        assert "child-friendly" in tags2

    def test_no_duplicates(self):
        tags = extract_tags({"amenity": "cafe", "cuisine": "cafe"}, "amenity")
        assert tags.count("cafe") == 1

    def test_cuisine_underscore_to_hyphen(self):
        tags = extract_tags({"amenity": "restaurant", "cuisine": "ice_cream"}, "amenity")
        assert "ice-cream" in tags

    def test_empty_cuisine(self):
        tags = extract_tags({"amenity": "bar", "cuisine": ""}, "amenity")
        assert tags == ["bar"]


# ── normalize_element ──


class TestNormalizeElement:
    def test_node(self):
        el = _make_node(42, "Pizza Place", "restaurant", {"cuisine": "pizza"})
        feat = normalize_element(el, "amenity")
        assert feat["properties"]["id"] == 42
        assert feat["properties"]["name"] == "Pizza Place"
        assert feat["properties"]["category"] == "restaurant"
        assert "pizza" in feat["properties"]["tags"]
        assert feat["geometry"]["coordinates"][0] == -122.30
        assert feat["geometry"]["coordinates"][1] == 47.59

    def test_way_uses_center(self):
        el = _make_way(200, "Judkins Park", "park")
        feat = normalize_element(el, "leisure")
        assert feat["properties"]["category"] == "park"
        assert feat["geometry"]["coordinates"] == [-122.30, 47.59]

    def test_unnamed_returns_none(self):
        el = _make_node(1, "", "restaurant")
        assert normalize_element(el, "amenity") is None

    def test_no_name_tag_returns_none(self):
        el = {"type": "node", "id": 1, "lat": 47.0, "lon": -122.0, "tags": {"amenity": "restaurant"}}
        assert normalize_element(el, "amenity") is None

    def test_optional_metadata(self):
        el = _make_node(1, "Test", "cafe", {
            "website": "https://test.com",
            "phone": "+1-206-555-0100",
            "opening_hours": "Mo-Fr 07:00-17:00",
        })
        feat = normalize_element(el, "amenity")
        assert feat["properties"]["website"] == "https://test.com"
        assert feat["properties"]["phone"] == "+1-206-555-0100"
        assert feat["properties"]["hours"] == "Mo-Fr 07:00-17:00"

    def test_contact_website_fallback(self):
        el = _make_node(1, "Test", "cafe", {"contact:website": "https://fallback.com"})
        feat = normalize_element(el, "amenity")
        assert feat["properties"]["website"] == "https://fallback.com"

    def test_way_without_center_returns_none(self):
        el = {"type": "way", "id": 1, "tags": {"name": "Test", "leisure": "park"}}
        assert normalize_element(el, "leisure") is None


# ── validate_geojson ──


class TestValidateGeojson:
    BBOX = [47.3, -122.35, 47.7, -122.1]

    def test_valid_fc(self):
        features = [_make_feature(i, f"Place {i}") for i in range(20)]
        errors = validate_geojson(_make_fc(features), "restaurants", self.BBOX)
        assert errors == []

    def test_too_few_features(self):
        features = [_make_feature(i, f"Place {i}") for i in range(3)]
        errors = validate_geojson(_make_fc(features), "restaurants", self.BBOX)
        assert any("only 3 features" in e for e in errors)

    def test_missing_name(self):
        feat = _make_feature(1, "", "restaurant")
        errors = validate_geojson(_make_fc([feat] * 20), "restaurants", self.BBOX)
        assert any("missing name" in e for e in errors)

    def test_invalid_category(self):
        feat = _make_feature(1, "Test", "invalid_cat")
        errors = validate_geojson(_make_fc([feat] * 20), "restaurants", self.BBOX)
        assert any("invalid category" in e for e in errors)

    def test_duplicate_ids(self):
        features = [_make_feature(1, f"Place {i}") for i in range(20)]
        errors = validate_geojson(_make_fc(features), "restaurants", self.BBOX)
        assert any("duplicate" in e for e in errors)

    def test_coordinates_outside_bbox(self):
        feat = _make_feature(1, "Test", "restaurant", lng=-130.0, lat=50.0)
        errors = validate_geojson(_make_fc([feat] * 20), "restaurants", self.BBOX)
        assert any("outside bbox" in e for e in errors)

    def test_not_feature_collection(self):
        errors = validate_geojson({"type": "Point"}, "restaurants", self.BBOX)
        assert any("not a FeatureCollection" in e for e in errors)


# ── haversine_dist ──


class TestHaversineDist:
    def test_same_point(self):
        assert haversine_dist(-122.30, 47.59, -122.30, 47.59) == 0

    def test_known_distance(self):
        # Westlake to Judkins Park is roughly 3.4km
        d = haversine_dist(-122.3367, 47.6116, -122.3045, 47.5903)
        assert 2500 < d < 4000

    def test_short_distance(self):
        # ~111m per 0.001° lat
        d = haversine_dist(-122.30, 47.590, -122.30, 47.591)
        assert 100 < d < 120


# ── categories ──


class TestCategories:
    def test_all_categories_defined(self):
        assert "restaurants" in CATEGORIES
        assert "attractions" in CATEGORIES
        assert "parks" in CATEGORIES

    def test_valid_categories_populated(self):
        assert "restaurant" in VALID_CATEGORIES
        assert "museum" in VALID_CATEGORIES
        assert "park" in VALID_CATEGORIES
