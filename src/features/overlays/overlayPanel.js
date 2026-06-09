import { openOverlay } from './overlayBase.js';

// Shows a simple overlay panel with your content and a "Continue" button.
// When the button is clicked, the overlay is removed and onClose() is called (if provided).
// This panel is intentionally modal: it can only be dismissed via the button
// (no backdrop-click, no Escape), so the reader has to acknowledge it.
export function showOverlayPanel(contentHtml, onClose) {
    // Create the centered panel for your content.
    const panel = document.createElement('div');
    panel.className = 'overlay-panel-panel';
    panel.innerHTML = contentHtml;

    // Create the "Continue" button that closes the overlay.
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-panel-close';
    closeBtn.textContent = 'Continue';
    panel.appendChild(closeBtn);

    const { close } = openOverlay({
        wrapperClass: 'overlay-panel-overlay',
        panel,
        dismissOnBackdrop: false,
        dismissOnEscape: false,
        gracefulClose: false, // remove immediately on Continue (matches prior behaviour)
        onClose,
    });

    closeBtn.onclick = close;

    // Optionally focus the panel for accessibility.
    panel.tabIndex = -1;
    panel.focus();
}
