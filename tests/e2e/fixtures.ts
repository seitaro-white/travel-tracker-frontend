import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

// A decodable, tile-sized image keeps Leaflet's real load/render lifecycle in
// play without downloading maps. OSM's community servers are not for automated
// pan/zoom traffic, and production-config tests shouldn't use Thunderforest quota.
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef0ea"/></svg>';

export const test = base.extend({
    page: async ({ page }, use) => {
        // Register before navigation, so even the map's very first tile request
        // is intercepted. This fixture exists only in the Playwright runner.
        await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|api\.thunderforest\.com)\//, route =>
            route.fulfill({ contentType: 'image/svg+xml', body: TILE })
        );
        await use(page);
    },
});
