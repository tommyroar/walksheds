"""Tests for data processing — verify line alignment and station data integrity."""

import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")


@pytest.fixture(scope="session", autouse=True)
def generate_data():
    """Run the processing script before tests."""
    subprocess.check_call([sys.executable, os.path.join(ROOT, "data", "process.py")])


def load(name):
    with open(os.path.join(PUBLIC, f"{name}.geojson")) as f:
        return json.load(f)


class TestLineAlignment:
    """Verify Line 1 is west of Line 2 in the shared segment."""

    @pytest.mark.unit
    def test_line1_west_of_line2_in_shared_segment(self):
        line1 = load("line1-alignment")
        line2 = load("line2-alignment")

        line1_coords = line1["features"][0]["geometry"]["coordinates"]
        line2_coords = line2["features"][0]["geometry"]["coordinates"]

        # Compare the first 13 points (shared segment, Lynnwood to Intl District)
        # Line 1 should have smaller longitude (further west) than Line 2
        shared_count = 13
        for i in range(min(shared_count, len(line1_coords), len(line2_coords))):
            lng1 = line1_coords[i][0]
            lng2 = line2_coords[i][0]
            assert lng1 < lng2, (
                f"At shared station index {i}: Line 1 (lng={lng1:.6f}) should be "
                f"west of Line 2 (lng={lng2:.6f})"
            )

    @pytest.mark.unit
    def test_lines_diverge_after_junction(self):
        line1 = load("line1-alignment")
        line2 = load("line2-alignment")

        line1_coords = line1["features"][0]["geometry"]["coordinates"]
        line2_coords = line2["features"][0]["geometry"]["coordinates"]

        # After the shared segment (index 13+), lines should diverge
        # Line 1 continues south, Line 2 goes east
        # Line 2's 14th point (Judkins Park) should be east of Line 1's 14th (Stadium)
        assert line2_coords[13][0] > line1_coords[13][0], (
            "After junction, Line 2 should be east of Line 1"
        )


class TestStationData:
    @pytest.mark.unit
    def test_no_duplicate_stations(self):
        stations = load("all-stations")
        names = [f["properties"]["name"] for f in stations["features"]]
        assert len(names) == len(set(names)), f"Duplicate stations found: {[n for n in names if names.count(n) > 1]}"

    @pytest.mark.unit
    def test_shared_stations_have_both_lines(self):
        stations = load("all-stations")
        shared = [f for f in stations["features"] if f["properties"]["shared"]]
        for feat in shared:
            assert feat["properties"]["lines"] == "1,2", (
                f"{feat['properties']['name']} should have lines='1,2'"
            )

    @pytest.mark.unit
    def test_all_stations_have_stop_codes(self):
        stations = load("all-stations")
        for feat in stations["features"]:
            code = feat["properties"]["stopCode"]
            assert code is not None, f"{feat['properties']['name']} missing stopCode"
            assert isinstance(code, int), f"{feat['properties']['name']} stopCode should be int"

    @pytest.mark.unit
    def test_station_counts(self):
        stations = load("all-stations")
        total = len(stations["features"])
        shared = sum(1 for f in stations["features"] if f["properties"]["shared"])
        line1_only = sum(1 for f in stations["features"] if f["properties"]["lines"] == "1")
        line2_only = sum(1 for f in stations["features"] if f["properties"]["lines"] == "2")
        assert total == 38, f"Expected 38 stations, got {total}"
        assert shared == 13, f"Expected 13 shared stations, got {shared}"
        assert line1_only == 13, f"Expected 13 Line 1 only stations, got {line1_only}"
        assert line2_only == 12, f"Expected 12 Line 2 only stations, got {line2_only}"

    @pytest.mark.unit
    def test_stop_codes_unique_per_line(self):
        """Each (line, stopCode) pair must be unique."""
        stations = load("all-stations")
        seen = {}
        for feat in stations["features"]:
            props = feat["properties"]
            for line_num in props["lines"].split(","):
                key = (line_num.strip(), props["stopCode"])
                assert key not in seen, (
                    f"Duplicate stop code {props['stopCode']} on line {line_num}: "
                    f"{seen[key]} and {props['name']}"
                )
                seen[key] = props["name"]

    @pytest.mark.unit
    def test_known_stop_codes(self):
        """Verify specific codes match Sound Transit reference."""
        stations = load("all-stations")
        by_name = {f["properties"]["name"]: f["properties"]["stopCode"] for f in stations["features"]}
        assert by_name["Westlake Station"] == 50
        assert by_name["U District Station"] == 47
        assert by_name["International District Station"] == 53
        assert by_name["Lynnwood City Center Station"] == 40
        assert by_name["Federal Way Downtown Station"] == 68
        assert by_name["Downtown Redmond Station"] == 65


class TestBakeIndexConsistency:
    """If a baked walkshed file exists, every station-index entry must be present."""

    @pytest.mark.unit
    def test_walkshed_keys_cover_station_index(self):
        bake_path = os.path.join(PUBLIC, "walksheds.geojson")
        index_path = os.path.join(ROOT, "data", "station-index.json")
        if not os.path.exists(bake_path) or not os.path.exists(index_path):
            pytest.skip("walksheds.geojson not present — skipping cross-check")

        with open(bake_path) as f:
            bake = json.load(f)
        with open(index_path) as f:
            index = json.load(f)

        keys = set(bake["walksheds"].keys())
        for station in index["stations"]:
            for minutes in (5, 10, 15):
                key = f"{station['lines']}-{station['stopCode']}-{minutes}"
                assert key in keys, f"Missing baked walkshed for {key} ({station['name']})"
