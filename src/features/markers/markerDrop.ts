const STAGGER_SECONDS = 1.5;

/** Returns one shuffled delay per marker, in seconds, across the intro window. */
export function createMarkerDropDelays(count: number): number[] {
    // Keep the endpoints at 0 and 1.5s so the window doesn't grow with the
    // marker count. A lone marker starts immediately; an empty set stays empty.
    const spacing = STAGGER_SECONDS / Math.max(count - 1, 1);
    const delays = Array.from({ length: count }, (_, index) => {
        // Set endpoints explicitly: multiplying spacing back up can round
        // slightly past 1.5s for some counts.
        if (index === 0) return 0;
        if (index === count - 1) return STAGGER_SECONDS;

        // Jitter only the interior slots, by at most 20% of one interval.
        // Neighbouring delays therefore stay 60–140% of an interval apart:
        // irregular enough to feel natural, without bursts or long dead gaps.
        const jitter = (Math.random() - 0.5) * 0.4 * spacing;
        return index * spacing + jitter;
    });

    // Fisher–Yates gives every ordering an equal chance. Shuffling the delays
    // removes any connection to DOM order, marker type or screen position.
    for (let index = delays.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [delays[index], delays[other]] = [delays[other], delays[index]];
    }
    return delays;
}

/**
 * Assign delays synchronously just after mounting, before the next paint.
 * `markers-dropping` scopes the CSS animation to this initial arrival; only
 * inner content is animated, leaving Leaflet's positioning transforms alone.
 */
export function staggerMarkerDrop() {
    const elements = document.querySelectorAll<HTMLElement>(
        '.markers-dropping .custom-cluster-stack, ' +
        '.markers-dropping .place-marker, ' +
        '.markers-dropping .info-marker-icon, ' +
        '.markers-dropping .photo-marker-image'
    );
    // One query and one schedule mix clusters, photos, places and info rather
    // than giving each category its own burst at the start of the window.
    const delays = createMarkerDropDelays(elements.length);
    elements.forEach((element, index) => {
        element.style.animationDelay = `${delays[index]}s`;
    });
}
