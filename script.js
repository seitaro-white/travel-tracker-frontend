import { LineStyles } from './src/features/geojson/geojsonStyles.js';
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer, createGeoJsonPointLayer } from './src/features/geojson/geojsonService.js';
import { createArcedFlightLayer } from './src/features/geojson/flightArcs.js';
import { manageLayerVisibilityByZoom } from './src/utils/layerVisibility.js';
import { animateMarkerAlongLine } from './src/features/animations/animateMarkerAlongLine.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/markers/photoViewer.js';
import { onEachInfoFeature, pointToLayerForInfo} from './src/features/markers/infoViewer.js';
import { onEachPlaceFeature, pointToLayerForPlaces } from './src/features/markers/placeViewer.js';
import { showOverlayPanel } from './src/features/overlays/overlayPanel.js';
import { showPolaroidStack } from './src/features/carousel/polaroidStack.js';

// The static (non-animated) line layers, declared as data so they can be
// loaded, added, and faded in with a single loop below.
const STATIC_LINE_LAYERS = [
    { file: 'assets/lines/public_transport.geojson', style: LineStyles.publicTransport },
    { file: 'assets/lines/walking_routes.geojson', style: LineStyles.walking },
    { file: 'assets/lines/cycling_routes.geojson', style: LineStyles.cycling },
    { file: 'assets/lines/ferries.geojson', style: LineStyles.ferry },
];

// Flight arcs are only meant to be glanceable from a zoomed-out view, so
// they're hidden once you zoom in past this level (see manageLayerVisibilityByZoom).
const FLIGHT_MAX_ZOOM = 9;

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
    const map = L.map(mapId, { maxZoom: 13 }).setView(center, zoom);

    // Stadia Maps API key comes from config.js (gitignored locally; injected
    // by the GitHub Pages deploy workflow from the STADIA_API_KEY secret).
    // See config.example.js.
    const stadiaApiKey = window.__APP_CONFIG__?.stadiaApiKey || '';
    const stadiaUrl = `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.{ext}?api_key=${stadiaApiKey}`;
    L.tileLayer(stadiaUrl, {
        maxZoom: 16,
        maxNativeZoom: 16,   // stop *requesting* past here; upscale beyond
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

// Resolves after `ms` milliseconds. CSS transitions are fire-and-forget, so we
// use this to wait one out before starting the next stage of the intro.
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Staggers the marker drop-in into a top-to-bottom "wave". Each marker's
// animation-delay scales with its vertical screen position, so markers near the
// top fall first and the whole cascade always fits inside MAX_STAGGER no matter
// how many markers there are. Must be called synchronously right after the
// markers mount (before the next paint) so the delays land before the CSS
// animation's first frame. Relies on `body.markers-dropping` being set so the
// inner content elements are the ones carrying the animation (see markers.css).
function staggerMarkerDrop() {
    const MAX_STAGGER = 1.5; // seconds spanning the first to the last marker
    const els = document.querySelectorAll(
        '.markers-dropping .custom-cluster-stack, ' +
        '.markers-dropping .place-marker, ' +
        '.markers-dropping .info-marker-icon, ' +
        '.markers-dropping .photo-marker-image'
    );
    if (!els.length) return;

    // Measure each marker's vertical position, then map that range onto the
    // delay window. (A single getBoundingClientRect pass; division guards
    // against every marker sharing the same top.)
    const tops = [...els].map(el => el.getBoundingClientRect().top);
    const minTop = Math.min(...tops);
    const span = Math.max(...tops) - minTop || 1;
    els.forEach((el, i) => {
        el.style.animationDelay = `${((tops[i] - minTop) / span) * MAX_STAGGER}s`;
    });
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

// Loads each static line layer in parallel, but does NOT add them to the map.
// Promise.all preserves array order so the eventual draw/z-order matches
// STATIC_LINE_LAYERS. Keeping load separate from display lets the caller add
// and fade them in at the exact moment the animated lines start fading out,
// so the two form a single simultaneous crossfade.
async function loadStaticLineLayers() {
    return Promise.all(
        STATIC_LINE_LAYERS.map(({ file, style }) => createGeoJsonLineLayer(file, style))
    );
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

    // 2. Now start the main chained animation.
    const animatedLayers = await animateChainedGeoJson(map, 'assets/lines/animation_tracks.geojson');

    // 3. Preload the static lines AND the faint flight arcs BEFORE the
    //    crossfade. They aren't on the map yet, so the fetch latency doesn't
    //    delay anything below. The flight arcs join the crossfade alongside the
    //    other static lines.
    const staticLayers = await loadStaticLineLayers();
    const flightLayer = await createArcedFlightLayer('assets/lines/flights.geojson', LineStyles.flight);

    // 4. Crossfade: add the static lines (and flight arcs) and fade them in over
    //    1s while the animated lines fade out over the same 1s, so one set of
    //    lines visually replaces the other. We wait the full second before
    //    continuing.
    staticLayers.forEach(layer => layer.addTo(map));
    flightLayer.addTo(map);
    fadeOutLayers(animatedLayers);
    fadeInLayers([...staticLayers, flightLayer]);
    await delay(1000);

    // The animated lines are now invisible (opacity 0); remove them from the map.
    animatedLayers.forEach(layer => map.removeLayer(layer));

    // Now that the flight arcs have faded in, hand them over to zoom-gating so
    // they fade from view once the user zooms in past FLIGHT_MAX_ZOOM. The map
    // starts zoomed out, so they stay visible until then.
    manageLayerVisibilityByZoom(map, flightLayer, 0, FLIGHT_MAX_ZOOM);

    // 5. With the lines settled, bring in the markers with a drop-in animation.
    //    The body class scopes the drop to this initial mount (see markers.css);
    //    we remove it once the drop has played so later re-renders (e.g. clusters
    //    recalculating on zoom) don't replay it.
    document.body.classList.add('markers-dropping');

    // The zoom-gated info and place points, then the photo clusters.
    await addZoomedPointLayers(map);

    const photosPointLayer = await addClusteredGeoJsonPointLayer(
        'assets/points/photos.geojson',
        onEachPhotoFeature,
        pointToLayerForPhotos);
    photosPointLayer.addTo(map);

    // Assign the staggered delays synchronously now that the markers are mounted,
    // so the cascade is set before the animation's first frame.
    staggerMarkerDrop();

    // Wait out the cascade (1.5s stagger window + 0.45s drop), then unscope it.
    await delay(2000);
    document.body.classList.remove('markers-dropping');

    // 6. Finally, once the lines and markers are in place, show the intro overlay.
    // We fetch the HTML from the new file and pass it to showOverlayPanel.
    const introHtml = await fetchHtmlFile('introOverlay.html');

    // 7. The pile of favourite photos is the closing beat of the intro: it
    //    slides in from the left once the reader dismisses the overlay, and
    //    then stays for the rest of the session.
    showOverlayPanel(introHtml, () => showPolaroidStack(map));
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);
