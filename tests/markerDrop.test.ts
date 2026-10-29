import { describe, expect, it } from 'vitest';
import { createMarkerDropDelays } from '../src/features/markers/markerDrop';

describe('createMarkerDropDelays', () => {
    it.each([0, 1, 2, 3, 20, 40, 188, 1000])('keeps all %i delays inside the 1.5s window', count => {
        const delays = createMarkerDropDelays(count);
        const tolerance = 1e-12;
        expect(delays).toHaveLength(count);
        expect(delays.every(delay => delay >= -tolerance && delay <= 1.5 + tolerance)).toBe(true);
    });

    it.each([0, 1, 2, 3, 20, 40, 188, 1000])('spaces %i arrivals evenly from 0 to 1.5s', count => {
        const spacing = 1.5 / Math.max(count - 1, 1);
        const sorted = createMarkerDropDelays(count).sort((a, b) => a - b);
        sorted.forEach((delay, index) => {
            expect(delay).toBeCloseTo(index * spacing, 12);
        });
    });
});
