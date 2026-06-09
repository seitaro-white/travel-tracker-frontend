/**
 * Full integration test — checks place/info markers render after the animation.
 *
 * The problem with testing markers in the smoke test:
 *   - Place and info markers only appear at zoom ≥ 10.
 *   - They are added to the map AFTER the route animation chain completes.
 *   - The animation chain can take 20–30 seconds in real time.
 *
 * The solution — route interception:
 *   Playwright's page.route() intercepts fetch() calls before they hit the
 *   network and returns a custom response. We replace both animation GeoJSON
 *   files with minimal 2-point stubs (a ~1.5 km line near Tokyo). At 600,000
 *   km/h that segment takes ~9 ms — the entire animation chain completes in
 *   well under a second, and the rest of setupMap() runs immediately after.
 *
 *   Python analogy: this is like monkeypatching requests.get in a slow
 *   integration test to return a canned response, so the code that runs
 *   *after* the network call is still exercised in full.
 *
 * No app code is changed. The real GeoJSON and Leaflet rendering paths still
 * run — we're only shortcutting the animation distance.
 *
 * Run with: npm run test:e2e
 * Run this file only: npx playwright test full-integration
 */

import { test, expect } from '@playwright/test';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Injects a script that intercepts the global `L` assignment made by the
 * Leaflet CDN bundle, then wraps `L.map()` to capture the first map instance
 * in `window.__leafletMap`. This lets the test zoom the map programmatically
 * without modifying any app code.
 *
 * Why addInitScript instead of evaluate: init scripts run before any page
 * scripts, so they can intercept the global before Leaflet even loads.
 */
async function captureLeafletMap(page) {
    await page.addInitScript(() => {
        // When Leaflet's CDN bundle runs, it assigns to window.L.
        // We intercept that assignment with a property setter.
        Object.defineProperty(window, 'L', {
            configurable: true,
            set(leaflet) {
                // Restore a normal writable property, then wrap L.map.
                Object.defineProperty(window, 'L', { value: leaflet, writable: true, configurable: true });
                const orig = leaflet.map.bind(leaflet);
                leaflet.map = function (...args) {
                    const m = orig(...args);
                    window.__leafletMap = m;
                    return m;
                };
            },
        });
    });
}

// ── minimal GeoJSON stubs ─────────────────────────────────────────────────────

// Two points ~1.5 km apart near Tokyo Haneda.
// At 600,000 km/h the animation completes in ~9 ms.
const TINY_LINE = {
    type: 'FeatureCollection',
    features: [{
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: [[139.780, 35.549], [139.781, 35.550]],
        },
    }],
};

// animateChainedGeoJson() looks for a feature with name "Initial Haneda" as
// the entry point, then follows its triggers array. One stub feature is enough.
const TINY_ANIMATION_TRACKS = {
    type: 'FeatureCollection',
    features: [{
        type: 'Feature',
        properties: {
            name:     'Initial Haneda',
            uuid:     'stub-uuid-1',
            triggers: [],          // no chained segments → finishes after one line
            type:     'default',   // matches AnimatedLineStyles.default speed
        },
        geometry: {
            type: 'LineString',
            coordinates: [[139.780, 35.549], [139.781, 35.550]],
        },
    }],
};

// ── test ──────────────────────────────────────────────────────────────────────

test('place markers appear after animation, when zoomed in', async ({ page }) => {
    // Set up the L.map() intercept before navigation so we can zoom
    // programmatically later without touching app code.
    await captureLeafletMap(page);

    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // Replace the animation GeoJSON files with stubs so the animation chain
    // finishes in milliseconds rather than 20–30 seconds.
    await page.route('**/incoming_flight.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_LINE) })
    );
    await page.route('**/animation_tracks.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_ANIMATION_TRACKS) })
    );

    await page.goto('http://localhost:8000');

    // Map container renders.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Wait for the intro overlay — it appears in setupMap() immediately after
    // the animation chain and after place/info layers have been added.
    // This is our "setup is fully done" signal.
    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: 15000 });

    // Dismiss the intro overlay — it covers the whole screen (including the
    // zoom controls), so we must close it before we can interact with the map.
    await page.locator('.overlay-panel-close').click();
    await expect(page.locator('.overlay-panel-overlay')).toBeHidden();

    // Zoom to level 12 via the captured Leaflet map instance.
    // animate: false makes zoomend fire synchronously, so the marker layer
    // is added to the DOM before the next assertion runs.
    await page.evaluate(() => {
        window.__leafletMap.setZoom(12, { animate: false });
    });

    // Confirm the map is actually at zoom ≥ 10 before checking for markers.
    await page.waitForFunction(() => window.__leafletMap?.getZoom() >= 10);

    // Place markers should now be visible.
    await expect(page.locator('.place-marker').first()).toBeVisible({ timeout: 5000 });

    // No uncaught JS errors throughout.
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});
