import { expect, it } from 'vitest';
import { createMarkerDropDelays } from '../src/features/markers/markerDrop';

it.each([
    [0, []],
    [1, [0]],
    [4, [0, 0.5, 1, 1.5]],
] as const)('%i markers receive delays across the 1.5-second arrival window', (count, expected) => {
    // Assignment order is random; the schedule is not. Concrete examples avoid
    // reproducing the implementation's spacing formula in the expected result.
    expect(createMarkerDropDelays(count).sort((a, b) => a - b)).toEqual(expected);
});
