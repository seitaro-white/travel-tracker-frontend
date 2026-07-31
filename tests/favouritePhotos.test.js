/**
 * Unit tests for the carousel's photo selection.
 *
 * Two halves:
 *   - the pure logic (isFavouritePhoto, shuffle), tested with hand-built
 *     features so every branch is covered explicitly;
 *   - the real photos.geojson, checked so a data change upstream can't silently
 *     empty the carousel or leave it pointing at a missing image file.
 *
 * loadFavouritePhotos() itself isn't tested here — it only glues fetchGeoJson
 * (already covered in geojsonService.test.js) to the two functions below.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { isFavouritePhoto, shuffle } from '../src/features/carousel/favouritePhotos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/** Builds a photo feature, letting each test override just the bit it cares about. */
function photoFeature(overrides = {}) {
    const { filename = 'IMG_0001', geometry = { type: 'Point', coordinates: [139.7, 35.6] } } = overrides;
    const properties = { filename, description: null, timestamp: null };
    // Checked by key presence rather than a destructuring default, so that a
    // test can pass `priority: undefined` and actually get undefined — a
    // default would quietly substitute '1' and the case would never be tested.
    properties.priority = 'priority' in overrides ? overrides.priority : '1';
    return { type: 'Feature', properties, geometry };
}

// ── isFavouritePhoto ──────────────────────────────────────────────────────────

describe('isFavouritePhoto', () => {
    it('accepts a photo flagged with priority "1"', () => {
        expect(isFavouritePhoto(photoFeature({ priority: '1' }))).toBe(true);
    });

    it('accepts any other truthy priority value', () => {
        // The flag is set upstream; we only care that something is there.
        expect(isFavouritePhoto(photoFeature({ priority: '2' }))).toBe(true);
        expect(isFavouritePhoto(photoFeature({ priority: 'yes' }))).toBe(true);
    });

    it.each([null, undefined, '', '0'])('rejects priority %o', (priority) => {
        expect(isFavouritePhoto(photoFeature({ priority }))).toBe(false);
    });

    it('rejects a flagged photo with no filename, since there is no image to show', () => {
        expect(isFavouritePhoto(photoFeature({ filename: null }))).toBe(false);
    });

    it('rejects a flagged photo with null geometry, since there is nowhere to fly to', () => {
        expect(isFavouritePhoto(photoFeature({ geometry: null }))).toBe(false);
    });

    it('rejects a feature with no properties at all', () => {
        expect(isFavouritePhoto({ type: 'Feature', properties: null, geometry: null })).toBe(false);
    });
});

// ── shuffle ───────────────────────────────────────────────────────────────────

describe('shuffle', () => {
    it('keeps every item, without duplicating or dropping any', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        const result = shuffle(input);
        expect(result).toHaveLength(input.length);
        // Sorting both sides compares membership while ignoring order.
        expect([...result].sort()).toEqual([...input].sort());
    });

    it('leaves the input array untouched', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        shuffle(input);
        expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('actually reorders (over enough runs that a fluke pass-through is negligible)', () => {
        const input = Array.from({ length: 20 }, (_, i) => i);
        // One shuffle could legitimately return the original order; twenty
        // identical results in a row could not.
        const anyReordered = Array.from({ length: 20 }, () => shuffle(input))
            .some(result => result.some((value, i) => value !== input[i]));
        expect(anyReordered).toBe(true);
    });
});

// ── the real data ─────────────────────────────────────────────────────────────

describe('favourites in photos.geojson', () => {
    const data = JSON.parse(fs.readFileSync(path.join(projectRoot, 'assets/points/photos.geojson'), 'utf8'));
    const favourites = data.features.filter(isFavouritePhoto);

    it('finds at least one favourite to put in the carousel', () => {
        // Deliberately not asserting 47: curating more favourites shouldn't
        // break the build. Asserting > 0 catches the case that matters — the
        // priority flags going missing entirely.
        expect(favourites.length).toBeGreaterThan(0);
    });

    it('excludes the known blank record (todo.MD: photos.geojson index 748)', () => {
        expect(isFavouritePhoto(data.features[748])).toBe(false);
    });

    it.each(favourites.map(f => [f.properties.filename, f]))(
        'favourite %s has a display image on disk',
        (filename, _feature) => {
            // A favourite with no image file would render as an empty card.
            const imagePath = path.join(projectRoot, 'assets/photos/display', `${filename}.jpg`);
            expect(fs.existsSync(imagePath), `missing ${imagePath}`).toBe(true);
        }
    );

    it.each(favourites.map(f => [f.properties.filename, f]))(
        'favourite %s has finite coordinates to fly to',
        (_filename, feature) => {
            const [longitude, latitude] = feature.geometry.coordinates;
            expect(isFinite(longitude)).toBe(true);
            expect(isFinite(latitude)).toBe(true);
        }
    );
});
