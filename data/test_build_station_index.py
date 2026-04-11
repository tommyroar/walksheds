"""Tests for the station index builder."""

import pytest

from build_station_index import build, INDEX_VERSION


def _feature(name, lines, stop_code, lng, lat, shared=False):
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "line": "1-line" if "1" in lines else "2-line",
            "lines": lines,
            "stopCode": stop_code,
            "shared": shared,
        },
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
    }


def _fc(features):
    return {"type": "FeatureCollection", "features": features}


@pytest.mark.unit
class TestBuild:
    def test_basic_structure(self):
        fc = _fc([_feature("Westlake Station", "1,2", 50, -122.337, 47.611, shared=True)])
        result = build(fc)
        assert result["version"] == INDEX_VERSION
        assert isinstance(result["stations"], list)
        assert len(result["stations"]) == 1
        s = result["stations"][0]
        assert s == {
            "name": "Westlake Station",
            "lines": "1,2",
            "stopCode": 50,
            "lng": -122.337,
            "lat": 47.611,
        }

    def test_sorted_by_lines_then_stop_code(self):
        fc = _fc([
            _feature("Z-Station", "2", 60, -122.0, 47.5),
            _feature("Y-Station", "1", 55, -122.1, 47.4),
            _feature("X-Station", "1,2", 50, -122.2, 47.3, shared=True),
            _feature("W-Station", "1", 54, -122.3, 47.2),
        ])
        result = build(fc)
        ordering = [(s["lines"], s["stopCode"]) for s in result["stations"]]
        assert ordering == [("1", 54), ("1", 55), ("1,2", 50), ("2", 60)]

    def test_preserves_all_fields(self):
        fc = _fc([_feature("Stadium Station", "1", 54, -122.327, 47.591)])
        result = build(fc)
        s = result["stations"][0]
        assert set(s.keys()) == {"name", "lines", "stopCode", "lng", "lat"}

    def test_preserves_shared_lines_string(self):
        fc = _fc([_feature("Shared", "1,2", 50, -122.0, 47.0, shared=True)])
        result = build(fc)
        assert result["stations"][0]["lines"] == "1,2"
