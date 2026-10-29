# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a travel visualization application displaying an interactive map of a Japan trip. It uses vanilla TypeScript (no UI framework), strict type checking, and Vite for development and production bundling.

## Development

Use Node 24 and run `npm ci` after cloning.

- `npm run dev` — Vite on `0.0.0.0:5173` (strict port): open `http://localhost:5173` from the Docker host, or `http://pi-box:5173` from Browserless.
- `npm run typecheck` — run `tsc --noEmit` on both configs. `tsconfig.json` checks `script.ts` and `src/` with DOM/Vite types and no Node globals; `tsconfig.node.json` checks tests and Vite/Vitest/Playwright configs with Node types. The latter retains DOM types for Playwright's browser callbacks. Vite transpiles without typechecking, so run this separately.
- `npm run build` — emit the deployable site into gitignored `dist/`.
- `npm run preview -- --port 5174 --strictPort` — serve the production build for verification. Browserless reaches it at `http://pi-box:5174`.

`vite.config.ts` uses `base: './'`: bundle URLs stay relative under the GitHub Pages project path `/travel-tracker-frontend/`. Runtime fetch/image URLs are also relative (`assets/...`, `miniMapKey.html`). `public/` is copied unchanged into the build; do not prefix those URLs with `/` or `public/`.

Optional root `config.js` remains gitignored. Vite serves/emits an empty default if it is absent; copy `config.example.js` to `config.js` for deliberate local configuration. Restart preview/rebuild after changing it. `.github/workflows/ci.yml` runs typecheck, unit tests, build and E2E (with its own Chromium) on every pull request into `main`; a failed run uploads the Playwright report as an artifact. The Pages workflow runs install, typecheck, unit tests, and build, then overwrites `dist/config.js` with production settings and uploads only `dist/`.

## Testing

### Test commands

| Command | What it runs | Speed |
|---------|-------------|-------|
| `npm test` | Vitest unit + schema + emoji tests | ~0.5s |
| `npm run test:e2e` | All Playwright E2E specs (Browserless in pi-box, local Chromium in CI; one worker) | ~5 min |
| `npx playwright test smoke` | Smoke test only (map loads, no JS errors) | ~1s |
| `npx playwright test full-integration` | Full integration with place markers | ~2s |

In pi-box, E2E uses the browser overlay's `BROWSER_CDP_URL` and `BROWSER_TOKEN`. Do **not** run `npx playwright install` here: Chromium runs in the Browserless sidecar. Without those variables (GitHub Actions), the config launches a local Chromium against `http://localhost:5173` instead. With Browserless, the config converts the CDP URL to Browserless's `/playwright` endpoint for `use.connectOptions`, limits workers to one, and extends the browser session to ten minutes (the default is only 30 seconds). Each test still gets a fresh context. The suite starts `npm run dev` automatically unless a server is already listening; readiness uses localhost, while browser navigation uses `http://pi-box:5173`. Use relative URLs such as `page.goto('/')` in specs so they respect `baseURL`.

### Test layout

```
tests/
  sanity.test.ts              # trivial 1+1 tooling check
  geojsonService.test.ts      # unit tests for fetchGeoJson() (3 code paths)
  geojson-schema.test.ts      # data validation for all 3 GeoJSON point files
  placeEmojis.test.ts         # dead-key check: every emoji key is used in data
  favouritePhotos.test.ts     # carousel selection + every favourite has a display image
  staticAssets.test.ts        # fetched HTML fragments reference shipped images
  e2e/
    fixtures.ts              # shared test/expect exports; basemap tiles stubbed before navigation
    mapTestHarness.ts         # shared: animation stubs, window.L interception, intro dismissal (not a spec)
    smoke.spec.ts             # Leaflet container + tile + marker load, no JS errors
    animation-completion.spec.ts # zero-distance motion cannot stall intro setup
    opening.spec.ts           # typed phase captions, live skip, returning visits and dismissal flag
    full-integration.spec.ts  # place markers visible after animation + zoom
    overlay-interactions.spec.ts # openOverlay dismissal paths (Escape, backdrop)
    intro-card.spec.ts        # modal flip/landing/shuffle, reopening, legend input, landscape scrolling
    carousel.spec.ts          # desktop drawer: mount, cycle, fly-to, collapse
    carousel-sheet.spec.ts    # phone: resting pile + bottom sheet (viewport set via test.use)
    roughLines.spec.ts        # hand-drawn renderer: bezier output + stable seed
```

**E2E specs import `test` and `expect` from `fixtures.ts`**, which serves a small synthetic tile for both OpenStreetMap and Thunderforest. This keeps automated pan/zoom tests off community servers and avoids using production quota. It does not affect the local dev map. The smoke test checks Leaflet's tile-loading lifecycle against this fixture, not the external provider's availability.

**E2E specs share `mapTestHarness.ts`** for the animation stubs, the `window.__leafletMap` capture, `dismissIntro()` (flip → land → shuffle → removed), and `openAppAndDismissIntro()` (stubs → load → dismiss intro → pile mounted) — add new specs against that rather than copying the scaffolding.

**Viewport is what selects the carousel idiom.** `carousel.spec.ts` runs at the default viewport and therefore tests the desktop drawer; `carousel-sheet.spec.ts` sets a phone viewport with `test.use()` so the page is laid out below the 700px breakpoint from the first paint. Use `test.use()` rather than `setViewportSize()` — resizing after load exercises a transition between idioms that no real user sees.

**No seeding hook for the carousel's shuffle.** `carousel.spec.ts` asserts behaviour (the top card changed, the map moved) rather than which photo is showing, so the random order needs no test-only surface in production code.

**The pile ignores input while a card is in flight** (420ms). A test that clicks `‹`/`›` twice quickly will have the second click dropped — wait for `.is-leaving`/`.is-entering` to clear first.

### Key E2E constraints to know

**Place/info markers only appear at zoom ≥ 10** (enforced by `manageLayerVisibilityByZoom` in `src/utils/layerVisibility.ts`, wired up from `script.ts`). The full integration test handles this by:
1. Intercepting `incoming_flight.geojson` and `animation_tracks.geojson` via `page.route()` and returning 2-point stub GeoJSON — the animation chain then completes in ~10ms instead of 20–30 seconds.
2. Defining a setter on `window.L` via `page.addInitScript()`. `leafletGlobal.ts` assigns the shared npm Leaflet object before the app runs; the setter wraps its mutable `map()` factory and stores the result as `window.__leafletMap`. This works in Vite dev and production without a production-only test hook.
3. Calling `window.__leafletMap.setZoom(12, { animate: false })` to zoom in and trigger `zoomend`.

**Leaflet has no public map registry** — `document.getElementById('map')._leaflet_map` does NOT exist in Leaflet 1.9.4. The `window.L` interception pattern (in `captureLeafletMap()` in `mapTestHarness.ts`) is the correct way to get programmatic access to the map in tests.

### Known data bug (tracked in todo.MD)
`public/assets/points/photos.geojson` feature index 748 is a blank record (`geometry: null`, all properties null). The schema test logs it but doesn't fail on it.

## Ad hoc browser testing with Browserless

Start `npm run dev` in another terminal. Run this from the project root; `playwright-core` is already installed with `@playwright/test`. CDP connects to the sidecar without a local browser download. A new context on each run avoids carrying cached JavaScript or storage between checks.

```sh
node --input-type=module <<'JS'
import { chromium } from 'playwright-core';

const url = new URL(process.env.BROWSER_CDP_URL);
url.searchParams.set('token', process.env.BROWSER_TOKEN);
url.searchParams.set('timeout', '120000'); // Session lifetime in milliseconds.
try {
  const browser = await chromium.connectOverCDP(url.href, { timeout: 10000 });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    // localhost here would mean the browser sidecar, not the app container.
    await page.goto('http://pi-box:5173', { timeout: 15000 });
    await page.locator('.leaflet-tile').first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: '/tmp/travel-tracker.png', fullPage: true });
    await context.close();
  } finally {
    await browser.close(); // Release the sidecar session even if navigation fails.
  }
} catch {
  // Raw connection errors may contain the authenticated URL; never log them.
  console.error('Browser check failed; check app and sidecar availability.');
  process.exitCode = 1;
}
JS
```

The screenshot is saved in **pi-box** at `/tmp/travel-tracker.png`, not in the sidecar; open it with the agent's image/file reader to inspect the result. Never print authenticated URLs or commit `BROWSER_TOKEN`. If the environment variables are absent, enable the browser overlay on the Docker host. For longer interactions, increase the session's `timeout` query parameter; disconnecting disposes the session.

## Architecture

**Entry Point:** `index.html` → `script.ts` (bundled by Vite). `src/types/geojson.ts` defines the dataset property contracts; `src/types/browser.d.ts` describes runtime config, the shared legacy-plugin global, and the optional test-captured map.

**Feature-based module organization:**
- `src/features/animations/` - Chained animation system (UUID-based triggers) plus `animateMarkerAlongLine` (the incoming flight marker). Attach `Ended` before `addTo(group)`: auto-start can finish a zero/tiny-distance route synchronously. The plane resolves its event promise first and removes itself after `await`, so a skip cannot re-enter Leaflet removal from inside `Ended`.
- `src/features/geojson/` - GeoJSON fetching and Leaflet layer creation, including `flightArcs.ts` (synthesises curved flight lines from 2-point GeoJSON)
- `src/features/markers/` - Photo, place, and info marker callbacks (onEachFeature/pointToLayer pattern)
- `src/features/overlays/` - Shared overlay lifecycle, polaroid photo display, and the welcome print (`introCard.ts` + `introCard.css`)
- `src/features/opening/` - Floating typewriter captions and skip control for the opening's two phases
- `src/features/carousel/` - The favourite-photo carousel: a pile of mini polaroids (`polaroidStack.ts`) fed by `favouritePhotos.ts`
- `src/utils/` - Generic, feature-agnostic map helpers (e.g. `layerVisibility.ts`)

**Key libraries (bundled):**
- npm Leaflet 1.9.4 and Leaflet.markercluster pinned to 1.4.1 (matching the old CDN), with their CSS and `@types` packages. A scoped npm override lets markercluster use the app's Leaflet version despite its obsolete `~1.3.1` peer declaration; no global legacy-peer mode is needed for `npm ci`.
- npm roughjs 4.6.6. Its UMD bundle is byte-identical to the former vendored file; Vite imports the ESM build of that version.
- Vendored leaflet.motion 0.3.2 in `src/vendor/`, with a small declaration of the API the app uses.

`src/lib/leaflet.ts` is the shared import for browser code. Its first dependency (`leafletGlobal.ts`) sets `window.L` to the npm Leaflet object before the legacy plugins execute, so they extend the same instance the app uses. Data-only `fetchGeoJson.ts` stays independent of Leaflet so unit tests can run in Node. Font Awesome and Google Fonts remain CDN-loaded.

**Basemap (local vs production):** `script.ts` reads `window.__APP_CONFIG__` — Thunderforest (landscape) only when `useThunderforest === true` *and* a `thunderforestApiKey` is present; otherwise it uses standard OpenStreetMap tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), with no account or key needed. Only the Pages workflow injects the production flag/key into `dist/config.js`; local dev defaults to empty settings and never burns the Thunderforest quota. The key is public in the deployed browser config, not a server-side secret. OSM tiles stop at zoom 19; `maxNativeZoom: 19` upscales them at the map's existing zoom-20 ceiling.

**OpenStreetMap usage:** Keep visible attribution and normal browser caching; do not bulk-download or prefetch tiles ([tile policy](https://operations.osmfoundation.org/policies/tiles/)). The community service is best-effort, not an unlimited commercial tile API. It replaces the former CartoDB fallback, which now requires a key.

**Build output:** `dist/` is now exclusively disposable Vite output. Vendored motion code lives in `src/vendor/`, so building cannot erase it.

**Static files:** `public/assets/points/` (photos, places, info), `public/assets/lines/` (routes, animations, flights), `public/assets/photos/`, `public/assets/icons/`, plus `public/miniMapKey.html`. Vite serves these without transformation and copies them to the output root, preserving existing runtime URLs.

**Opening sequence:** Removing motion layers fires `Ended`, so phase continuations check the skip flag and chain children stay inert in the detached group. The plane removes itself after `await`, not inside `Ended`, to avoid double removal. The `travel-tracker:intro-seen = '1'` localStorage flag is written on first-visit card dismissal, not on load.

**Intro card:** The handwritten back explains why the map exists; the front chin only says “start exploring →”. The pile is created once on first dismissal and reused on reopen; only the first-visit `onClose` adds About. `openOverlay` awaits `onClosing`'s landing and normal carousel cycle before removing the modal, so input cannot interrupt the hand-off. The welcome photo joins the carousel even if unflagged, without duplicating it on reopen. `introLanding.ts` measures the settled target and animates a front-face copy outside the scrollable modal to avoid landscape clipping. Legend hover CSS is limited to hover-capable devices so a tap can close the key.

**Favourite photo carousel:** a pile of four askew mini polaroids, mounted on the intro's first dismissal so it can receive the welcome print. It is put away differently on the two screen sizes but is **one state machine with two skins** — `is-collapsed` means "put away", and only the CSS for it differs:

| | desktop (> 700px) | phone (≤ 700px) |
|---|---|---|
| open | 260px pile, bottom-left corner | bottom sheet, ~280px cards |
| put away (`is-collapsed`) | slid off the left edge, handle left behind | ~96px resting pile in the corner |
| arrives | open | put away (resting) |
| way back in | the drawer handle | tap the resting pile |

- **Which photos:** the `priority` property in `photos.geojson`. A photo is a favourite when `priority` is truthy and not `"0"` (47 at time of writing); the welcome photo is also included once it lands. `favouritePhotos.ts` is the only consumer of that field. Order is reshuffled on every page load.
- **Only four cards exist in the DOM.** `byDepth` holds them in pile order (index 0 = top). Cycling rotates that array and repaints whichever card lands at the back, so a 47-photo pile costs the same DOM as a 4-photo one. `data-depth` is what positions each card in CSS.
- **Card face:** a *mini* polaroid — white frame with the wide bottom chin, but no caption and no date stamp, and the photo centre-cropped to a square window. Those are held back so the blow-up is a payoff. Fed from `display/` (not `thumbnail/`) so it's sharp and already cached when the blow-up opens.
- **The two directions are different gestures, not mirror images.** Forward, the finger is on the card being thrown away, so that card moves. Backward, the top card stays put and what tracks the finger is the *previous* photo being pulled in from the left — the card arriving, not the one you happen to be touching. Getting this wrong (moving the touched card on a backward drag) makes the gesture read as "the photo vanishes and the deck reshuffles", because the thing under your finger travels the opposite way to your hand.
- **The pull-in has no keyframe**, because a drag can slow, stop and reverse. `entryTransform()` interpolates it per frame; letting go clears the inline transform and the card's own CSS transition carries it to whichever depth it ended up at. Opacity ramps to full over the first 30% only — a print is opaque, and a half-transparent card reads as a crossfade.
- **`draggable="false"` on the card images is load-bearing.** Without it Chromium starts a native image drag on mousedown, fires `pointercancel`, and the swipe dies one frame in. Touch is unaffected (`touch-action: none`), so the bug is mouse-only and easy to miss.
- **`is-cycling` on the container** is the "pile is busy" signal, mirroring the internal `animating` flag. The per-card classes are removed partway through a cycle, so they can't be used for this — the E2E spec waits on `is-cycling`.
- **Sweeping does not move the map**; tapping the top card does. `flyTo` at zoom 13 runs *simultaneously* with the blow-up rising — the overlay's backdrop is a 40% scrim, not an opaque cover, so the flight stays visible through it. The blow-up is the unchanged `showAnimatedPolaroid`, identical to a marker click.
- **The drawer handle sits on the pile's right edge** (desktop only — `display: none` on a phone), not in the button row, because that edge is the part still on screen once the pile has slid away. Putting it in the row would let the only way back travel off-screen with the pile.
- **Aspect ratios force the square crop:** the favourites run 0.70 → 1.68. Anything that preserved each photo's shape would make the pile's peeking edges jump on every cycle.
- The container needs Leaflet's `disableClickPropagation`/`disableScrollPropagation` *and* an explicit `pointerdown` stop, or dragging a card pans the map underneath.
- **`.polaroid-stack` is `pointer-events: none`; the slider inside it takes hits back.** Only the slider is transformed, and a transform moves what you see without moving the *positioner's* hit box — so putting hits on the container leaves a card-sized invisible hole wherever the pile was laid out, swallowing pans and pinches even when the pile has slid away. Anything that moves the transform back onto the container reintroduces that.

**The phone sheet** (the `@media (max-width: 700px)` block in `carousel.css`):

- **Nothing ever leaves the screen**, which is what retires the handle, the collapse direction, and any need to drag the pile around. Resting is small rather than gone, so the way back is always something you can see.
- **The size change is a `transform: scale()` on `.polaroid-stack-cards`, not a smaller `--pm-card`** — custom property changes don't animate, so the pile could not grow into the sheet that way.
- **The sheet's footprint is a fixed height** (`--pm-sheet-h`, derived from `--pm-card`), so the surface can be `position: absolute` and the whole sheet moves as one piece rather than reflowing.
- **The collapsed rule must not mention `--pm-sheet-drag`.** A dismissal then animates from wherever the finger left the sheet straight down to `translateY(100%)`, continuing the gesture instead of snapping back to 0 first and re-running it.
- **The sheet drag lives on `.polaroid-stack-surface`, and the cards are its *sibling*, not its child.** That is what keeps the vertical dismiss and the horizontal browse from colliding — a swipe starting on a photo never reaches the surface's handlers, so no axis detection is needed.
- **`setPointerCapture` retargets the rest of the gesture to the capturing element**, so "did this start on the grabber?" has to be recorded at `pointerdown`; by `pointerup` the target is the surface and the answer is lost.
- **Tapping the map closes the sheet, but only when no overlay is up** (`OVERLAY_WRAPPERS`) — otherwise dismissing the blow-up you just opened from the pile would close the sheet behind it. Phone-only: on a desktop the corner pile obstructs nothing, so collapsing it on every marker click would be taking it away unasked.

**Hand-drawn lines:** every *static* line layer is drawn as if by hand, via rough.js. `src/features/geojson/roughRenderer.ts` subclasses `L.SVG` and overrides one method — `_updatePoly`, the single place Leaflet turns projected pixel points into an SVG `d`. Everything else about a line layer is untouched: stroke styling, click handling, and the `_path` element the intro's fade helpers reach for.

- **It is a renderer, not a layer.** Opt in per style object (`renderer: roughRenderer` in `geojsonStyles.ts`), so the animated intro lines simply don't get it.
- **All static lines share one renderer instance.** Each instance owns its own `<svg>` in the overlay pane, so splitting them would make them stack by renderer rather than by `STATIC_LINE_LAYERS` order.
- **`renderer` has to reach the Polyline *constructor*.** Leaflet reads that option once, when the layer is added to the map — supplying it only via `style` (applied later) is too late and the layer silently falls back to the default renderer, straight lines and all. This is why `createGeoJsonLineLayer` spreads the style into the `L.geoJSON` options as well as passing it as `style`.
- **The seed is load-bearing.** rough re-rolls its randomness on every call and Leaflet redraws on every zoom, so without a fixed seed the wobble changes each time and the lines shimmer. `L.Util.stamp(layer)` is the stable per-layer id used for it.
- **The animated lines can't have this**, and shouldn't: leaflet.motion redraws them as they grow, so the wobble would be re-rolled every frame and the line would boil. The intro crossfade reads better as tidy lines dissolving into hand-drawn ones anyway.
- **`smoothFactor` is turned up** (2–4, vs. the default 1) on the static layers. It cuts how much geometry rough redraws per zoom, and a sketchy line wants fewer points regardless — rough overshoots each segment by a couple of pixels, so tracing every GPS wiggle becomes a scribble. The flight arcs keep the default, being synthesised smooth curves rather than GPS traces.
- **`roughness`/`bowing` were tuned by eye** against dense Tokyo walking routes at zoom 13. Past roughly `roughness: 3` the lines wander far enough off the real streets that a route stops reading as a route. Cost is ~10–15 ms added to a zoom redraw.

**Flight arcs:** `public/assets/lines/flights.geojson` holds past flights as `LineString`s with exactly two coordinates (origin + destination airport, `[lng, lat]`). `flightArcs.ts` reads these and synthesises a bowed arc per flight (quadratic Bézier offset perpendicular to the route midpoint — `ARC_CURVATURE`/`ARC_SEGMENTS` tune it); a straight 2-point line would otherwise render flat. The arcs join the intro crossfade in `script.ts` and are zoom-gated to only show when zoomed out (≤ `FLIGHT_MAX_ZOOM`) via `manageLayerVisibilityByZoom`.

## Conventions

**Markers:** Use Leaflet `L.divIcon` with HTML content, not image icons. Z-index layering: Places(10) → Info(20) → Clusters(30) → Photos(40).

**GeoJSON properties:**
- Photos: `filename`, `description`, `timestamp`, `priority` (the carousel's favourite flag — see above)
- Places: `placeList` (category), `Title`
- Animations: `name`, `type`, `triggers` (UUID array), `uuid`
- Flights: `from`, `to` (airport codes), `name` (human-readable route)

**CSS:** Feature-prefixed classes (`.polaroid-`, `.place-`, `.info-`). Mobile breakpoint at 700px.

**Animation speeds:** Values in `geojsonStyles.ts` are in km/h (e.g., `600000` = 600,000 km/h). At that speed a 1,000 km route takes ~6 seconds of real time. Different dash patterns per transport type.

## Code Style Guidelines

- Implement only what's requested - no extra features or error handling unless asked
- Prefer simple solutions that break cleanly over complex ones that mask errors
- Add thorough comments - the developer knows Python but is newer to JavaScript
- Suggest better approaches in responses but don't implement unless requested
