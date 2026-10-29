/**
 * Full integration test — checks place/info markers render after the animation.
 *
 * The problem with testing markers in the smoke test:
 *   - Place and info markers only appear at zoom ≥ 10.
 *   - They are added to the map AFTER the route animation chain completes.
 *   - The animation chain can take 20–30 seconds in real time.
 *
 * Both of those are handled by ./mapTestHarness.ts, which stubs the animation
 * GeoJSON down to a ~9 ms line and captures the Leaflet map instance so this
 * test can zoom it programmatically. See that file for why each is needed.
 *
 * Run with: npm run test:e2e
 * Run this file only: npx playwright test full-integration
 */

import { test, expect } from './fixtures';
import { captureLeafletMap, dismissIntro, stubIntroAnimations } from './mapTestHarness';

test('place markers appear after animation, when zoomed in', async ({ page }) => {
    // Intercept the shared window.L assignment before navigation so the test
    // can zoom the real bundled Leaflet map programmatically.
    await captureLeafletMap(page);

    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // Shortcut the animation chain so the rest of setupMap() runs immediately.
    await stubIntroAnimations(page);

    await page.goto('/');

    // Map container renders.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // The intro is the "setup done" signal and covers the zoom controls.
    // Flip it and wait for its landing before interacting with the map.
    await dismissIntro(page);

    // Zoom to level 12 via the captured Leaflet map instance.
    // animate: false makes zoomend fire synchronously, so the marker layer
    // is added to the DOM before the next assertion runs.
    await page.evaluate(() => {
        window.__leafletMap!.setZoom(12, { animate: false });
    });

    // Confirm the map is actually at zoom ≥ 10 before checking for markers.
    await page.waitForFunction(() => (window.__leafletMap?.getZoom() ?? 0) >= 10);

    // Place markers should now be visible.
    await expect(page.locator('.place-marker').first()).toBeVisible({ timeout: 5000 });

    // No uncaught JS errors throughout.
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});
