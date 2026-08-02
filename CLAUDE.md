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
  favouritePhotos.test.js     # carousel selection + every favourite has a display image
  e2e/
    mapTestHarness.js         # shared: animation stubs + L.map() capture (not a spec)
    smoke.spec.js             # Leaflet container + tile + marker load, no JS errors
    full-integration.spec.js  # place markers visible after animation + zoom
    overlay-interactions.spec.js # openOverlay dismissal paths (Escape, backdrop)
    carousel.spec.js          # polaroid pile: mount, cycle, fly-to, collapse
    roughLines.spec.js        # hand-drawn renderer: bezier output + stable seed
```

**E2E specs share `mapTestHarness.js`** for the animation stubs and the `window.__leafletMap` capture — add new specs against that rather than copying the scaffolding.

**No seeding hook for the carousel's shuffle.** `carousel.spec.js` asserts behaviour (the top card changed, the map moved) rather than which photo is showing, so the random order needs no test-only surface in production code.

**The pile ignores input while a card is in flight** (420ms). A test that clicks `‹`/`›` twice quickly will have the second click dropped — wait for `.is-leaving`/`.is-entering` to clear first.

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
- `src/features/carousel/` - The favourite-photo carousel: a pile of mini polaroids (`polaroidStack.js`) fed by `favouritePhotos.js`
- `src/utils/` - Generic, feature-agnostic map helpers (e.g. `layerVisibility.js`)

**Key libraries (CDN-loaded):**
- Leaflet 1.9.4 for mapping
- Leaflet.MarkerCluster for clustering
- leaflet.motion for line animations

**Basemap (local vs production):** `script.js` picks the tile layer from `window.__APP_CONFIG__` — Thunderforest (landscape) only when `useThunderforest === true` *and* a `thunderforestApiKey` is present; otherwise it falls back to the free CartoDB `light_all` basemap. The `useThunderforest` flag is injected only by the GitHub Pages deploy workflow (`.github/workflows/deploy.yml` writes `config.js` from the `THUNDERFOREST_API_KEY` secret), so local dev (`http-server`, no `config.js`) always uses CartoDB and never burns the Thunderforest quota. `config.js` is gitignored; `config.example.js` is the template (flip `useThunderforest` there only for deliberate local Thunderforest testing).

**Vendored in `dist/`:** leaflet.motion, and rough.js (the hand-drawn line renderer — see below).

**Data:** GeoJSON files in `assets/points/` (photos, places, info) and `assets/lines/` (routes, animations, flights)

**Favourite photo carousel:** a pile of four askew mini polaroids in the map's bottom-left corner (centred on mobile), mounted as the closing beat of the intro via `showOverlayPanel`'s `onClose`.

- **Which photos:** the `priority` property in `photos.geojson`. A photo is a favourite when `priority` is truthy and not `"0"` (47 at time of writing). `favouritePhotos.js` is the only consumer of that field. Order is reshuffled on every page load.
- **Only four cards exist in the DOM.** `byDepth` holds them in pile order (index 0 = top). Cycling rotates that array and repaints whichever card lands at the back, so a 47-photo pile costs the same DOM as a 4-photo one. `data-depth` is what positions each card in CSS.
- **Card face:** a *mini* polaroid — white frame with the wide bottom chin, but no caption and no date stamp, and the photo centre-cropped to a square window. Those are held back so the blow-up is a payoff. Fed from `display/` (not `thumbnail/`) so it's sharp and already cached when the blow-up opens.
- **The two directions are different gestures, not mirror images.** Forward, the finger is on the card being thrown away, so that card moves. Backward, the top card stays put and what tracks the finger is the *previous* photo being pulled in from the left — the card arriving, not the one you happen to be touching. Getting this wrong (moving the touched card on a backward drag) makes the gesture read as "the photo vanishes and the deck reshuffles", because the thing under your finger travels the opposite way to your hand.
- **The pull-in has no keyframe**, because a drag can slow, stop and reverse. `entryTransform()` interpolates it per frame; letting go clears the inline transform and the card's own CSS transition carries it to whichever depth it ended up at. Opacity ramps to full over the first 30% only — a print is opaque, and a half-transparent card reads as a crossfade.
- **`draggable="false"` on the card images is load-bearing.** Without it Chromium starts a native image drag on mousedown, fires `pointercancel`, and the swipe dies one frame in. Touch is unaffected (`touch-action: none`), so the bug is mouse-only and easy to miss.
- **`is-cycling` on the container** is the "pile is busy" signal, mirroring the internal `animating` flag. The per-card classes are removed partway through a cycle, so they can't be used for this — the E2E spec waits on `is-cycling`.
- **Sweeping does not move the map**; tapping the top card does. `flyTo` at zoom 13 runs *simultaneously* with the blow-up rising — the overlay's backdrop is a 40% scrim, not an opaque cover, so the flight stays visible through it. The blow-up is the unchanged `showAnimatedPolaroid`, identical to a marker click.
- **The drawer handle sits on the pile's right edge**, not in the button row, because that edge is the part still on screen once the pile has slid away. Putting it in the row would let the only way back travel off-screen with the pile.
- **Aspect ratios force the square crop:** the favourites run 0.70 → 1.68. Anything that preserved each photo's shape would make the pile's peeking edges jump on every cycle.
- The container needs Leaflet's `disableClickPropagation`/`disableScrollPropagation` *and* an explicit `pointerdown` stop, or dragging a card pans the map underneath.

**Hand-drawn lines:** every *static* line layer is drawn as if by hand, via rough.js. `src/features/geojson/roughRenderer.js` subclasses `L.SVG` and overrides one method — `_updatePoly`, the single place Leaflet turns projected pixel points into an SVG `d`. Everything else about a line layer is untouched: stroke styling, click handling, and the `_path` element the intro's fade helpers reach for.

- **It is a renderer, not a layer.** Opt in per style object (`renderer: roughRenderer` in `geojsonStyles.js`), so the animated intro lines simply don't get it.
- **All static lines share one renderer instance.** Each instance owns its own `<svg>` in the overlay pane, so splitting them would make them stack by renderer rather than by `STATIC_LINE_LAYERS` order.
- **`renderer` has to reach the Polyline *constructor*.** Leaflet reads that option once, when the layer is added to the map — supplying it only via `style` (applied later) is too late and the layer silently falls back to the default renderer, straight lines and all. This is why `createGeoJsonLineLayer` spreads the style into the `L.geoJSON` options as well as passing it as `style`.
- **The seed is load-bearing.** rough re-rolls its randomness on every call and Leaflet redraws on every zoom, so without a fixed seed the wobble changes each time and the lines shimmer. `L.Util.stamp(layer)` is the stable per-layer id used for it.
- **The animated lines can't have this**, and shouldn't: leaflet.motion redraws them as they grow, so the wobble would be re-rolled every frame and the line would boil. The intro crossfade reads better as tidy lines dissolving into hand-drawn ones anyway.
- **`smoothFactor` is turned up** (2–4, vs. the default 1) on the static layers. It cuts how much geometry rough redraws per zoom, and a sketchy line wants fewer points regardless — rough overshoots each segment by a couple of pixels, so tracing every GPS wiggle becomes a scribble. The flight arcs keep the default, being synthesised smooth curves rather than GPS traces.
- **`roughness`/`bowing` were tuned by eye** against dense Tokyo walking routes at zoom 13. Past roughly `roughness: 3` the lines wander far enough off the real streets that a route stops reading as a route. Cost is ~10–15 ms added to a zoom redraw.

**Flight arcs:** `assets/lines/flights.geojson` holds past flights as `LineString`s with exactly two coordinates (origin + destination airport, `[lng, lat]`). `flightArcs.js` reads these and synthesises a bowed arc per flight (quadratic Bézier offset perpendicular to the route midpoint — `ARC_CURVATURE`/`ARC_SEGMENTS` tune it); a straight 2-point line would otherwise render flat. The arcs join the intro crossfade in `script.js` and are zoom-gated to only show when zoomed out (≤ `FLIGHT_MAX_ZOOM`) via `manageLayerVisibilityByZoom`.

## Conventions

**Markers:** Use Leaflet `L.divIcon` with HTML content, not image icons. Z-index layering: Places(10) → Info(20) → Clusters(30) → Photos(40).

**GeoJSON properties:**
- Photos: `filename`, `description`, `timestamp`, `priority` (the carousel's favourite flag — see above)
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
