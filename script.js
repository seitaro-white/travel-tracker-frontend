import { geoJSONLayerStyles } from './geojson_styles.js';
import { addAnimatedLineGeoJsonLayer, addPointGeoJsonLayer } from '/src/services/geojson.js';

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
        const popupContent = `<img src="${imagePath}" alt="Photo" style="width:500px; height:500px; object-fit:cover">`;
        layer.bindPopup(popupContent, { maxWidth: 500 });
    }

    // Mouseover event
    layer.on('mouseover', function (e) {
        const iconDiv = this._icon; // Get the L.divIcon's main div element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                // Apply hover styles to the img element
                imgElement.style.transform = 'scale(1.5)'; // Adjusted scale for a less extreme jump
                imgElement.style.border = "2px solid red";
                // Apply transition - ensure it's consistently applied
                imgElement.style.transition = 'transform 0.2s ease-in-out, border-color 0.2s ease-in-out, border-width 0.2s ease-in-out, border-style 0.2s ease-in-out';
            }

            // Ensure the iconDiv container allows the (now larger) image to be fully visible
            // and that the iconDiv itself is on top.
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000;
        }
    });

    // Mouseoff event
    layer.on('mouseout', function (e) {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                // Revert img element to its original style
                imgElement.style.transform = 'scale(1)';
                // Transition border properties for a smooth disappearance
                imgElement.style.borderColor = 'transparent'; // Make color transparent
                imgElement.style.borderWidth = '0px';       // Make width zero
                // border-style will remain 'solid' from hover, but invisible with 0px width / transparent color
                // The transition property set on mouseover will apply to these changes.

            }

            //iconDiv.style.zIndex = ''; // Revert z-index
            // iconDiv.style.overflow = 'hidden'; // Revert overflow to default, typically hidden for divIcon
        }
    });
}

// Specific callback for photo markers
function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/thumbnail/${feature.properties.filepath}`;
        // Ensure the img fills the iconDiv and maintains its appearance
        const iconHtml = `<img src="${imagePath}" alt="Photo location" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;

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

    // Define layers to load
    const layersToLoad = [
        // Line Layers
        { type: 'line', filePath: 'assets/lines/animation_tracks.geojson', style: geoJSONLayerStyles.publicTransport /*, onEachFeature: optionalCallbackForLines */ },
        // Point Layer
        {
            type: 'point',
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos
        }
    ];

    const animatedLineFilePath = 'assets/lines/animation_tracks.geojson';
    const animationDelay = 2000; // 5 seconds delay between starting each animation chunk

    // Load all GeoJSON layers
    for (const layerConfig of layersToLoad) {
        if (layerConfig.type === 'line') {
            if (layerConfig.filePath === animatedLineFilePath) {
                // Handle sequenced animation for animation_tracks.geojson
                const animationOrders = [1.0, 2.0, 3.0, 4.0]; // AnimationOrder values from your GeoJSON
                for (let i = 0; i < animationOrders.length; i++) {
                    const order = animationOrders[i];
                    await addAnimatedLineGeoJsonLayer(map, layerConfig.filePath, layerConfig.style, layerConfig.onEachFeature, order);
                    if (i < animationOrders.length - 1) { // Don't wait after the last animation order
                        await new Promise(resolve => setTimeout(resolve, animationDelay));
                    }
                }
            } else {
                // Load other line layers normally (if any)
                await addAnimatedLineGeoJsonLayer(map, layerConfig.filePath, layerConfig.style, layerConfig.onEachFeature, undefined);
            }
        } else if (layerConfig.type === 'point') {
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