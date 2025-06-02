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
        this.bringToFront(); // Bring the marker to the front
        const iconDiv = this._icon; // Get the divIcon's wrapper element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                imgElement.style.transform = 'scale(1.5)'; // Make the image 50% larger
                imgElement.style.border = '2px solid #007bff'; // Add a blue border
                imgElement.style.transition = 'transform 0.1s ease-in-out, border 0.1s ease-in-out'; // Smooth transition
            }
            // Ensure the divIcon itself allows the scaled image to be fully visible
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000; // Explicitly set z-index for hover
        }
    });

    // Mouseoff event
    layer.on('mouseout', function (e) {
        const iconDiv = this._icon; // Get the divIcon's wrapper element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                imgElement.style.transform = 'scale(1)'; // Revert to original size
                imgElement.style.border = ''; // Remove the border
            }
            iconDiv.style.zIndex = ''; // Revert z-index
            // iconDiv.style.overflow = ''; // Revert overflow if it was changed from a default
        }
    });
}

// Specific callback for photo markers
function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/thumbnail/${feature.properties.filepath}`;
        const iconHtml = `<img src="${imagePath}" alt="Photo location" style="width:20px; height:20px; border-radius:50%; object-fit:cover; display:block;">`;

        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Set to empty to avoid default Leaflet divIcon styling
            iconSize: [20, 20],
            iconAnchor: [10, 10],
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