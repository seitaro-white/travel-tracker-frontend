/**
 * Smoke test — proves the app loads, the map renders, and no JS crashes occur.
 *
 * This is an integration test: it runs the real app in a real Chromium browser,
 * served by Vite (auto-started via playwright.config.ts webServer).
 * Python analogy: like a requests-based integration test that hits a real
 * running server rather than mocking the HTTP layer.
 *
 * What it checks:
 *   1. The Leaflet map container renders.
 *   2. Stubbed map tiles load (proves Leaflet's tile-loading lifecycle works).
 *   3. The animated flight marker appears (proves JS initialised & fetch worked).
 *   4. No uncaught JavaScript errors during page load.
 *
 * What it deliberately doesn't check:
 *   - Place/info markers: these only appear at zoom ≥10 AND after the full
 *     route animation completes (which can take 30+ seconds). That's too slow
 *     for a smoke test.
 *   - Photo clusters: same reason — they appear after the animation chain ends.
 */

import { test, expect } from './fixtures';
import { captureLeafletMap } from './mapTestHarness';

test('app loads and map renders without JS errors', async ({ page }) => {
    // Collect any uncaught JS exceptions. Python equivalent: capturing
    // unhandled exceptions from a subprocess rather than letting them disappear.
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.route('**/config.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__APP_CONFIG__ = {};',
    }));
    await page.goto('/');

    // 1. The Leaflet container must be in the DOM and visible.
    //    This is the <div id="map"> that Leaflet transforms into a map widget.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // 2. Wait for a decoded tile, not merely an <img> with a URL. The fixture
    //    supplies the image; this checks Leaflet, not external tile availability.
    const tile = page.locator('.leaflet-tile-loaded').first();
    await expect(tile).toBeVisible({ timeout: 15000 });
    await expect(tile).toHaveAttribute('src', /^https:\/\/tile\.openstreetmap\.org\//);

    // 3. The animated flight marker must appear.
    //    script.ts calls animateMarkerAlongLine() immediately at startup —
    //    it creates a L.divIcon marker that Leaflet wraps in .leaflet-marker-icon.
    //    If this is missing, either fetch() failed or Leaflet didn't initialise.
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15000 });

    // 4. No uncaught JS errors. A non-empty array means something crashed.
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

test('OpenStreetMap tiles upscale at zoom 20 without requesting unsupported tiles', async ({ page }) => {
    await captureLeafletMap(page);
    await page.route('**/config.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__APP_CONFIG__ = {};',
    }));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__leafletMap));
    await page.evaluate(() => window.__leafletMap!.setZoom(20, { animate: false }));

    await expect(page.locator('.leaflet-tile-loaded[src^="https://tile.openstreetmap.org/19/"]').first()).toBeVisible();
    await expect(page.locator('.leaflet-tile[src^="https://tile.openstreetmap.org/20/"]')).toHaveCount(0);
    await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
});

test('production config still selects Thunderforest', async ({ page }) => {
    await page.route('**/config.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__APP_CONFIG__ = { useThunderforest: true, thunderforestApiKey: "e2e-test-key" };',
    }));
    await page.goto('/');

    // fixtures.ts intercepts these too: this exercises selection and attribution
    // without a real key or any request reaching Thunderforest.
    await expect(page.locator('.leaflet-tile-loaded').first()).toHaveAttribute(
        'src', /^https:\/\/api\.thunderforest\.com\/landscape\/.+\?apikey=e2e-test-key$/
    );
    await expect(page.locator('.leaflet-control-attribution')).toContainText('Thunderforest');
});
