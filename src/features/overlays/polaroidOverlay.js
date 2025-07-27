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
    polaroidElement.className = 'polaroid';

    // Create the image element and caption.
    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = "Photo";

    const caption = document.createElement('p');
    caption.className = 'caption';
    caption.textContent = captionText;

    // Prevent clicks on the polaroid itself from closing the overlay.
    polaroidElement.onclick = function (event) {
        event.stopPropagation();
    };

    // Append image and caption to the polaroid element.
    polaroidElement.appendChild(img);
    polaroidElement.appendChild(caption);

    // Append the polaroid to the overlay and add the overlay to the DOM.
    wrapper.appendChild(polaroidElement);
    document.body.appendChild(wrapper);

    // Wait for the image to load before triggering the animation.
    img.onload = () => {
        // Use two requestAnimationFrame calls to ensure the element is in the DOM before animating.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                wrapper.classList.add('visible');
            });
        });
    };

    // If the image fails to load, still show the overlay after a short delay.
    img.onerror = () => {
        setTimeout(() => {
            wrapper.classList.add('visible');
        }, 100);
    };
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