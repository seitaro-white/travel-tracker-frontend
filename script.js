import { LineStyles } from './src/features/geojson/geojsonStyles.js';
// Import the new function from geojsonService.js
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer, createGeoJsonPointLayer, manageLayerVisibilityByZoom, animateMarkerAlongLine  } from './src/features/geojson/geojsonService.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/markers/photoViewer.js';
import { onEachInfoFeature, pointToLayerForInfo} from './src/features/markers/infoViewer.js';
import { showScrollyPanel } from './src/features/overlays/scrollyPanel.js';

// Function to initialize the map with responsive center/zoom.
function initializeMap(mapId) {
    // Choose settings based on viewport width.
    // You can adjust the breakpoints and values as needed.
    // Ok these turned out to be the same lol after testing I found that was best
    let center, zoom;
    if (window.innerWidth < 700) { // Treat as mobile if width < 700px
        center = [39.39, 138.40]; // Example: focus more on Tokyo for mobile
        zoom = 6;
    } else {
        center = [39.39, 138.40]; // Original center for desktop
        zoom = 6;
    }
    const map = L.map(mapId, {}).setView(center, zoom);
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
    const map = initializeMap('map');

    // 1. Animate the incoming flight marker first
    await animateMarkerAlongLine(map, 'assets/lines/incoming_flight.geojson');

    // 2. Now start the main chained animation
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

    // Use the new generic function to manage the info layer's visibility.
    // This will show the layer only when the zoom level is 17 or higher.
    manageLayerVisibilityByZoom(map, infoPointLayer, 10);

    // After animation finishes:
    showScrollyPanel(`
      <h2>Welcome to the Journey!</h2>
      <p>This interactive map tells the story of my travels across Japan. Scroll down to continue.</p>
      <p>You'll see animated routes, photos, and more. Enjoy exploring!</p>
    `, () => {
      // This callback runs after the panel is closed
      // Continue with info/photos logic here
    });

    // Add photo clusters
    const photosPointLayer = await addClusteredGeoJsonPointLayer(
        'assets/points/photos.geojson',
        onEachPhotoFeature,
        pointToLayerForPhotos);

    photosPointLayer.addTo(map);


}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);