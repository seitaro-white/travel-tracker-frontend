// This module handles creation and removal of the animated polaroid overlay.
// It is intended to be called from marker/photo logic elsewhere.

import { openOverlay } from './overlayBase.js';

/**
 * Ensures the SVG filter for the stamp texture effect exists in the DOM.
 * This filter uses turbulence to create a worn/imperfect stamp look.
 * We only add it once to avoid duplicates.
 */
function ensureStampFilter() {
    // Check if the filter already exists in the document.
    if (document.getElementById('stamp-texture')) {
        return;
    }

    // Create an SVG element with a filter that creates a distressed/worn look.
    // The feTurbulence generates noise, and feDisplacementMap displaces the text slightly.
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';

    // The filter definition that creates the stamp texture effect.
    svg.innerHTML = `
        <defs>
            <filter id="stamp-texture" x="0" y="0" width="100%" height="100%">
                <!-- Create noise/turbulence pattern -->
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
                <!-- Use the noise to displace the text, creating gaps and imperfections -->
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
        </defs>
    `;

    document.body.appendChild(svg);
}

/**
 * Shows an animated polaroid overlay for the given photo feature.
 * This creates a DOM element overlay containing the image and caption,
 * then triggers the CSS transition to animate it in.
 *
 * @param {Object} feature - A GeoJSON feature that must include properties for filename and (optionally) description.
 */
export function showAnimatedPolaroid(feature) {
    // Ensure the SVG filter for stamp texture is in the DOM.
    ensureStampFilter();

    // Construct the image path and caption from the feature properties.
    const imagePath = `assets/photos/display/${feature.properties.filename}.jpg`;
    const captionText = feature.properties.description || "";

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

    // Create the date stamp element if a timestamp is available.
    // The timestamp is in ISO 8601 format (e.g., "2025-01-21T22:24:00Z").
    // We parse it and format it as an uppercase date string like "16 JAN 2025".
    let dateStamp = null;
    if (feature.properties.timestamp) {
        const date = new Date(feature.properties.timestamp);
        // Format the date as "D MMM YYYY" in uppercase (e.g., "16 JAN 2025") to look like a typewriter stamp.
        const day = date.getDate();
        const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
        const year = date.getFullYear();
        const formattedDate = `${day} ${month} ${year}`;

        dateStamp = document.createElement('span');
        dateStamp.className = 'polaroid-date-stamp';
        dateStamp.textContent = formattedDate;
    }

    // Append image, caption, and date stamp to the polaroid element.
    polaroidElement.appendChild(img);
    polaroidElement.appendChild(caption);
    if (dateStamp) {
        polaroidElement.appendChild(dateStamp);
    }

    // Open the overlay, but wait for the image to load before fading in (so the
    // polaroid doesn't pop in half-rendered). onerror resolves too, so a missing
    // image still shows the overlay rather than hanging.
    openOverlay({
        wrapperClass: 'polaroid-animated-wrapper-overlay',
        panel: polaroidElement,
        beforeShow: () => new Promise(resolve => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = resolve;
                img.onerror = resolve;
            }
        }),
    });
}