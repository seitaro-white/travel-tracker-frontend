import { test, expect } from './fixtures';
import { captureLeafletMap } from './mapTestHarness';

test('default OSM map loads and upscales native tiles at the zoom ceiling without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await captureLeafletMap(page);
    await page.route('**/config.js', route => route.fulfill({
        contentType: 'application/javascript', body: 'window.__APP_CONFIG__ = {};',
    }));
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    const tile = page.locator('.leaflet-tile-loaded').first();
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('src', /^https:\/\/tile\.openstreetmap\.org\//);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    await page.evaluate(() => window.__leafletMap!.setZoom(20, { animate: false }));
    await expect(page.locator('.leaflet-tile-loaded[src^="https://tile.openstreetmap.org/19/"]').first()).toBeVisible();
    await expect(page.locator('.leaflet-tile[src^="https://tile.openstreetmap.org/20/"]')).toHaveCount(0);
    await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
    expect(errors).toEqual([]);
});

test('production config selects Thunderforest with attribution', async ({ page }) => {
    await page.route('**/config.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__APP_CONFIG__ = { useThunderforest: true, thunderforestApiKey: "e2e-test-key" };',
    }));
    await page.goto('/');
    // fixtures.ts intercepts both providers, so no real key or quota is used.
    await expect(page.locator('.leaflet-tile-loaded').first()).toHaveAttribute(
        'src', /^https:\/\/api\.thunderforest\.com\/landscape\/.+\?apikey=e2e-test-key$/
    );
    await expect(page.locator('.leaflet-control-attribution')).toContainText('Thunderforest');
});
