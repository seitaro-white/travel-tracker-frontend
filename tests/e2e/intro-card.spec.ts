import { test, expect } from './fixtures';
import { dismissIntro, SETUP_TIMEOUT, stubFavouritePhotos, stubIntroAnimations } from './mapTestHarness';

test.beforeEach(async ({ page }) => {
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('/');
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
});

test('first visit requires a flip then a toss, and mounts the pile once', async ({ page }) => {
    const card = page.locator('.intro-card');
    const overlay = page.locator('.intro-card-overlay');
    await expect(card).not.toHaveClass(/is-flipped/);
    await expect(card).toBeFocused();
    await expect.poll(() => card.evaluate(element => element.matches(':focus-visible'))).toBe(false);
    await expect(page.locator('.about-button')).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toHaveClass(/visible/);
    await expect(card).not.toHaveClass(/is-flipped/);

    await card.click();
    await expect(card).toHaveClass(/is-flipped/);
    await expect.poll(() => page.locator('.intro-card-photo').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.intro-card-prompt')).toHaveText('start exploring →');
    // Bypass Playwright's "wait until stable" click so this second input
    // really lands during the flip and proves the double-tap lock works.
    await card.dispatchEvent('click');
    await expect(card).not.toHaveClass(/is-tossed/);
    await page.waitForTimeout(750);
    await card.click();
    await expect(card).toHaveClass(/is-tossed/);
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(1);
    await expect(page.locator('.about-button')).toBeVisible();
});

for (const dismissal of ['card', 'backdrop', 'Escape']) {
    test(`reopens photo-up and tosses via ${dismissal} without a second pile`, async ({ page }) => {
        await dismissIntro(page);
        await page.getByRole('button', { name: 'About this map' }).click();
        const card = page.locator('.intro-card');
        await expect(page.locator('.intro-card-overlay.visible')).toBeVisible();
        await expect(card).toHaveClass(/is-flipped/);
        await expect(card).toBeFocused();
        if (dismissal === 'card') await card.click();
        else if (dismissal === 'backdrop') {
            await page.locator('.intro-card-overlay').click({ position: { x: 5, y: 5 } });
        } else await page.keyboard.press('Escape');
        await expect(card).toHaveClass(/is-tossed/);
        await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);
        await expect(page.locator('.about-button')).toHaveCount(1);
    });
}

test('mouse clicks do not pin the hovered legend open', async ({ page }) => {
    await dismissIntro(page);
    const key = page.locator('.mini-map-key');
    await page.locator('.legend-icon').hover();
    await expect(key).toBeVisible();
    await page.locator('.legend-icon').click();
    await page.mouse.move(10, 100);
    await expect(key).toBeHidden();
});

test.describe('phone legend', () => {
    // Touch capability, not just width, exercises the real touch hover rules.
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('tapping the legend toggles the key open and closed', async ({ page }) => {
        await dismissIntro(page);
        const key = page.locator('.mini-map-key');
        await expect(key).toBeHidden();
        await page.locator('.legend-icon').tap();
        await expect(key).toBeVisible();
        await page.locator('.legend-icon').tap();
        await expect(key).toBeHidden();
    });
});

test.describe('landscape welcome print', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test('the welcome text and dismissal prompt can be scrolled into view on first visit and reopen', async ({ page }) => {
        await expect(page.locator('.intro-card-hi')).toBeInViewport({ ratio: 1 });
        await page.locator('.intro-card').tap();
        await page.waitForTimeout(750);

        const overlay = page.locator('.intro-card-overlay');
        const text = page.locator('.intro-card-text');
        const prompt = page.locator('.intro-card-prompt');
        // Scroll the overlay itself. Checking the whole rotated prompt matters:
        // toBeVisible alone allows off-screen text.
        await overlay.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(text).toBeInViewport({ ratio: 1 });
        await expect(prompt).toBeInViewport({ ratio: 1 });
        await prompt.tap();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);

        await page.getByRole('button', { name: 'About this map' }).tap();
        await expect(page.locator('.intro-card-overlay.visible')).toBeVisible();
        await expect(page.locator('.intro-card')).toHaveClass(/is-flipped/);
        await overlay.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(text).toBeInViewport({ ratio: 1 });
        await expect(prompt).toBeInViewport({ ratio: 1 });
        await prompt.tap();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);
    });
});
