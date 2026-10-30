import { test, expect } from './fixtures';
import { dismissIntro, SEEN_KEY, SETUP_TIMEOUT, stubFavouritePhotos } from './mapTestHarness';
const PLANE_TEXT = 'January 2025 — landing in Tokyo';
const LINES_TEXT = '…and everywhere since';

// Keep real animation distances here: the skip must interrupt live motion,
// not just race the tiny routes used by the other integration specs.
test.beforeEach(async ({ page }) => {
    await stubFavouritePhotos(page);
});

for (const phase of ['plane', 'routes']) {
    test(`skip button during ${phase} stops motion and reaches the first-visit card`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/');
        const text = page.locator('.opening-caption-text');
        await expect(text).toHaveText(PLANE_TEXT);
        if (phase === 'routes') await expect(text).toHaveText(LINES_TEXT, { timeout: SETUP_TIMEOUT });
        await expect(page.locator('.leaflet-polymotion-pane path').first()).toBeAttached();
        await page.getByRole('button', { name: 'skip ›' }).click();
        await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.leaflet-polymotion-pane path')).toHaveCount(0);
        await expect(page.locator('.opening-caption')).toHaveCount(0);
        await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached();
        await expect(page.locator('.custom-cluster-stack').first()).toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(/markers-dropping/);
        expect(await page.evaluate(() => localStorage.getItem('travel-tracker:intro-seen'))).toBeNull();
        expect(errors).toEqual([]);
    });
}

test('both captions appear and the real opening completes normally', async ({ page }) => {
    await page.goto('/');
    const text = page.locator('.opening-caption-text');
    await expect(text).toHaveText(PLANE_TEXT);
    await expect(text).toHaveText(LINES_TEXT, { timeout: SETUP_TIMEOUT });
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await expect(page.locator('.opening-caption')).toHaveCount(0);
    await expect(page.locator('.leaflet-polymotion-pane path')).toHaveCount(0);
});

test('clicking the map skips, but dragging it does not', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.opening-caption-skip')).toBeVisible();
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(300, 230, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.opening-caption-skip')).toBeVisible();
    await page.locator('#map').click({ position: { x: 100, y: 200 } });
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.opening-caption')).toHaveCount(0);
});

test('dismissal records a return; reload bypasses animation and still allows About', async ({ page }) => {
    await page.goto('/');
    await page.locator('.opening-caption-skip').click();
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(key => localStorage.getItem(key), SEEN_KEY)).toBeNull();
    await dismissIntro(page);
    expect(await page.evaluate(key => localStorage.getItem(key), SEEN_KEY)).toBe('1');

    const openingRequests: string[] = [];
    page.on('request', request => {
        if (/incoming_flight|animation_tracks/.test(request.url())) openingRequests.push(request.url());
    });
    await page.reload();
    await expect(page.locator('.polaroid-stack')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.about-button')).toBeVisible();
    await expect(page.locator('.opening-caption')).toHaveCount(0);
    await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/markers-dropping/);
    await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached();
    expect(openingRequests).toEqual([]);
    await page.getByRole('button', { name: 'About this map' }).click();
    await expect(page.locator('.intro-card')).toHaveClass(/is-flipped/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(1);
});
