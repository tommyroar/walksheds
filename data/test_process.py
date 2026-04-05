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
