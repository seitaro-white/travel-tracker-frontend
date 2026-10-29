import { openOverlay } from './overlayBase';
import './introCard.css';

export const INTRO_PHOTO = 'IMG_0715'; // Placeholder — the user will choose the final photo.
const WELCOME_TEXT = "I moved to Japan in January 2025. I've been travelling around and taking some photos — here's where I've been.";
const FLIP_MS = 700; // Keep in step with .intro-card-inner's CSS transition.

/** Shows the modal welcome print, or its photo-up version when reopened. */
export function showIntroCard({ faceUp = false, landOnPile, onClose }: {
    faceUp?: boolean;
    landOnPile: (card: HTMLButtonElement) => Promise<void>;
    onClose?: () => void;
}) {
    // A native button gives the whole print keyboard activation (Enter/Space).
    // Its children are phrasing elements, not divs or paragraphs, to keep valid
    // button markup even though CSS lays them out like a physical card.
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'intro-card';
    card.classList.toggle('is-flipped', faceUp);
    card.setAttribute('aria-label', faceUp ? 'Start exploring' : 'Turn over the welcome card');
    card.innerHTML = `
        <span class="intro-card-inner">
            <span class="intro-card-face intro-card-back">
                <span class="intro-card-hi">Hi</span>
                <span class="intro-card-note">turn me over ↻</span>
            </span>
            <span class="intro-card-face intro-card-front">
                <img class="intro-card-photo" src="assets/photos/display/${INTRO_PHOTO}.webp" alt="A snapshot from Japan" draggable="false">
                <span class="intro-card-chin">
                    <span class="intro-card-text">${WELCOME_TEXT}</span>
                    <span class="intro-card-prompt">start exploring →</span>
                </span>
            </span>
        </span>
    `;

    const photo = card.querySelector<HTMLImageElement>('.intro-card-photo')!;

    const { wrapper, close } = openOverlay({
        wrapperClass: 'intro-card-overlay',
        panel: card,
        dismissOnBackdrop: faceUp,
        dismissOnEscape: faceUp,
        gracefulClose: false, // The landing owns the close animation; remove only once it finishes.
        // As with the photo blow-up, wait for the image before revealing the
        // print. Resolving on error also prevents a failed image from blocking entry.
        beforeShow: () => new Promise<void>(resolve => {
            if (photo.complete) resolve();
            else {
                photo.onload = () => resolve();
                photo.onerror = () => resolve();
            }
        }),
        // Card, Escape and backdrop dismissal all wait for the same landing.
        // Keep the modal wrapper mounted until the pile's introductory shuffle
        // finishes, so input cannot interrupt the hand-off between the two.
        onClosing: async () => {
            wrapper.classList.add('is-landing');
            card.classList.add('is-landing');
            await landOnPile(card);
        },
        onClose,
    });

    let flipping = false;
    card.addEventListener('click', () => {
        // A quick double-tap must not dismiss the print before the photo is seen.
        if (flipping) return;
        if (card.classList.contains('is-flipped')) {
            close();
            return;
        }
        flipping = true;
        card.classList.add('is-flipped');
        card.setAttribute('aria-label', 'Start exploring');
        setTimeout(() => { flipping = false; }, FLIP_MS);
    });
    // Keep keyboard input on the modal without drawing an outline on arrival.
    card.focus({ focusVisible: false });
}
