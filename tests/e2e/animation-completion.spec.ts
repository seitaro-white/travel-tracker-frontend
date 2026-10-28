import { test, expect } from './fixtures';
import { captureLeafletMap, stubFavouritePhotos, SETUP_TIMEOUT } from './mapTestHarness';

// The motion plugin can emit Ended inside addTo(). A degenerate two-point
// segment makes that deterministic, rather than relying on a fast machine
// occasionally finishing our usual ~9ms stub before the listener is attached.
test('the intro completes when motion ends synchronously', async ({ page }) => {
    await captureLeafletMap(page);
    await stubFavouritePhotos(page);
    await page.route(/\/(?:incoming_flight|animation_tracks)\.geojson$/, route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: { name: 'Initial Haneda', uuid: 'instant', type: 'default', triggers: [] },
                geometry: { type: 'LineString', coordinates: [[139.78, 35.549], [139.78, 35.549]] },
            }],
        }),
    }));
    await page.goto('/');
    await expect(page.locator('.overlay-panel-close')).toBeVisible({ timeout: SETUP_TIMEOUT });
});
