/**
 * E2E test for the favourite-photo carousel — the pile of mini polaroids.
 *
 * This file runs at the default (desktop) viewport, so it covers the drawer:
 * the corner pile, its handle, and the slide off the left edge. The phone is a
 * different idiom entirely — a resting pile and a bottom sheet — and lives in
 * carousel-sheet.spec.ts.
 *
 * The pile mounts as the closing beat of the intro, so every test here has to
 * get through the intro first; mapTestHarness stubs it down to milliseconds.
 *
 * Note that nothing below asserts *which* photo is shown. The carousel
 * reshuffles its favourites on every page load, so the tests check behaviour
 * (the top card changed, the map moved) rather than identity — which is why the
 * app needs no test-only seeding hook.
 *
 * Run this file only: npx playwright test carousel.spec
 */

import { test, expect, type Page } from './fixtures';
import {
    captureLeafletMap,
    dismissIntro,
    openAppAndDismissIntro,
    stubIntroAnimations,
    stubFavouritePhotos,
    SETUP_TIMEOUT,
} from './mapTestHarness';

/** The <img> inside whichever card is currently on top of the pile. */
function topCardImage(page: Page) {
    return page.locator('.polaroid-mini[data-depth="0"] img');
}

/** Waits for both legs of a send/return, not just its depth change. */
async function waitForPileToSettle(page: Page) {
    await expect(page.locator('.polaroid-stack.is-cycling')).toHaveCount(0);
}

test('the pile slides in once the intro is dismissed', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('/');

    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
    // The pile must NOT be there yet — it is the intro's closing beat, not part
    // of the map's initial furniture.
    await expect(page.locator('.polaroid-stack')).toHaveCount(0);

    await dismissIntro(page);

    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: 5000 });
    // Four cards: the top one plus three peeking edges.
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    // It arrives expanded, not collapsed.
    await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
    // The top card is showing a real photo from the display directory.
    await expect(topCardImage(page)).toHaveAttribute('src', /assets\/photos\/display\/.+\.webp$/);

    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

test('no pile is built when no photos are flagged as favourites', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await captureLeafletMap(page);
    await stubIntroAnimations(page);
    // An unflagged photos.geojson is a legitimate state, not a failure — the
    // carousel should simply not appear, and must not throw on the way there.
    await page.route('**/photos.geojson', route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) })
    );
    await page.goto('/');

    await dismissIntro(page);

    await expect(page.locator('.polaroid-stack')).toHaveCount(0);
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
});

test('the next button cycles to a different photo', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const firstSrc = await topCardImage(page).getAttribute('src');

    await page.locator('.polaroid-stack-step[aria-label="Next photo"]').click();

    // After cycling, the card sitting at depth 0 is a different element showing
    // a different photo. Poll until the animation has settled.
    await expect.poll(
        () => topCardImage(page).getAttribute('src'),
        { timeout: 5000 }
    ).not.toBe(firstSrc);

    // Still exactly four cards — the pile recycles rather than growing.
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
});

test('revealing the next print does not move it', async ({ page }) => {
    await openAppAndDismissIntro(page);
    const next = page.locator('.polaroid-mini[data-depth="1"]');
    const src = await next.locator('img').getAttribute('src');
    const before = (await next.boundingBox())!;

    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    await waitForPileToSettle(page);

    await expect(topCardImage(page)).toHaveAttribute('src', src!);
    const after = (await page.locator('.polaroid-mini[data-depth="0"]').boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(after[key]).toBeCloseTo(before[key], 3);
    }
});

test('the sent print stays opaque and changes z-order only at the turnaround', async ({ page }) => {
    await openAppAndDismissIntro(page);
    const first = await topCardImage(page).getAttribute('src');
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    const moving = page.locator('.polaroid-mini.is-moving');
    expect(await moving.evaluate(card => getComputedStyle(card).zIndex)).toBe('5');

    // Finish only the outbound leg, then freeze the new return leg at its
    // start. This measures the actual turnaround without a timing-sensitive
    // sleep, and requires no test-only surface in the application.
    await moving.evaluate(card => {
        const outward = card.getAnimations()[0];
        outward.addEventListener('finish', () => {
            const inward = card.getAnimations()[0];
            inward.pause();
            inward.currentTime = 0;
        }, { once: true });
        outward.finish();
    });
    await expect.poll(() => moving.evaluate(card => getComputedStyle(card).zIndex)).toBe('0');
    const turn = await moving.evaluate(card => {
        const style = getComputedStyle(card);
        return {
            opacity: style.opacity,
            dx: new DOMMatrixReadOnly(style.transform).m41 - parseFloat(style.getPropertyValue('--pm-x')),
            width: (card as HTMLElement).offsetWidth,
            right: card.getBoundingClientRect().right,
            pileLeft: Math.min(...Array.from(card.parentElement!.querySelectorAll('.polaroid-mini'))
                .filter(print => print !== card).map(print => print.getBoundingClientRect().left)),
        };
    });
    expect(turn.opacity).toBe('1');
    expect(turn.dx).toBeCloseTo(-turn.width * 1.3, 2);
    // Changing depth while rectangles overlap used to cut off the remaining
    // visible third of the photo. Now even its tilted corners are clear.
    expect(turn.right).toBeLessThanOrEqual(turn.pileLeft);
    await expect(moving.locator('img')).toHaveAttribute('src', first!);
    await moving.evaluate(card => card.getAnimations()[0].finish());
    await waitForPileToSettle(page);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
});

test('the forward send does not park at its turnaround during the last quarter of the outward leg', async ({ page }) => {
    await openAppAndDismissIntro(page);
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    const remaining = await page.locator('.polaroid-mini.is-moving').evaluate(card => {
        const animation = card.getAnimations()[0];
        animation.pause();
        animation.currentTime = Number(animation.effect!.getTiming().duration) * 0.75;
        const style = getComputedStyle(card);
        const x = new DOMMatrixReadOnly(style.transform).m41;
        const endX = parseFloat(style.getPropertyValue('--pm-x')) - (card as HTMLElement).offsetWidth * 1.3;
        return x - endX;
    });
    // The old ease-out had practically finished by this point, giving the
    // appearance of a hold before its z-order suddenly changed.
    expect(remaining).toBeGreaterThan(20);
    await page.locator('.polaroid-mini.is-moving').evaluate(card => card.getAnimations()[0].finish());
    await waitForPileToSettle(page);
});

test('the desktop pile leaves space for its tilted edges and controls', async ({ page }) => {
    await openAppAndDismissIntro(page);
    const boxes = await page.locator('.polaroid-mini').evaluateAll(cards =>
        cards.map(card => ({ left: card.getBoundingClientRect().left })));
    for (const box of boxes) expect(box.left).toBeGreaterThanOrEqual(20);
    const bottomGap = await page.locator('.polaroid-stack-bar').evaluate(bar =>
        window.innerHeight - bar.getBoundingClientRect().bottom);
    expect(bottomGap).toBeGreaterThanOrEqual(40);
});

test('two rapid next clicks advance two prints, and rapid previous clicks return them', async ({ page }) => {
    await openAppAndDismissIntro(page);
    const first = await topCardImage(page).getAttribute('src');
    const third = await page.locator('.polaroid-mini[data-depth="2"] img').getAttribute('src');

    // dblclick delivers two clicks inside a single 500ms send. Neither may be
    // ignored, and finishing the old leg must not leave a stale callback.
    await page.getByRole('button', { name: 'Next photo', exact: true }).dblclick();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', third!);
    await page.getByRole('button', { name: 'Previous photo', exact: true }).dblclick();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', first!);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
});

test('previous returns to the photo that was showing before', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const firstSrc = await topCardImage(page).getAttribute('src');

    await page.locator('.polaroid-stack-step[aria-label="Next photo"]').click();
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).not.toBe(firstSrc);
    await waitForPileToSettle(page);

    await page.locator('.polaroid-stack-step[aria-label="Previous photo"]').click();
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).toBe(firstSrc);
});

/**
 * Drags the top card horizontally by `dx` pixels in steps, so the pile sees a
 * real stream of pointermove events rather than one jump.
 */
async function dragTopCard(page: Page, dx: number) {
    const card = page.locator('.polaroid-mini[data-depth="0"]');
    // hover() waits for the card to be stable before moving the mouse onto it.
    // Without that, a drag measured while the pile is still sliding in (620ms)
    // uses stale coordinates and the press lands on the map behind it.
    await card.hover();
    const box = (await card.boundingBox())!;
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) {
        await page.mouse.move(startX + (dx * step) / 6, y);
    }
    await page.mouse.up();
}

test('dragging right pulls the previous photo in, dragging left throws the top card away', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const first = await topCardImage(page).getAttribute('src');

    // Left, past the commit threshold: forward.
    await dragTopCard(page, -140);
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).not.toBe(first);
    await waitForPileToSettle(page);
    const second = await topCardImage(page).getAttribute('src');

    // Right, past the threshold: back to where we were. This is the case that
    // used to be incoherent — the card under the finger moved right, then
    // reversed and slid left while a different card faded in.
    await dragTopCard(page, 140);
    await expect.poll(() => topCardImage(page).getAttribute('src'), { timeout: 5000 }).toBe(first);
    await waitForPileToSettle(page);

    // Still four cards, and no card left stranded mid-flight with inline styles.
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
    expect(second).not.toBe(first);
});

test('a new drag finishes the in-flight send before browsing again', async ({ page }) => {
    await openAppAndDismissIntro(page);
    const third = await page.locator('.polaroid-mini[data-depth="2"] img').getAttribute('src');
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    // Do not use hover(): it would wait for stability and miss the very
    // interruption this test covers. The newly revealed top print is still.
    const box = (await page.locator('.polaroid-mini[data-depth="0"]').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y, { steps: 4 });
    await page.mouse.up();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', third!);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});

test('reduced motion jumps straight to the new depth and lie in both directions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAppAndDismissIntro(page);
    const first = await topCardImage(page).getAttribute('src');
    const second = await page.locator('.polaroid-mini[data-depth="1"] img').getAttribute('src');

    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    await expect(topCardImage(page)).toHaveAttribute('src', second!);
    await page.getByRole('button', { name: 'Previous photo', exact: true }).click();
    await expect(topCardImage(page)).toHaveAttribute('src', first!);
    await expect(page.locator('.polaroid-stack')).not.toHaveClass(/is-cycling/);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
    expect(await page.locator('.polaroid-stack').evaluate(stack =>
        stack.getAnimations({ subtree: true }).length)).toBe(0);
});

test('a drag that stops short of the threshold changes nothing', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const first = await topCardImage(page).getAttribute('src');

    // Well under DRAG_COMMIT_RATIO (25% of a 260px card = 65px), but past the
    // 8px tap slop, so it is a real sweep that should still be abandoned.
    await dragTopCard(page, 30);
    await waitForPileToSettle(page);
    expect(await topCardImage(page).getAttribute('src')).toBe(first);

    await dragTopCard(page, -30);
    await waitForPileToSettle(page);
    expect(await topCardImage(page).getAttribute('src')).toBe(first);

    // Only the persistent lie properties may remain after a cancelled return.
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
    const properties = await page.locator('.polaroid-mini[data-depth="3"]').evaluate(card =>
        Array.from((card as HTMLElement).style).sort());
    expect(properties).toEqual(['--pm-tilt', '--pm-x', '--pm-y']);

    // And a sweep must not be mistaken for a tap.
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});

test('tapping the top card flies the map and opens the blow-up', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const before = await page.evaluate(() => {
        const map = window.__leafletMap!;
        const { lat, lng } = map.getCenter();
        return { lat, lng, zoom: map.getZoom() };
    });
    // What the carousel should actually land on: its own target, unless the map
    // caps zoom lower than that. Read from the page so this test keeps passing
    // when the map's maxZoom is retuned for a new basemap.
    const target = await page.evaluate(() => Math.min(13, window.__leafletMap!.getMaxZoom()));
    // The map starts zoomed out over Japan, well short of wherever it will land.
    expect(before.zoom).toBeLessThan(target);

    await page.locator('.polaroid-mini[data-depth="0"]').click();

    // The blow-up is the existing polaroid overlay, unchanged — the same thing a
    // map marker click produces.
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.polaroid-animated-wrapper-overlay .polaroid img')).toBeVisible();

    // flyTo runs for ~1.2s and passes through intermediate zoom levels on the
    // way, so wait for it to land on exactly the target rather than sampling
    // mid-arc. flyTo ignores the map's maxZoom, so landing above `target` would
    // mean the carousel is punching through the map's own ceiling.
    await page.waitForFunction(z => window.__leafletMap?.getZoom() === z, target, { timeout: 8000 });

    const after = await page.evaluate(() => {
        const map = window.__leafletMap!;
        const { lat, lng } = map.getCenter();
        return { lat, lng, zoom: map.getZoom() };
    });
    // The centre actually moved to the photo, rather than just zooming in place.
    expect(Math.abs(after.lat - before.lat) + Math.abs(after.lng - before.lng)).toBeGreaterThan(0.01);

    // Closing the blow-up leaves the map where it flew.
    await page.locator('.polaroid-animated-wrapper-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
    const settled = await page.evaluate(() => {
        const map = window.__leafletMap!;
        const { lat, lng } = map.getCenter();
        return { lat, lng, zoom: map.getZoom() };
    });
    expect(settled).toEqual(after);
});

test('the pile collapses to a sliver and comes back', async ({ page }) => {
    await openAppAndDismissIntro(page);

    const stack = page.locator('.polaroid-stack');
    const handle = page.locator('.polaroid-stack-handle');
    const stepButtons = page.locator('.polaroid-stack-step');

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
    const collapsedBox = (await page.locator('.polaroid-stack-cards').boundingBox())!;
    await page.mouse.click(collapsedBox.x + collapsedBox.width - 8, collapsedBox.y + collapsedBox.height / 2);
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'true');

    // Clicking the sliver expands rather than selecting a photo.
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});
