import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGeoJson } from '../src/features/geojson/fetchGeoJson';

afterEach(() => vi.unstubAllGlobals());

describe('fetchGeoJson', () => {
    it('fetches the requested path and returns parsed JSON', async () => {
        const data = { type: 'FeatureCollection', features: [] };
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
        vi.stubGlobal('fetch', fetch);
        expect(await fetchGeoJson('points.geojson')).toEqual(data);
        expect(fetch).toHaveBeenCalledWith('points.geojson');
    });

    it('reports an HTTP failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' })));
        await expect(fetchGeoJson('missing.geojson')).rejects.toThrow(/Network response was not ok/);
    });

    it('reports invalid JSON', async () => {
        // Use the real Response parser rather than a hand-built json() mock.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));
        await expect(fetchGeoJson('bad.geojson')).rejects.toThrow(/Failed to parse JSON/);
    });
});
