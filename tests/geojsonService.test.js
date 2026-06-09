/**
 * Unit tests for fetchGeoJson() in geojsonService.js.
 *
 * Python analogy: this is like pytest with monkeypatch on requests.get.
 * `vi.stubGlobal('fetch', ...)` replaces the browser's global fetch with a
 * fake (vi.fn()), so we can control what it returns without hitting the network.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGeoJson } from '../src/features/geojson/geojsonService.js';

afterEach(() => {
    // Restore the real fetch after each test, like teardown in pytest fixtures.
    vi.unstubAllGlobals();
});

describe('fetchGeoJson()', () => {

    it('happy path: returns parsed JSON when response is ok', async () => {
        const mockData = { type: 'FeatureCollection', features: [] };

        // Stub global.fetch to return a successful response.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
        }));

        const result = await fetchGeoJson('some/path.geojson');
        expect(result).toEqual(mockData);
    });

    it('network error: rejects with "Network response was not ok" when ok is false', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            statusText: 'Not Found',
        }));

        // The Python equivalent: with pytest.raises(ValueError, match="...")
        await expect(fetchGeoJson('missing.geojson'))
            .rejects.toThrow(/Network response was not ok/);
    });

    it('bad JSON: rejects with "Failed to parse JSON" when response.json() throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => { throw new Error('Unexpected token'); },
        }));

        await expect(fetchGeoJson('bad.geojson'))
            .rejects.toThrow(/Failed to parse JSON/);
    });

});
