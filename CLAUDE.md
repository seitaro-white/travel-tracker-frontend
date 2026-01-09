# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a travel visualization application displaying an interactive map of a Japan trip. It uses vanilla JavaScript (ES6 modules) with no build system or package manager - files are served directly.

## Development

**Running locally:** Serve the project directory with using http-server -p 8000 (we have http-server installed locally).

**No build/test/lint commands** - this is a pure vanilla JS project with no npm scripts.

## Testing with MCP Browser

**IMPORTANT:** The MCP Playwright browser maintains a persistent session and caches JavaScript files between tool calls. After making code changes:

1. **Close and reopen the browser** using `browser_close` then navigate again for a completely fresh session
2. **Or use hard refresh** by pressing `Cmd+Shift+R` in the browser to force reload cached files

Note: The human developer doesn't experience this caching issue in their browser - this only affects Claude's MCP browser session.

## Architecture

**Entry Point:** `index.html` → `script.js` (ES6 module)

**Feature-based module organization:**
- `src/features/animations/` - Chained animation system with UUID-based triggers
- `src/features/geojson/` - GeoJSON fetching and Leaflet layer creation
- `src/features/markers/` - Photo, place, and info marker callbacks (onEachFeature/pointToLayer pattern)
- `src/features/overlays/` - Overlay panel system including polaroid photo display

**Key libraries (CDN-loaded):**
- Leaflet 1.9.4 for mapping
- Leaflet.MarkerCluster for clustering
- leaflet.motion for line animations

**Data:** GeoJSON files in `assets/points/` (photos, places, info) and `assets/lines/` (routes, animations)

## Conventions

**Markers:** Use Leaflet `L.divIcon` with HTML content, not image icons. Z-index layering: Places(10) → Info(20) → Clusters(30) → Photos(40).

**GeoJSON properties:**
- Photos: `filename`, `description`, `timestamp`
- Places: `placeList` (category), `Title`
- Animations: `name`, `type`, `triggers` (UUID array), `uuid`

**CSS:** Feature-prefixed classes (`.polaroid-`, `.place-`, `.info-`). Mobile breakpoint at 700px.

**Animation speeds:** Measured in milliseconds (e.g., 600000ms for typical journey). Different dash patterns per transport type.

## Code Style Guidelines

- Implement only what's requested - no extra features or error handling unless asked
- Prefer simple solutions that break cleanly over complex ones that mask errors
- Add thorough comments - the developer knows Python but is newer to JavaScript
- Suggest better approaches in responses but don't implement unless requested
