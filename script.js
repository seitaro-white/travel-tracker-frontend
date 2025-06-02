import { geoJSONLayerStyles } from './geojson_styles.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
}

// Function to load a GeoJSON layer and add it to the map
async function addGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback, pointToLayerCallback) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        const layerOptions = {};
        if (styleOptions) {
            layerOptions.style = styleOptions;
        }
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        if (pointToLayerCallback) {
            layerOptions.pointToLayer = pointToLayerCallback;
        }

        L.geoJSON(geojsonData, layerOptions).addTo(map);
    } catch (error) {
        console.error('Error loading or parsing GeoJSON:', filePath, error);
    }
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
            // Bring the marker's icon element to the front of its parent pane
            L.DomUtil.toFront(iconDiv);

            // Apply hover styles directly to the iconDiv
            iconDiv.style.width = "30px";
            iconDiv.style.height = "30px";
            iconDiv.style.border = "3px solid red"; // Test border
            iconDiv.style.borderRadius = "50%"; // Make the div itself circular to match image

            // Ensure the divIcon container allows the (now larger) image to be fully visible
            // and that the div itself is on top.
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000; // Explicitly set CSS z-index
        }
    });

    // Mouseoff event
    layer.on('mouseout', function (e) {
        const iconDiv = this._icon;
        if (iconDiv) {
            // Revert iconDiv to its original size (from L.divIcon options)
            iconDiv.style.width = "20px";  // Corresponds to iconSize[0]
            iconDiv.style.height = "20px"; // Corresponds to iconSize[1]
            iconDiv.style.border = "";      // Remove border
            iconDiv.style.borderRadius = ""; // Remove div's border-radius

            iconDiv.style.zIndex = ''; // Revert z-index
            // iconDiv.style.overflow = ''; // Revert overflow if needed
            // No direct equivalent to "sendToBack" for this specific DOM manipulation,
            // the natural stacking order will resume or other hovered items will come to front.
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
    const map = initializeMap('map', [36.2048, 138.2529], 5.7);

    // Define layers to load
    const layersToLoad = [
        { filePath: 'assets/lines/public_transport.geojson', style: geoJSONLayerStyles.publicTransport },
        { filePath: 'assets/lines/walking_routes.geojson', style: geoJSONLayerStyles.walking },
        { filePath: 'assets/lines/cycling_routes.geojson', style: geoJSONLayerStyles.cycling },
        { filePath: 'assets/lines/ferries.geojson', style: geoJSONLayerStyles.ferry },
        {
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos
        }
    ];

    // Load all GeoJSON layers
    for (const layerConfig of layersToLoad) {
        await addGeoJsonLayer(map, layerConfig.filePath, layerConfig.style, layerConfig.onEachFeature, layerConfig.pointToLayer);
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here
}

// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', setupMap);