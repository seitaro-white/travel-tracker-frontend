import { LineStyles } from './src/features/geojson/geojsonStyles.js';
// Import the new function from geojsonService.js
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer, createGeoJsonPointLayer  } from './src/features/geojson/geojsonService.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/markers/photoViewer.js';
import { onEachInfoFeature, pointToLayerForInfo} from './src/features/markers/infoViewer.js';

// Function to initialize the map.
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId, {}).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.{ext}', {
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
    const map = initializeMap('map', [39.390439, 138.403350], 6);

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


    // Add info layers
    const infoPointLayer = await createGeoJsonPointLayer(
        'assets/points/information.geojson',
        onEachInfoFeature,
        pointToLayerForInfo
        );

    // Define the minimum zoom level at which the info layer should be visible.
    const infoLayerMinZoom = 17;

    // This function checks the map's current zoom level and decides whether to show or hide the info layer.
    const updateInfoLayerVisibility = () => {
        // Get the current zoom level from the map instance.
        const currentZoom = map.getZoom();

        // Check if the current zoom is at or above our minimum threshold.
        if (currentZoom >= infoLayerMinZoom) {
            // If the layer isn't already on the map, add it.
            // The map.hasLayer() check prevents errors from adding a layer multiple times.
            if (!map.hasLayer(infoPointLayer)) {
                map.addLayer(infoPointLayer);
            }
        } else {
            // If the zoom is below the threshold, remove the layer if it's currently on the map.
            if (map.hasLayer(infoPointLayer)) {
                map.removeLayer(infoPointLayer);
            }
        }
    };

    // Listen for the 'zoomend' event on the map. This event fires every time the map finishes a zoom animation.
    // When it fires, we call our function to update the layer's visibility.
    map.on('zoomend', updateInfoLayerVisibility);

    // We also call the function once right after setting it up.
    // This ensures the layer's visibility is correctly set when the map first loads.
    updateInfoLayerVisibility();



    // Add photo clusters
    const photosPointLayer = await addClusteredGeoJsonPointLayer(
        'assets/points/photos.geojson',
        onEachPhotoFeature,
        pointToLayerForPhotos);

    photosPointLayer.addTo(map);

    // Example marker for Kyoto.
    const kyotoMarker = L.marker([39.390439, 138.403350]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);