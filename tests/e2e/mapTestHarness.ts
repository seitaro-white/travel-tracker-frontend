import { expect, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import type { Photos } from '../../src/types/geojson';
import { isFavouritePhoto } from '../../src/features/carousel/favouritePhotos';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SETUP_TIMEOUT = 30000;
export const SEEN_KEY = 'travel-tracker:intro-seen';

// Short routes exercise the real animation-completion path without waiting for
// the full trip. Live opening/skip tests deliberately do not use these stubs.
const TINY_LINE = {
    type: 'FeatureCollection',
    features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[139.780, 35.549], [139.781, 35.550]] },
    }],
};
const TINY_ANIMATION_TRACKS = {
    type: 'FeatureCollection',
    features: [{
        type: 'Feature',
        properties: { name: 'Initial Haneda', uuid: 'stub-uuid-1', triggers: [], type: 'default' },
        geometry: { type: 'LineString', coordinates: [[139.780, 35.549], [139.781, 35.550]] },
    }],
};

/** Capture the real map before legacy plugins/app code use the shared Leaflet object. */
export async function captureLeafletMap(page: Page) {
    // Leaflet has no public map registry. Intercepting the global assignment
    // avoids a test hook in production and works in both dev and bundled code.
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

/** Keep genuine photo metadata while avoiding hundreds of irrelevant thumbnails. */
export async function stubFavouritePhotos(page: Page, count = 8) {
    const photosPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/points/photos.geojson');
    const real = JSON.parse(fs.readFileSync(photosPath, 'utf8')) as Photos;
    const favourites = real.features.filter(isFavouritePhoto).slice(0, count);
    // Count zero intentionally leaves an unflagged welcome photo, not an empty
    // dataset. That exercises the no-favourites state without missing metadata.
    const intro = real.features.find(feature => feature.properties?.filename === 'IMG_0715')!;
    const features = [...favourites.filter(feature => feature !== intro), intro];
    await page.route('**/photos.geojson', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ type: 'FeatureCollection', features }),
    }));
}

/** Wait for finite UI motion, not a copied CSS duration or a visible-but-moving box. */
export async function waitForAnimations(locator: Locator) {
    // The intro prompt has an intentional infinite wobble; it must not prevent
    // waiting for its enclosing card's finite flip/landing transitions.
    await expect.poll(() => locator.evaluate(element => element.getAnimations({ subtree: true })
        .filter(animation => animation.playState === 'running'
            && animation.effect?.getComputedTiming().endTime !== Infinity).length)).toBe(0);
}

/** Flip the first-visit print and await the landing/shuffle before interacting behind it. */
export async function dismissIntro(page: Page) {
    const card = page.locator('.intro-card');
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await card.click();
    await expect(card).toHaveClass(/is-flipped/);
    await waitForAnimations(card);
    await card.click();
    await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
}

/** Open the real returning-visitor UI; carousel tests need not replay first-visit handoff. */
export async function openFinishedMap(page: Page) {
    await captureLeafletMap(page);
    await stubFavouritePhotos(page);
    await page.addInitScript(key => localStorage.setItem(key, '1'), SEEN_KEY);
    await page.goto('/');
    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await waitForAnimations(page.locator('.polaroid-stack'));
}

export async function stubIntroAnimations(page: Page) {
    await page.route('**/incoming_flight.geojson', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify(TINY_LINE),
    }));
    await page.route('**/animation_tracks.geojson', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify(TINY_ANIMATION_TRACKS),
    }));
}
