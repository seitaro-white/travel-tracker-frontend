import { test, expect, type Page } from './fixtures';
import {
    dismissIntro, openFinishedMap, stubFavouritePhotos, stubIntroAnimations, waitForAnimations,
} from './mapTestHarness';

function topCardImage(page: Page) {
    return page.locator('.polaroid-mini[data-depth="0"] img');
}

async function waitForPileToSettle(page: Page) {
    await expect(page.locator('.polaroid-stack')).not.toHaveClass(/is-cycling/);
}

// Use mouse input here: native image dragging can cancel a pointer gesture even
// when the equivalent touch gesture works. hover() also waits for settled boxes.
async function dragTopCard(page: Page, dx: number) {
    const card = page.locator('.polaroid-mini[data-depth="0"]');
    await card.hover();
    const box = (await card.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 6 });
    await page.mouse.up();
    await waitForPileToSettle(page);
}

test('unflagged photos leave the map usable without a pile', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page, 0);
    await page.goto('/');
    // Dismissal awaits loading the pile, so a premature no-element assertion
    // cannot pass while the carousel fetch is still outstanding.
    await dismissIntro(page);
    await expect(page.getByRole('button', { name: 'About this map' })).toBeVisible();
    await expect(page.locator('.polaroid-stack')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('buttons browse both ways, including rapid input, without losing prints', async ({ page }) => {
    await openFinishedMap(page);
    const next = page.getByRole('button', { name: 'Next photo', exact: true });
    const previous = page.getByRole('button', { name: 'Previous photo', exact: true });
    const first = await topCardImage(page).getAttribute('src');
    const third = await page.locator('.polaroid-mini[data-depth="2"] img').getAttribute('src');

    await next.click();
    const moving = page.locator('.polaroid-mini.is-moving');
    // Freeze the return leg at the turnaround. The visual contract is that the
    // print clears the pile before going behind it, not a particular distance
    // multiplier or z-index value.
    await moving.evaluate(card => {
        const outward = card.getAnimations()[0];
        outward.addEventListener('finish', () => {
            const inward = card.getAnimations()[0];
            inward.pause();
            inward.currentTime = 0;
        }, { once: true });
        outward.finish();
    });
    await expect.poll(() => moving.evaluate(card => card.getAnimations()[0].playState)).toBe('paused');
    const clearsPile = await moving.evaluate(card => card.getBoundingClientRect().right <= Math.min(
        ...Array.from(card.parentElement!.querySelectorAll('.polaroid-mini'))
            .filter(print => print !== card).map(print => print.getBoundingClientRect().left)
    ));
    expect(clearsPile).toBe(true);
    await moving.evaluate(card => card.getAnimations()[0].finish());
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).not.toHaveAttribute('src', first!);
    await previous.click();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', first!);

    await next.dblclick();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', third!);
    await previous.dblclick();
    await waitForPileToSettle(page);
    await expect(topCardImage(page)).toHaveAttribute('src', first!);
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
});

test('drags browse both ways, while short drags neither browse nor select', async ({ page }) => {
    await openFinishedMap(page);
    const first = await topCardImage(page).getAttribute('src');
    for (const dx of [30, -30]) {
        await dragTopCard(page, dx);
        await expect(topCardImage(page)).toHaveAttribute('src', first!);
        await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
    }
    // A successful browse after cancellation also proves the pile was not left
    // stuck in a drag state, without inspecting its private inline properties.
    await dragTopCard(page, -140);
    await expect(topCardImage(page)).not.toHaveAttribute('src', first!);
    await dragTopCard(page, 140);
    await expect(topCardImage(page)).toHaveAttribute('src', first!);
    await expect(page.locator('.polaroid-mini.is-moving')).toHaveCount(0);
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});

test('a new drag finishes the in-flight button movement before browsing again', async ({ page }) => {
    await openFinishedMap(page);
    const third = await page.locator('.polaroid-mini[data-depth="2"] img').getAttribute('src');
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    // Do not hover(): waiting for stability would miss the interruption.
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

test('reduced motion browses in both directions without travelling prints', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFinishedMap(page);
    const first = await topCardImage(page).getAttribute('src');
    const second = await page.locator('.polaroid-mini[data-depth="1"] img').getAttribute('src');
    for (const [name, src] of [['Next photo', second], ['Previous photo', first]] as const) {
        // Snapshot in the click's own task: a retrying assertion could wait out
        // an unwanted animation and accidentally pass with reduced motion broken.
        const travelling = await page.getByRole('button', { name, exact: true }).evaluate(button => {
            (button as HTMLButtonElement).click();
            const stack = button.closest('.polaroid-stack')!;
            return stack.classList.contains('is-cycling') || !!stack.querySelector('.polaroid-mini.is-moving');
        });
        expect(travelling).toBe(false);
        await expect(topCardImage(page)).toHaveAttribute('src', src!);
    }
});

test('selecting a photo opens its blow-up and flies the map without resetting it on close', async ({ page }) => {
    await openFinishedMap(page);
    const before = await page.evaluate(() => window.__leafletMap!.getCenter());
    const target = await page.evaluate(() => Math.min(13, window.__leafletMap!.getMaxZoom()));
    const src = await topCardImage(page).getAttribute('src');
    await page.locator('.polaroid-mini[data-depth="0"]').click();
    const overlay = page.locator('.polaroid-animated-wrapper-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.polaroid img')).toHaveAttribute('src', src!);
    await page.waitForFunction(zoom => window.__leafletMap!.getZoom() === zoom, target);
    const after = await page.evaluate(() => window.__leafletMap!.getCenter());
    expect(Math.abs(after.lat - before.lat) + Math.abs(after.lng - before.lng)).toBeGreaterThan(0.01);
    await waitForAnimations(overlay);
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toHaveCount(0);
    expect(await page.evaluate(() => window.__leafletMap!.getCenter())).toEqual(after);
});

test('the desktop drawer stays open on map clicks and can be put away and reopened', async ({ page }) => {
    await openFinishedMap(page);
    const stack = page.locator('.polaroid-stack');
    const handle = page.locator('.polaroid-stack-handle');
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('.polaroid-stack-surface')).toBeHidden();
    await page.mouse.click(900, 200);
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await handle.click();
    await expect(stack).toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await waitForAnimations(stack);
    await expect(handle).toBeInViewport();
    await expect(page.locator('.polaroid-stack-step').first()).toBeHidden();
    // The visible sliver is an alternate launcher, not a photo selection.
    const box = (await page.locator('.polaroid-stack-cards').boundingBox())!;
    await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});
