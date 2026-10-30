import { existsSync, readFileSync } from 'node:fs';
import type { FeatureCollection, Point } from 'geojson';
import { expect, it } from 'vitest';
import { isFavouritePhoto } from '../src/features/carousel/favouritePhotos';
import { placeEmojis } from '../src/features/markers/placeEmojis';
import type { Photos } from '../src/types/geojson';

type PointCollection = FeatureCollection<Point | null, Record<string, unknown> | null>;

function loadPoints<T>(filename: string): T {
    return JSON.parse(readFileSync(new URL(`../public/assets/points/${filename}`, import.meta.url), 'utf8')) as T;
}

it.each([
    ['photos.geojson', ['filename', 'timestamp', 'description']],
    ['places.geojson', ['Title', 'placeList']],
    ['information.geojson', ['Name', 'Description']],
] as const)('%s has nonempty point data with required properties and numeric coordinates', (filename, requiredKeys) => {
    const data = loadPoints<PointCollection>(filename);
    expect(data.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBeGreaterThan(0);

    data.features.forEach((feature, index) => {
        const label = `${filename} feature ${index}`;
        // Soft assertions report all bad records in a dataset, not just the
        // first. Keep the record index in every failure after grouping the audit.
        for (const key of requiredKeys) {
            expect.soft(feature.properties, label).toHaveProperty(key);
        }
        // Preserve the existing null-geometry policy (known issue in todo.MD).
        if (feature.geometry === null) return;
        const coordinates = feature.geometry?.coordinates;
        expect.soft(Array.isArray(coordinates), `${label}: coordinate array`).toBe(true);
        expect.soft(coordinates?.length, `${label}: at least longitude and latitude`).toBeGreaterThanOrEqual(2);
        expect.soft(Number.isFinite(coordinates?.[0]), `${label}: finite longitude`).toBe(true);
        expect.soft(Number.isFinite(coordinates?.[1]), `${label}: finite latitude`).toBe(true);
    });
});

it('the favourite collection is nonempty and every favourite has a display image', () => {
    const favourites = loadPoints<Photos>('photos.geojson').features.filter(isFavouritePhoto);
    expect(favourites.length).toBeGreaterThan(0);
    const missingImages = favourites.map(photo => photo.properties.filename)
        .filter(filename => !existsSync(new URL(`../public/assets/photos/display/${filename}.webp`, import.meta.url)));
    expect(missingImages, 'favourites missing display images').toEqual([]);
});

it('every explicit emoji mapping is used by a place category', () => {
    const places = loadPoints<PointCollection>('places.geojson');
    const categories = new Set(places.features.map(feature => feature.properties?.placeList));
    // Unmapped categories intentionally use the fallback pin; only stale
    // explicit mappings are errors. Report all of their names together.
    const unusedKeys = Object.keys(placeEmojis).filter(key => !categories.has(key));
    expect(unusedKeys, 'emoji mappings with no matching place category').toEqual([]);
});
