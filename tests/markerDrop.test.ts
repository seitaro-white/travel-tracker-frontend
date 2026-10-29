import { describe, expect, it } from 'vitest';
import { createMarkerDropDelays } from '../src/features/markers/markerDrop';

describe('createMarkerDropDelays', () => {
    it.each([0, 1, 2, 3, 20, 188, 1000])('keeps all %i delays inside the 1.5s window', count => {
        // Exercise fresh random schedules, not a seeded order. Include empty
        // and single-marker mounts as well as sparse and crowded views.
        for (let run = 0; run < 10; run++) {
            const delays = createMarkerDropDelays(count);
            expect(delays).toHaveLength(count);
            expect(delays.every(delay => delay >= 0 && delay <= 1.5)).toBe(true);
        }
    });

    it('starts a lone marker immediately', () => {
        expect(createMarkerDropDelays(1)).toEqual([0]);
    });

    it.each([2, 3, 20, 188, 1000])('spreads %i arrivals evenly with bounded jitter', count => {
        const spacing = 1.5 / (count - 1);
        // Allow only floating-point rounding at the spacing boundaries, not
        // extra jitter. Sorting ignores which marker won each shuffled slot.
        const rounding = 1e-12;
        for (let run = 0; run < 10; run++) {
            const sorted = createMarkerDropDelays(count).sort((a, b) => a - b);
            expect(sorted[0]).toBe(0);
            expect(sorted[count - 1]).toBe(1.5);
            expect(sorted.every((delay, index) =>
                Math.abs(delay - index * spacing) <= 0.2 * spacing + rounding
            )).toBe(true);
            expect(sorted.slice(1).every((delay, index) => {
                const gap = delay - sorted[index];
                return gap >= 0.6 * spacing - rounding && gap <= 1.4 * spacing + rounding;
            })).toBe(true);
        }
    });
});
