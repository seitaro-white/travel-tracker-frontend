import { test, expect } from './fixtures';
import { captureLeafletMap, SEEN_KEY, SETUP_TIMEOUT } from './mapTestHarness';

test('the finished map renders real point data and info overlays dismiss through both inputs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await captureLeafletMap(page);
    await page.addInitScript(key => localStorage.setItem(key, '1'), SEEN_KEY);
    // Keep the complete photo dataset in one finished-map test. Interaction
    // specs use a small subset, so they do not pay for all those thumbnails.
    await page.goto('/');
    await expect(page.locator('.about-button')).toBeVisible({ timeout: SETUP_TIMEOUT });
    await expect(page.locator('.custom-cluster-stack').first()).toBeVisible();
    await page.evaluate(() => window.__leafletMap!.setZoom(12, { animate: false }));
    await expect(page.locator('.place-marker').first()).toBeVisible();
    const marker = page.locator('.info-marker-icon').first();
    await expect(marker).toBeVisible();

    // Synthetic clicks isolate marker-to-overlay wiring from random marker
    // overlap/position. These are not a test of Leaflet's pointer hit testing.
    for (const dismissal of ['Escape', 'backdrop']) {
        await marker.dispatchEvent('click');
        const overlay = page.locator('.overlay-panel-overlay');
        await expect(overlay).toHaveClass(/visible/);
        await expect(page.locator('.info-panel')).toBeVisible();
        if (dismissal === 'Escape') await page.keyboard.press('Escape');
        else await overlay.click({ position: { x: 5, y: 5 } });
        await expect(overlay).toHaveCount(0);
    }
    expect(errors).toEqual([]);
});
