/**
 * Emoji sanity tests — "dead data" check.
 *
 * ⚠️  This is NOT "every placeList value has an emoji". Most categories
 * deliberately rely on the '📍' fallback (e.g. "駅", "定食", all English
 * list names). Testing coverage would produce ~30 false failures.
 *
 * What we actually test (the reverse direction):
 *   Every KEY in placeEmojis is used by at least one place feature.
 * This catches emoji entries that were added for a category that was later
 * renamed or deleted — a key with no matching features is dead code that
 * will never render.
 *
 * Python analogy: checking that every entry in a lookup dict is reachable
 * from your data, like asserting every enum value appears in a test fixture.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { placeEmojis } from '../src/features/markers/placeEmojis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const placesPath = path.resolve(__dirname, '../assets/points/places.geojson');
const placesData = JSON.parse(fs.readFileSync(placesPath, 'utf8'));

// Collect the set of all placeList values that exist in the data.
const usedCategories = new Set(
    placesData.features.map(f => f.properties.placeList)
);

describe('placeEmojis — dead key detection', () => {

    it.each(Object.keys(placeEmojis))(
        'emoji key "%s" is used by at least one place feature',
        (emojiKey) => {
            expect(
                usedCategories.has(emojiKey),
                `"${emojiKey}" (→ ${placeEmojis[emojiKey]}) exists in placeEmojis but no place has this placeList value`
            ).toBe(true);
        }
    );

});

describe('placeEmojis — informational coverage log', () => {

    it('logs placeList values with no emoji (informational only — not a failure)', () => {
        const emojiKeys = new Set(Object.keys(placeEmojis));
        const noEmoji = [...usedCategories].filter(cat => !emojiKeys.has(cat));

        // Sort for readable output. This console.log is intentional — the owner
        // can scan it to decide if any category *should* have an emoji.
        if (noEmoji.length > 0) {
            console.log(
                '\n[placeEmojis] Categories using the 📍 fallback (no emoji assigned):',
                noEmoji.sort().join(', ')
            );
        }

        // Not a failing assertion — just logging. The test always passes.
        expect(true).toBe(true);
    });

});
