"""Tests for the SDOT data refresh script."""

import json
from unittest.mock import patch

import pytest

from refresh import (
    ALIGNMENT_URL,
    STATIONS_URL,
    fetch_geojson,
    validate_alignment,
    validate_stations,
    download,
)


# ── Fixtures ──


def _make_station_feature(name="Test Station", status="Existing / Under Construction"):
    return {
        "type": "Feature",
        "properties": {"NAME": name, "STATUS": status, "STATION": "Test"},
        "geometry": {"type": "Point", "coordinates": [-122.33, 47.60]},
    }


def _make_alignment_feature(desc="Central Link", status="Existing / Under Construction"):
    return {
        "type": "Feature",
        "properties": {"DESCRIPTIO": desc, "STATUS": status},
        "geometry": {"type": "LineString", "coordinates": [[-122.33, 47.60], [-122.34, 47.61]]},
    }


def _make_fc(features):
    return {"type": "FeatureCollection", "features": features}


@pytest.fixture
def stations_fc():
    return _make_fc([_make_station_feature(f"Station {i}") for i in range(40)])


@pytest.fixture
def alignment_fc():
    return _make_fc([_make_alignment_feature(f"Segment {i}") for i in range(20)])


# ── validate_stations ���─


class TestValidateStations:
    def test_valid(self, stations_fc):
        validate_stations(stations_fc)  # should not raise

    def test_too_few_features(self):
        fc = _make_fc([_make_station_feature(f"S{i}") for i in range(5)])
        with pytest.raises(ValueError, match="at least 30"):
            validate_stations(fc)

    def test_missing_name_field(self):
        feat = _make_station_feature()
        del feat["properties"]["NAME"]
        with pytest.raises(ValueError, match="missing expected field"):
            validate_stations(_make_fc([feat] * 40))

    def test_missing_status_field(self):
        feat = _make_station_feature()
        del feat["properties"]["STATUS"]
        with pytest.raises(ValueError, match="missing expected field"):
            validate_stations(_make_fc([feat] * 40))


# ── validate_alignment ──


class TestValidateAlignment:
    def test_valid(self, alignment_fc):
        validate_alignment(alignment_fc)  # should not raise

    def test_too_few_features(self):
        fc = _make_fc([_make_alignment_feature(f"S{i}") for i in range(3)])
        with pytest.raises(ValueError, match="at least 10"):
            validate_alignment(fc)

    def test_missing_fields(self):
        feat = _make_alignment_feature()
        feat["properties"] = {"unrelated": True}
        with pytest.raises(ValueError, match="missing expected fields"):
            validate_alignment(_make_fc([feat] * 20))


# ── fetch_geojson ──


class TestFetchGeojson:
    def test_valid_response(self, stations_fc):
        with patch("refresh.httpx.get") as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = stations_fc
            mock_get.return_value.raise_for_status = lambda: None
            result = fetch_geojson("https://example.com/test")
        assert result["type"] == "FeatureCollection"
        assert len(result["features"]) == 40

    def test_invalid_json_structure(self):
        with patch("refresh.httpx.get") as mock_get:
            mock_get.return_value.json.return_value = {"error": "bad request"}
            mock_get.return_value.raise_for_status = lambda: None
            with pytest.raises(ValueError, match="Expected GeoJSON"):
                fetch_geojson("https://example.com/test")

    def test_http_error(self):
        import httpx as _httpx

        with patch("refresh.httpx.get") as mock_get:
            mock_get.return_value.raise_for_status.side_effect = _httpx.HTTPStatusError(
                "404", request=_httpx.Request("GET", "https://x"), response=_httpx.Response(404)
            )
            with pytest.raises(_httpx.HTTPStatusError):
                fetch_geojson("https://example.com/test")


# ── download (dry run) ──


class TestDownload:
    def test_dry_run_does_not_write_files(self, stations_fc, alignment_fc, tmp_path):
        with patch("refresh.fetch_geojson") as mock_fetch, \
             patch("refresh.RAW_DIR", tmp_path / "raw"):
            mock_fetch.side_effect = [stations_fc, alignment_fc]
            s, a = download(dry_run=True)

        assert len(s["features"]) == 40
        assert len(a["features"]) == 20
        assert not (tmp_path / "raw").exists()

    def test_writes_files_and_runs_process(self, stations_fc, alignment_fc, tmp_path):
        raw = tmp_path / "raw"
        with patch("refresh.fetch_geojson") as mock_fetch, \
             patch("refresh.RAW_DIR", raw), \
             patch("refresh.subprocess.check_call") as mock_proc:
            mock_fetch.side_effect = [stations_fc, alignment_fc]
            download(dry_run=False)

        assert (raw / "light-rail-stations.geojson").exists()
        assert (raw / "light-rail-alignment.geojson").exists()

        written = json.loads((raw / "light-rail-stations.geojson").read_text())
        assert len(written["features"]) == 40

        # download() runs process.py then build_station_index.py.
        assert mock_proc.call_count == 2
        scripts = [call.args[0][1] for call in mock_proc.call_args_list]
        assert any("process.py" in s for s in scripts)
        assert any("build_station_index.py" in s for s in scripts)

    def test_urls_are_well_formed(self):
        assert "FeatureServer/14" in STATIONS_URL
        assert "FeatureServer/18" in ALIGNMENT_URL
        assert "f=geojson" in STATIONS_URL
        assert "f=geojson" in ALIGNMENT_URL
