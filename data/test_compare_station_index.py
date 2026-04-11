"""Tests for the station index drift detector."""

import pytest

from compare_station_index import (
    Drift,
    Report,
    compare,
    haversine,
    _live_station_map,
)


# ── Helpers ──


def _index(*entries):
    return {
        "version": 1,
        "stations": [
            {"name": n, "lines": l, "stopCode": c, "lng": lng, "lat": lat}
            for (n, l, c, lng, lat) in entries
        ],
    }


def _live_feature(name, lng, lat, status="Existing / Under Construction"):
    # Mirror SDOT feature shape — process.py reads list(values())[2] as the name.
    return {
        "type": "Feature",
        "properties": {"OBJECTID": 1, "ID": "x", "NAME": name, "STATUS": status},
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
    }


def _live_fc(*features):
    return {"type": "FeatureCollection", "features": list(features)}


# ── haversine ──


@pytest.mark.unit
class TestHaversine:
    def test_zero_distance(self):
        assert haversine(-122.337, 47.611, -122.337, 47.611) == pytest.approx(0.0, abs=0.01)

    def test_known_distance(self):
        # Roughly 100 m east at lat 47.6
        d = haversine(-122.337, 47.611, -122.337 + 0.00133, 47.611)
        assert 90 < d < 110

    def test_symmetric(self):
        a = haversine(-122.337, 47.611, -122.30, 47.65)
        b = haversine(-122.30, 47.65, -122.337, 47.611)
        assert a == pytest.approx(b)


# ── compare ──


@pytest.mark.unit
class TestCompare:
    def test_exact_match_passes(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        live = _live_fc(_live_feature("Westlake Station", -122.337, 47.611))
        report = compare(index, live)
        assert report.ok
        assert report.added == []
        assert report.removed == []
        assert report.drifted == []

    def test_drift_below_threshold_passes(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        # ~15 m east
        live = _live_fc(_live_feature("Westlake Station", -122.337 + 0.0002, 47.611))
        report = compare(index, live, threshold_m=75)
        assert report.ok

    def test_drift_above_threshold_fails(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        # ~150 m east
        live = _live_fc(_live_feature("Westlake Station", -122.337 + 0.002, 47.611))
        report = compare(index, live, threshold_m=75)
        assert not report.ok
        assert len(report.drifted) == 1
        assert report.drifted[0].name == "Westlake Station"
        assert report.drifted[0].distance_m > 75

    def test_added_station_in_live(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        live = _live_fc(
            _live_feature("Westlake Station", -122.337, 47.611),
            _live_feature("Brand New Station", -122.30, 47.65),
        )
        report = compare(index, live)
        assert not report.ok
        assert report.added == ["Brand New Station"]

    def test_removed_station_in_live(self):
        index = _index(
            ("Westlake Station", "1,2", 50, -122.337, 47.611),
            ("Stadium Station", "1", 54, -122.327, 47.591),
        )
        live = _live_fc(_live_feature("Westlake Station", -122.337, 47.611))
        report = compare(index, live)
        assert not report.ok
        assert report.removed == ["Stadium Station"]

    def test_missing_stations_exempt_from_removed(self):
        # Lynnwood City Center is in process.MISSING_STATIONS
        index = _index(("Lynnwood City Center Station", "1,2", 40, -122.295, 47.816))
        live = _live_fc()  # SDOT doesn't publish it yet
        report = compare(index, live)
        assert report.removed == []
        assert report.ok

    def test_missing_stations_exempt_from_drift(self):
        # Lynnwood is in MISSING_STATIONS — its index coords are approximate.
        index = _index(("Lynnwood City Center Station", "1,2", 40, -122.295, 47.816))
        live = _live_fc(_live_feature("Lynnwood City Center Station", -122.20, 47.90))
        report = compare(index, live)
        assert report.drifted == []

    def test_name_map_normalization(self):
        # NAME_MAP: "NE 145th Station" -> "Shoreline South/148th Station"
        index = _index(("Shoreline South/148th Station", "1,2", 43, -122.33, 47.73))
        live = _live_fc(_live_feature("NE 145th Station", -122.33, 47.73))
        report = compare(index, live)
        assert report.ok

    def test_filters_tacoma_link(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        live = _live_fc(
            _live_feature("Westlake Station", -122.337, 47.611),
            _live_feature("Tacoma Dome Station", -122.43, 47.24),
        )
        report = compare(index, live)
        assert report.ok
        assert "Tacoma Dome Station" not in report.added

    def test_filters_non_existing_status(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        live = _live_fc(
            _live_feature("Westlake Station", -122.337, 47.611),
            _live_feature("Future Station", -122.30, 47.65, status="Planned"),
        )
        report = compare(index, live)
        assert report.ok


@pytest.mark.unit
class TestReport:
    def test_empty_report_is_ok(self):
        assert Report().ok

    def test_any_finding_makes_not_ok(self):
        assert not Report(added=["x"]).ok
        assert not Report(removed=["x"]).ok
        assert not Report(drifted=[Drift("x", 100)]).ok
