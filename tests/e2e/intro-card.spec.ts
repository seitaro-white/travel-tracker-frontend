import { test, expect } from './fixtures';
import { dismissIntro, SETUP_TIMEOUT, stubFavouritePhotos, stubIntroAnimations } from './mapTestHarness';

test.beforeEach(async ({ page }) => {
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('/');
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
});

test('first visit flips, lands on one pile, and shuffles to another photo', async ({ page }) => {
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
    await expect(card).not.toHaveClass(/is-landing/);
    await page.waitForTimeout(750);
    await card.click();
    await expect(card).toHaveClass(/is-landing/);
    await expect(page.locator('.intro-card-flight')).toBeVisible();
    const introSrc = await card.locator('.intro-card-photo').getAttribute('src');
    await expect(page.locator('.polaroid-mini.is-landing-target img')).toHaveAttribute('src', introSrc!);
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(1);
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    await expect(page.locator('.about-button')).toBeVisible();
    await expect(page.locator('.polaroid-mini[data-depth="0"] img')).not.toHaveAttribute('src', introSrc!);

    // The welcome photo really joined the carousel; it was not merely a clone
    // flying towards an unrelated card and disappearing at the destination.
    await page.getByRole('button', { name: 'Previous photo' }).click();
    await expect(page.locator('.polaroid-mini[data-depth="0"] img')).toHaveAttribute('src', introSrc!);
});

for (const dismissal of ['card', 'backdrop', 'Escape']) {
    test(`reopens photo-up and lands via ${dismissal} without a second pile`, async ({ page }) => {
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
        await expect(card).toHaveClass(/is-landing/);
        await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);
        await expect(page.locator('.about-button')).toHaveCount(1);
    });
}

test('a tucked-away desktop pile opens to receive the reopened intro', async ({ page }) => {
    await dismissIntro(page);
    await page.getByRole('button', { name: 'Hide photos', exact: true }).click();
    await expect(page.locator('.polaroid-stack')).toHaveClass(/is-collapsed/);
    const previousTop = await page.locator('.polaroid-mini[data-depth="0"] img').getAttribute('src');
    await page.getByRole('button', { name: 'About this map' }).click();
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.intro-card-flight')).toBeVisible();
    await expect(page.locator('.polaroid-stack')).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
    await expect(page.locator('.polaroid-mini[data-depth="0"] img')).toHaveAttribute('src', previousTop!);
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
});

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

    test('the intro lands on the small resting pile, then reveals another photo', async ({ page }) => {
        await page.locator('.intro-card').tap();
        await page.waitForTimeout(750);
        await page.locator('.intro-card').tap();
        await expect(page.locator('.intro-card-flight')).toBeVisible();
        await expect(page.locator('.polaroid-stack')).toHaveClass(/is-collapsed/);
        await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
        await expect(page.locator('.polaroid-mini')).toHaveCount(4);
        await expect(page.locator('.polaroid-mini[data-depth="0"] img')).not.toHaveAttribute('src', /IMG_0715/);
        await page.locator('.polaroid-mini[data-depth="0"]').tap();
        await page.getByRole('button', { name: 'Previous photo' }).tap();
        await expect(page.locator('.polaroid-mini[data-depth="0"] img')).toHaveAttribute('src', /IMG_0715/);
    });

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

    test('the back note and front prompt are reachable on first visit and reopen', async ({ page }) => {
        await expect(page.locator('.intro-card-message')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.intro-card-note')).toBeInViewport({ ratio: 1 });
        await page.locator('.intro-card').tap();
        await page.waitForTimeout(750);

        const overlay = page.locator('.intro-card-overlay');
        const prompt = page.locator('.intro-card-prompt');
        // Scroll the overlay itself. Checking the whole rotated prompt matters:
        // toBeVisible alone allows off-screen text.
        await overlay.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(prompt).toBeInViewport({ ratio: 1 });
        await prompt.tap();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);

        await page.getByRole('button', { name: 'About this map' }).tap();
        await expect(page.locator('.intro-card-overlay.visible')).toBeVisible();
        await expect(page.locator('.intro-card')).toHaveClass(/is-flipped/);
        await overlay.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(prompt).toBeInViewport({ ratio: 1 });
        await prompt.tap();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('.polaroid-stack')).toHaveCount(1);
    });
});
