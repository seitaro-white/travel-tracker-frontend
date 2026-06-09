import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Don't let Vitest pick up Playwright specs in tests/e2e/.
        // Those are run separately via `npm run test:e2e`.
        exclude: ['tests/e2e/**', 'node_modules/**'],
    },
});
