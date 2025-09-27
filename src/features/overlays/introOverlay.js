/**
 * Fetches the content for the intro overlay from an HTML file, displays it,
 * and attaches an event listener to the close button.
 */
export function showIntroOverlay() {
    // Fetch the HTML content from the 'introOverlay.html' file.
    // fetch() is a modern JavaScript API for making network requests (like getting a file).
    fetch('introOverlay.html')
        // .then() is used to handle the response. The response from fetch() is not the actual
        // content, but a 'Response' object. We need to call .text() to get the content as a string.
        .then(response => response.text())
        // This .then() receives the actual HTML content as a string.
        .then(html => {
            // Find the element where the intro content should be placed.
            const content = document.getElementById('overlay-panel-content');
            // Set the inner HTML of the content area to the fetched HTML.
            content.innerHTML = html;

            // Find the main overlay panel element.
            const overlay = document.getElementById('intro-overlay');
            // Make the overlay visible by adding the 'visible' class.
            overlay.classList.add('visible');

            // Find the close button inside the loaded HTML.
            const closeButton = document.getElementById('close-intro-overlay');
            // Add a 'click' event listener to the close button. When clicked, it will
            // call the closeIntroOverlay function.
            closeButton.addEventListener('click', closeIntroOverlay);
        });
}

/**
 * Hides the intro overlay and shows the mini map key.
 */
function closeIntroOverlay() {
    // Find the main overlay panel element.
    const overlay = document.getElementById('intro-overlay');
    // Hide the overlay by removing the 'visible' class.
    overlay.classList.remove('visible');

    // When the overlay is closed, find the mini map key element.
    const miniMapKey = document.getElementById('mini-map-key');
    // Make the mini map key visible by adding the 'visible' class.
    miniMapKey.classList.add('visible');
}