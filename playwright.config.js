import { defineConfig } from '@playwright/test';

// Browserless offers both CDP (/chromium) and Playwright (/chromium/playwright).
// The test runner's connectOptions needs the Playwright protocol, not CDP.
if (!process.env.BROWSER_CDP_URL || !process.env.BROWSER_TOKEN) {
    throw new Error('E2E requires BROWSER_CDP_URL and BROWSER_TOKEN from the pi-box browser overlay.');
}
const browserEndpoint = new URL(process.env.BROWSER_CDP_URL);
browserEndpoint.pathname = `${browserEndpoint.pathname.replace(/\/$/, '')}/playwright`;
browserEndpoint.searchParams.set('token', process.env.BROWSER_TOKEN);
// One browser is reused across tests; Browserless's default 30-second session
// would expire mid-suite. This is the session lifetime, not a per-test timeout.
browserEndpoint.searchParams.set('timeout', '300000');

export default defineConfig({
    testDir: './tests/e2e',
    // Keep within the sidecar's session limit and avoid concurrent CDN loads.
    workers: 1,
    timeout: 60000,
    // One retry: setup is gated behind cold CDN bundle loads (Leaflet, markercluster
    // from unpkg). Under worker contention a cold load can occasionally exceed the
    // setup wait. The retry only costs time when a flake actually occurs.
    retries: 1,
    // Start http-server automatically before the suite; stop it after.
    // reuseExistingServer: true means it won't fail if you already have
    // the server running in another terminal (handy during development).
    webServer: {
        command: 'npm run dev -- --silent',
        // Readiness is checked here in pi-box, not in the remote browser.
        url: 'http://localhost:5173',
        reuseExistingServer: true,
    },
    use: {
        // Browser localhost is the sidecar; reach this container by its DNS name.
        baseURL: 'http://pi-box:5173',
        connectOptions: {
            wsEndpoint: browserEndpoint.href,
            timeout: 10000,
        },
        // Playwright still creates a fresh context per test on the remote browser.
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
