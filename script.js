import { LineStyles } from './src/features/geojson/geojsonStyles.js';
import { createGeoJsonLineLayer } from './src/features/geojson/geojsonService.js';
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
        const el = layer._path || layer._icon;
        if (el) {
            el.style.transition = 'opacity 1s';
            el.style.opacity = 0;
        }
    });
}

// Helper function: fades in layers over 1 second.
function fadeInLayers(layers) {
    // This console log helps confirm that the function is called with the expected layers.
    console.log('fadeInLayers called with:', layers);

    // This is an inner helper function. It's defined inside fadeInLayers
    // so it can be reused for each individual feature layer that needs to be faded in.
    // 'featureLayer' is an individual Leaflet layer (like a polyline for a single GeoJSON feature).
    // 'logPrefix' is just a string to make console messages clearer by indicating which layer/feature is being processed.
    const applyFadeToElement = (featureLayer, logPrefix = '') => {
        // Leaflet layers that represent visual elements on the map usually have
        // a direct reference to their underlying DOM element.
        // For vector layers (like lines and polygons from GeoJSON), this is typically '_path'.
        // For markers, this is typically '_icon'.
        const el = featureLayer._path || featureLayer._icon;
        console.log(`${logPrefix}Sub-Layer:`, featureLayer, 'Element:', el);

        // Check if we successfully got a DOM element.
        if (el) {
            // Log the element's inline style before we make changes.
            // JSON.parse(JSON.stringify(el.style)) is a way to get a clean copy of the style object for logging.
            console.log(`${logPrefix}Initial style:`, JSON.parse(JSON.stringify(el.style)));

            // 1. Explicitly set the element's CSS 'opacity' style to 0.
            // This is the starting point for our fade-in animation.
            // We're directly manipulating the CSS 'style' property of the DOM element.
            el.style.opacity = 0;
            console.log(`${logPrefix}After setting opacity to 0:`, el.style.opacity);

            // 2. Define the CSS 'transition' property on the element.
            // This tells the browser how to animate changes to certain CSS properties.
            // 'opacity 1s ease-in-out' means:
            //   - Animate the 'opacity' property.
            //   - The animation should last for 1 second.
            //   - 'ease-in-out' is a timing function that makes the animation
            //     start and end smoothly.
            el.style.transition = 'opacity 1s ease-in-out';
            console.log(`${logPrefix}After setting transition:`, el.style.transition);

            // 3. Defer setting opacity to 1 using 'requestAnimationFrame'.
            // 'requestAnimationFrame' asks the browser to run a function just before the next repaint.
            // This is important for CSS transitions to work reliably when styles are changed with JavaScript.
            // If we set opacity to 0 and then immediately to 1 in the same block of JavaScript code,
            // the browser might optimize it and not "see" the change, so the transition wouldn't play.
            requestAnimationFrame(() => {
                console.log(`${logPrefix}First rAF, el.style.opacity before change:`, el.style.opacity);
                // Using a second, nested 'requestAnimationFrame' is a common defensive pattern.
                // It gives the browser an extra "tick" to ensure it has processed the
                // initial opacity (0) and the transition rule before we ask it to animate to opacity 1.
                requestAnimationFrame(() => {
                    console.log(`${logPrefix}Second rAF, setting opacity to 1`);
                    // Now, change the opacity to 1. Because a transition is defined for 'opacity',
                    // the browser will animate this change from 0 to 1 over 1 second.
                    el.style.opacity = 1;
                    console.log(`${logPrefix}After setting opacity to 1:`, el.style.opacity);
                });
            });
        } else {
            // If 'el' is null or undefined, it means we couldn't find the DOM element
            // for this Leaflet layer, so we can't animate it.
            console.log(`${logPrefix}No element (_path or _icon) found for this sub-layer.`);
        }
    };

    // The 'layers' argument is an array of top-level Leaflet layers
    // (e.g., [staticLayer1, staticLayer2, ...]).
    layers.forEach((layer, groupIndex) => {
        console.log(`Processing Group/Layer ${groupIndex}:`, layer);

        // Check if the current 'layer' is a Leaflet LayerGroup (like L.GeoJSON).
        // LayerGroups can contain multiple individual feature layers.
        // The 'eachLayer' method is a way to iterate over these child layers.
        if (typeof layer.eachLayer === 'function') {
            // 'layer.eachLayer' calls the provided function for each individual layer
            // (e.g., each polyline) within the GeoJSON group.
            // The callback function receives the 'featureLayer' (the child layer).
            // It does NOT provide an index for this child layer.
            let featureCounter = 0; // We can create our own counter for logging if needed.
            layer.eachLayer((featureLayer) => {
                // Create a descriptive prefix for logging, using the groupIndex and our manual featureCounter.
                const logPrefix = `  Group ${groupIndex}, Feature ${featureCounter} - `;
                applyFadeToElement(featureLayer, logPrefix);
                featureCounter++; // Increment for the next feature in this group.
            });
        } else {
            // If 'layer' is not a group (e.g., it's a single L.Marker or L.Polyline
            // that wasn't part of a GeoJSON group), we apply the fade effect directly to it.
            const logPrefix = `  Layer ${groupIndex} - `;
            applyFadeToElement(layer, logPrefix);
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to set up the map and layers.
async function setupMap() {
    const map = initializeMap('map', [36.2048, 138.2529], 7);

    // Start the chained line animation and get back an array of animated layers.
    const animatedLayers = await animateChainedGeoJson(map, 'assets/lines/animation_tracks.geojson');
    // Once the animation finishes, fade it out.
    fadeOutLayers(animatedLayers);

    // Wait for 2 seconds before adding static layers.
    await sleep(2000);

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
            staggerDelay: 1
        }
    ];

    //for (const layerConfig of pointLayersConfig) {
    //    if (layerConfig.type === 'point') {
    //        const staggerMilliseconds = layerConfig.staggerDelay !== undefined ? layerConfig.staggerDelay : 50;
    //        await addGeoJsonPointLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer, staggerMilliseconds);
    //    }
    //}

    // Example marker for Kyoto.
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);