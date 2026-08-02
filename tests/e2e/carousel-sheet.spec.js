/**
 * E2E test for the carousel's phone idiom — the resting pile and the bottom
 * sheet. The desktop drawer is a different shape entirely and lives in
 * carousel.spec.js; both are the same state machine underneath, with
 * `is-collapsed` meaning "put away" in each.
 *
 * Everything here runs at a phone viewport, set per-describe with test.use()
 * rather than setViewportSize() so the page is laid out at that size from the
 * first paint — the layout is chosen by a media query, and resizing after load
 * would exercise a transition that real users never see.
 *
 * The one test at a desktop viewport is a leak guard: the sheet must not appear
 * on a screen that has a drawer.
 *
 * Run this file only: npx playwright test carousel-sheet
 */

import { test, expect } from '@playwright/test';
import { openAppAndDismissIntro } from './mapTestHarness.js';

// Roughly an iPhone 14: comfortably inside the 700px breakpoint, and tall
// enough that the sheet covering its lower half still leaves map above it.
const PHONE = { width: 390, height: 844 };

// The sheet's rise and fall is a 420ms CSS transition (--pm-ease, matching
// CYCLE_MS in polaroidStack.js). Anything that measures geometry has to let it
// finish first; assertions on classes do not.
const SHEET_MS = 420;

/** Waits out the sheet transition, plus a frame or two of slack. */
async function waitForSheet(page) {
    await page.waitForTimeout(SHEET_MS + 120);
}

/** Taps the resting pile to raise the sheet, and waits for it to settle. */
async function openSheet(page) {
    await page.locator('.polaroid-mini[data-depth="0"]').click();
    await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
    await waitForSheet(page);
}

/**
 * Drags from a point by (0, dy) in steps, so the sheet sees a real stream of
 * pointermove events rather than one jump — the drag is interpolated per frame,
 * so a single move would not exercise it.
 */
async function dragBy(page, from, dy, steps = 8) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 1; step <= steps; step++) {
        await page.mouse.move(from.x, from.y + (dy * step) / steps);
    }
    await page.mouse.up();
}

/** Centre of an element's box, for gestures that must start on it. */
async function centreOf(page, selector) {
    const box = await page.locator(selector).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('phone', () => {
    test.use({ viewport: PHONE });

    test('arrives resting, leaving the middle of the screen to the map', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await openAppAndDismissIntro(page);

        // Resting is the phone's mount state: a half-screen sheet thrown over
        // the map the instant the intro closes would be answering a question
        // nobody has asked yet.
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(1);
        await waitForSheet(page);

        // The regression this whole layout exists to prevent. The stack's
        // positioner is laid out at the sheet's full footprint, and only its
        // contents are transformed — so if it ever takes pointer events itself,
        // it leaves a large invisible hole over the map that swallows pans and
        // pinches. Ask the page what is actually under the middle of the screen.
        const centre = await page.evaluate(() => {
            const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            return { inStack: !!el.closest('.polaroid-stack') };
        });
        expect(centre.inStack, 'the resting pile must not leave a dead zone').toBe(false);

        // And prove it for real: a drag across the centre must pan the map.
        const before = await page.evaluate(() => window.__leafletMap.getCenter());
        await page.mouse.move(120, 422);
        await page.mouse.down();
        for (let step = 1; step <= 8; step++) await page.mouse.move(120 + (120 * step) / 8, 422);
        await page.mouse.up();
        const after = await page.evaluate(() => window.__leafletMap.getCenter());
        expect(after.lng).not.toBeCloseTo(before.lng, 5);

        expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    });

    test('tapping the resting pile raises the sheet and makes the cards bigger', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await waitForSheet(page);

        const resting = await page.locator('.polaroid-stack-cards').boundingBox();
        // Small enough to ignore: a launcher, not a viewer.
        expect(resting.width).toBeLessThan(130);

        await openSheet(page);

        const open = await page.locator('.polaroid-stack-cards').boundingBox();
        // The whole point of the sheet: the photos get materially bigger than
        // the pile could ever be while sitting on top of the map.
        expect(open.width).toBeGreaterThan(resting.width * 2);
        // And the sheet's surface is really there, holding them.
        await expect(page.locator('.polaroid-stack-surface')).toBeVisible();
    });

    test('browsing is a sheet activity, not a resting-pile one', async ({ page }) => {
        await openAppAndDismissIntro(page);

        // At rest the step buttons have gone with the sheet, which also takes
        // them out of the tab order.
        await expect(page.locator('.polaroid-stack-bar')).toBeHidden();

        await openSheet(page);
        await expect(page.locator('.polaroid-stack-bar')).toBeVisible();

        const first = await page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src');
        await page.locator('.polaroid-stack-step[aria-label="Next photo"]').click();
        await expect.poll(
            () => page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src'),
            { timeout: 5000 }
        ).not.toBe(first);
    });

    test('swiping a card browses without moving the map or the sheet', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await openSheet(page);

        const mapBefore = await page.evaluate(() => window.__leafletMap.getCenter());
        const first = await page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src');

        const card = await page.locator('.polaroid-mini[data-depth="0"]').boundingBox();
        const y = card.y + card.height / 2;
        const startX = card.x + card.width * 0.8;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        for (let step = 1; step <= 6; step++) await page.mouse.move(startX - (160 * step) / 6, y);
        await page.mouse.up();

        await expect.poll(
            () => page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src'),
            { timeout: 5000 }
        ).not.toBe(first);

        // The horizontal card gesture and the vertical sheet gesture share a
        // surface but must never collide: the cards are a *sibling* of the sheet
        // surface, not a child, so a swipe never reaches the sheet's handlers.
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
        // And a sweep still leaves the map alone; only a tap commits.
        const mapAfter = await page.evaluate(() => window.__leafletMap.getCenter());
        expect(mapAfter.lng).toBeCloseTo(mapBefore.lng, 5);
    });

    test('dragging the sheet down dismisses it; a short drag springs back', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await openSheet(page);

        const grabber = await centreOf(page, '.polaroid-stack-grabber');

        // Short of SHEET_DISMISS_RATIO (25% of the sheet's height): abandoned.
        await dragBy(page, grabber, 30);
        await waitForSheet(page);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);

        // Past it: dismissed.
        await dragBy(page, grabber, 200);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(1);
    });

    test('tapping the grabber closes the sheet', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await openSheet(page);

        // Regression guard: setPointerCapture retargets the rest of the gesture
        // to the capturing element, so by pointerup the event's target is the
        // surface, not the grabber. Whether the press started on the grabber has
        // to be recorded at pointerdown or a tap here does nothing at all.
        await page.locator('.polaroid-stack-grabber').click();
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(1);
    });

    test('tapping the map closes the sheet', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await openSheet(page);

        // Well above the sheet, so this lands on the map itself.
        await page.mouse.click(195, 100);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(1);
    });

    test('tapping a card flies the map and opens the blow-up, and dismissing it leaves the sheet up', async ({ page }) => {
        await openAppAndDismissIntro(page);
        await openSheet(page);

        const before = await page.evaluate(() => window.__leafletMap.getCenter());
        await page.locator('.polaroid-mini[data-depth="0"]').click();

        // The payoff is unchanged from a marker click: the blow-up rises while
        // the map flies underneath it.
        await expect(page.locator('.polaroid')).toBeVisible();
        await expect.poll(
            async () => (await page.evaluate(() => window.__leafletMap.getCenter())).lat,
            { timeout: 5000 }
        ).not.toBeCloseTo(before.lat, 3);

        // Dismissing the blow-up must not also close the sheet it was opened
        // from — the tap belongs to the overlay, which is why the outside-tap
        // handler ignores taps while any overlay wrapper is in the DOM. Let the
        // blow-up finish rising first: mid-animation the panel can still be over
        // the corner we aim at, and panel clicks do not dismiss.
        await expect(page.locator('.polaroid-animated-wrapper-overlay.visible')).toHaveCount(1);
        await page.waitForTimeout(900);
        await page.locator('.polaroid-animated-wrapper-overlay').click({ position: { x: 5, y: 5 } });

        await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);

        // But the next tap on the map, with nothing over it now, does close it.
        await page.mouse.click(195, 100);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(1);
    });
});

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('gets the drawer, not the sheet', async ({ page }) => {
        await openAppAndDismissIntro(page);

        // The desktop pile arrives open — it sits in a corner obstructing
        // nothing, so there is nothing to put away on arrival.
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
        await expect(page.locator('.polaroid-stack-handle')).toBeVisible();
        // The sheet's chrome is display: none above the breakpoint.
        await expect(page.locator('.polaroid-stack-surface')).toBeHidden();

        // And a click on the map leaves it alone: auto-collapsing on every
        // marker click would take the pile away from someone who never asked.
        await page.mouse.click(900, 200);
        await page.waitForTimeout(300);
        await expect(page.locator('.polaroid-stack.is-collapsed')).toHaveCount(0);
    });
});
