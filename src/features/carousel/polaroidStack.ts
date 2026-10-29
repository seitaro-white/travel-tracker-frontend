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

import L from '../../lib/leaflet';
import type { FavouritePhoto } from '../../types/geojson';
import { loadCarouselPhotos } from './favouritePhotos';
import { showAnimatedPolaroid } from '../overlays/polaroidOverlay';
import { landIntroCard } from '../overlays/introLanding';

interface Lie {
    x: number;
    y: number;
    tilt: number;
}
type Card = HTMLButtonElement & { _feature?: FavouritePhoto; _lie: Lie };
interface Incoming {
    card: Card;
    originalLie: Lie;
    destination: Lie;
    turnaround: Lie;
    progress: number;
    slipping: boolean;
    onSlipped?: () => void;
}
interface CardDrag {
    startX: number;
    dx: number;
    card: Card;
    mode: 'forward' | 'back' | null;
    incoming: Incoming | null;
}
interface SheetDrag {
    startY: number;
    dy: number;
    fromGrabber: boolean;
}

// The top card plus three peeking edges behind it.
const CARD_COUNT = 4;
const SEND_MS = 500;
const TURNAROUND_RATIO = 0.65;
// The forward print must clear the pile before dropping underneath, or the
// overlapping part disappears all at once at the depth switch. The extra over
// one width covers both prints' offsets and rotated corners. Backward travel
// stays shorter: its existing reveal above the pile already reads smoothly.
const SEND_TRAVEL_RATIO = 1.3;
const SEND_OUT_RATIO = 0.55;
const SLIP_OUT_RATIO = 0.4;
// Opposite tilts keep neighbouring white edges peeking out. A lie belongs to
// the print, not its depth: revealing a print must never move it.
const MIN_TILT_DEG = 2;
const MAX_TILT_DEG = 6;
const MAX_OFFSET_PX = 12;
const CYCLE_EASING = 'cubic-bezier(0.18, 0.89, 0.32, 1.02)';
// The signature ease-out spends most of a leg almost stationary at its end.
// A symmetric ease brings the send to a brief, smooth reversal instead of
// parking it at the turnaround and then abruptly accelerating back in.
const SEND_EASING = 'cubic-bezier(0.4, 0, 0.6, 1)';
// How far across the card a drag must travel to commit, as a fraction of its width.
const DRAG_COMMIT_RATIO = 0.25;
// Pointer movement under this many pixels counts as a tap rather than a sweep.
const TAP_SLOP_PX = 8;
// Town/district level: close enough to place the photo, wide enough for context.
const FLY_ZOOM = 13;
const FLY_SECONDS = 1.2;
// Must match the mobile breakpoint in carousel.css, which is where the pile
// stops being a corner drawer and becomes a bottom sheet.
const MOBILE_BREAKPOINT_PX = 700;
// How far down the sheet must be dragged to dismiss it, as a fraction of its
// own height. Same idea as DRAG_COMMIT_RATIO, on the other axis.
const SHEET_DISMISS_RATIO = 0.25;
// Every full-screen overlay openOverlay can put up (the polaroid blow-up,
// info panel, and intro card). Kept as one selector because the pile treats them
// alike: while any of them is on screen, a tap elsewhere belongs to it.
const OVERLAY_WRAPPERS = '.polaroid-animated-wrapper-overlay, .overlay-panel-overlay, .intro-card-overlay';

/** Builds one mini polaroid. A <button> so it is focusable and clickable for free. */
function buildCard(oppositeTo: number): Card {
    const card = document.createElement('button') as Card;
    setLie(card, randomLie(oppositeTo));
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
function buildButton(className: string, glyph: string, label: string) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    return button;
}

function randomLie(oppositeTo: number): Lie {
    const sign = oppositeTo > 0 ? -1 : 1;
    return {
        x: (Math.random() * 2 - 1) * MAX_OFFSET_PX,
        y: (Math.random() * 2 - 1) * MAX_OFFSET_PX,
        tilt: sign * (MIN_TILT_DEG + Math.random() * (MAX_TILT_DEG - MIN_TILT_DEG)),
    };
}

function setLie(card: Card, lie: Lie) {
    card._lie = lie;
    card.style.setProperty('--pm-x', `${lie.x}px`);
    card.style.setProperty('--pm-y', `${lie.y}px`);
    card.style.setProperty('--pm-tilt', `${lie.tilt}deg`);
}

function lieTransform(lie: Lie) {
    return `translate(${lie.x}px, ${lie.y}px) rotate(${lie.tilt}deg)`;
}

/** A drag can stop or reverse, so its return leg is interpolated per move. */
function scrubLie(incoming: Incoming): Lie {
    const at = (from: number, to: number) => from + (to - from) * incoming.progress;
    return {
        x: at(incoming.turnaround.x, incoming.destination.x),
        y: at(incoming.turnaround.y, incoming.destination.y),
        tilt: at(incoming.turnaround.tilt, incoming.destination.tilt),
    };
}

/**
 * Loads the favourites, builds the pile, and slides it onto the page.
 *
 * @param map - The Leaflet map to fly when a photo is selected.
 * @returns The pile and its intro-card hand-off, or null when there are no favourites.
 */
export async function showPolaroidStack(map: L.Map, introFilename: string) {
    const photos = await loadCarouselPhotos(introFilename);
    // Nothing is flagged as a favourite, so there is no pile to build. This is
    // an empty list rather than a failure — it's what an unflagged
    // photos.geojson produces — so we leave the map alone and say nothing.
    if (!photos) return null;
    const { favourites, introPhoto } = photos;

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

    const byDepth: Card[] = [];
    for (let i = 0; i < CARD_COUNT; i++) {
        const card = buildCard(byDepth.at(-1)?._lie.tilt ?? 0);
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
    // Busy across both legs, or while a backward drag holds a borrowed print.
    // This is a signal for geometry/selection, not an input lock: a new browse
    // finishes the running movement first. E2E tests wait on the same class.
    let animating = false;
    const setAnimating = (value: boolean) => {
        animating = value;
        container.classList.toggle('is-cycling', value);
    };
    // The in-progress drag, or null.
    let drag: CardDrag | null = null;
    // Set when a drag has moved far enough that the click it produces should
    // not also be read as a tap.
    let suppressClick = false;

    /** The photo that belongs at the given pile depth. */
    function featureAt(depth: number) {
        return favourites[(topIndex + depth) % favourites.length];
    }

    /** Points a card at a photo. */
    function paint(card: Card, feature: FavouritePhoto) {
        card._feature = feature;
        const image = card.querySelector('img')!;
        image.src = `assets/photos/display/${feature.properties.filename}.webp`;
        image.alt = feature.properties.description || 'A favourite photo from the trip';
    }

    /** Writes z-order and accessibility only; each print keeps its own lie. */
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
     * Runs `mutate` with CSS transitions switched off. Reading offsetWidth
     * forces the browser to apply the change before restoring transitions, so
     * committing a finished lie or preparing the landing target cannot create
     * a second, unintended animation.
     */
    function withoutMotion(card: Card, mutate: () => void) {
        card.classList.add('is-instant');
        mutate();
        void card.offsetWidth;
        card.classList.remove('is-instant');
    }

    // --- Cycling ----------------------------------------------------------

    // Only one leg runs at a time. Two legs let z-order change exactly at the
    // turnaround, rather than interpolating numeric z-index values mid-flight.
    let running: { animation: Animation; complete: () => void } | null = null;

    function playLeg(card: Card, from: string, to: Lie, zIndex: number, duration: number,
        done: () => void, easing = CYCLE_EASING) {
        card.classList.add('is-moving');
        card.style.zIndex = String(zIndex);
        if (reduceMotion) {
            card.style.transform = lieTransform(to);
            done();
            return;
        }
        const animation = card.animate([
            { transform: from },
            { transform: lieTransform(to) },
        ], { duration, easing, fill: 'forwards' });
        const complete = () => {
            // Commit before cancelling the fill so there is no frame at the
            // old transform between the two legs. is-moving suppresses CSS
            // transitions; Web Animations alone owns the travelling print.
            animation.onfinish = null;
            card.style.transform = lieTransform(to);
            animation.cancel();
            running = null;
            done();
        };
        running = { animation, complete };
        animation.onfinish = complete;
    }

    function finishMovement() {
        // Animation.finish() queues its finish event; it does not call it on
        // this stack. Run our completion explicitly so a rapid click sees the
        // settled pile immediately. Completion may start the return leg, so
        // finish that too before accepting the next browse.
        while (running) {
            const leg = running;
            leg.animation.finish();
            leg.complete();
        }
    }

    function turnaround(card: Card, travelRatio = TURNAROUND_RATIO): Lie {
        return {
            x: card._lie.x - card.offsetWidth * travelRatio,
            y: card._lie.y + 12,
            tilt: card._lie.tilt - 6,
        };
    }

    function settleCard(card: Card, lie: Lie) {
        withoutMotion(card, () => {
            setLie(card, lie);
            card.style.removeProperty('transform');
            card.style.removeProperty('z-index');
            card.style.removeProperty('--pm-drag');
            card.classList.remove('is-moving');
        });
        setAnimating(false);
    }

    /** Sends the top print out above the pile, then back in underneath it. */
    function goNext() {
        finishMovement();
        setAnimating(true);
        const leaving = byDepth[0];
        // Capture before changing depth so a forward drag continues from the
        // hand's position, not from the print's original lie.
        const from = getComputedStyle(leaving).transform;
        const turn = turnaround(leaving, SEND_TRAVEL_RATIO);
        const destination = randomLie(byDepth[CARD_COUNT - 1]._lie.tilt);
        byDepth.push(byDepth.shift()!);
        topIndex = (topIndex + 1) % favourites.length;
        applyDepths();

        return new Promise<void>(resolve => {
            playLeg(leaving, from, turn, 5, SEND_MS * SEND_OUT_RATIO, () => {
                playLeg(leaving, lieTransform(turn), destination, 0, SEND_MS * (1 - SEND_OUT_RATIO), () => {
                    settleCard(leaving, destination);
                    // Only its white edges are visible now. Recycle its photo
                    // at the back, never while it is travelling in plain sight.
                    paint(leaving, featureAt(CARD_COUNT - 1));
                    resolve();
                }, SEND_EASING);
            }, SEND_EASING);
        });
    }

    /** Borrows the hidden bottom print and visibly slips it out below the pile. */
    function liftIncoming(): Incoming {
        const card = byDepth[CARD_COUNT - 1];
        const incoming: Incoming = {
            card,
            originalLie: card._lie,
            destination: randomLie(byDepth[0]._lie.tilt),
            turnaround: turnaround(card),
            progress: 0,
            slipping: true,
        };
        paint(card, favourites[(topIndex - 1 + favourites.length) % favourites.length]);
        setAnimating(true);
        playLeg(card, lieTransform(card._lie), incoming.turnaround, 0, SEND_MS * SLIP_OUT_RATIO, () => {
            incoming.slipping = false;
            // The hand may have moved (or let go) during the slip-out. Apply
            // its latest progress only once the print has cleared the pile.
            card.style.zIndex = '5';
            scrubIncoming(incoming, incoming.progress);
            incoming.onSlipped?.();
        });
        return incoming;
    }

    /** Tracks the arriving print, leaving the touched top print undisturbed. */
    function scrubIncoming(incoming: Incoming, progress: number) {
        incoming.progress = progress;
        if (!incoming.slipping) incoming.card.style.transform = lieTransform(scrubLie(incoming));
    }

    function commitPrevious(incoming: Incoming) {
        const travelIn = () => {
            byDepth.pop();
            byDepth.unshift(incoming.card);
            topIndex = (topIndex - 1 + favourites.length) % favourites.length;
            applyDepths();
            playLeg(incoming.card, lieTransform(scrubLie(incoming)), incoming.destination, 5,
                SEND_MS * (1 - SLIP_OUT_RATIO), () => settleCard(incoming.card, incoming.destination));
        };
        if (incoming.slipping) incoming.onSlipped = travelIn;
        else travelIn();
    }

    /** Retraces the pull-in, then slips the borrowed print back underneath. */
    function cancelPrevious(incoming: Incoming) {
        const returnToBack = () => {
            playLeg(incoming.card, lieTransform(scrubLie(incoming)), incoming.turnaround, 5,
                SEND_MS * (1 - SLIP_OUT_RATIO), () => {
                    playLeg(incoming.card, lieTransform(incoming.turnaround), incoming.originalLie, 0,
                        SEND_MS * SLIP_OUT_RATIO, () => {
                            settleCard(incoming.card, incoming.originalLie);
                            paint(incoming.card, featureAt(CARD_COUNT - 1));
                        });
                });
        };
        if (incoming.slipping) incoming.onSlipped = returnToBack;
        else returnToBack();
    }

    /** Pulls the bottom print out below the pile, then returns it above. */
    function goPrevious() {
        finishMovement();
        commitPrevious(liftIncoming());
    }

    // --- Selecting --------------------------------------------------------

    /**
     * Commits to the photo on top: the map flies to it while the blow-up rises.
     * Both start together — the blow-up's backdrop is a 40% scrim rather than an
     * opaque cover, so the flight stays visible through it.
     */
    function selectTop() {
        const feature = byDepth[0]._feature!; // Every card is painted before input is enabled.
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

    function setCollapsed(collapsed: boolean) {
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
        if (container.contains(event.target as Node)) return;
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
    let sheetDrag: SheetDrag | null = null;

    surface.addEventListener('pointerdown', (event) => {
        if (container.classList.contains('is-collapsed')) return;
        // Whether this started on the grabber has to be settled now: the
        // capture below retargets every later event in the gesture to the
        // surface, so pointerup can no longer tell where the finger went down.
        sheetDrag = {
            startY: event.clientY,
            dy: 0,
            fromGrabber: !!(event.target as Element).closest('.polaroid-stack-grabber'),
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
        if (container.classList.contains('is-collapsed')) return;
        // Finish before identifying the top card: completing a previous move
        // can change which element is on top. Padding and the handle must not
        // finish a cycle, since those are not the start of a card gesture.
        const target = (event.target as Element).closest<Card>('.polaroid-mini');
        if (!target || target !== byDepth[0]) return;
        finishMovement();
        const card = byDepth[0];

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
                // Forward: the finger is on the card being sent to the back,
                // so that card is what moves.
                drag.mode = 'forward';
                drag.card.classList.add('is-dragging');
            } else {
                // Back: the top card stays put. What moves is the photo you
                // flicked away last time, pulled back in from the left — so the
                // thing travelling under your finger is the one arriving, not
                // the one you happen to be touching.
                drag.mode = 'back';
                drag.incoming = liftIncoming();
                drag.incoming.card.classList.add('is-dragging');
            }
        }

        if (drag.mode === 'forward') {
            // CSS folds this into the top card's transform, so we never have to
            // rebuild (and duplicate) the card's rotation here.
            drag.card.style.setProperty('--pm-drag', `${drag.dx}px`);
            return;
        }

        if (drag.mode === 'back' && drag.incoming) {
            // Map the drag onto the incoming card's journey, clamped so pulling past
            // home doesn't overshoot and reversing past the start doesn't invert it.
            const travel = drag.card.offsetWidth * TURNAROUND_RATIO;
            scrubIncoming(drag.incoming, Math.min(Math.max(drag.dx / travel, 0), 1));
        }
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

        if (mode === 'back' && incoming) {
            incoming.card.classList.remove('is-dragging');
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
        const card = (event.target as Element).closest<Card>('.polaroid-mini');
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

    byDepth.forEach((card, depth) => { paint(card, featureAt(depth)); });
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

    /** Lands the welcome photo, then reveals the next print using a normal cycle. */
    async function receiveIntroCard(card: HTMLButtonElement) {
        // A reopened intro can be dismissed while a previous browse is still
        // finishing. Let that short cycle settle before changing the pile order.
        if (animating) await new Promise(resolve => setTimeout(resolve, SEND_MS));
        if (!isPhone.matches) setCollapsed(false);

        // Mount/reveal and opening the desktop drawer both move our destination.
        // Wait for their CSS transitions before measuring the landing rectangle.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.all(container.getAnimations({ subtree: true }).map(animation => animation.finished));
        setAnimating(true);

        // Preserve the reader's current photo immediately behind the welcome
        // print, and remove its old occurrence on reopen so it never duplicates.
        const ordered = Array.from({ length: favourites.length }, (_, depth) => featureAt(depth))
            .filter(feature => feature.properties.filename !== introPhoto.properties.filename);
        favourites.splice(0, favourites.length, introPhoto, ...ordered);
        topIndex = 0;
        const receiving = byDepth.pop()!;
        byDepth.unshift(receiving);
        receiving.classList.add('is-landing-target');
        byDepth.forEach((print, depth) => { paint(print, featureAt(depth)); });
        // The borrowed print needs its new lie before landing is measured.
        // Changing depth must not disturb the three prints underneath it.
        withoutMotion(receiving, () => {
            setLie(receiving, randomLie(byDepth[1]._lie.tilt));
            applyDepths();
        });

        await landIntroCard(card, receiving);
        receiving.classList.remove('is-landing-target');
        // A brief rest makes the landing legible before the next photo steps
        // forward. The welcome photo remains browseable, including via Previous.
        await new Promise(resolve => setTimeout(resolve, 180));
        setAnimating(false);
        await goNext();
    }

    return { container, receiveIntroCard };
}
