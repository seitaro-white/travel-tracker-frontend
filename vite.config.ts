import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Keep the optional local config out of git. Both dev and production always
// have a config.js URL, even without a key, so the browser never requests a
// missing script. Deployment overwrites the emitted default after building.
function runtimeConfig() {
    const localConfig = resolve('config.js');
    return existsSync(localConfig)
        ? readFileSync(localConfig, 'utf8')
        : 'window.__APP_CONFIG__ = {};\n';
}

export default defineConfig({
    // A relative base supports the GitHub Pages project site
    // (/travel-tracker-frontend/) as well as local preview at /.
    base: './',
    server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['pi-box'] },
    plugins: [{
        name: 'runtime-config',
        configureServer(server) {
            server.middlewares.use('/config.js', (_request, response) => {
                response.setHeader('Content-Type', 'application/javascript');
                response.end(runtimeConfig());
            });
        },
        generateBundle() {
            this.emitFile({ type: 'asset', fileName: 'config.js', source: runtimeConfig() });
        },
    }],
});
