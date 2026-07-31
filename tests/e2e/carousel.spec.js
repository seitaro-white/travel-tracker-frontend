/**
 * E2E test for the favourite-photo carousel — the pile of mini polaroids.
 *
 * The pile mounts as the closing beat of the intro, so every test here has to
 * get through the intro first; mapTestHarness stubs it down to milliseconds.
 *
 * Note that nothing below asserts *which* photo is shown. The carousel
 * reshuffles its favourites on every page load, so the tests check behaviour
 * (the top card changed, the map moved) rather than identity — which is why the
 * app needs no test-only seeding hook.
 *
 * Run this file only: npx playwright test carousel
 */

import { test, expect } from '@playwright/test';
import { captureLeafletMap, stubIntroAnimations, stubFavouritePhotos, SETUP_TIMEOUT } from './mapTestHarness.js';

/** Runs the intro, dismisses the overlay, and waits for the pile to slide in. */
async function openAppAndDismissIntro(page) {
    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('http://localhost:8000');

    // The intro overlay appearing is the signal that setupMap() is done.
    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await page.locator('.overlay-panel-close').click();

    // Dismissing the intro is what mounts the pile (via showOverlayPanel's onClose).
    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: 5000 });
}

/** The <img> inside whichever card is currently on top of the pile. */
function topCardImage(page) {
    return page.locator('.polaroid-mini[data-depth="0"] img');
}

/**
 * Waits for a cycle animation to finish. The pile ignores input while a card is
 * in flight, so a test that clicks ‹ or › twice in quick succession would have
 * its second click dropped.
 */
async function waitForPileToSettle(page) {
    await expect(page.locator('.polaroid-mini.is-leaving, .polaroid-mini.is-entering')).toHaveCount(0);
}

test('the pile slides in once the intro is dismissed', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('http://localhost:8000');

    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: SETUP_TIMEOUT });
    // The pile must NOT be there yet — it is the intro's closing beat, not part
    // of the map's initial furniture.
    await expect(page.locator('.polaroid-stack')).toHaveCount(0);

    await page.locator('.overlay-panel-close').click();

    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: 5000 });
    // Four cards: the top one plus three peeking edges.
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    // It arrives expanded, not collapsed.
    await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
    // The top card is showing a real photo from the display directory.
    await expect(topCardImage(page)).toHaveAttribute('src', /assets\/photos\/display\/.+\.jpg$/);

    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

test('no pile is built when no photos are flagged as favourites', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    // An unflagged photos.geojson is a legitimate state, not a failure — the
    // carousel should simply not appear, and must not throw on the way there.
    await page.route('**/photos.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) })
    );
    await page.goto('http://localhost:8000');

    await expect(page.locator('.overlay-panel-overlay')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await page.locator('.overlay-panel-close').click();
    await expect(page.locator('.overlay-panel-overlay')).toBeHidden();

    await expect(page.locator('.polaroid-stack')).toHaveCount(0);
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

test('the next button cycles to a different photo', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const firstSrc = await topCardImage(page).getAttribute('src');

    await page.locator('.polaroid-stack-button[aria-label="Next photo"]').click();

    // After cycling, the card sitting at depth 0 is a different element showing
    // a different photo. Poll until the animation has settled.
    await expect.poll(
        () => topCardImage(page).getAttribute('src'),
        { timeout: 5000 }
    ).not.toBe(firstSrc);

    // Still exactly four cards — the pile recycles rather than growing.
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
});

test('previous returns to the photo that was showing before', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const firstSrc = await topCardImage(page).getAttribute('src');

    await page.locator('.polaroid-stack-button[aria-label="Next photo"]').click();
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).not.toBe(firstSrc);
    await waitForPileToSettle(page);

    await page.locator('.polaroid-stack-button[aria-label="Previous photo"]').click();
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).toBe(firstSrc);
});

test('tapping the top card flies the map and opens the blow-up', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const before = await page.evaluate(() => {
        const { lat, lng } = window.__leafletMap.getCenter();
        return { lat, lng, zoom: window.__leafletMap.getZoom() };
    });
    // The map starts zoomed out over Japan, well short of the carousel's target.
    expect(before.zoom).toBeLessThan(13);

    await page.locator('.polaroid-mini[data-depth="0"]').click();

    // The blow-up is the existing polaroid overlay, unchanged — the same thing a
    // map marker click produces.
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.polaroid-animated-wrapper-overlay .polaroid img')).toBeVisible();

    // flyTo runs for ~1.2s and passes through intermediate zoom levels on the
    // way, so wait for it to land on exactly the carousel's target rather than
    // sampling mid-arc.
    await page.waitForFunction(() => window.__leafletMap.getZoom() === 13, null, { timeout: 8000 });

    const after = await page.evaluate(() => {
        const { lat, lng } = window.__leafletMap.getCenter();
        return { lat, lng, zoom: window.__leafletMap.getZoom() };
    });
    // The centre actually moved to the photo, rather than just zooming in place.
    expect(Math.abs(after.lat - before.lat) + Math.abs(after.lng - before.lng)).toBeGreaterThan(0.01);

    // Closing the blow-up leaves the map where it flew.
    await page.locator('.polaroid-animated-wrapper-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
    const settled = await page.evaluate(() => {
        const { lat, lng } = window.__leafletMap.getCenter();
        return { lat, lng, zoom: window.__leafletMap.getZoom() };
    });
    expect(settled).toEqual(after);
});

test('the pile collapses to a sliver and comes back', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const stack = page.locator('.polaroid-stack');
    const handle = page.locator('.polaroid-stack-handle');
    const stepButtons = page.locator('.polaroid-stack-bar .polaroid-stack-button');

    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await expect(stepButtons).toHaveCount(2);

    await handle.click();
    await expect(stack).toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'false');

    // The handle rides on the pile's right edge specifically so that it stays on
    // screen when everything else slides away. If it ever travels off with the
    // pile, the collapsed state becomes a trap.
    await expect(handle).toBeInViewport();
    // The step buttons, by contrast, are gone — and hidden, so they also drop out
    // of the tab order rather than lurking off-screen.
    await expect(stepButtons.first()).toBeHidden();

    // The visible card edges are a second target for the same job. Most of the
    // pile's box is now off the left of the viewport, so aim at its right edge
    // rather than at an element-relative offset that would land at a negative
    // page coordinate.
    const collapsedBox = await page.locator('.polaroid-stack-cards').boundingBox();
    await page.mouse.click(collapsedBox.x + collapsedBox.width - 8, collapsedBox.y + collapsedBox.height / 2);
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'true');

    // Clicking the sliver expands rather than selecting a photo.
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});
