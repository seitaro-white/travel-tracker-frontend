// Shows a scrolly overlay panel with the given HTML/text content.
// Calls onClose() when the panel is dismissed.
export function showScrollyPanel(contentHtml, onClose) {
    // Remove any existing panel
    const existing = document.querySelector('.scrolly-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'scrolly-overlay';

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'scrolly-panel';
    panel.innerHTML = contentHtml;

    // Optional: Add a close button at the end
    const closeBtn = document.createElement('button');
    closeBtn.className = 'scrolly-close';
    closeBtn.textContent = 'Continue';
    closeBtn.onclick = () => {
        overlay.remove();
        if (onClose) onClose();
    };
    panel.appendChild(closeBtn);

    // Prevent overlay click from closing (optional)
    overlay.onclick = (e) => { if (e.target === overlay) { /* Optionally close */ } };

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Optionally: Focus panel for accessibility
    panel.tabIndex = -1;
    panel.focus();
}