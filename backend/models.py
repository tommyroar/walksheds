"""Data models for the walksheds API.

All models are plain dataclasses that serialize to JSON/GeoJSON.
The schema is extensible: Attraction.metadata is a free-form dict
for type-specific fields, and Category is a simple string enum that
can grow without migrations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Category(StrEnum):
    RESTAURANT = "restaurant"
    CAFE = "cafe"
    BAR = "bar"
    SHOP = "shop"
    VENUE = "venue"
    PARK = "park"
    TRANSIT_STOP = "transit_stop"
    LANDMARK = "landmark"
    SCHOOL = "school"
    LIBRARY = "library"
    OTHER = "other"


@dataclass
class Line:
    id: str
    name: str
    color: str
    agency_id: str


@dataclass
class Station:
    id: str
    name: str
    line_id: str
    latitude: float
    longitude: float
    accessible: bool = True
    metadata: dict = field(default_factory=dict)

    def to_geojson_feature(self) -> dict:
        return {
            "type": "Feature",
            "properties": {
                "id": self.id,
                "name": self.name,
                "line_id": self.line_id,
                "accessible": self.accessible,
                **self.metadata,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [self.longitude, self.latitude],
            },
        }


@dataclass
class Attraction:
    id: str
    name: str
    category: Category
    latitude: float
    longitude: float
    source: str = "osm"  # "osm" | "user" | "google"
    metadata: dict = field(default_factory=dict)

    def to_geojson_feature(self) -> dict:
        return {
            "type": "Feature",
            "properties": {
                "id": self.id,
                "name": self.name,
                "category": self.category.value,
                "source": self.source,
                **self.metadata,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [self.longitude, self.latitude],
            },
        }


@dataclass
class Walkshed:
    station_id: str
    minutes: int
    geometry: dict  # GeoJSON Polygon

    def to_geojson_feature(self) -> dict:
        return {
            "type": "Feature",
            "properties": {
                "station_id": self.station_id,
                "minutes": self.minutes,
            },
            "geometry": self.geometry,
        }
