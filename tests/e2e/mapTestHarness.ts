/**
 * Shared scaffolding for the E2E specs.
 *
 * Two problems every test of this app runs into, and their fixes:
 *
 * 1. The intro sequence takes 20–30 seconds of real time.
 *    Fix — route interception. Playwright's page.route() intercepts fetch()
 *    calls before they hit the network and returns a canned response. We
 *    replace both animation GeoJSON files with minimal 2-point stubs (a ~1.5 km
 *    line near Tokyo). At 600,000 km/h that segment takes ~9 ms, so the whole
 *    animation chain finishes in well under a second and the rest of
 *    setupMap() runs immediately after.
 *
 *    Python analogy: monkeypatching requests.get in a slow integration test to
 *    return a canned response, so the code that runs *after* the network call
 *    is still exercised in full.
 *
 * 2. Leaflet has no public map registry, so a test cannot reach the map object.
 *    document.getElementById('map')._leaflet_map does NOT exist in Leaflet
 *    1.9.4. Fix — intercept the window.L assignment made by leafletGlobal.ts
 *    before the app starts, and wrap that object's map factory. This captures
 *    the actual map without adding a test hook to production code.
 *
 * The real GeoJSON and Leaflet rendering paths still run; only the animation
 * distance is shortened.
 */

import { expect, type Page } from '@playwright/test';
import type { Photos } from '../../src/types/geojson';
import { isFavouritePhoto } from '../../src/features/carousel/favouritePhotos';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * How long to wait for the intro overlay, which is every spec's "setup is done"
 * signal. Generous on purpose: even with the animations stubbed to milliseconds,
 * setup still loads real GeoJSON, tiles, and photos; under worker contention
 * those requests can run long. Shared so the specs
 * can't drift apart and leave one of them marginal.
 */
export const SETUP_TIMEOUT = 30000;

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
            name: 'Initial Haneda',
            uuid: 'stub-uuid-1',
            triggers: [],          // no chained segments → finishes after one line
            type: 'default',       // matches AnimatedLineStyles.default speed
        },
        geometry: {
            type: 'LineString',
            coordinates: [[139.780, 35.549], [139.781, 35.550]],
        },
    }],
};

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * leafletGlobal.ts assigns the shared npm Leaflet object to window.L for the
 * legacy plugins. An init-script setter can wrap its mutable map factory before
 * the entry point uses it, in dev and production alike. Only tests get a map
 * registry; no app-side test hook is needed.
 */
export async function captureLeafletMap(page: Page) {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'L', {
            configurable: true,
            set(leaflet: typeof window.L) {
                Object.defineProperty(window, 'L', { value: leaflet, writable: true, configurable: true });
                const originalMap = leaflet.map;
                leaflet.map = (...args: Parameters<typeof originalMap>) => {
                    const map = originalMap(...args);
                    window.__leafletMap = map;
                    return map;
                };
            },
        });
    });
}

/**
 * Serves a cut-down photos.geojson holding only the first `count` favourites
 * taken from the real file. Must be called before page.goto().
 *
 * Why: the real file has 936 features, so the marker cluster layer pulls
 * hundreds of thumbnails on every page load. That is the single heaviest thing
 * a test does, and with nine specs in the suite it is enough to push a cold
 * setup past its timeout. Slicing the real data keeps the features genuine
 * (real filenames, real coordinates, real priority flags) while cutting the
 * bytes by two orders of magnitude.
 *
 * @param count - How many favourites to serve. Needs to exceed the
 *   pile's card count for cycling tests to show distinct photos.
 */
export async function stubFavouritePhotos(page: Page, count = 8) {
    const photosPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/points/photos.geojson');
    const real = JSON.parse(fs.readFileSync(photosPath, 'utf8')) as Photos;
    const favourites = real.features
        .filter(isFavouritePhoto)
        .slice(0, count);

    await page.route('**/photos.geojson', route =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ type: 'FeatureCollection', features: favourites }),
        })
    );
}

/**
 * Everything a carousel test needs to reach its starting line: stubs applied,
 * page loaded, intro dismissed, pile mounted. Shared by the carousel specs so
 * they can't drift apart on how they get there.
 *
 * The final wait — for the intro wrapper to leave the DOM, not merely to start
 * fading — is load-bearing on a phone. The sheet ignores taps outside itself
 * while any overlay is on screen (so that dismissing a blow-up doesn't also
 * close the sheet behind it), which means a test that starts tapping during the
 * intro's 600 ms fade-out would have those taps quietly swallowed.
 */
export async function openAppAndDismissIntro(page: Page) {
    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('/');

    // The intro overlay appearing is the signal that setupMap() is done.
    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await page.locator('.overlay-panel-close').click();

    // Dismissing the intro is what mounts the pile (via showOverlayPanel's onClose).
    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.overlay-panel-overlay')).toHaveCount(0);
}

/**
 * Replaces the two animation GeoJSON files with stubs so the intro finishes in
 * milliseconds rather than 20–30 seconds. Must be called before page.goto().
 */
export async function stubIntroAnimations(page: Page) {
    await page.route('**/incoming_flight.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_LINE) })
    );
    await page.route('**/animation_tracks.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(TINY_ANIMATION_TRACKS) })
    );
}
