const LANDING_MS = 700;
const LANDING_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/** Moves the welcome print onto a mini polaroid, matching its actual frame. */
export async function landIntroCard(card: HTMLButtonElement, target: HTMLButtonElement) {
    const front = card.querySelector<HTMLElement>('.intro-card-front')!;
    const sourceRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const sourceStyle = getComputedStyle(front);
    const targetStyle = getComputedStyle(target);
    const sourceTransform = new DOMMatrix(getComputedStyle(card).transform);
    const targetTransform = new DOMMatrix(targetStyle.transform);

    // Bounding boxes include rotation; offsetWidth/Height do not. Recover the
    // ancestor scale from the rotated target width so this also lands precisely
    // on the phone's small resting pile (scaled by its parent, not the card).
    const targetScale = targetRect.width / (
        Math.abs(targetTransform.a) * target.offsetWidth
        + Math.abs(targetTransform.c) * target.offsetHeight
    );
    const targetWidth = target.offsetWidth * targetScale;
    const targetHeight = target.offsetHeight * targetScale;
    const angle = (matrix: DOMMatrix) => Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;

    // Clone only the front, not the button or its 3D flip. Moving this copy
    // outside the modal also avoids clipping at a scrolled landscape viewport.
    const flight = front.cloneNode(true) as HTMLElement;
    flight.className = 'intro-card-flight';
    flight.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flight);
    card.style.visibility = 'hidden';

    const animation = flight.animate([
        {
            left: `${sourceRect.x + sourceRect.width / 2 - card.offsetWidth / 2}px`,
            top: `${sourceRect.y + sourceRect.height / 2 - card.offsetHeight / 2}px`,
            width: `${card.offsetWidth}px`,
            height: `${card.offsetHeight}px`,
            padding: sourceStyle.padding,
            borderWidth: sourceStyle.borderTopWidth,
            transform: `rotate(${angle(sourceTransform)}deg)`,
        },
        {
            left: `${targetRect.x + targetRect.width / 2 - targetWidth / 2}px`,
            top: `${targetRect.y + targetRect.height / 2 - targetHeight / 2}px`,
            width: `${targetWidth}px`,
            height: `${targetHeight}px`,
            padding: [targetStyle.paddingTop, targetStyle.paddingRight, targetStyle.paddingBottom, targetStyle.paddingLeft]
                .map(value => `${parseFloat(value) * targetScale}px`).join(' '),
            borderWidth: `${parseFloat(targetStyle.borderTopWidth) * targetScale}px`,
            transform: `rotate(${angle(targetTransform)}deg)`,
        },
    ], { duration: LANDING_MS, easing: LANDING_EASE, fill: 'forwards' });

    // The welcome writing recedes as the long chin becomes the pile's shorter
    // frame. Animate frame dimensions rather than scaleX/scaleY, which would
    // squash the square photo during the hand-off.
    flight.querySelector<HTMLElement>('.intro-card-chin')!.animate([
        { opacity: 1 },
        { opacity: 0, offset: 0.3 },
        { opacity: 0 },
    ], { duration: LANDING_MS, fill: 'forwards' });

    await animation.finished;
    flight.remove();
}
