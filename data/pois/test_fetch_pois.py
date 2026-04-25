"""Tests for the POI data fetch pipeline."""

import json
import os
import sys

import pytest

# Add the pois directory to the path so we can import fetch_pois
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_pois import (
    compute_bbox,
    build_raw_query,
    filter_elements,
    extract_tags,
    format_address,
    normalize_element,
    build_category,
    validate_geojson,
    haversine_dist,
    BOOL_TAG_FIELDS,
    CATEGORIES,
    RAW_KEYS,
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


# ── build_raw_query ──


class TestBuildRawQuery:
    BBOX = [47.3, -122.35, 47.7, -122.1]

    def test_query_contains_bbox(self):
        query = build_raw_query(self.BBOX)
        assert "47.3,-122.35,47.7,-122.1" in query

    def test_query_covers_all_raw_keys(self):
        query = build_raw_query(self.BBOX)
        for key in RAW_KEYS:
            assert f'"{key}"' in query

    def test_query_queries_nodes_and_ways(self):
        query = build_raw_query(self.BBOX)
        # One node clause and one way clause per key
        assert query.count("node[") == len(RAW_KEYS)
        assert query.count("way[") == len(RAW_KEYS)

    def test_query_requires_name(self):
        query = build_raw_query(self.BBOX)
        assert '"name"~"."' in query

    def test_custom_keys(self):
        query = build_raw_query(self.BBOX, keys=("amenity",))
        assert '"amenity"' in query
        assert '"tourism"' not in query


# ── filter_elements ──


class TestFilterElements:
    def test_matches_by_key_and_value(self):
        elements = [
            _make_node(1, "A", amenity="restaurant"),
            _make_node(2, "B", amenity="bar"),
            _make_node(3, "C", amenity="pharmacy"),
        ]
        matched = filter_elements(elements, "amenity", ["restaurant", "bar"])
        ids = {el["id"] for el in matched}
        assert ids == {1, 2}

    def test_ignores_other_keys(self):
        elements = [
            _make_node(1, "A", amenity="restaurant"),
            _make_way(2, "Park", leisure="park"),
        ]
        matched = filter_elements(elements, "leisure", ["park"])
        assert [el["id"] for el in matched] == [2]

    def test_empty_values_matches_nothing(self):
        elements = [_make_node(1, "A", amenity="restaurant")]
        assert filter_elements(elements, "amenity", []) == []


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

    def test_star_rating(self):
        tags = extract_tags({"tourism": "hotel", "stars": "4"}, "tourism")
        assert "4-star" in tags

    def test_invalid_star_rating_ignored(self):
        tags = extract_tags({"tourism": "hotel", "stars": "superior"}, "tourism")
        assert not any("star" in t for t in tags)

    def test_wifi(self):
        tags = extract_tags({"tourism": "hotel", "internet_access": "wlan"}, "tourism")
        assert "wifi" in tags

    def test_organic(self):
        tags = extract_tags({"shop": "supermarket", "organic": "yes"}, "shop")
        assert "organic" in tags

    def test_emergency(self):
        tags = extract_tags({"amenity": "hospital", "emergency": "yes"}, "amenity")
        assert "emergency" in tags

    def test_sport_type(self):
        tags = extract_tags({"leisure": "fitness_centre", "sport": "swimming;tennis"}, "leisure")
        assert "swimming" in tags
        assert "tennis" in tags

    def test_microbrew(self):
        tags = extract_tags({"amenity": "pub", "microbrewery": "yes"}, "amenity")
        assert "microbrew" in tags

    def test_craft_value_as_tag(self):
        tags = extract_tags({"shop": "brewery", "craft": "brewery"}, "shop")
        assert "brewery" in tags

    def test_takeaway_only_accepted(self):
        assert "takeaway" in extract_tags({"amenity": "restaurant", "takeaway": "yes"}, "amenity")
        assert "takeaway" in extract_tags({"amenity": "restaurant", "takeaway": "only"}, "amenity")
        assert "takeaway" not in extract_tags({"amenity": "restaurant", "takeaway": "no"}, "amenity")

    def test_smoking_outside(self):
        tags = extract_tags({"amenity": "bar", "smoking": "outside"}, "amenity")
        assert "smoking" in tags

    def test_smoking_no_excluded(self):
        tags = extract_tags({"amenity": "bar", "smoking": "no"}, "amenity")
        assert "smoking" not in tags

    def test_drink_alias(self):
        # drink:wine and drink:cocktail both map to canonical tags
        tags = extract_tags(
            {"amenity": "bar", "drink:wine": "yes", "drink:cocktail": "yes"},
            "amenity",
        )
        assert "wine" in tags
        assert "cocktails" in tags

    def test_dog_friendly_variants(self):
        for value in ("yes", "leashed", "outside"):
            tags = extract_tags({"amenity": "cafe", "dog": value}, "amenity")
            assert "dog-friendly" in tags

    def test_meal_periods(self):
        tags = extract_tags(
            {"amenity": "cafe", "breakfast": "yes", "brunch": "yes", "lunch": "yes"},
            "amenity",
        )
        assert "breakfast" in tags
        assert "brunch" in tags
        assert "lunch" in tags

    def test_reservation_required(self):
        for value in ("yes", "required", "recommended"):
            tags = extract_tags({"amenity": "restaurant", "reservation": value}, "amenity")
            assert "reservations" in tags
        # "no" should not produce the tag
        tags = extract_tags({"amenity": "restaurant", "reservation": "no"}, "amenity")
        assert "reservations" not in tags

    def test_has_bar_distinct_from_amenity_bar(self):
        # An amenity=bar primary still emits "bar"; a restaurant with bar=yes
        # emits "has-bar" so the two don't collide.
        bar_amenity = extract_tags({"amenity": "bar"}, "amenity")
        assert "bar" in bar_amenity
        assert "has-bar" not in bar_amenity

        restaurant_with_bar = extract_tags({"amenity": "restaurant", "bar": "yes"}, "amenity")
        assert "has-bar" in restaurant_with_bar
        assert "bar" not in restaurant_with_bar


class TestBoolTagFieldsCoverage:
    def test_every_field_emits_tag(self):
        # Each BOOL_TAG_FIELDS entry should produce its tag for at least one accepted value.
        for field, (tag_name, accepted) in BOOL_TAG_FIELDS.items():
            value = next(iter(accepted))
            tags = extract_tags({"amenity": "restaurant", field: value}, "amenity")
            assert tag_name in tags, f"{field}={value!r} did not emit {tag_name!r}"


class TestFormatAddress:
    def test_house_and_street(self):
        assert format_address({
            "addr:housenumber": "851",
            "addr:street": "Rainier Avenue South",
        }) == "851 Rainier Avenue South"

    def test_street_only(self):
        assert format_address({"addr:street": "Pike St"}) == "Pike St"

    def test_house_only(self):
        # House number alone is not useful — return None
        assert format_address({"addr:housenumber": "851"}) is None

    def test_missing(self):
        assert format_address({}) is None

    def test_strips_whitespace(self):
        assert format_address({
            "addr:housenumber": "  851  ",
            "addr:street": "  Pike St  ",
        }) == "851 Pike St"


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

    def test_address_passthrough(self):
        el = _make_node(1, "Test", "pub", {
            "addr:housenumber": "851",
            "addr:street": "Rainier Avenue South",
        })
        feat = normalize_element(el, "amenity")
        assert feat["properties"]["address"] == "851 Rainier Avenue South"

    def test_address_omitted_when_missing(self):
        el = _make_node(1, "Test", "cafe")
        feat = normalize_element(el, "amenity")
        assert "address" not in feat["properties"]


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
        assert "lodging" in CATEGORIES
        assert "shopping" in CATEGORIES
        assert "healthcare" in CATEGORIES
        assert "services" in CATEGORIES
        assert "fitness" in CATEGORIES

    def test_valid_categories_populated(self):
        assert "restaurant" in VALID_CATEGORIES
        assert "museum" in VALID_CATEGORIES
        assert "park" in VALID_CATEGORIES
        assert "hotel" in VALID_CATEGORIES
        assert "supermarket" in VALID_CATEGORIES
        assert "pharmacy" in VALID_CATEGORIES
        assert "library" in VALID_CATEGORIES
        assert "fitness_centre" in VALID_CATEGORIES

    def test_all_category_keys_covered_by_raw_dump(self):
        """Every CATEGORIES entry must use a tag key fetched by the raw dump.

        If this fails, either add the key to RAW_KEYS (and re-run --refresh)
        or move the category under an existing RAW_KEYS key.
        """
        for name, (osm_key, _values) in CATEGORIES.items():
            assert osm_key in RAW_KEYS, (
                f"Category '{name}' uses osm_key '{osm_key}' missing from RAW_KEYS {RAW_KEYS}"
            )


# ── build_category ──


class TestBuildCategory:
    def test_filters_and_normalizes(self):
        elements = [
            _make_node(1, "Pizza Place", amenity="restaurant", extra_tags={"cuisine": "pizza"}),
            _make_node(2, "Some Bar", amenity="bar"),
            _make_node(3, "A Pharmacy", amenity="pharmacy"),
            _make_way(4, "Green Park", leisure="park"),
        ]
        fc = build_category(elements, "restaurants")
        assert fc["type"] == "FeatureCollection"
        names = {f["properties"]["name"] for f in fc["features"]}
        assert names == {"Pizza Place", "Some Bar"}

    def test_skips_unnamed(self):
        elements = [
            _make_node(1, "Real Place", amenity="restaurant"),
            {"type": "node", "id": 2, "lat": 47.59, "lon": -122.30,
             "tags": {"amenity": "restaurant"}},  # no name
        ]
        fc = build_category(elements, "restaurants")
        assert len(fc["features"]) == 1

    def test_deduplicates_ids(self):
        elements = [
            _make_node(1, "Place", amenity="restaurant"),
            _make_node(1, "Place Duplicate", amenity="restaurant"),
        ]
        fc = build_category(elements, "restaurants")
        assert len(fc["features"]) == 1

    def test_rejects_category_with_unknown_key(self, monkeypatch):
        import fetch_pois
        monkeypatch.setitem(fetch_pois.CATEGORIES, "_bogus", ("highway", ["bus_stop"]))
        with pytest.raises(ValueError, match="not in the raw dump"):
            build_category([], "_bogus")
