import { describe, expect, it, vi } from 'vitest';
import { isFavouritePhoto, loadCarouselPhotos, shuffle } from '../src/features/carousel/favouritePhotos';
import { fetchGeoJson } from '../src/features/geojson/fetchGeoJson';
import type { PhotoFeature, PhotoProperties } from '../src/types/geojson';

vi.mock('../src/features/geojson/fetchGeoJson', () => ({ fetchGeoJson: vi.fn() }));

function photoFeature(overrides: Partial<PhotoProperties> & { geometry?: PhotoFeature['geometry'] } = {}): PhotoFeature {
    const { geometry = { type: 'Point', coordinates: [139.7, 35.6] }, ...properties } = overrides;
    return {
        type: 'Feature',
        geometry,
        // Spreading last preserves explicit null/undefined values in test cases.
        properties: { filename: 'IMG_0001', description: null, timestamp: null, priority: '1', ...properties },
    };
}

describe('isFavouritePhoto', () => {
    it.each([
        ['1', true], ['2', true], ['yes', true],
        [null, false], [undefined, false], ['', false], ['0', false],
    ] as const)('priority %o selects a favourite: %s', (priority, expected) => {
        expect(isFavouritePhoto(photoFeature({ priority }))).toBe(expected);
    });

    it.each([
        ['filename', photoFeature({ filename: null })],
        ['geometry', photoFeature({ geometry: null })],
        ['properties', { ...photoFeature(), properties: null }],
    ] as const)('rejects a flagged photo missing %s', (_missing, feature) => {
        expect(isFavouritePhoto(feature)).toBe(false);
    });
});

it('shuffle returns a reordered copy with the same items and leaves its input untouched', () => {
    const input = [1, 2, 3, 4];
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
        const shuffled = shuffle(input);
        // Controlled draws make reordering deterministic without pinning the
        // exact permutation or claiming to measure statistical shuffle quality.
        expect(shuffled).not.toEqual(input);
        expect([...shuffled].sort()).toEqual([1, 2, 3, 4]);
        expect(input).toEqual([1, 2, 3, 4]);
    } finally {
        random.mockRestore();
    }
});

describe('loadCarouselPhotos', () => {
    it('loads the unflagged welcome photo alongside the favourites', async () => {
        const intro = photoFeature({ filename: 'welcome', priority: null });
        const favourite = photoFeature({ filename: 'favourite' });
        vi.mocked(fetchGeoJson).mockResolvedValue({ type: 'FeatureCollection', features: [intro, favourite] });
        expect(await loadCarouselPhotos('welcome')).toEqual({ introPhoto: intro, favourites: [favourite] });
    });

    it('returns no carousel when no favourites are flagged', async () => {
        vi.mocked(fetchGeoJson).mockResolvedValue({
            type: 'FeatureCollection', features: [photoFeature({ filename: 'welcome', priority: null })],
        });
        expect(await loadCarouselPhotos('welcome')).toBeNull();
    });

    it('reports a selected welcome photo missing from the dataset', async () => {
        vi.mocked(fetchGeoJson).mockResolvedValue({ type: 'FeatureCollection', features: [photoFeature()] });
        await expect(loadCarouselPhotos('missing')).rejects.toThrow('Welcome photo not found: missing');
    });
});
