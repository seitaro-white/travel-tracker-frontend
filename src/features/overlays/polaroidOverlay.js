// This module handles creation and removal of the animated polaroid overlay.
// It is intended to be called from marker/photo logic elsewhere.

/**
 * Shows an animated polaroid overlay for the given photo feature.
 * This creates a DOM element overlay containing the image and caption,
 * then triggers the CSS transition to animate it in.
 *
 * @param {Object} feature - A GeoJSON feature that must include properties for filename and (optionally) description.
 */
export function showAnimatedPolaroid(feature) {
    // Remove any existing polaroid overlay first to avoid duplicates.
    const existingWrapper = document.querySelector('.polaroid-animated-wrapper-overlay');
    if (existingWrapper) {
        existingWrapper.remove();
    }

    // Construct the image path and caption from the feature properties.
    const imagePath = `assets/photos/display/${feature.properties.filename}.jpg`;
    const captionText = feature.properties.description || "";

    // Create the overlay wrapper element.
    const wrapper = document.createElement('div');
    wrapper.className = 'polaroid-animated-wrapper-overlay';

    // Clicking the overlay background removes it, but clicking inside the polaroid does not.
    wrapper.onclick = function (event) {
        if (event.target === wrapper) {
            hideAnimatedPolaroidOnClick();
        }
    };

    // Create the polaroid element that holds the image and caption.
    const polaroidElement = document.createElement('div');
    polaroidElement.className = 'polaroid'; // Uses the .polaroid CSS class.

    // Set the inner HTML for the polaroid element.
    polaroidElement.innerHTML = `
        <img src="${imagePath}" alt="Photo">
        <p class="caption">${captionText}</p>
    `;

    // Prevent clicks on the polaroid itself from closing the overlay.
    polaroidElement.onclick = function (event) {
        event.stopPropagation();
    };

    // Append the polaroid to the overlay and add the overlay to the DOM.
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
        // Remove the visible class to start the fade-out animation.
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