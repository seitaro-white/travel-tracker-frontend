import { test, expect } from './fixtures';
import { dismissIntro, SETUP_TIMEOUT, stubFavouritePhotos, stubIntroAnimations } from './mapTestHarness';

for (const phone of [false, true]) {
    test.describe(phone ? 'phone welcome print' : 'desktop welcome print', () => {
        // Set the idiom before first paint, including touch capability so the
        // legend test exercises real touch :hover behaviour rather than a mouse.
        test.use(phone
            ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
            : { viewport: { width: 1280, height: 720 } });

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
            await expect(page.locator('.about-button')).toHaveCount(0);
            await expect(page.locator('.polaroid-stack')).toHaveCount(0);
            await page.keyboard.press('Escape');
            await overlay.click({ position: { x: 5, y: 5 } });
            await expect(overlay).toHaveClass(/visible/);
            await expect(card).not.toHaveClass(/is-flipped/);

            if (phone) await card.tap();
            else await card.click();
            await expect(card).toHaveClass(/is-flipped/);
            await expect.poll(() => page.locator('.intro-card-photo').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
            await expect(page.locator('.intro-card-prompt')).toHaveText('start exploring →');
            await expect(card.locator('.map-key')).toHaveCount(0);
            // Bypass Playwright's "wait until stable" click so this second input
            // really lands during the flip and proves the double-tap lock works.
            await card.dispatchEvent('click');
            await expect(card).not.toHaveClass(/is-tossed/);
            await page.waitForTimeout(750);
            if (phone) await card.tap();
            else await card.click();
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

        test('the native card button supports Enter and Space', async ({ page }) => {
            const card = page.locator('.intro-card');
            await card.focus();
            await page.keyboard.press('Enter');
            await expect(card).toHaveClass(/is-flipped/);
            await page.waitForTimeout(750);
            await page.keyboard.press('Space');
            await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
            await expect(page.locator('.polaroid-stack')).toHaveCount(1);
        });

        if (phone) {
            test('tapping the legend toggles the key open and closed', async ({ page }) => {
                await dismissIntro(page);
                const key = page.locator('.mini-map-key');
                await expect(key).toBeHidden();
                await page.locator('.legend-icon').tap();
                await expect(key).toBeVisible();
                await page.locator('.legend-icon').tap();
                await expect(key).toBeHidden();
            });
        }
    });
}
