// This module handles creation and removal of the animated photo polaroid overlay
// It exports two functions: showAnimatedPolaroid and hideAnimatedPolaroidOnClick

/**
 * Shows an animated polaroid overlay for the given photo feature.
 * This creates a DOM element overlay containing the image and caption,
 * then triggers the CSS transition to animate it in.
 *
 * @param {Object} feature - A GeoJSON feature that must include properties for filepath and (optionally) filename.
 */
export function showAnimatedPolaroid(feature) {
    // Remove any existing overlay first
    const existingWrapper = document.querySelector('.polaroid-animated-wrapper-overlay');
    if (existingWrapper) {
        existingWrapper.remove();
    }

    // Construct the image path and caption from the feature
    const imagePath = `assets/photos/display/${feature.properties.filename}.jpg`;
    const captionText = feature.properties.description || ""

    // Create the overlay element
    const wrapper = document.createElement('div');
    wrapper.className = 'polaroid-animated-wrapper-overlay';
    // Clicking the overlay itself removes it, but clicking inside the polaroid won't bubble up
    wrapper.onclick = function (event) {
        if (event.target === wrapper) {
            hideAnimatedPolaroidOnClick();
        }
    };

    // Create the polaroid element that holds the image and caption
    const polaroidElement = document.createElement('div');
    polaroidElement.className = 'polaroid'; // Use the existing CSS styles for .polaroid

    // Set the inner HTML for the polaroid element
    polaroidElement.innerHTML = `
        <img src="${imagePath}" alt="Photo">
        <p class="caption">${captionText}</p>
    `;

    // Prevent clicks on the polaroid itself from closing the overlay
    polaroidElement.onclick = function (event) {
        event.stopPropagation();
    };

    // Append the polaroid to the overlay and add the overlay to the DOM
    wrapper.appendChild(polaroidElement);
    document.body.appendChild(wrapper);

    // Trigger the animation by adding the 'visible' class after ensuring the element is in the DOM.
    // Two consecutive calls to requestAnimationFrame help ensure the CSS transition is applied.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            wrapper.classList.add('visible');
        });
    });
}

/**
 * Hides the animated polaroid overlay.
 * It removes the CSS 'visible' class to trigger the fade-out transition,
 * then removes the element from the DOM once the transition ends.
 */
export function hideAnimatedPolaroidOnClick() {
    const wrapper = document.querySelector('.polaroid-animated-wrapper-overlay');
    if (wrapper && wrapper.classList.contains('visible')) {
        // Remove the visible class to start the fade-out animation
        wrapper.classList.remove('visible');

        // Once the CSS opacity transition ends, remove the overlay from the DOM.
        const onTransitionEnd = (event) => {
            if (event.target === wrapper && event.propertyName === 'opacity') {
                if (wrapper.parentElement) {
                    wrapper.remove();
                }
            }
        };
        wrapper.addEventListener('transitionend', onTransitionEnd, { once: true });
    }
}

// Callback function to attach events for photo features in the GeoJSON layer.
export function onEachPhotoFeature(feature, layer) {
    // If the feature has a valid photo filepath, attach a click event that shows the polaroid.
    if (feature.properties && feature.properties.filename) {
        layer.on('click', function () {
            showAnimatedPolaroid(feature);
        });
    }
    // Add mouseover and mouseout events to modify the marker's appearance.
    layer.on('mouseover', function () {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                imgElement.classList.add('photo-marker-image-hover');
            }
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000;
        }
    });
    layer.on('mouseout', function () {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                imgElement.classList.remove('photo-marker-image-hover');
            }
        }
    });
}

// Callback function to create a custom marker for photo features.
export function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filename) {
        const imagePath = `assets/photos/thumbnail/${feature.properties.filename}.jpg`;
        const iconHtml = `<img src="${imagePath}" alt="Photo location" class="photo-marker-image">`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // No default styling
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
        return L.marker(latlng, { icon: customIcon });
    }
    return L.marker(latlng);
}