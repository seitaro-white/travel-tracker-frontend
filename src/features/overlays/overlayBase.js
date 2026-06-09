// Shared lifecycle for the app's full-screen overlays (intro panel, info card,
// polaroid). Each overlay type builds its own inner "panel" element and the
// markup/classes it needs for styling; this primitive only owns the common
// behaviour: mounting the backdrop wrapper, fading it in, dismissing it
// (backdrop click / Escape), and removing it once the CSS fade-out finishes.

/**
 * Opens a full-screen overlay and returns a handle to close it.
 *
 * @param {Object} opts
 * @param {string} opts.wrapperClass - CSS class for the full-screen backdrop wrapper.
 * @param {HTMLElement} opts.panel - The content element placed inside the wrapper.
 * @param {boolean} [opts.dismissOnBackdrop=true] - Clicking the backdrop closes the overlay.
 * @param {boolean} [opts.dismissOnEscape=true] - Pressing Escape closes the overlay.
 * @param {boolean} [opts.gracefulClose=true] - Fade out via CSS before removal (vs. remove immediately).
 * @param {Function} [opts.beforeShow] - Optional async step awaited before fading in (e.g. image load).
 * @param {Function} [opts.onClose] - Called after the overlay has been removed from the DOM.
 * @returns {{ wrapper: HTMLElement, close: () => void }}
 */
export function openOverlay({
    wrapperClass,
    panel,
    dismissOnBackdrop = true,
    dismissOnEscape = true,
    gracefulClose = true,
    beforeShow,
    onClose,
}) {
    // Remove any existing overlay with the same wrapper class to avoid duplicates,
    // running each one's cleanup first so its document-level listeners don't leak.
    document.querySelectorAll('.' + wrapperClass).forEach(el => {
        if (typeof el._overlayCleanup === 'function') el._overlayCleanup();
        el.remove();
    });

    // Build the backdrop wrapper and mount the caller's panel inside it.
    const wrapper = document.createElement('div');
    wrapper.className = wrapperClass;
    // Clicks inside the panel should never reach the backdrop dismissal handler.
    panel.addEventListener('click', e => e.stopPropagation());
    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    // Escape handling lives at the document level, so it must be torn down on close.
    const onKeydown = (e) => { if (e.key === 'Escape') close(); };
    const removeKeydown = () => document.removeEventListener('keydown', onKeydown);
    // Exposed so the duplicate-removal sweep above can clean up a stale overlay.
    wrapper._overlayCleanup = removeKeydown;

    let closed = false;
    function close() {
        if (closed) return;
        closed = true;
        removeKeydown();

        const finish = () => {
            if (wrapper.parentElement) wrapper.remove();
            if (onClose) onClose();
        };

        if (!gracefulClose) {
            finish();
            return;
        }

        // Trigger the CSS fade-out, then remove once the wrapper's opacity
        // transition completes. A timeout backstops the case where transitionend
        // never fires (e.g. the element is already hidden).
        wrapper.classList.remove('visible');
        let done = false;
        const onEnd = (e) => {
            // Ignore bubbling transitions from child elements and non-opacity properties.
            if (e.target !== wrapper || e.propertyName !== 'opacity') return;
            wrapper.removeEventListener('transitionend', onEnd);
            if (!done) { done = true; finish(); }
        };
        wrapper.addEventListener('transitionend', onEnd);
        setTimeout(() => {
            wrapper.removeEventListener('transitionend', onEnd);
            if (!done) { done = true; finish(); }
        }, 600);
    }

    if (dismissOnBackdrop) {
        wrapper.addEventListener('click', (e) => { if (e.target === wrapper) close(); });
    }
    if (dismissOnEscape) {
        document.addEventListener('keydown', onKeydown);
    }

    // Fade in on the next frame (double rAF guarantees the element is laid out
    // before .visible is added, so the CSS transition actually runs). An optional
    // beforeShow step lets callers wait for e.g. an image to load first.
    const show = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        wrapper.classList.add('visible');
    }));
    if (beforeShow) {
        Promise.resolve(beforeShow()).then(show);
    } else {
        show();
    }

    return { wrapper, close };
}
