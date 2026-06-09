import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // Start http-server automatically before the suite; stop it after.
    // reuseExistingServer: true means it won't fail if you already have
    // the server running in another terminal (handy during development).
    webServer: {
        command: 'npx http-server . -p 8000 --silent',
        url: 'http://localhost:8000',
        reuseExistingServer: true,
    },
    use: {
        baseURL: 'http://localhost:8000',
        // Fresh browser context per test — avoids the JS caching issue noted in CLAUDE.md.
        // (Each Playwright test runner context starts cold; no persistent session.)
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
