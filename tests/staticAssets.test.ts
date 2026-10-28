import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const publicRoot = new URL('../public/', import.meta.url);

describe('fetched HTML fragments', () => {
    it.each(['miniMapKey.html'])('%s references images that ship with the site', filename => {
        const html = readFileSync(new URL(filename, publicRoot), 'utf8');
        // These fragments are fetched as text, not processed as Vite entries.
        // Their image URLs therefore need to name real files in public/.
        for (const match of html.matchAll(/src="(assets\/[^"]+)"/g)) {
            const image = fileURLToPath(new URL(match[1], publicRoot));
            expect(existsSync(image), `missing ${image}`).toBe(true);
        }
    });
});
