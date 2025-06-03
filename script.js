import { geoJSONLayerStyles } from './geojson_styles.js';
import { addAnimatedLineGeoJsonLayer, addPointGeoJsonLayer, addStaticLineGeoJsonLayer } from '/src/services/geojson.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(
        mapId, {

    }).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        maxZoom: 20,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png',
    }).addTo(map);
    return map;
}


// Specific callback for photo popups
function onEachPhotoFeature(feature, layer) {
    if (feature.properties && feature.properties.filepath) {
        // const imagePath = `assets/geotagged_photos/display/${feature.properties.filepath}`;
        // const captionText = feature.properties.filename || feature.properties.filepath.split('/').pop() || "Photo";

        // const popupContent = `
        //     <div class="polaroid">
        //         <img src="${imagePath}" alt="Photo">
        //         <p class="caption">${captionText}</p>
        //     </div>`;
        // layer.bindPopup(popupContent, { maxWidth: 500 }); // REMOVE THIS LINE

        // NEW: Add click listener to show animated polaroid
        layer.on('click', function () {
            showAnimatedPolaroid(feature);
        });
    }

    // Mouseover event (keep existing for marker icon hover effect)
    layer.on('mouseover', function (e) {
        const iconDiv = this._icon; // Get the L.divIcon's main div element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                // Apply hover styles by adding a class
                imgElement.classList.add('photo-marker-image-hover');
            }

            // Ensure the iconDiv container allows the (now larger) image to be fully visible
            // and that the iconDiv itself is on top.
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000;
        }
    });

    // Mouseout event (keep existing for marker icon hover effect)
    layer.on('mouseout', function (e) {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                // Revert to original styles by removing the class
                imgElement.classList.remove('photo-marker-image-hover');
            }

            //iconDiv.style.zIndex = ''; // Revert z-index if needed
            // iconDiv.style.overflow = 'hidden'; // Revert overflow if needed
        }
    });
}

// Specific callback for photo markers
function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/thumbnail/${feature.properties.filepath}`;
        // Ensure the img fills the iconDiv and maintains its appearance
        const iconHtml = `<img src="${imagePath}" alt="Photo location" class="photo-marker-image">`;

        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Set to empty to avoid default Leaflet divIcon styling
            iconSize: [20, 20], // This sets the initial size of the iconDiv
            iconAnchor: [10, 10], // Anchor should be center of the iconSize
            popupAnchor: [0, -10]
        });
        return L.marker(latlng, { icon: customIcon });
    }
    return L.marker(latlng); // Fallback to default marker
}


// NEW FUNCTIONS for animated polaroid

function hideAnimatedPolaroidOnClick() {
    const wrapper = document.querySelector('.polaroid-animated-wrapper');
    if (wrapper && wrapper.classList.contains('visible')) {
        wrapper.classList.remove('visible');

        // Listen for the end of the opacity transition on the wrapper to remove it from DOM
        const onTransitionEnd = (event) => {
            if (event.target === wrapper && event.propertyName === 'opacity') {
                if (wrapper.parentElement) { // Check again before removing
                    wrapper.remove();
                }
            }
        };
        wrapper.addEventListener('transitionend', onTransitionEnd, { once: true });
    }
}

function showAnimatedPolaroid(feature) {
    // If an old wrapper exists, remove it immediately to prevent overlap or issues.
    const existingWrapper = document.querySelector('.polaroid-animated-wrapper');
    if (existingWrapper) {
        existingWrapper.remove();
    }

    const imagePath = `assets/geotagged_photos/display/${feature.properties.filepath}`;
    const captionText = feature.properties.filename || feature.properties.filepath.split('/').pop() || "Photo";

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'polaroid-animated-wrapper';
    wrapper.onclick = function(event) { // Click on backdrop to close
        if (event.target === wrapper) { // Only if click is on wrapper itself
            hideAnimatedPolaroidOnClick();
        }
    };

    // Create polaroid element
    const polaroidElement = document.createElement('div');
    polaroidElement.className = 'polaroid'; // Use existing .polaroid styles

    polaroidElement.innerHTML = `
        <img src="${imagePath}" alt="Photo">
        <p class="caption">${captionText}</p>
    `;

    // Prevent clicks on the polaroid itself from closing it via the wrapper's click listener
    polaroidElement.onclick = function(event) {
        event.stopPropagation();
    };

    wrapper.appendChild(polaroidElement);
    document.body.appendChild(wrapper);

    // Trigger the animation by adding 'visible' class to wrapper.
    // Using requestAnimationFrame ensures the element is in the DOM and initial styles are applied
    // before the class change, allowing the CSS transition to occur.
    requestAnimationFrame(() => {
        // A second rAF can help ensure the transition triggers reliably in all browsers
        requestAnimationFrame(() => {
            wrapper.classList.add('visible');
        });
    });
}

// Main function to set up the map and layers
async function setupMap() {
    const map = initializeMap('map', [36.2048, 138.2529], 7);

    // Configuration for the animated line layer
    const animatedLineLayerConfig = {
        type: 'line',
        filePath: 'assets/lines/animation_tracks.geojson',
        style: geoJSONLayerStyles.publicTransport,
        // onEachFeature: optionalCallbackForLines // Uncomment if you have one
    };

    // Configuration for point layers
    const pointLayersConfig = [
        {
            type: 'point',
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos
        }
        // Add other point layer configurations here if needed
    ];

    const animationDelay = 2000; // Delay between starting each animation chunk

    // Handle sequenced animation for the main animated_tracks.geojson
    if (animatedLineLayerConfig.filePath === 'assets/lines/animation_tracks.geojson') {
        // Call each animation order sequentially with a delay

        // AnimationOrder 1.0
        await addAnimatedLineGeoJsonLayer(map, animatedLineLayerConfig.filePath, animatedLineLayerConfig.style, animatedLineLayerConfig.onEachFeature, 1.0, 500); // Example: 3000ms duration
        await new Promise(resolve => setTimeout(resolve, 500));

        // AnimationOrder 2.0
        await addAnimatedLineGeoJsonLayer(map, animatedLineLayerConfig.filePath, animatedLineLayerConfig.style, animatedLineLayerConfig.onEachFeature, 2.0, 1000); // Example: 2500ms duration
        await new Promise(resolve => setTimeout(resolve, 1000));

        // AnimationOrder 3.0
        await addAnimatedLineGeoJsonLayer(map, animatedLineLayerConfig.filePath, animatedLineLayerConfig.style, animatedLineLayerConfig.onEachFeature, 3.0, 1000); // Example: 2000ms duration
        await new Promise(resolve => setTimeout(resolve, 1000));

        // AnimationOrder 4.0
        await addAnimatedLineGeoJsonLayer(map, animatedLineLayerConfig.filePath, animatedLineLayerConfig.style, animatedLineLayerConfig.onEachFeature, 4.0, 2000); // Example: 3500ms duration
        await new Promise(resolve => setTimeout(resolve, 2000));

        // AnimationOrder 5.0
        await addAnimatedLineGeoJsonLayer(map, animatedLineLayerConfig.filePath, animatedLineLayerConfig.style, animatedLineLayerConfig.onEachFeature, 5.0, 1000); // Example: 4000ms duration
        // No delay needed after the last animation order
    }
    // Add other animated line layers here if you have any that are not part of the sequence
    // For example:
    // await addAnimatedLineGeoJsonLayer(map, 'path/to/other_animated_lines.geojson', someStyle, someCallback, undefined);

    // Add static walking routes
    await addStaticLineGeoJsonLayer(map, 'assets/lines/walking_routes.geojson', geoJSONLayerStyles.walking);
    await addStaticLineGeoJsonLayer(map, 'assets/lines/cycling_routes.geojson', geoJSONLayerStyles.cycling);
    await addStaticLineGeoJsonLayer(map, 'assets/lines/ferries.geojson', geoJSONLayerStyles.ferry);

    // Load all point layers after all line animations are initiated
    for (const layerConfig of pointLayersConfig) {
        if (layerConfig.type === 'point') {
            await addPointGeoJsonLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer);
        }
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here
}

// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', setupMap);