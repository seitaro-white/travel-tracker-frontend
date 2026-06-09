import { LineStyles } from './src/features/geojson/geojsonStyles.js';
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer, createGeoJsonPointLayer } from './src/features/geojson/geojsonService.js';
import { manageLayerVisibilityByZoom } from './src/utils/layerVisibility.js';
import { animateMarkerAlongLine } from './src/features/animations/animateMarkerAlongLine.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/markers/photoViewer.js';
import { onEachInfoFeature, pointToLayerForInfo} from './src/features/markers/infoViewer.js';
import { onEachPlaceFeature, pointToLayerForPlaces } from './src/features/markers/placeViewer.js';
import { showOverlayPanel } from './src/features/overlays/overlayPanel.js';

// The static (non-animated) line layers, declared as data so they can be
// loaded, added, and faded in with a single loop below.
const STATIC_LINE_LAYERS = [
    { file: 'assets/lines/public_transport.geojson', style: LineStyles.publicTransport },
    { file: 'assets/lines/walking_routes.geojson', style: LineStyles.walking },
    { file: 'assets/lines/cycling_routes.geojson', style: LineStyles.cycling },
    { file: 'assets/lines/ferries.geojson', style: LineStyles.ferry },
];

// Point layers that should only be visible once zoomed in (zoom >= minZoom).
const ZOOMED_POINT_LAYERS = [
    { file: 'assets/points/information.geojson', onEachFeature: onEachInfoFeature, pointToLayer: pointToLayerForInfo, minZoom: 10 },
    { file: 'assets/points/places.geojson', onEachFeature: onEachPlaceFeature, pointToLayer: pointToLayerForPlaces, minZoom: 10 },
];

// Function to initialize the map with responsive center/zoom.
function initializeMap(mapId) {
    // Choose settings based on viewport width.
    // You can adjust the breakpoints and values as needed.
    // Ok these turned out to be the same lol after testing I found that was best
    let center, zoom;
    if (window.innerWidth < 700) { // Treat as mobile if width < 700px
        center = [39.39, 138.40]; // Example: focus more on Tokyo for mobile
        zoom = 5;
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

// Helper function to fetch HTML content from a file.
// Returns a Promise that resolves to the HTML string.
async function fetchHtmlFile(filePath) {
    const response = await fetch(filePath);
    return await response.text();
}

// Builds the always-visible legend (a hover icon + the mini map key) and adds
// it to the page. The key markup lives in miniMapKey.html.
async function setupLegend() {
    // Create a container for the legend icon and the map key.
    // This container will be positioned in the top-right of the screen.
    const legendContainer = document.createElement('div');
    legendContainer.id = 'legend-container';
    legendContainer.className = 'legend-container';

    // Create the legend icon that the user will hover over (a Font Awesome icon).
    const legendIcon = document.createElement('i');
    legendIcon.className = 'fa fa-map-o legend-icon';
    legendContainer.appendChild(legendIcon);

    // Fetch the mini map key HTML and insert it right after the icon.
    const miniMapKeyHtml = await fetchHtmlFile('miniMapKey.html');
    legendContainer.insertAdjacentHTML('beforeend', miniMapKeyHtml);

    // Add the complete legend container (with icon and hidden key) to the page.
    document.body.appendChild(legendContainer);
}

// Loads each static line layer, adds them to the map in order, and fades them in.
async function addStaticLineLayers(map) {
    // Load all layers in parallel; Promise.all preserves array order so the
    // draw/z-order matches STATIC_LINE_LAYERS.
    const layers = await Promise.all(
        STATIC_LINE_LAYERS.map(({ file, style }) => createGeoJsonLineLayer(file, style))
    );

    // Add the static layers to the map (initially rendered with opacity 0)...
    layers.forEach(layer => layer.addTo(map));
    // ...then trigger their fade-in.
    fadeInLayers(layers);
}

// Loads each zoom-gated point layer and wires up its zoom-based visibility.
async function addZoomedPointLayers(map) {
    for (const { file, onEachFeature, pointToLayer, minZoom } of ZOOMED_POINT_LAYERS) {
        const layer = await createGeoJsonPointLayer(file, onEachFeature, pointToLayer);
        // Show the layer only when the zoom level is at or above minZoom.
        manageLayerVisibilityByZoom(map, layer, minZoom);
    }
}

// Main function to set up the map and layers.
async function setupMap() {
    const map = initializeMap('map');

    await setupLegend();

    // 1. Animate the incoming flight marker first
    await animateMarkerAlongLine(map, 'assets/lines/incoming_flight.geojson', 'assets/icons/airplane.svg');

    // 2. Now start the main chained animation
    const animatedLayers = await animateChainedGeoJson(map, 'assets/lines/animation_tracks.geojson');
    // Once the animation finishes, fade it out.
    fadeOutLayers(animatedLayers);

    // 3. Add the static line layers (faded in).
    await addStaticLineLayers(map);

    // 4. Add the zoom-gated info and place point layers.
    await addZoomedPointLayers(map);

    // After animation finishes, show the intro overlay panel.
    // We fetch the HTML from the new file and pass it to showOverlayPanel.
    const introHtml = await fetchHtmlFile('introOverlay.html');
    // The legend is now always visible, so we no longer need a callback here.
    showOverlayPanel(introHtml);

    // Add photo clusters
    const photosPointLayer = await addClusteredGeoJsonPointLayer(
        'assets/points/photos.geojson',
        onEachPhotoFeature,
        pointToLayerForPhotos);

    photosPointLayer.addTo(map);
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);
