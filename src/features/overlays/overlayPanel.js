// This function shows a simple overlay panel with your content and a "Continue" button.
// When the button is clicked, the overlay is removed and onClose() is called (if provided).
export function showOverlayPanel(contentHtml, onClose) {
    // Remove any existing overlay to avoid duplicates.
    const existing = document.querySelector('.overlay-panel-overlay');
    if (existing) existing.remove();

    // Create the full-screen overlay background.
    const overlay = document.createElement('div');
    overlay.className = 'overlay-panel-overlay';

    // Create the centered panel for your content.
    const panel = document.createElement('div');
    panel.className = 'overlay-panel-panel';
    panel.innerHTML = contentHtml;

    // Create the "Continue" button.
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-panel-close';
    closeBtn.textContent = 'Continue';
    // When clicked, remove the overlay and call onClose if provided.
    closeBtn.onclick = () => {
        overlay.remove();
        if (onClose) onClose();
    };
    panel.appendChild(closeBtn);

    // Prevent clicks on the overlay background from closing the panel.
    overlay.onclick = (e) => { if (e.target === overlay) { /* do nothing */ } };

    // Add the panel to the overlay, and the overlay to the document.
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Add the .visible class after the overlay is in the DOM to trigger the fade-in.
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });

    // Optionally focus the panel for accessibility.
    panel.tabIndex = -1;
    panel.focus();
}