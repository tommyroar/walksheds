# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Walksheds — Seattle light rail walkshed explorer. Interactive map showing areas reachable within walking distance of Link Light Rail stations, with filterable points of interest.

## Commands

```bash
# Frontend
npm run dev           # Vite dev server on port 5187
npm run build         # Production build to dist/
npm run lint          # ESLint
npm run test          # Vitest unit tests (watch mode)
npm run test -- --run # Vitest unit tests (single run)
npm run e2e           # Playwright smoke tests
npm run preview       # Preview production build

# Backend (from backend/)
python3 server.py              # Flask dev server on port 8002
ruff check .                   # Lint
ruff format --check .          # Format check
pytest -m "not slow" -q        # Fast tests
pytest -q                      # All tests
```

## Architecture

- **Frontend**: React + Vite + react-map-gl (Uber's Mapbox GL JS wrapper)
- **Backend**: Flask + Flask-CORS (`backend/server.py`), data models in `backend/models.py`
- **Map**: Mapbox Standard style with configurable theme/lightPreset via `config` prop
- **Themes**: `src/themes.js` — modular transit agency theme system (Sound Transit, London Underground, NYC Subway, Tokyo Metro)
- **Data**: `src/data/seattle-link.js` — GeoJSON for Link Light Rail Lines 1 and 2

## API

Backend serves at `/api`. Key endpoints: `/api/health`, `/api/stations`, `/api/stations/:id/walkshed?minutes=N`, `/api/stations/:id/attractions`. Full schema in `docs/api-schema.md`.

## Infrastructure

- **Terraform** (`terraform/`): Cloudflare Pages (frontend) + Workers (backend container)
- **CI/CD** (`.github/workflows/`): `ci.yml` (lint+test), `deploy-staging.yml` (PR previews), `deploy-prod.yml` (Cloudflare)
- **Docker**: `terraform/Dockerfile` for backend container

## Testing

- **JS unit tests**: Vitest + jsdom + React Testing Library (`src/__tests__/`)
- **Python unit tests**: pytest with markers `unit`, `integration`, `slow` (`backend/tests/`)
- **E2E**: Playwright chromium (`e2e/smoke.spec.js`)
- **Linting**: ESLint (JS), ruff (Python)

## Ports & Credentials

- Vite dev server: **5187** (registered in `~/.claude/vite-ports.json`)
- Flask backend: **8002**
- Mapbox token: `.env` → `VITE_MAPBOX_ACCESS_TOKEN`; managed in `~/.mapbox/credentials` under `[walksheds]`

## Mapbox Style

Base: `mapbox://styles/mapbox/standard` with `theme: 'monochrome'`, `lightPreset: 'dusk'`. Theme switching changes config values and flies camera to each city.
