/**
 * Shows an overlay with the information from a feature.
 * This function creates and displays a DOM element containing the
 * feature's name and description.
 *
 * @param {Object} feature - A GeoJSON feature with 'name' and 'description' properties.
 */
export function showInfoOverlay(feature) {
    // First, remove any existing overlay to avoid duplicates.
    const existingOverlay = document.querySelector('.info-overlay-wrapper');
    if (existingOverlay) {
        existingOverlay.remove();
    }


    const description = feature.properties.description || "No description available.";

    // Create the main wrapper for the overlay.
    const wrapper = document.createElement('div');
    wrapper.className = 'info-overlay-wrapper';
    // Add a click event to the wrapper to close the overlay when the background is clicked.
    wrapper.onclick = function(event) {
        if (event.target === wrapper) {
            hideInfoOverlay();
        }
    };

    // Create the content container for the text.
    const content = document.createElement('div');
    content.className = 'info-content';
    // Populate the content with the feature's name and description.
    content.innerHTML = `
        <p>${description}</p>
    `;
    // Stop click events inside the content from bubbling up to the wrapper.
    content.onclick = function(event) {
        event.stopPropagation();
    };

    // Append the content to the wrapper, and the wrapper to the body.
    wrapper.appendChild(content);
    document.body.appendChild(wrapper);

    // Use requestAnimationFrame to ensure the element is in the DOM before adding
    // the 'visible' class, which will trigger the CSS fade-in animation.
    requestAnimationFrame(() => {
        wrapper.classList.add('visible');
    });
}

/**
 * Hides and removes the information overlay from the DOM.
 * It triggers a fade-out animation and then removes the element.
 */
export function hideInfoOverlay() {
    const wrapper = document.querySelector('.info-overlay-wrapper');
    if (wrapper) {
        // Remove the 'visible' class to start the fade-out animation.
        wrapper.classList.remove('visible');

        // Listen for the end of the transition, then remove the element.
        // The 'once: true' option ensures the event listener is removed after it runs.
        wrapper.addEventListener('transitionend', () => {
            if (wrapper.parentElement) {
                wrapper.remove();
            }
        }, { once: true });
    }
}

/**
 * A callback function for Leaflet's onEachFeature option.
 * It attaches event listeners to each information marker layer.
 *
 * @param {Object} feature - The GeoJSON feature.
 * @param {L.Layer} layer - The Leaflet layer for the feature.
 */
export function onEachInfoFeature(feature, layer) {
    // When the marker is clicked, show the info overlay for that feature.
    layer.on('click', () => {
        showInfoOverlay(feature);
    });

    // On mouseover, add a class to the icon to make it larger.
    layer.on('mouseover', function() {
        const iconDiv = this._icon;
        if (iconDiv) {
            iconDiv.classList.add('info-marker-icon-hover');
        }
    });

    // On mouseout, remove the hover class to return the icon to its normal size.
    layer.on('mouseout', function() {
        const iconDiv = this._icon;
        if (iconDiv) {
            iconDiv.classList.remove('info-marker-icon-hover');
        }
    });
}

/**
 * A callback function for Leaflet's pointToLayer option.
 * It creates a custom marker icon for each information point.
 *
 * @param {Object} feature - The GeoJSON feature.
 * @param {L.LatLng} latlng - The latitude and longitude of the point.
 * @returns {L.Marker} A Leaflet marker with a custom 'i' icon.
 */
export function pointToLayerForInfo(feature, latlng) {
    // Create the HTML for the custom icon. It's a simple div with the letter 'i'.
    const iconHtml = `<div class="info-marker-icon">i</div>`;

    // Use Leaflet's DivIcon to create an icon from our HTML.
    const customIcon = L.divIcon({
        html: iconHtml,
        className: '', // We use our own class on the div, so no extra class is needed here.
        iconSize: [24, 24], // Size of the icon.
        iconAnchor: [12, 12] // Anchor point of the icon (center).
    });

    // Return a new marker at the given position with our custom icon.
    return L.marker(latlng, { icon: