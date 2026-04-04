# Walksheds API Schema

Base URL: `/api`

## Endpoints

### `GET /api/health`
Health check.

**Response:** `{"status": "ok"}`

---

### `GET /api/lines`
List all transit lines.

**Response:**
```json
[
  { "id": "1-line", "name": "1 Line", "color": "#0054A6", "agency_id": "sound-transit" }
]
```

---

### `GET /api/stations`
List all stations as a GeoJSON FeatureCollection.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `line_id` | string | Filter by line ID (e.g. `1-line`) |

**Response:** GeoJSON FeatureCollection of Point features.

**Feature properties:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Station ID slug |
| `name` | string | Display name |
| `line_id` | string | Parent line ID |
| `accessible` | boolean | ADA accessible |

---

### `GET /api/stations/:id`
Get a single station.

**Response:** GeoJSON Feature (Point).

**Errors:** `404` if station not found.

---

### `GET /api/stations/:id/walkshed`
Compute a walkshed isochrone polygon for a station.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `minutes` | int | 15 | Walk time (clamped to 1–60) |

**Response:** GeoJSON Feature (Polygon) with properties `station_id` and `minutes`.

---

### `GET /api/stations/:id/attractions`
List attractions within a station's walkshed.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category (see below) |
| `sort` | string | Sort order: `distance` (default), `name` |

**Response:** GeoJSON FeatureCollection of Point features.

**Feature properties:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Attraction ID |
| `name` | string | Display name |
| `category` | string | Category enum value |
| `source` | string | Data source: `osm`, `user`, `google` |

---

## Data Model

### Categories (extensible enum)
`restaurant`, `cafe`, `bar`, `shop`, `venue`, `park`, `transit_stop`, `landmark`, `school`, `library`, `other`

### Extensibility
- **New attraction types**: Add values to the `Category` enum in `models.py`
- **Type-specific fields**: Use the `metadata` dict on `Station` or `Attraction` for arbitrary fields (e.g. `{"cuisine": "thai"}` for restaurants, `{"height_m": 45}` for tallest trees, `{"routes": ["44", "48"]}` for bus stops)
- **New agencies**: Add entries to the `LINES` dict and corresponding stations
