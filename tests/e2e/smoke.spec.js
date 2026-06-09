/**
 * Smoke test — proves the app loads, the map renders, and no JS crashes occur.
 *
 * This is an integration test: it runs the real app in a real Chromium browser,
 * served by http-server (auto-started via playwright.config.js webServer).
 * Python analogy: like a requests-based integration test that hits a real
 * running server rather than mocking the HTTP layer.
 *
 * What it checks:
 *   1. The Leaflet map container renders.
 *   2. Map tiles start loading (proves http-server is serving files).
 *   3. The animated flight marker appears (proves JS initialised & fetch worked).
 *   4. No uncaught JavaScript errors during page load.
 *
 * What it deliberately doesn't check:
 *   - Place/info markers: these only appear at zoom ≥10 AND after the full
 *     route animation completes (which can take 30+ seconds). That's too slow
 *     for a smoke test.
 *   - Photo clusters: same reason — they appear after the animation chain ends.
 */

import { test, expect } from '@playwright/test';

test('app loads and map renders without JS errors', async ({ page }) => {
    // Collect any uncaught JS exceptions. Python equivalent: capturing
    // unhandled exceptions from a subprocess rather than letting them disappear.
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto('http://localhost:8000');

    // 1. The Leaflet container must be in the DOM and visible.
    //    This is the <div id="map"> that Leaflet transforms into a map widget.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // 2. At least one map tile must be visible, proving http-server
    //    is serving static files and Leaflet's tile layer initialised.
    await expect(page.locator('.leaflet-tile').first()).toBeVisible({ timeout: 15000 });

    // 3. The animated flight marker must appear.
    //    script.js calls animateMarkerAlongLine() immediately at startup —
    //    it creates a L.divIcon marker that Leaflet wraps in .leaflet-marker-icon.
    //    If this is missing, either fetch() failed or Leaflet didn't initialise.
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15000 });

    // 4. No uncaught JS errors. A non-empty array means something crashed.
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});
