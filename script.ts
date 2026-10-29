import L from './src/lib/leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { LineStyles } from './src/features/geojson/geojsonStyles';
import { createGeoJsonLineLayer, addClusteredGeoJsonPointLayer, createGeoJsonPointLayer } from './src/features/geojson/geojsonService';
import { createArcedFlightLayer } from './src/features/geojson/flightArcs';
import { manageLayerVisibilityByZoom } from './src/utils/layerVisibility';
import { animateMarkerAlongLine } from './src/features/animations/animateMarkerAlongLine';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/markers/photoViewer';
import { onEachInfoFeature, pointToLayerForInfo } from './src/features/markers/infoViewer';
import { onEachPlaceFeature, pointToLayerForPlaces } from './src/features/markers/placeViewer';
import { INTRO_PHOTO, showIntroCard } from './src/features/overlays/introCard';
import { showPolaroidStack } from './src/features/carousel/polaroidStack';
import { createCaption } from './src/features/opening/caption';

// Dismissal, not merely arriving at the map, makes the next visit a return.
const SEEN_KEY = 'travel-tracker:intro-seen';
const PLANE_TEXT = 'January 2025 — landing in Tokyo';
const LINES_TEXT = '…and everywhere since';
const NORMAL_FADE_MS = 1000;
const QUICK_FADE_MS = 500;
// Removal fires leaflet.motion's Ended event; phase continuations must know
// that this was a skip rather than permission to start the next phase.
let skipped = false;

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
const FLIGHT_MAX_ZOOM = 10;

// Point layers that should only be visible once zoomed in (zoom >= minZoom).
const ZOOMED_POINT_LAYERS = [
    // Each factory pairs callbacks with its own property interface. A single
    // union of unrelated callbacks would lose that pairing in TypeScript.
    { create: () => createGeoJsonPointLayer('assets/points/information.geojson', onEachInfoFeature, pointToLayerForInfo), minZoom: 10 },
    { create: () => createGeoJsonPointLayer('assets/points/places.geojson', onEachPlaceFeature, pointToLayerForPlaces), minZoom: 10 },
];

// Function to initialize the map with responsive center/zoom.
function initializeMap(mapId: string) {
    // Choose settings based on viewport width.
    // You can adjust the breakpoints and values as needed.
    // Ok these turned out to be the same lol after testing I found that was best
    let center: L.LatLngTuple, zoom: number;
    if (window.innerWidth < 700) { // Treat as mobile if width < 700px
        center = [39.39, 138.40]; // Example: focus more on Tokyo for mobile
        zoom = 5;
    } else {
        center = [39.39, 138.40]; // Original center for desktop
        zoom = 6;
    }
    const map = L.map(mapId, { maxZoom: 20 }).setView(center, zoom);

    // Basemap selection: Thunderforest only runs in production, where the
    // GitHub Pages deploy workflow injects config.js with `useThunderforest: true`
    // AND the real API key (from the THUNDERFOREST_API_KEY secret). Locally there
    // is no config.js (or no flag), so we use keyless OpenStreetMap tiles —
    // this keeps local exploring from burning the Thunderforest quota.
    // See config.example.js.
    const cfg = window.__APP_CONFIG__ || {};
    const useThunderforest = cfg.useThunderforest === true && cfg.thunderforestApiKey;

    if (useThunderforest) {
        const tfUrl = `https://api.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=${cfg.thunderforestApiKey}`;
        L.tileLayer(tfUrl, {
            maxZoom: 19,
            maxNativeZoom: 19,   // stop *requesting* past here; upscale beyond
            attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a>, © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
    } else {
        // Standard OSM tiles need no key. Normal browser caching and visible
        // attribution satisfy their interactive-use requirements; E2Es stub tiles
        // rather than send repeated automated pan/zoom requests to the service.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 20,
            maxNativeZoom: 19, // OSM stops at 19; upscale at the map's zoom-20 ceiling.
            attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
    }
    return map;
}

// The same fade helpers serve the normal crossfade and the quicker skip/return.
// Leaflet's public types omit _path. These functions only touch vector layers
// during the intro; a narrow optional field also covers an undrawn layer.
type FadeLayer = L.Layer & { _path?: SVGPathElement };
function fadeOutLayers(layers: L.Layer[], durationMs: number) {
    layers.forEach(layer => {
        const el = (layer as FadeLayer)._path;
        if (el) {
            el.style.transition = `opacity ${durationMs}ms`;
            el.style.opacity = '0';
        }
    });
}

function fadeInLayers(layers: L.LayerGroup[], durationMs: number) {
    const applyFadeToElement = (featureLayer: L.Layer) => {
        const el = (featureLayer as FadeLayer)._path;
        if (el) {
            el.style.opacity = '0';
            el.style.transition = `opacity ${durationMs}ms ease-in-out`;
            requestAnimationFrame(() => {
                el.style.opacity = '1';
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
function delay(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
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
    const els = document.querySelectorAll<HTMLElement>(
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
async function fetchHtmlFile(filePath: string) {
    const response = await fetch(filePath);
    return await response.text();
}

// Builds the always-visible legend (hover or tap to open the mini map key) and adds
// it to the page. The key markup lives in miniMapKey.html.
async function setupLegend() {
    // Create a container for the legend icon and the map key.
    // This container will be positioned in the top-right of the screen.
    const legendContainer = document.createElement('div');
    legendContainer.id = 'legend-container';
    legendContainer.className = 'legend-container';

    const legendIcon = document.createElement('button');
    legendIcon.type = 'button';
    legendIcon.className = 'legend-icon';
    legendIcon.setAttribute('aria-label', 'Map key');
    legendIcon.innerHTML = '<i class="fa fa-map-o" aria-hidden="true"></i>';
    legendIcon.addEventListener('click', () => {
        // Mouse users keep pure hover behaviour; a click must not pin the key open.
        if (!window.matchMedia('(hover: hover)').matches) legendContainer.classList.toggle('is-open');
    });
    legendContainer.appendChild(legendIcon);

    // Fetch the mini map key HTML and insert it right after the icon.
    const miniMapKeyHtml = await fetchHtmlFile('miniMapKey.html');
    legendContainer.insertAdjacentHTML('beforeend', miniMapKeyHtml);

    // Add the complete legend container (with icon and hidden key) to the page.
    document.body.appendChild(legendContainer);
}

// This is separate from the legend container so hovering over About never
// opens the key. Returning visits also get it without opening the welcome card.
function addAboutButton(landOnPile: (card: HTMLButtonElement) => Promise<void>) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'about-button';
    button.setAttribute('aria-label', 'About this map');
    button.innerHTML = '<i class="fa fa-camera-retro" aria-hidden="true"></i>';
    button.addEventListener('click', () => showIntroCard({ faceUp: true, landOnPile }));
    document.body.appendChild(button);
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
async function addZoomedPointLayers(map: L.Map) {
    for (const { create, minZoom } of ZOOMED_POINT_LAYERS) {
        const layer = await create();
        // Show the layer only when the zoom level is at or above minZoom.
        manageLayerVisibilityByZoom(map, layer, minZoom);
    }
}

async function playOpening(group: L.LayerGroup, caption: ReturnType<typeof createCaption>): Promise<L.Layer[]> {
    caption.type(PLANE_TEXT);
    await animateMarkerAlongLine(group, 'assets/lines/incoming_flight.geojson', 'assets/icons/airplane.svg');
    if (skipped) return [];

    caption.type(LINES_TEXT);
    const layers = await animateChainedGeoJson(group, 'assets/lines/animation_tracks.geojson');
    if (skipped) return [];
    caption.remove();
    return layers;
}

async function runOpeningWithSkip(map: L.Map, group: L.LayerGroup) {
    let requestSkip: () => void;
    const skipRequested = new Promise<{ animatedLayers: L.Layer[]; skipped: boolean }>(resolve => {
        requestSkip = () => resolve({ animatedLayers: [], skipped: true });
    });
    const skip = () => {
        skipped = true;
        requestSkip();
        // onRemove cancels motion's animation frame and removes its marker.
        // It also fires Ended: the phase guards above stop the second caption,
        // while any chain children remain inert in this now-detached group.
        map.removeLayer(group);
        caption.remove();
    };
    const caption = createCaption(skip);
    map.once('click', skip); // Leaflet distinguishes a click/tap from a map drag.
    // A removed chain may never finish (its children cannot start). Racing the
    // skip lets setup continue without waiting for that abandoned promise.
    const result = await Promise.race([
        playOpening(group, caption).then(animatedLayers => ({ animatedLayers, skipped: false })),
        skipRequested,
    ]);
    map.off('click', skip);
    return result;
}

// All three paths share the same final layers, zoom gates and marker drop.
async function showFinishedMap(map: L.Map, { animatedLayers, fadeMs }: { animatedLayers: L.Layer[]; fadeMs: number }) {
    // Preload the static lines AND the faint flight arcs BEFORE the
    // crossfade. They aren't on the map yet, so the fetch latency doesn't
    // delay anything below. The flight arcs join the crossfade alongside the
    // other static lines.
    const staticLayers = await loadStaticLineLayers();
    const flightLayer = await createArcedFlightLayer('assets/lines/flights.geojson', LineStyles.flight);

    // Normal completion keeps the original 1s crossfade. Skip/return have no
    // animated lines left and fade the finished routes in over just 0.5s.
    staticLayers.forEach(layer => { layer.addTo(map); });
    flightLayer.addTo(map);
    fadeOutLayers(animatedLayers, fadeMs);
    fadeInLayers([...staticLayers, flightLayer], fadeMs);
    await delay(fadeMs);

    // The animated lines are now invisible (opacity 0); remove them from the map.
    animatedLayers.forEach(layer => { map.removeLayer(layer); });

    // Now that the flight arcs have faded in, hand them over to zoom-gating so
    // they fade from view once the user zooms in past FLIGHT_MAX_ZOOM. The map
    // starts zoomed out, so they stay visible until then.
    manageLayerVisibilityByZoom(map, flightLayer, 0, FLIGHT_MAX_ZOOM);

    // With the lines settled, bring in the markers with a drop-in animation.
    // The body class scopes the drop to this initial mount (see markers.css);
    // we remove it once the drop has played so later re-renders (e.g. clusters
    // recalculating on zoom) don't replay it.
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
}

async function setupMap() {
    const map = initializeMap('map');
    await setupLegend();

    // First dismissal and returning visits create the pile at different times.
    // Keep its promise (including a null result for no favourites) so reopening
    // always hands the card to the same pile, never a second one.
    let pile: ReturnType<typeof showPolaroidStack> | undefined;
    const landOnPile = async (card: HTMLButtonElement) => {
        pile ??= showPolaroidStack(map, INTRO_PHOTO);
        const stack = await pile;
        if (stack) await stack.receiveIntroCard(card);
    };
    const returning = localStorage.getItem(SEEN_KEY) === '1';
    if (returning) {
        await showFinishedMap(map, { animatedLayers: [], fadeMs: QUICK_FADE_MS });
        pile = showPolaroidStack(map, INTRO_PHOTO);
        addAboutButton(landOnPile);
    } else {
        const group = L.layerGroup().addTo(map);
        const opening = await runOpeningWithSkip(map, group);
        await showFinishedMap(map, {
            animatedLayers: opening.animatedLayers,
            fadeMs: opening.skipped ? QUICK_FADE_MS : NORMAL_FADE_MS,
        });
        map.removeLayer(group);
        showIntroCard({ landOnPile, onClose: () => {
            localStorage.setItem(SEEN_KEY, '1');
            addAboutButton(landOnPile);
        } });
    }
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);
