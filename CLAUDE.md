# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a travel visualization application displaying an interactive map of a Japan trip. It uses vanilla JavaScript (ES6 modules) with no build system or package manager - files are served directly.

## Development

**Running locally:** Serve the project directory with using http-server -p 8000 (we have http-server installed locally).

**App code has no build step** - JS/CSS files are served directly. However there is a `package.json` for the test runner (dev-only). Run `npm install` once after cloning.

## Testing

### Test commands

| Command | What it runs | Speed |
|---------|-------------|-------|
| `npm test` | Vitest unit + schema + emoji tests | ~0.5s |
| `npm run test:e2e` | Playwright E2E (smoke + full integration) | ~4s |
| `npx playwright test smoke` | Smoke test only (map loads, no JS errors) | ~1s |
| `npx playwright test full-integration` | Full integration with place markers | ~2s |
| `npx playwright test --ui` | Playwright interactive UI (good for debugging) | — |

### Test layout

```
tests/
  sanity.test.js              # trivial 1+1 tooling check
  geojsonService.test.js      # unit tests for fetchGeoJson() (3 code paths)
  geojson-schema.test.js      # data validation for all 3 GeoJSON point files
  placeEmojis.test.js         # dead-key check: every emoji key is used in data
  e2e/
    smoke.spec.js             # Leaflet container + tile + marker load, no JS errors
    full-integration.spec.js  # place markers visible after animation + zoom
```

### Key E2E constraints to know

**Place/info markers only appear at zoom ≥ 10** (enforced by `manageLayerVisibilityByZoom` in `src/utils/layerVisibility.js`, wired up from `script.js`). The full integration test handles this by:
1. Intercepting `incoming_flight.geojson` and `animation_tracks.geojson` via `page.route()` and returning 2-point stub GeoJSON — the animation chain then completes in ~10ms instead of 20–30 seconds.
2. Capturing the Leaflet map instance via `page.addInitScript()` which wraps `L.map()` before the CDN bundle loads, storing the result as `window.__leafletMap`.
3. Calling `window.__leafletMap.setZoom(12, { animate: false })` to zoom in and trigger `zoomend`.

**Leaflet has no public map registry** — `document.getElementById('map')._leaflet_map` does NOT exist in Leaflet 1.9.4. The `window.__leafletMap` intercept pattern (in `captureLeafletMap()` in `full-integration.spec.js`) is the correct way to get programmatic access to the map in tests.

### Known data bug (tracked in todo.MD)
`assets/points/photos.geojson` feature index 748 is a blank record (`geometry: null`, all properties null). The schema test logs it but doesn't fail on it.

## Testing with MCP Browser

**IMPORTANT:** The MCP Playwright browser maintains a persistent session and caches JavaScript files between tool calls. After making code changes:

1. **Close and reopen the browser** using `browser_close` then navigate again for a completely fresh session
2. **Or use hard refresh** by pressing `Cmd+Shift+R` in the browser to force reload cached files

Note: The human developer doesn't experience this caching issue in their browser - this only affects Claude's MCP browser session.

## Architecture

**Entry Point:** `index.html` → `script.js` (ES6 module)

**Feature-based module organization:**
- `src/features/animations/` - Chained animation system (UUID-based triggers) plus `animateMarkerAlongLine` (the incoming flight marker)
- `src/features/geojson/` - GeoJSON fetching and Leaflet layer creation, including `flightArcs.js` (synthesises curved flight lines from 2-point GeoJSON)
- `src/features/markers/` - Photo, place, and info marker callbacks (onEachFeature/pointToLayer pattern)
- `src/features/overlays/` - Overlay panel system including polaroid photo display
- `src/utils/` - Generic, feature-agnostic map helpers (e.g. `layerVisibility.js`)

**Key libraries (CDN-loaded):**
- Leaflet 1.9.4 for mapping
- Leaflet.MarkerCluster for clustering
- leaflet.motion for line animations

**Data:** GeoJSON files in `assets/points/` (photos, places, info) and `assets/lines/` (routes, animations, flights)

**Flight arcs:** `assets/lines/flights.geojson` holds past flights as `LineString`s with exactly two coordinates (origin + destination airport, `[lng, lat]`). `flightArcs.js` reads these and synthesises a bowed arc per flight (quadratic Bézier offset perpendicular to the route midpoint — `ARC_CURVATURE`/`ARC_SEGMENTS` tune it); a straight 2-point line would otherwise render flat. The arcs join the intro crossfade in `script.js` and are zoom-gated to only show when zoomed out (≤ `FLIGHT_MAX_ZOOM`) via `manageLayerVisibilityByZoom`.

## Conventions

**Markers:** Use Leaflet `L.divIcon` with HTML content, not image icons. Z-index layering: Places(10) → Info(20) → Clusters(30) → Photos(40).

**GeoJSON properties:**
- Photos: `filename`, `description`, `timestamp`
- Places: `placeList` (category), `Title`
- Animations: `name`, `type`, `triggers` (UUID array), `uuid`
- Flights: `from`, `to` (airport codes), `name` (human-readable route)

**CSS:** Feature-prefixed classes (`.polaroid-`, `.place-`, `.info-`). Mobile breakpoint at 700px.

**Animation speeds:** Values in `geojsonStyles.js` are in km/h (e.g., `600000` = 600,000 km/h). At that speed a 1,000 km route takes ~6 seconds of real time. Different dash patterns per transport type.

## Code Style Guidelines

- Implement only what's requested - no extra features or error handling unless asked
- Prefer simple solutions that break cleanly over complex ones that mask errors
- Add thorough comments - the developer knows Python but is newer to JavaScript
- Suggest better approaches in responses but don't implement unless requested
