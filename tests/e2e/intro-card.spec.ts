import { test, expect, type Page } from './fixtures';
import {
    openFinishedMap, SETUP_TIMEOUT, stubFavouritePhotos, stubIntroAnimations, waitForAnimations,
} from './mapTestHarness';

async function openIntro(page: Page) {
    await stubIntroAnimations(page);
    await stubFavouritePhotos(page);
    await page.goto('/');
    await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
}

test('first visit flips, lands on one pile, and adds the welcome photo before shuffling', async ({ page }) => {
    await openIntro(page);
    const card = page.locator('.intro-card');
    const overlay = page.locator('.intro-card-overlay');
    await expect(card).not.toHaveClass(/is-flipped/);
    await expect(card).toBeFocused();
    await expect(page.locator('.about-button')).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toHaveClass(/visible/);
    await expect(card).not.toHaveClass(/is-flipped/);

    await card.click();
    await expect(card).toHaveClass(/is-flipped/);
    // Dispatch immediately: Playwright's normal click waits for stability and
    // would miss the flip's deliberate double-tap input lock.
    await card.dispatchEvent('click');
    await expect(card).not.toHaveClass(/is-landing/);
    await expect.poll(() => card.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.intro-card-prompt')).toHaveText('start exploring →');
    await waitForAnimations(card);
    const introSrc = await card.locator('.intro-card-photo').getAttribute('src');
    await card.click();
    await expect(page.locator('.intro-card-flight')).toBeVisible();
    await expect(page.locator('.polaroid-mini.is-landing-target img')).toHaveAttribute('src', introSrc!);
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('.polaroid-stack')).toHaveCount(1);
    await expect(page.locator('.polaroid-mini')).toHaveCount(4);
    await expect(page.locator('.about-button')).toBeVisible();
    const topImage = page.locator('.polaroid-mini[data-depth="0"] img');
    await expect(topImage).toHaveAttribute('src', /assets\/photos\/display\/.+\.webp$/);
    await expect(topImage).not.toHaveAttribute('src', introSrc!);
    await page.getByRole('button', { name: 'Previous photo' }).click();
    await expect(topImage).toHaveAttribute('src', introSrc!);
});

test('About reopens photo-up and closes through each input without duplicating the pile', async ({ page }) => {
    await openFinishedMap(page);
    for (const dismissal of ['card', 'backdrop', 'Escape']) {
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
    }
});

test('a tucked-away desktop pile opens to receive the reopened intro', async ({ page }) => {
    await openFinishedMap(page);
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
});

test('the desktop legend explains map symbols and closes when the pointer leaves', async ({ page }) => {
    await openFinishedMap(page);
    const icon = page.locator('.legend-icon');
    const key = page.locator('.mini-map-key');
    await icon.hover();
    await expect(key).toBeVisible();
    for (const label of ['Public transport', 'Walking / cycling', 'Photo', 'Places']) {
        await expect(key.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(key.locator('svg').first()).toBeVisible();
    await expect(key.getByAltText('Photo marker')).toBeVisible();
    await icon.click();
    await page.mouse.move(10, 100);
    await expect(key).toBeHidden();
});

test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('a map tap skips to a fitted intro which lands on the resting pile', async ({ page }) => {
        await stubFavouritePhotos(page);
        await page.goto('/');
        await expect(page.locator('.opening-caption-skip')).toBeInViewport({ ratio: 1 });
        await page.locator('#map').tap({ position: { x: 180, y: 200 } });
        await expect(page.locator('.intro-card-overlay.visible')).toBeVisible({ timeout: SETUP_TIMEOUT });
        await expect(page.locator('.intro-card-message')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.intro-card-note')).toBeInViewport({ ratio: 1 });
        const card = page.locator('.intro-card');
        await card.tap();
        await waitForAnimations(card);
        const introSrc = await card.locator('.intro-card-photo').getAttribute('src');
        await card.tap();
        await expect(page.locator('.intro-card-flight')).toBeVisible();
        await expect(page.locator('.polaroid-stack')).toHaveClass(/is-collapsed/);
        await expect(page.locator('.intro-card-overlay')).toHaveCount(0);
        await expect(page.locator('.polaroid-mini')).toHaveCount(4);
        const topImage = page.locator('.polaroid-mini[data-depth="0"] img');
        await expect(topImage).not.toHaveAttribute('src', introSrc!);
        await page.locator('.polaroid-mini[data-depth="0"]').tap();
        await page.getByRole('button', { name: 'Previous photo' }).tap();
        await expect(topImage).toHaveAttribute('src', introSrc!);
    });

    test('tapping the legend toggles the key open and closed', async ({ page }) => {
        await openFinishedMap(page);
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
        await openIntro(page);
        await expect(page.locator('.intro-card-message')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.intro-card-note')).toBeInViewport({ ratio: 1 });
        await page.locator('.intro-card').tap();
        await waitForAnimations(page.locator('.intro-card'));
        const overlay = page.locator('.intro-card-overlay');
        const prompt = page.locator('.intro-card-prompt');
        // Visibility alone allows off-screen text. Scroll the modal and check
        // that the entire prompt is reachable before trying to dismiss it.
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
