import { LineStyles } from './src/features/geojson/geojsonStyles.js';
// Import the new function from geojsonService.js
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer  } from './src/features/geojson/geojsonService.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/photos/photoViewer.js';

// Function to initialize the map.
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        maxZoom: 20,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png',
    }).addTo(map);
    return map;
}

// Helper function: fades out layers over 1 second.
// It checks for layer._path (for vector layers) or layer._icon (for markers).
function fadeOutLayers(layers) {
    layers.forEach(layer => {
        const el = layer._path;
        if (el) {
            el.style.transition = 'opacity 1s';
            el.style.opacity = 0;
        }
    });
}

// Helper function: fades in layers over 1 second.
function fadeInLayers(layers) {
    const applyFadeToElement = (featureLayer) => {
        const el = featureLayer._path;
        if (el) {
            el.style.opacity = 0;
            el.style.transition = 'opacity 1s ease-in-out';
            requestAnimationFrame(() => {
                el.style.opacity = 1;
            });
        }
    };

    layers.forEach((layer) => {
        layer.eachLayer((featureLayer) => {
            applyFadeToElement(featureLayer);
        });
    })
}


// Main function to set up the map and layers.
async function setupMap() {
    const map = initializeMap('map', [36.2048, 138.2529], 7);

    // Start the chained line animation and get back an array of animated layers.
    const animatedLayers = await animateChainedGeoJson(map, 'assets/lines/animation_tracks.geojson');
    // Once the animation finishes, fade it out.
    fadeOutLayers(animatedLayers);


    // Create static GeoJSON line layers without adding them to the map.
    const staticLayer1 = await createGeoJsonLineLayer('assets/lines/public_transport.geojson', LineStyles.publicTransport);
    const staticLayer2 = await createGeoJsonLineLayer('assets/lines/walking_routes.geojson', LineStyles.walking);
    const staticLayer3 = await createGeoJsonLineLayer('assets/lines/cycling_routes.geojson', LineStyles.cycling);
    const staticLayer4 = await createGeoJsonLineLayer('assets/lines/ferries.geojson', LineStyles.ferry);

    // Add the static layers to the map. Assume they are initially rendered with opacity 0.
    staticLayer1.addTo(map);
    staticLayer2.addTo(map);
    staticLayer3.addTo(map);
    staticLayer4.addTo(map);

    // Trigger their fade-in.
    fadeInLayers([staticLayer1, staticLayer2, staticLayer3, staticLayer4]);


    // Configuration and loading of point layers.
    const pointLayersConfig = [
        {
            type: 'point',
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos,
            // We will use the new clustered function for this layer
            cluster: true
        }
    ];

    for (const layerConfig of pointLayersConfig) {
        // Check if the layer should be clustered
        if (layerConfig.cluster) {
            // If so, call the new function to create a clustered layer
            await addClusteredGeoJsonPointLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer);
        }
        // Note: The old non-clustered logic has been removed for simplicity,
        // as the goal is to use clustering for the photos.
    }

    // Example marker for Kyoto.
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);