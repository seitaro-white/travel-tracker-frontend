// The favourite-photo carousel: a pile of mini polaroids in the map's corner.
//
// Sweeping the pile is browsing and leaves the map alone; tapping the top card
// commits, flying the map to that photo's location while the full-size polaroid
// blow-up rises over it.
//
// Only four card elements ever exist. `byDepth` holds them in pile order (index
// 0 is the top card), and cycling rotates that array and repaints whichever card
// ends up at the back — so a 47-photo pile costs the same DOM as a 4-photo one.

import { loadFavouritePhotos } from './favouritePhotos.js';
import { showAnimatedPolaroid } from '../overlays/polaroidOverlay.js';

// The top card plus three peeking edges behind it.
const CARD_COUNT = 4;
// Must match the animation duration in carousel.css.
const CYCLE_MS = 420;
// How far across the card a drag must travel to commit, as a fraction of its width.
const DRAG_COMMIT_RATIO = 0.25;
// Pointer movement under this many pixels counts as a tap rather than a sweep.
const TAP_SLOP_PX = 8;
// Town/district level: close enough to place the photo, wide enough for context.
const FLY_ZOOM = 13;
const FLY_SECONDS = 1.2;

/** Builds one mini polaroid. A <button> so it is focusable and clickable for free. */
function buildCard() {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'polaroid-mini';

    // The square window that crops the photo. Wrapping the image lets the frame
    // hold its shape while the photo is still loading.
    const frame = document.createElement('span');
    frame.className = 'polaroid-mini-window';
    frame.appendChild(document.createElement('img'));

    card.appendChild(frame);
    return card;
}

/** Builds one control button in the row beneath the pile. */
function buildButton(glyph, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'polaroid-stack-button';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    return button;
}

/**
 * Loads the favourites, builds the pile, and slides it onto the page.
 *
 * @param {L.Map} map - The Leaflet map to fly when a photo is selected.
 * @returns {Promise<HTMLElement>} The mounted stack container.
 */
export async function showPolaroidStack(map) {
    const favourites = await loadFavouritePhotos();
    // Nothing is flagged as a favourite, so there is no pile to build. This is
    // an empty list rather than a failure — it's what an unflagged
    // photos.geojson produces — so we leave the map alone and say nothing.
    if (favourites.length === 0) {
        return null;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Build the DOM ----------------------------------------------------

    const container = document.createElement('div');
    // Mounts parked off-screen so it can slide in; see the reveal at the bottom.
    container.className = 'polaroid-stack is-hidden';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Favourite photos');

    // The slider carries the sideways slide (expanded / collapsed / off-screen),
    // kept separate from the container so it never has to compose with the
    // vertical centring the mobile breakpoint puts on the container.
    const slider = document.createElement('div');
    slider.className = 'polaroid-stack-slider';

    const cardsElement = document.createElement('div');
    cardsElement.className = 'polaroid-stack-cards';

    const byDepth = [];
    for (let i = 0; i < CARD_COUNT; i++) {
        const card = buildCard();
        byDepth.push(card);
        cardsElement.appendChild(card);
    }

    // The drawer handle rides on the pile's right edge rather than sitting in the
    // row below, because that edge is the part of the pile still on screen once
    // it has slid away — so the control that brings it back is never lost with it.
    const handle = buildButton('‹', 'Hide photos');
    handle.classList.add('polaroid-stack-handle');
    cardsElement.appendChild(handle);

    const bar = document.createElement('div');
    bar.className = 'polaroid-stack-bar';
    const previousButton = buildButton('‹', 'Previous photo');
    const nextButton = buildButton('›', 'Next photo');
    bar.append(previousButton, nextButton);

    slider.append(cardsElement, bar);
    container.appendChild(slider);
    document.body.appendChild(container);

    // Keep drags, clicks and wheel gestures on the pile away from the map
    // underneath, or dragging a card would pan Japan around behind it.
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    // Leaflet's own handlers listen on pointerdown too, which
    // disableClickPropagation does not cover. Our listeners sit on descendants,
    // so they still run before this stops the event climbing to the map.
    L.DomEvent.on(container, 'pointerdown', L.DomEvent.stopPropagation);

    // --- State ------------------------------------------------------------

    // Index into `favourites` of the photo currently on top of the pile.
    let topIndex = 0;
    // True while a cycle animation is playing, so cycles cannot overlap.
    let animating = false;
    // The in-progress drag, or null.
    let drag = null;
    // Set when a drag has moved far enough that the click it produces should
    // not also be read as a tap.
    let suppressClick = false;

    /** The photo that belongs at the given pile depth. */
    function featureAt(depth) {
        return favourites[(topIndex + depth) % favourites.length];
    }

    /** Points a card at a photo. */
    function paint(card, feature) {
        card._feature = feature;
        const image = card.querySelector('img');
        image.src = `assets/photos/display/${feature.properties.filename}.jpg`;
        image.alt = feature.properties.description || 'A favourite photo from the trip';
    }

    /** Writes each card's current pile depth, which is what positions it in CSS. */
    function applyDepths() {
        byDepth.forEach((card, depth) => {
            card.dataset.depth = String(depth);
            // Only the top card is reachable by keyboard or exposed to a
            // screen reader; the rest are just white edges.
            card.tabIndex = depth === 0 ? 0 : -1;
            card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
        });
    }

    /**
     * Runs `mutate` with the card's transitions and animations switched off, so
     * it can be moved or repainted without the change being animated. Reading
     * offsetWidth in between forces the browser to apply the change while
     * motion is still suppressed. This is how the card that just flew off the
     * front gets planted at the back of the pile unseen.
     */
    function withoutMotion(card, mutate) {
        card.classList.add('is-instant');
        mutate();
        void card.offsetWidth;
        card.classList.remove('is-instant');
    }

    // --- Cycling ----------------------------------------------------------

    /** Flicks the top card away and brings the next photo forward. */
    function goNext() {
        if (animating) return;
        animating = true;

        // Rotate the pile: the top card goes to the back.
        const leaving = byDepth.shift();
        byDepth.push(leaving);
        topIndex = (topIndex + 1) % favourites.length;
        applyDepths();

        const settle = () => {
            // Plant the card at the back of the pile showing its new photo,
            // without animating the trip there.
            withoutMotion(leaving, () => {
                leaving.classList.remove('is-leaving');
                leaving.style.removeProperty('--pm-drag');
                paint(leaving, featureAt(CARD_COUNT - 1));
            });
            animating = false;
        };

        if (reduceMotion) {
            settle();
            return;
        }
        // The keyframe starts from --pm-drag, so a flick continues into the
        // throw instead of snapping back to centre first.
        leaving.classList.add('is-leaving');
        setTimeout(settle, CYCLE_MS);
    }

    /** Sweeps the previous photo back in from the left, on top of the pile. */
    function goPrevious() {
        if (animating) return;
        animating = true;

        // Rotate the pile the other way: the back card returns to the top.
        const arriving = byDepth.pop();
        byDepth.unshift(arriving);
        topIndex = (topIndex - 1 + favourites.length) % favourites.length;

        // It has to show its photo before it sweeps into view.
        paint(arriving, featureAt(0));
        applyDepths();

        // The card that was on top only steps back to depth 1, which its normal
        // transition handles. Clearing any drag offset here lets it travel from
        // where the finger left it rather than jumping.
        const demoted = byDepth[1];
        demoted.classList.remove('is-dragging');
        demoted.style.removeProperty('--pm-drag');

        const settle = () => {
            arriving.classList.remove('is-entering');
            animating = false;
        };

        if (reduceMotion) {
            settle();
            return;
        }
        arriving.classList.add('is-entering');
        setTimeout(settle, CYCLE_MS);
    }

    // --- Selecting --------------------------------------------------------

    /**
     * Commits to the photo on top: the map flies to it while the blow-up rises.
     * Both start together — the blow-up's backdrop is a 40% scrim rather than an
     * opaque cover, so the flight stays visible through it.
     */
    function selectTop() {
        const feature = byDepth[0]._feature;
        // GeoJSON coordinates are [lng, lat, altitude]; Leaflet wants [lat, lng].
        const [longitude, latitude] = feature.geometry.coordinates;

        if (reduceMotion) {
            map.setView([latitude, longitude], FLY_ZOOM, { animate: false });
        } else {
            map.flyTo([latitude, longitude], FLY_ZOOM, { duration: FLY_SECONDS });
        }
        showAnimatedPolaroid(feature);
    }

    // --- Collapsing -------------------------------------------------------

    function setCollapsed(collapsed) {
        container.classList.toggle('is-collapsed', collapsed);
        // The chevron points the way the pile will travel if you press it.
        handle.textContent = collapsed ? '›' : '‹';
        handle.setAttribute('aria-label', collapsed ? 'Show photos' : 'Hide photos');
        handle.setAttribute('aria-expanded', String(!collapsed));
    }

    // --- Input ------------------------------------------------------------

    cardsElement.addEventListener('pointerdown', (event) => {
        if (animating || container.classList.contains('is-collapsed')) return;
        // Cards behind the top one are pointer-events: none, so any card that
        // receives this is the top one — but check, since the padding around
        // the pile belongs to cardsElement itself.
        const card = event.target.closest('.polaroid-mini');
        if (card !== byDepth[0]) return;

        drag = { startX: event.clientX, dx: 0, card };
        card.classList.add('is-dragging');
        // Capture so the card keeps receiving moves even if the pointer strays
        // off it mid-drag.
        card.setPointerCapture(event.pointerId);
    });

    cardsElement.addEventListener('pointermove', (event) => {
        if (!drag) return;
        drag.dx = event.clientX - drag.startX;
        // CSS folds this into the top card's transform, so we never have to
        // rebuild (and duplicate) the card's rotation here.
        drag.card.style.setProperty('--pm-drag', `${drag.dx}px`);
    });

    function endDrag() {
        if (!drag) return;
        const { card, dx } = drag;
        drag = null;
        card.classList.remove('is-dragging');

        const distance = Math.abs(dx);
        // A tap: leave it alone and let the click that follows select the photo.
        if (distance < TAP_SLOP_PX) {
            card.style.removeProperty('--pm-drag');
            return;
        }

        // Anything past the slop was a sweep, so the click it produces is not a tap.
        suppressClick = true;

        if (distance >= card.offsetWidth * DRAG_COMMIT_RATIO) {
            // Committed. goNext reads --pm-drag to start the throw from here,
            // and both directions clear it once they settle.
            if (dx < 0) goNext(); else goPrevious();
            return;
        }

        // Short of the threshold: the transition springs it back.
        card.style.removeProperty('--pm-drag');
    }

    cardsElement.addEventListener('pointerup', endDrag);
    cardsElement.addEventListener('pointercancel', endDrag);

    cardsElement.addEventListener('click', (event) => {
        // Collapsed, the controls have travelled off-screen with the pile, so
        // the visible sliver of card edges is what brings it back.
        if (container.classList.contains('is-collapsed')) {
            setCollapsed(false);
            return;
        }
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        if (animating) return;
        const card = event.target.closest('.polaroid-mini');
        if (card !== byDepth[0]) return;
        selectTop();
    });

    previousButton.addEventListener('click', goPrevious);
    nextButton.addEventListener('click', goNext);
    handle.addEventListener('click', (event) => {
        // The handle sits inside cardsElement, whose own click handler also
        // expands a collapsed pile — without this the two would cancel out.
        event.stopPropagation();
        setCollapsed(!container.classList.contains('is-collapsed'));
    });

    // --- Reveal -----------------------------------------------------------

    byDepth.forEach((card, depth) => paint(card, featureAt(depth)));
    applyDepths();
    setCollapsed(false);

    // Double rAF so the browser has laid the pile out at its off-screen start
    // position before we ask it to slide in; otherwise the transition has
    // nothing to animate from. (The same trick openOverlay uses to fade in.)
    requestAnimationFrame(() => requestAnimationFrame(() => {
        container.classList.remove('is-hidden');
    }));

    return container;
}
