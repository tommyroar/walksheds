# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Walksheds — Seattle light rail walkshed explorer. Interactive React SPA showing areas reachable within walking distance of Link Light Rail stations, with Mapbox isochrone visualization.

## Commands

```bash
npm run dev           # Vite dev server on port 5187
npm run build         # Production build to dist/
npm run lint          # ESLint
npm run test          # Vitest unit tests (watch mode)
npm run test -- --run # Vitest unit tests (single run)
npm run e2e           # Playwright smoke tests
npm run preview       # Preview production build
python3 data/process.py          # Regenerate transit GeoJSON from SDOT raw data
python3 data/pois/fetch_pois.py  # Rebuild POI GeoJSONs from committed OSM dump (no network)
python3 data/pois/fetch_pois.py --refresh  # Refetch OSM dump from Overpass, then rebuild
```

## Architecture

- **Frontend**: React + Vite + react-map-gl (Mapbox GL JS wrapper)
- **Map**: Mapbox Standard style, walksheds via Mapbox Isochrone API
- **Data**: SDOT alignment + station GeoJSON processed via `data/process.py` into `public/` static files
- **Station icons**: SVG pill markers generated at runtime (`src/stationIcons.js`), light/dark variants
- **Route graph**: `src/routeGraph.js` — station adjacency for keyboard/swipe navigation along lines

## Data Pipeline

### Transit (SDOT → public/)
Raw SDOT data in `data/raw/` → `data/process.py` → processed GeoJSON in `public/`:
- `line1-alignment.geojson` / `line2-alignment.geojson` — curved route lines (Chaikin-smoothed SDOT points)
- `all-stations.geojson` — 38 stations with stop codes, line assignments, shared flag
- Line 1 offset west, Line 2 offset east in the shared segment (Lynnwood → Intl District)

`data/refresh.py` re-downloads the raw SDOT GeoJSON from Seattle ArcGIS (only needed when Sound Transit publishes updates), then runs `process.py`. Everything else reads from the committed raw files — no network required.

### POIs (OSM → public/pois/)
Two phases, with the raw Overpass dump committed to the repo:

1. **Refresh** (needs network to `overpass-api.de`): `python3 data/pois/fetch_pois.py --refresh` runs one broad Overpass query covering every named node/way tagged with `amenity`/`tourism`/`leisure`/`shop` inside the station bbox, and writes `data/pois/raw/osm-seattle.json.gz` (~1.5 MB).
2. **Build** (no network, default): `python3 data/pois/fetch_pois.py` reads the committed raw dump, applies `CATEGORIES` filters + `extract_tags`, and writes per-category GeoJSONs to `public/pois/`.

Adding a new POI category:
1. Edit `CATEGORIES` in `data/pois/fetch_pois.py`. The osm_key must be in `RAW_KEYS`.
2. Run `python3 data/pois/fetch_pois.py` — rebuilds from the committed dump, no network.
3. Wire into `src/constants.js`. Commit.

Only add a new key to `RAW_KEYS` + run `--refresh` if a new category uses an OSM tag key not already covered by the dump.

## Deployment

React SPA deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to main.

## Testing

- **JS unit tests**: Vitest + jsdom + React Testing Library (`src/__tests__/`)
- **Route graph tests**: `src/__tests__/routeGraph.test.js` — navigation, junctions, bearings
- **Data processing tests**: `data/test_process.py` — alignment invariants, station data integrity
- **E2E**: Playwright chromium (`e2e/smoke.spec.js`)
- **Linting**: ESLint

## Ports & Credentials

- Vite dev server: **5187** (registered in `~/.claude/vite-ports.json`)
- Mapbox token: `.env` → `VITE_MAPBOX_ACCESS_TOKEN`; managed in `~/.mapbox/credentials` under `[walksheds]`

## Mapbox Style

Base: `mapbox://styles/mapbox/standard` with `theme: 'default'`, `lightPreset: 'day'`. Dark mode toggles to `lightPreset: 'dusk'`.

## Station Codes (Sound Transit Reference)

Reference: https://www.soundtransit.org/ride-with-us/stations/link-light-rail-stations
Blog post: https://www.soundtransit.org/blog/platform/understanding-sound-transits-new-three-digit-station-codes
Screenshots: `data/reference/soundtransit-stations.png`, `data/reference/soundtransit-station-codes.png`

Sound Transit uses three-digit station codes: first digit = line number, last two digits = stop code.
Westlake (center) = 50. Numbers increase south/east, decrease north. Gaps reserved for future infill stations.

**Shared stations (both lines):**
40=Lynnwood City Center, 41=Mountlake Terrace, 42=Shoreline North/185th, 43=Shoreline South/148th,
[44=NE 130th St, future], 45=Northgate, 46=Roosevelt, 47=U District, 48=UW,
49=Capitol Hill, 50=Westlake, 51=Symphony, 52=Pioneer Square, 53=Intl District/Chinatown

**Line 1 only (south):**
54=Stadium, 55=SODO, 56=Beacon Hill, 57=Mount Baker, 58=Columbia City,
[59=Graham St, future], 60=Othello, 61=Rainier Beach, [62=Boeing Access Rd, future],
63=Tukwila Intl Blvd, 64=SeaTac/Airport, 65=Angle Lake, 66=Kent Des Moines, 67=Star Lake, 68=Federal Way Downtown

**Line 2 only (east):**
54=Judkins Park, 55=Mercer Island, 56=South Bellevue, 57=East Main, 58=Bellevue Downtown,
59=Wilburton, 60=Spring District, 61=BelRed, 62=Overlake Village, 63=Redmond Technology,
64=Marymoor Village, 65=Downtown Redmond
