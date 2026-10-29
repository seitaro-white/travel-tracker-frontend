import { defineConfig } from '@playwright/test';

// Two places run this suite. In pi-box, Chromium lives in the Browserless
// sidecar, reached through the overlay's BROWSER_CDP_URL/BROWSER_TOKEN. Anywhere
// without them (GitHub Actions), Playwright launches its own local Chromium.
const useBrowserless = Boolean(process.env.BROWSER_CDP_URL && process.env.BROWSER_TOKEN);

// Browserless offers both CDP (/chromium) and Playwright (/chromium/playwright).
// The test runner's connectOptions needs the Playwright protocol, not CDP.
function browserlessEndpoint() {
    const endpoint = new URL(process.env.BROWSER_CDP_URL!);
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/playwright`;
    endpoint.searchParams.set('token', process.env.BROWSER_TOKEN!);
    // One browser is reused across tests; Browserless's default 30-second session
    // would expire mid-suite. This is the session lifetime, not a per-test timeout.
    endpoint.searchParams.set('timeout', '300000');
    return endpoint.href;
}

export default defineConfig({
    testDir: './tests/e2e',
    // Keep within the sidecar's session limit and avoid concurrent tile/photo loads.
    workers: 1,
    timeout: 60000,
    // One retry for cold tile/photo loads under worker contention.
    retries: 1,
    // In CI, keep an HTML report so a failure can be inspected from the run's artifacts.
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    // Start Vite automatically before the suite; stop it after.
    // reuseExistingServer: true means it won't fail if you already have
    // the server running in another terminal (handy during development).
    webServer: {
        command: 'npm run dev -- --logLevel silent',
        // Readiness is checked from this machine, not from the browser.
        url: 'http://localhost:5173',
        reuseExistingServer: true,
    },
    use: useBrowserless
        ? {
            // Browser localhost is the sidecar; reach this container by its DNS name.
            baseURL: 'http://pi-box:5173',
            // Playwright still creates a fresh context per test on the remote browser.
            connectOptions: { wsEndpoint: browserlessEndpoint(), timeout: 10000 },
        }
        : { baseURL: 'http://localhost:5173' },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
