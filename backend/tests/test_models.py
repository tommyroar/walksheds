import pytest

from models import Attraction, Category, Station, Walkshed


class TestStation:
    @pytest.mark.unit
    def test_to_geojson_feature(self):
        station = Station(
            id="test-1",
            name="Test Station",
            line_id="1-line",
            latitude=47.6,
            longitude=-122.3,
        )
        feature = station.to_geojson_feature()

        assert feature["type"] == "Feature"
        assert feature["properties"]["id"] == "test-1"
        assert feature["properties"]["name"] == "Test Station"
        assert feature["geometry"]["type"] == "Point"
        assert feature["geometry"]["coordinates"] == [-122.3, 47.6]

    @pytest.mark.unit
    def test_metadata_included_in_geojson(self):
        station = Station(
            id="s1",
            name="S1",
            line_id="1-line",
            latitude=47.0,
            longitude=-122.0,
            metadata={"parking": True},
        )
        feature = station.to_geojson_feature()
        assert feature["properties"]["parking"] is True


class TestAttraction:
    @pytest.mark.unit
    def test_to_geojson_feature(self):
        attr = Attraction(
            id="a1",
            name="Test Cafe",
            category=Category.CAFE,
            latitude=47.61,
            longitude=-122.33,
            source="osm",
        )
        feature = attr.to_geojson_feature()

        assert feature["properties"]["category"] == "cafe"
        assert feature["properties"]["source"] == "osm"

    @pytest.mark.unit
    def test_category_values(self):
        assert Category.RESTAURANT.value == "restaurant"
        assert Category.TRANSIT_STOP.value == "transit_stop"
        assert Category.LANDMARK.value == "landmark"


class TestWalkshed:
    @pytest.mark.unit
    def test_to_geojson_feature(self):
        ws = Walkshed(
            station_id="test-1",
            minutes=15,
            geometry={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
        )
        feature = ws.to_geojson_feature()

        assert feature["properties"]["station_id"] == "test-1"
        assert feature["properties"]["minutes"] == 15
        assert feature["geometry"]["type"] == "Polygon"
