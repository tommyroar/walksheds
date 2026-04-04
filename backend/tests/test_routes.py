import pytest


class TestHealth:
    @pytest.mark.unit
    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "ok"


class TestLines:
    @pytest.mark.unit
    def test_list_lines(self, client):
        resp = client.get("/api/lines")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        ids = {line["id"] for line in data}
        assert "1-line" in ids
        assert "2-line" in ids


class TestStations:
    @pytest.mark.unit
    def test_list_all_stations(self, client):
        resp = client.get("/api/stations")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 27  # 19 + 8

    @pytest.mark.unit
    def test_filter_by_line(self, client):
        resp = client.get("/api/stations?line_id=2-line")
        data = resp.get_json()
        assert len(data["features"]) == 8

    @pytest.mark.unit
    def test_get_single_station(self, client):
        resp = client.get("/api/stations/westlake")
        assert resp.status_code == 200
        feature = resp.get_json()
        assert feature["properties"]["name"] == "Westlake"

    @pytest.mark.unit
    def test_station_not_found(self, client):
        resp = client.get("/api/stations/nonexistent")
        assert resp.status_code == 404


class TestWalkshed:
    @pytest.mark.unit
    def test_get_walkshed(self, client):
        resp = client.get("/api/stations/westlake/walkshed?minutes=10")
        assert resp.status_code == 200
        feature = resp.get_json()
        assert feature["properties"]["minutes"] == 10
        assert feature["geometry"]["type"] == "Polygon"

    @pytest.mark.unit
    def test_walkshed_clamps_minutes(self, client):
        resp = client.get("/api/stations/westlake/walkshed?minutes=999")
        feature = resp.get_json()
        assert feature["properties"]["minutes"] == 60

    @pytest.mark.unit
    def test_walkshed_station_not_found(self, client):
        resp = client.get("/api/stations/fake/walkshed")
        assert resp.status_code == 404


class TestAttractions:
    @pytest.mark.unit
    def test_attractions_empty_placeholder(self, client):
        resp = client.get("/api/stations/westlake/attractions")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []
