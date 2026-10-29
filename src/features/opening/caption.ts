import './caption.css';

// Keep the typing readable without delaying either map-animation phase.
const TYPE_MS = 40;
const FADE_MS = 200; // Matches the opacity transition in caption.css.

/** One floating caption shared by both phases, with an always-available skip. */
export function createCaption(onSkip: () => void) {
    const container = document.createElement('div');
    container.className = 'opening-caption';
    const textElement = document.createElement('span');
    textElement.className = 'opening-caption-text';
    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.className = 'opening-caption-skip';
    skipButton.textContent = 'skip ›';
    skipButton.addEventListener('click', onSkip);
    container.append(textElement, skipButton);
    document.body.appendChild(container);

    let timer: ReturnType<typeof setTimeout>;
    let hasCaption = false;

    function type(text: string) {
        clearTimeout(timer);
        // Fade only the words between phases: the skip control must stay put.
        textElement.classList.add('is-fading');
        const startTyping = () => {
            textElement.textContent = '';
            textElement.classList.remove('is-fading');
            let index = 0;
            const nextCharacter = () => {
                textElement.textContent += text[index++];
                if (index < text.length) timer = setTimeout(nextCharacter, TYPE_MS);
            };
            nextCharacter();
        };
        if (hasCaption) timer = setTimeout(startTyping, FADE_MS);
        else startTyping();
        hasCaption = true;
    }

    function remove() {
        // Cancel typing as well as a pending phase change, so a skipped caption
        // cannot reappear while the finished map is being set up.
        clearTimeout(timer);
        container.classList.add('is-fading');
        skipButton.disabled = true;
        setTimeout(() => container.remove(), FADE_MS);
    }

    return { type, remove };
}
