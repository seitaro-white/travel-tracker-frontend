import { test, expect, type Page } from './fixtures';
import { openFinishedMap, waitForAnimations } from './mapTestHarness';

// Width chooses the phone skin from first paint. Mouse gestures intentionally
// cover pointer handling here; intro-card.spec.ts separately uses real touch taps.
test.use({ viewport: { width: 390, height: 844 } });

async function openSheet(page: Page) {
    await page.locator('.polaroid-mini[data-depth="0"]').click();
    await expect(page.locator('.polaroid-stack')).not.toHaveClass(/is-collapsed/);
    await waitForAnimations(page.locator('.polaroid-stack'));
}

async function dragBy(page: Page, from: { x: number; y: number }, delta: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps: 8 });
    await page.mouse.up();
}

test('the resting pile leaves the map usable and expands into a browsable sheet', async ({ page }) => {
    await openFinishedMap(page);
    const stack = page.locator('.polaroid-stack');
    const cards = page.locator('.polaroid-stack-cards');
    await expect(stack).toHaveClass(/is-collapsed/);
    await expect(page.locator('.polaroid-stack-bar')).toBeHidden();
    const resting = (await cards.boundingBox())!;
    expect(resting.width).toBeLessThan(130);

    // A transformed child must not leave its full-size parent's invisible hit
    // box swallowing map pans. Check actual input, not just pointer-events CSS.
    const before = await page.evaluate(() => window.__leafletMap!.getCenter());
    await dragBy(page, { x: 120, y: 422 }, { x: 120, y: 0 });
    expect((await page.evaluate(() => window.__leafletMap!.getCenter())).lng).not.toBeCloseTo(before.lng, 5);

    await openSheet(page);
    expect((await cards.boundingBox())!.width).toBeGreaterThan(resting.width * 2);
    await expect(page.locator('.polaroid-stack-surface')).toBeVisible();
    await expect(page.locator('.polaroid-stack-bar')).toBeVisible();
    const first = await page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src');
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    await expect(stack).not.toHaveClass(/is-cycling/);
    await expect(page.locator('.polaroid-mini[data-depth="0"] img')).not.toHaveAttribute('src', first!);
});

test('swiping cards in both directions leaves the map and sheet alone', async ({ page }) => {
    await openFinishedMap(page);
    await openSheet(page);
    const stack = page.locator('.polaroid-stack');
    const image = page.locator('.polaroid-mini[data-depth="0"] img');
    const first = await image.getAttribute('src');
    const before = await page.evaluate(() => window.__leafletMap!.getCenter());
    for (const dx of [-160, 160]) {
        const box = (await page.locator('.polaroid-mini[data-depth="0"]').boundingBox())!;
        await dragBy(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: dx, y: 0 });
        await expect(stack).not.toHaveClass(/is-cycling/);
        if (dx < 0) await expect(image).not.toHaveAttribute('src', first!);
        else await expect(image).toHaveAttribute('src', first!);
        await expect(stack).not.toHaveClass(/is-collapsed/);
    }
    expect(await page.evaluate(() => window.__leafletMap!.getCenter())).toEqual(before);
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
});

test('short sheet drags spring back; long drags and grabber taps dismiss', async ({ page }) => {
    await openFinishedMap(page);
    await openSheet(page);
    const stack = page.locator('.polaroid-stack');
    const grabber = page.locator('.polaroid-stack-grabber');
    const box = (await grabber.boundingBox())!;
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await dragBy(page, start, { x: 0, y: 30 });
    await waitForAnimations(stack);
    await expect(stack).not.toHaveClass(/is-collapsed/);
    await dragBy(page, start, { x: 0, y: 200 });
    await expect(stack).toHaveClass(/is-collapsed/);
    await waitForAnimations(stack);
    await openSheet(page);
    // Pointer capture retargets pointerup to the surface. The app must remember
    // that this gesture started on the grabber for a tap to dismiss correctly.
    await grabber.click();
    await expect(stack).toHaveClass(/is-collapsed/);
});

test('closing a selected photo preserves the sheet; the next map tap dismisses it', async ({ page }) => {
    await openFinishedMap(page);
    await openSheet(page);
    const before = await page.evaluate(() => window.__leafletMap!.getCenter());
    await page.locator('.polaroid-mini[data-depth="0"]').click();
    const overlay = page.locator('.polaroid-animated-wrapper-overlay.visible');
    await expect(overlay.locator('.polaroid')).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__leafletMap!.getCenter())).lat)
        .not.toBeCloseTo(before.lat, 3);
    await waitForAnimations(overlay);
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.polaroid-animated-wrapper-overlay')).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).not.toHaveClass(/is-collapsed/);
    await page.mouse.click(195, 100);
    await expect(page.locator('.polaroid-stack')).toHaveClass(/is-collapsed/);
});
