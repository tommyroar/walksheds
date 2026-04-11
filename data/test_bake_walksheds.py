"""Tests for the walkshed bake script."""

import json
from unittest.mock import MagicMock, patch

import pytest

from bake_walksheds import (
    DEFAULT_OPTIONS,
    KEY_RE,
    _round_coords,
    bake,
    bake_one,
    make_key,
    write_atomic,
)


# ── Helpers ──


def _isochrone_fc(minutes=5):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"contour": minutes},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-122.337123456789, 47.611123456789],
                        [-122.336, 47.612],
                        [-122.335, 47.611],
                        [-122.337123456789, 47.611123456789],
                    ]],
                },
            }
        ],
    }


def _mock_client(response_fc=None):
    """Build an httpx.Client mock that returns response_fc."""
    if response_fc is None:
        response_fc = _isochrone_fc()
    client = MagicMock()
    resp = MagicMock()
    resp.json.return_value = response_fc
    resp.raise_for_status = MagicMock()
    client.get.return_value = resp
    return client


def _index(*entries):
    return {
        "version": 1,
        "stations": [
            {"name": n, "lines": l, "stopCode": c, "lng": lng, "lat": lat}
            for (n, l, c, lng, lat) in entries
        ],
    }


# ── make_key + KEY_RE ──


@pytest.mark.unit
class TestKey:
    def test_make_key_format(self):
        assert make_key("1,2", 50, 5) == "1,2-50-5"
        assert make_key("1", 54, 10) == "1-54-10"
        assert make_key("2", 60, 15) == "2-60-15"

    def test_key_regex_accepts_valid(self):
        assert KEY_RE.match("1,2-50-5")
        assert KEY_RE.match("1-54-10")
        assert KEY_RE.match("2-65-15")

    def test_key_regex_rejects_invalid(self):
        assert not KEY_RE.match("3-50-5")
        assert not KEY_RE.match("1,2,3-50-5")
        assert not KEY_RE.match("1-50")
        assert not KEY_RE.match("foo")


# ── _round_coords ──


@pytest.mark.unit
class TestRoundCoords:
    def test_rounds_floats(self):
        result = _round_coords([-122.337123456789, 47.611123456789])
        assert result == [-122.337123, 47.611123]

    def test_recursive_rounds_polygon(self):
        fc = _isochrone_fc()
        result = _round_coords(fc)
        coord = result["features"][0]["geometry"]["coordinates"][0][0]
        assert coord == [-122.337123, 47.611123]

    def test_preserves_non_coord_values(self):
        result = _round_coords({"contour": 5, "name": "x"})
        assert result == {"contour": 5, "name": "x"}


# ── bake_one ──


@pytest.mark.unit
class TestBakeOne:
    def test_returns_rounded_fc(self):
        client = _mock_client()
        fc = bake_one(client, -122.337, 47.611, 5, "test-token")
        assert fc["type"] == "FeatureCollection"
        coord = fc["features"][0]["geometry"]["coordinates"][0][0]
        assert coord == [-122.337123, 47.611123]

    def test_passes_correct_url_and_params(self):
        client = _mock_client()
        bake_one(client, -122.337, 47.611, 10, "test-token")
        call = client.get.call_args
        assert "isochrone" in call.args[0]
        assert "-122.337,47.611" in call.args[0]
        assert call.kwargs["params"]["contours_minutes"] == 10
        assert call.kwargs["params"]["polygons"] == "true"
        assert call.kwargs["params"]["access_token"] == "test-token"

    def test_raises_on_non_feature_collection(self):
        client = _mock_client(response_fc={"type": "Polygon", "coordinates": []})
        with pytest.raises(ValueError, match="Expected FeatureCollection"):
            bake_one(client, -122.337, 47.611, 5, "test-token")


# ── bake ──


@pytest.mark.unit
class TestBake:
    def test_iterates_all_stations_and_options(self):
        index = _index(
            ("Westlake Station", "1,2", 50, -122.337, 47.611),
            ("Stadium Station", "1", 54, -122.327, 47.591),
        )
        client = _mock_client()
        with patch("bake_walksheds.time.sleep"):
            output = bake(index, token="test-token", delay=0, client=client)

        assert output["version"] == 1
        assert "generated" in output
        # 2 stations × 3 options = 6 entries
        assert len(output["walksheds"]) == 6
        assert "1,2-50-5" in output["walksheds"]
        assert "1,2-50-10" in output["walksheds"]
        assert "1,2-50-15" in output["walksheds"]
        assert "1-54-5" in output["walksheds"]

    def test_no_duplicate_keys(self):
        index = _index(
            ("Stadium Station", "1", 54, -122.327, 47.591),
            ("Judkins Park Station", "2", 54, -122.30, 47.59),
        )
        client = _mock_client()
        with patch("bake_walksheds.time.sleep"):
            output = bake(index, token="test-token", delay=0, client=client)
        # Same stop code 54 on two lines must produce two distinct keys.
        assert "1-54-5" in output["walksheds"]
        assert "2-54-5" in output["walksheds"]

    def test_rate_limit_delay_called_n_minus_one_times(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        client = _mock_client()
        with patch("bake_walksheds.time.sleep") as mock_sleep:
            bake(index, token="test-token", delay=0.05, client=client)
        # 1 station × 3 options = 3 calls; sleep should fire between them = 2 times.
        assert mock_sleep.call_count == 3 - 1
        for call in mock_sleep.call_args_list:
            assert call.args[0] == 0.05

    def test_uses_default_options(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        client = _mock_client()
        with patch("bake_walksheds.time.sleep"):
            output = bake(index, token="test-token", delay=0, client=client)
        keys_for_station = [k for k in output["walksheds"] if k.startswith("1,2-50-")]
        suffixes = sorted(int(k.rsplit("-", 1)[1]) for k in keys_for_station)
        assert suffixes == list(DEFAULT_OPTIONS)


# ── write_atomic ──


@pytest.mark.unit
class TestWriteAtomic:
    def test_writes_json_file(self, tmp_path):
        out = tmp_path / "walksheds.geojson"
        write_atomic(out, {"hello": "world"})
        assert out.exists()
        assert json.loads(out.read_text()) == {"hello": "world"}

    def test_creates_parent_dir(self, tmp_path):
        out = tmp_path / "nested" / "dir" / "walksheds.geojson"
        write_atomic(out, {"x": 1})
        assert out.exists()

    def test_no_lingering_tmp(self, tmp_path):
        out = tmp_path / "walksheds.geojson"
        write_atomic(out, {"x": 1})
        assert not (tmp_path / "walksheds.geojson.tmp").exists()


# ── token exfil safety ──


@pytest.mark.unit
class TestTokenExfilSafety:
    def test_token_not_in_serialized_output(self):
        index = _index(("Westlake Station", "1,2", 50, -122.337, 47.611))
        client = _mock_client()
        token = "pk.test_secret_token_value"
        with patch("bake_walksheds.time.sleep"):
            output = bake(index, token=token, delay=0, client=client)
        assert token not in json.dumps(output)
