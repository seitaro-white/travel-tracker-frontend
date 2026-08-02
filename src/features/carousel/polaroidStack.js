// The favourite-photo carousel: a pile of mini polaroids in the map's corner.
//
// Sweeping the pile is browsing and leaves the map alone; tapping the top card
// commits, flying the map to that photo's location while the full-size polaroid
// blow-up rises over it.
//
// Only four card elements ever exist. `byDepth` holds them in pile order (index
// 0 is the top card), and cycling rotates that array and repaints whichever card
// ends up at the back — so a 47-photo pile costs the same DOM as a 4-photo one.
//
// The pile is put away differently on the two screen sizes, but it is the same
// state machine: `is-collapsed` means "put away", and only the CSS for it
// differs. On a desktop that is the drawer — the pile slides off the left edge
// leaving its handle behind. On a phone it is a small resting pile in the
// bottom-left corner, and "open" is a bottom sheet the pile grows into, where
// the photos get more room than the old centred pile ever gave them. Nothing
// leaves the screen there, which is why the phone needs no handle to find it
// with, and why the pile never needs repositioning.

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
// How far a drag has to travel to pull an incoming card all the way home, as a
// fraction of card width. Matches the distance the leaving card covers in the
// polaroid-mini-leave keyframe, so going back retraces going forward.
const ENTRY_TRAVEL_RATIO = 0.46;
// Where an incoming card waits before it is pulled in: off to the left, tilted
// and slightly shrunk. Must agree with the end of polaroid-mini-leave, since
// this is the same resting place a flicked card was thrown to.
const ENTRY_START = { x: -46, y: 10, rotate: -9, scale: 0.9 };
// Where it lands: the resting look of a depth-0 card (see carousel.css).
const ENTRY_END = { x: 0, y: 0, rotate: 1.5, scale: 1 };
// How much of the journey an incoming card spends fading up. Kept short on
// purpose: a print is an opaque object, so a card still half transparent halfway
// in reads as a crossfade rather than something being pulled into place. It only
// fades over the first stretch, where it is mostly off-screen anyway.
const ENTRY_FADE_RATIO = 0.3;
// Town/district level: close enough to place the photo, wide enough for context.
const FLY_ZOOM = 13;
const FLY_SECONDS = 1.2;
// Must match the mobile breakpoint in carousel.css, which is where the pile
// stops being a corner drawer and becomes a bottom sheet.
const MOBILE_BREAKPOINT_PX = 700;
// How far down the sheet must be dragged to dismiss it, as a fraction of its
// own height. Same idea as DRAG_COMMIT_RATIO, on the other axis.
const SHEET_DISMISS_RATIO = 0.25;
// Every full-screen overlay openOverlay can put up (the polaroid blow-up, and
// the info/intro panels). Kept as one selector because the pile treats them
// alike: while any of them is on screen, a tap elsewhere belongs to it.
const OVERLAY_WRAPPERS = '.polaroid-animated-wrapper-overlay, .overlay-panel-overlay';

/** Builds one mini polaroid. A <button> so it is focusable and clickable for free. */
function buildCard() {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'polaroid-mini';

    // The square window that crops the photo. Wrapping the image lets the frame
    // hold its shape while the photo is still loading.
    const frame = document.createElement('span');
    frame.className = 'polaroid-mini-window';

    const image = document.createElement('img');
    // Without this, pressing and moving on the photo starts Chromium's native
    // image drag-and-drop, which fires pointercancel and kills the swipe one
    // frame in. Touch devices are spared it by touch-action: none, so the bug
    // only shows up with a mouse.
    image.draggable = false;
    frame.appendChild(image);

    card.appendChild(frame);
    return card;
}

/** Builds one of the pile's controls. */
function buildButton(className, glyph, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    return button;
}

/**
 * The transform for an incoming card partway through being pulled in, where
 * progress 0 is waiting off to the left and 1 is landed on top of the pile.
 *
 * Interpolated in script rather than by a CSS animation because a drag needs to
 * scrub this back and forth under the finger, which keyframes can't do.
 */
function entryTransform(progress) {
    const at = (from, to) => from + (to - from) * progress;
    return `translate(${at(ENTRY_START.x, ENTRY_END.x)}%, ${at(ENTRY_START.y, ENTRY_END.y)}%)`
        + ` rotate(${at(ENTRY_START.rotate, ENTRY_END.rotate)}deg)`
        + ` scale(${at(ENTRY_START.scale, ENTRY_END.scale)})`;
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

    // The sheet's own surface — the paper the pile sits on once it's open, and
    // the thing that slides down out of sight when it isn't. Phone-only:
    // display: none on wider screens, where the drawer is the idiom instead.
    // Built first so the cards, as a later sibling, paint on top of it.
    const surface = document.createElement('div');
    surface.className = 'polaroid-stack-surface';
    // The universal "drag me" affordance, and a tap target for closing. Not a
    // <button> because the sheet drag lives on the surface and this sits inside
    // it — a nested button would only complicate what a tap means.
    const grabber = document.createElement('div');
    grabber.className = 'polaroid-stack-grabber';
    grabber.setAttribute('role', 'button');
    grabber.setAttribute('aria-label', 'Hide photos');
    surface.appendChild(grabber);

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
    const handle = buildButton('polaroid-stack-handle', '‹', 'Hide photos');
    cardsElement.appendChild(handle);

    const bar = document.createElement('div');
    bar.className = 'polaroid-stack-bar';
    const previousButton = buildButton('polaroid-stack-step', '‹', 'Previous photo');
    const nextButton = buildButton('polaroid-stack-step', '›', 'Next photo');
    bar.append(previousButton, nextButton);

    slider.append(surface, cardsElement, bar);
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
    // True while a cycle is playing, so cycles cannot overlap. Mirrored onto the
    // container as a class: the individual card classes come and go partway
    // through a cycle, so they are not a reliable "is the pile busy" signal for
    // anything outside this module (the E2E spec waits on this).
    let animating = false;
    const setAnimating = (value) => {
        animating = value;
        container.classList.toggle('is-cycling', value);
    };
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
        image.src = `assets/photos/display/${feature.properties.filename}.webp`;
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
        setAnimating(true);

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
            setAnimating(false);
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

    /**
     * Lifts the card at the back of the pile out and parks it off to the left,
     * showing the previous photo, ready to be pulled in. Returns it.
     *
     * Reusing the back card is what keeps going back cheap: the pile's data
     * model rotates by one, so only this one card needs a new photo. It is 95%
     * hidden behind three others, so borrowing it costs nothing visually.
     */
    function liftIncoming() {
        const incoming = byDepth[CARD_COUNT - 1];
        const previous = favourites[(topIndex - 1 + favourites.length) % favourites.length];
        paint(incoming, previous);
        // Placed without animating, so it doesn't visibly fly out to its
        // waiting position before the pull-in even starts.
        withoutMotion(incoming, () => {
            incoming.classList.add('is-incoming');
            incoming.style.transform = entryTransform(0);
            incoming.style.opacity = '0';
        });
        return incoming;
    }

    /** Moves a lifted card to `progress` (0 = waiting off-left, 1 = landed). */
    function scrubIncoming(incoming, progress) {
        incoming.style.transform = entryTransform(progress);
        incoming.style.opacity = String(Math.min(progress / ENTRY_FADE_RATIO, 1));
    }

    /** Strips the temporary entry styling, leaving the card to its depth rule. */
    function releaseIncoming(incoming) {
        incoming.classList.remove('is-incoming');
        incoming.style.removeProperty('transform');
        incoming.style.removeProperty('opacity');
    }

    /**
     * Completes a step backwards: the lifted card travels the rest of the way in
     * and becomes the top of the pile. Clearing its inline transform is what
     * animates it home — the depth-0 rule supplies the destination, so there is
     * no second copy of the resting transform to keep in sync.
     */
    function commitPrevious(incoming) {
        setAnimating(true);

        byDepth.pop();
        byDepth.unshift(incoming);
        topIndex = (topIndex - 1 + favourites.length) % favourites.length;
        applyDepths();

        // The card that was on top just steps back to depth 1, which its own
        // transition handles.
        releaseIncoming(incoming);

        setTimeout(() => setAnimating(false), reduceMotion ? 0 : CYCLE_MS);
    }

    /**
     * Abandons a step backwards: the lifted card slides out to the left again
     * and then quietly rejoins the back of the pile with its original photo.
     */
    function cancelPrevious(incoming) {
        setAnimating(true);
        scrubIncoming(incoming, 0);

        setTimeout(() => {
            withoutMotion(incoming, () => {
                releaseIncoming(incoming);
                paint(incoming, featureAt(CARD_COUNT - 1));
            });
            setAnimating(false);
        }, reduceMotion ? 0 : CYCLE_MS);
    }

    /** Pulls the previous photo in from the left, on top of the pile. */
    function goPrevious() {
        if (animating) return;
        commitPrevious(liftIncoming());
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

        // flyTo does NOT respect the map's maxZoom, unlike setZoom — so without
        // this the carousel would fly straight through whatever ceiling the map
        // sets and land somewhere the basemap can't follow.
        const zoom = Math.min(FLY_ZOOM, map.getMaxZoom());

        if (reduceMotion) {
            map.setView([latitude, longitude], zoom, { animate: false });
        } else {
            map.flyTo([latitude, longitude], zoom, { duration: FLY_SECONDS });
        }
        showAnimatedPolaroid(feature);
    }

    // --- Collapsing -------------------------------------------------------

    // Read live rather than captured at mount, so a rotation or a resized
    // window switches idioms with the CSS rather than drifting out of step
    // with it.
    const isPhone = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

    function setCollapsed(collapsed) {
        container.classList.toggle('is-collapsed', collapsed);
        // The chevron points the way the pile will travel if you press it.
        handle.textContent = collapsed ? '›' : '‹';
        handle.setAttribute('aria-label', collapsed ? 'Show photos' : 'Hide photos');
        handle.setAttribute('aria-expanded', String(!collapsed));
    }

    // Touching the map — or anything else that isn't the pile — puts the pile
    // away. On a phone the expanded pile sits in the middle of the screen, so
    // reaching for the map is itself the signal that you're done with it, and
    // hunting for the handle first is a step too many.
    //
    // Phone only: on a desktop the pile is a small object in a corner
    // obstructing nothing, so collapsing it every time you clicked a marker
    // would be taking it away from someone who never asked.
    //
    // Capture phase, because the map and the overlays stop pointerdown
    // propagating; this has to see the event before they swallow it. That makes
    // the contains() check load-bearing rather than belt-and-braces: it is now
    // the only thing keeping a tap on the pile from collapsing it.
    document.addEventListener('pointerdown', (event) => {
        if (!isPhone.matches) return;
        if (container.classList.contains('is-collapsed')) return;
        if (container.contains(event.target)) return;
        // An overlay is up, so this tap is aimed at the overlay — dismissing the
        // blow-up you just opened from the pile, most likely. Only a tap that
        // reaches the map itself means "I'm done with the photos". Checking for
        // the overlay rather than tracking our own blow-up covers info cards
        // opened from markers too, which want the same treatment.
        if (document.querySelector(OVERLAY_WRAPPERS)) return;
        setCollapsed(true);
    }, true);

    // --- The sheet drag ---------------------------------------------------

    // Dragging the sheet down puts it away. The listeners are on the surface
    // rather than the grabber alone, so the whole paper is draggable and the
    // grabber is just the part that says so. The cards and the button row are
    // siblings of the surface, not children, so a swipe that starts on a photo
    // never reaches here — the two gestures can't collide.
    let sheetDrag = null;

    surface.addEventListener('pointerdown', (event) => {
        if (container.classList.contains('is-collapsed')) return;
        // Whether this started on the grabber has to be settled now: the
        // capture below retargets every later event in the gesture to the
        // surface, so pointerup can no longer tell where the finger went down.
        sheetDrag = {
            startY: event.clientY,
            dy: 0,
            fromGrabber: !!event.target.closest('.polaroid-stack-grabber'),
        };
        container.classList.add('is-sheet-dragging');
        surface.setPointerCapture(event.pointerId);
    });

    surface.addEventListener('pointermove', (event) => {
        if (!sheetDrag) return;
        // Downward only. There is nothing above the sheet to reveal, and letting
        // it be pulled up would just tear it off the bottom of the screen.
        sheetDrag.dy = Math.max(event.clientY - sheetDrag.startY, 0);
        container.style.setProperty('--pm-sheet-drag', `${sheetDrag.dy}px`);
    });

    function endSheetDrag() {
        if (!sheetDrag) return;
        const { dy, fromGrabber } = sheetDrag;
        sheetDrag = null;
        container.classList.remove('is-sheet-dragging');
        // Clearing this returns the open state's target to 0, so a sheet let go
        // short of the threshold eases back up. If we collapse instead, the
        // collapsed rule doesn't mention the variable at all — the transform
        // animates from wherever the finger left it straight down to 100%, so
        // the dismissal continues the gesture rather than restarting it.
        container.style.removeProperty('--pm-sheet-drag');

        if (dy >= surface.offsetHeight * SHEET_DISMISS_RATIO) {
            setCollapsed(true);
            return;
        }
        // Not a drag at all, and it started on the grabber: treat it as the tap
        // that the grabber's shape is inviting.
        if (dy < TAP_SLOP_PX && fromGrabber) {
            setCollapsed(true);
        }
    }

    surface.addEventListener('pointerup', endSheetDrag);
    surface.addEventListener('pointercancel', endSheetDrag);

    // --- Input ------------------------------------------------------------

    cardsElement.addEventListener('pointerdown', (event) => {
        if (animating || container.classList.contains('is-collapsed')) return;
        // Cards behind the top one are pointer-events: none, so any card that
        // receives this is the top one — but check, since the padding around
        // the pile belongs to cardsElement itself.
        const card = event.target.closest('.polaroid-mini');
        if (card !== byDepth[0]) return;

        // `mode` is decided on the first real movement, not here, because which
        // card moves depends on which way the finger goes. `incoming` is only
        // populated in 'back' mode.
        drag = { startX: event.clientX, dx: 0, card, mode: null, incoming: null };
        // Capture so the card keeps receiving moves even if the pointer strays
        // off it mid-drag.
        card.setPointerCapture(event.pointerId);
    });

    cardsElement.addEventListener('pointermove', (event) => {
        if (!drag) return;
        drag.dx = event.clientX - drag.startX;

        // Decide the direction once, on the first movement past the tap slop, and
        // stick to it for the rest of the gesture.
        if (drag.mode === null) {
            if (Math.abs(drag.dx) < TAP_SLOP_PX) return;
            if (drag.dx < 0) {
                // Forward: the finger is on the card being thrown away, so that
                // card is what moves.
                drag.mode = 'forward';
                drag.card.classList.add('is-dragging');
            } else {
                // Back: the top card stays put. What moves is the photo you
                // flicked away last time, pulled back in from the left — so the
                // thing travelling under your finger is the one arriving, not
                // the one you happen to be touching.
                drag.mode = 'back';
                drag.incoming = liftIncoming();
                drag.incoming.classList.add('is-dragging');
            }
        }

        if (drag.mode === 'forward') {
            // CSS folds this into the top card's transform, so we never have to
            // rebuild (and duplicate) the card's rotation here.
            drag.card.style.setProperty('--pm-drag', `${drag.dx}px`);
            return;
        }

        // Map the drag onto the incoming card's journey, clamped so pulling past
        // home doesn't overshoot and reversing past the start doesn't invert it.
        const travel = drag.card.offsetWidth * ENTRY_TRAVEL_RATIO;
        scrubIncoming(drag.incoming, Math.min(Math.max(drag.dx / travel, 0), 1));
    });

    function endDrag() {
        if (!drag) return;
        const { card, dx, mode, incoming } = drag;
        drag = null;

        // Never moved past the slop, so no mode was ever chosen: this was a tap,
        // and the click that follows will select the photo.
        if (mode === null) return;

        // A sweep, so the click it produces is not a tap.
        suppressClick = true;
        const committed = Math.abs(dx) >= card.offsetWidth * DRAG_COMMIT_RATIO;

        if (mode === 'back') {
            incoming.classList.remove('is-dragging');
            // Either way the card keeps moving the way the finger was going:
            // onward to the top, or back out to where it came from.
            if (committed) commitPrevious(incoming); else cancelPrevious(incoming);
            return;
        }

        card.classList.remove('is-dragging');
        if (committed) {
            // goNext reads --pm-drag so the throw continues from here, and clears
            // it once the card has settled at the back of the pile.
            goNext();
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
    // A phone arrives at rest: the small corner pile is the invitation, and
    // throwing a half-screen sheet over the map the moment the intro closes
    // would be answering a question nobody asked yet. A desktop arrives open,
    // as it always has — the corner pile obstructs nothing there.
    setCollapsed(isPhone.matches);

    // Double rAF so the browser has laid the pile out at its off-screen start
    // position before we ask it to slide in; otherwise the transition has
    // nothing to animate from. (The same trick openOverlay uses to fade in.)
    requestAnimationFrame(() => requestAnimationFrame(() => {
        container.classList.remove('is-hidden');
    }));

    return container;
}
