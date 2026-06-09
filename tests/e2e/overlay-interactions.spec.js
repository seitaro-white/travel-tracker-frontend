/**
 * Overlay interaction test — covers the shared overlay primitive (openOverlay)
 * that backs the intro panel, info card, and polaroid.
 *
 * These dismissal paths had no automated coverage before the overlays were
 * consolidated onto a single primitive, so this test locks in:
 *   - the info overlay opens when an info marker is clicked
 *   - pressing Escape closes it
 *   - clicking the backdrop closes it
 *
 * Reuses the route-stub + map-capture pattern from full-integration.spec.js so
 * the slow animation chain finishes in milliseconds. It additionally stubs the
 * large photos.geojson (irrelevant here) to keep the page load light, and runs
 * both dismissal checks against a single page load to avoid piling concurrent
 * cold loads (CDN bundles + GeoJSON) onto the dev server. Markers are triggered
 * via dispatchEvent('click') so the test does not depend on marker position.
 */

import { test, expect } from '@playwright/test';

// Capture the Leaflet map instance so the test can zoom programmatically.
async function captureLeafletMap(page) {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'L', {
            configurable: true,
            set(leaflet) {
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

const TINY_LINE = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[139.780, 35.549], [139.781, 35.550]] } }],
};
const TINY_ANIMATION_TRACKS = {
    type: 'FeatureCollection',
    features: [{
        type: 'Feature',
        properties: { name: 'Initial Haneda', uuid: 'stub-uuid-1', triggers: [], type: 'default' },
        geometry: { type: 'LineString', coordinates: [[139.780, 35.549], [139.781, 35.550]] },
    }],
};
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

test('info overlay opens on marker click and closes via Escape and backdrop', async ({ page }) => {
    await captureLeafletMap(page);
    await page.route('**/incoming_flight.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_LINE) }));
    await page.route('**/animation_tracks.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_ANIMATION_TRACKS) }));
    // photos.geojson is large and unrelated to overlays — stub it out to keep load light.
    await page.route('**/photos.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(EMPTY_FC) }));

    await page.goto('http://localhost:8000');

    // Intro overlay is the "setup done" signal; dismiss it via Continue. Generous
    // timeout: setup is gated behind cold CDN bundle loads under worker contention.
    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: 30000 });
    await page.locator('.overlay-panel-close').click();
    await expect(page.locator('.overlay-panel-overlay')).toBeHidden();

    // Zoom in so the info layer (zoom ≥ 10) is added to the map.
    await page.evaluate(() => window.__leafletMap.setZoom(12, { animate: false }));
    await page.waitForFunction(() => window.__leafletMap?.getZoom() >= 10);
    await expect(page.locator('.info-marker-icon').first()).toBeVisible({ timeout: 5000 });

    // Open → Escape closes (a behaviour added during consolidation).
    await page.locator('.info-marker-icon').first().dispatchEvent('click');
    await expect(page.locator('.overlay-panel-overlay.visible')).toBeVisible();
    await expect(page.locator('.info-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.overlay-panel-overlay')).toBeHidden();

    // Re-open → backdrop click closes (target === wrapper).
    await page.locator('.info-marker-icon').first().dispatchEvent('click');
    await expect(page.locator('.overlay-panel-overlay.visible')).toBeVisible();
    await page.locator('.overlay-panel-overlay').dispatchEvent('click');
    await expect(page.locator('.overlay-panel-overlay')).toBeHidden();
});
