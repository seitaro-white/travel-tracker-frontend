import { describe, expect, it } from 'vitest';
import { createMarkerDropDelays } from '../src/features/markers/markerDrop';

describe('createMarkerDropDelays', () => {
    it.each([0, 1, 2, 3, 20, 40, 188, 1000])('spaces %i arrivals evenly from 0 to 1.5s', count => {
        const spacing = 1.5 / Math.max(count - 1, 1);
        const sorted = createMarkerDropDelays(count).sort((a, b) => a - b);
        expect(sorted).toHaveLength(count);
        sorted.forEach((delay, index) => {
            expect(delay).toBeCloseTo(index * spacing, 12);
        });
    });
});
