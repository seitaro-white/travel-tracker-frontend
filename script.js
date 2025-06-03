import { geoJSONLayerStyles } from './geojson_styles.js';
import { addAnimatedLineGeoJsonLayer, addPointGeoJsonLayer, addStaticLineGeoJsonLayer } from '/src/services/geojson.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(
        mapId, {

    }).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
}


// Specific callback for photo popups
function onEachPhotoFeature(feature, layer) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/display/${feature.properties.filepath}`;
        // Use filepath as a placeholder for caption, or use another property if available
        const captionText = feature.properties.filename || feature.properties.filepath.split('/').pop() || "Photo";

        const popupContent = `
            <div class="polaroid">
                <img src="${imagePath}" alt="Photo">
                <p class="caption">${captionText}</p>
            </div>`;
        // Adjust maxWidth to accommodate the .polaroid's CSS max-width (e.g., 450px + buffer)
        layer.bindPopup(popupContent, { maxWidth: 500 });
    }

    // Mouseover event
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

    // Mouseout event
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