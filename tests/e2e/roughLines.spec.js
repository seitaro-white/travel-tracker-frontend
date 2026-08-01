import { test, expect } from '@playwright/test';
import { captureLeafletMap, stubIntroAnimations, stubFavouritePhotos, SETUP_TIMEOUT } from './mapTestHarness.js';

/**
 * The hand-drawn line renderer (src/features/geojson/roughRenderer.js).
 *
 * Both things asserted here fail *silently* if they break — the map still draws
 * lines, they just stop being hand-drawn, or they start shimmering — so neither
 * would be caught by the smoke test.
 */

// Tokyo at zoom 12: the densest part of the walking/cycling/transport data, so
// there is guaranteed to be a static line on screen to inspect.
const TOKYO = [35.70, 139.70];

/**
 * Collects the `d` attribute of every static line currently on the map.
 *
 * Leaflet has no public list of a layer's SVG paths, so we walk the map's
 * layers and pick out the ones the rough renderer is responsible for. Empty
 * paths ("M0 0") are Leaflet's placeholder for a line clipped entirely out of
 * the viewport — not interesting, so they are dropped.
 */
async function staticLinePaths(page) {
    return page.evaluate(() => {
        const ds = [];
        window.__leafletMap.eachLayer((layer) => {
            // Line features live inside L.geoJSON / L.featureGroup wrappers.
            if (!layer.eachLayer) return;
            layer.eachLayer((feature) => {
                const d = feature._path?.getAttribute('d');
                if (d && d !== 'M0 0') ds.push(d);
            });
        });
        return ds;
    });
}

test.beforeEach(async ({ page }) => {
    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page, 8);
    await page.goto('/');
    // The intro overlay is every spec's "setup finished" signal.
    await page.waitForSelector('.overlay-panel-close', { timeout: SETUP_TIMEOUT });
    await page.evaluate((c) => window.__leafletMap.setView(c, 12, { animate: false }), TOKYO);
});

test('static lines are drawn as hand-drawn paths, not straight segments', async ({ page }) => {
    const paths = await staticLinePaths(page);
    expect(paths.length).toBeGreaterThan(0);

    // Leaflet's own pointsToPath emits only M and L commands. rough.js draws
    // every segment as a bezier, so a C command is proof the line went through
    // our renderer rather than falling back to the default one — which is
    // exactly what happens if the `renderer` option stops reaching the Polyline
    // constructor (see createGeoJsonLineLayer in geojsonService.js).
    expect(paths.some((d) => d.includes('C'))).toBe(true);
});

test('the wobble is stable across redraws, so lines do not shimmer', async ({ page }) => {
    const before = await staticLinePaths(page);

    // _reset() reprojects and redraws every path. The map has not moved, so the
    // pixel coordinates fed to rough are identical — and with a stable per-layer
    // seed the generated paths must be identical too. Without the seed rough
    // re-rolls its randomness here and the lines visibly jump.
    await page.evaluate(() => {
        window.__leafletMap.eachLayer((layer) => {
            if (!layer.eachLayer) return;
            layer.eachLayer((feature) => feature._reset?.());
        });
    });

    expect(await staticLinePaths(page)).toEqual(before);
});
