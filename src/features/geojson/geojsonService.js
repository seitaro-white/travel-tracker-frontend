// Function to fetch GeoJSON data
export async function fetchGeoJson(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
    }
    try {
        return await response.json();
    } catch (e) {
        throw new Error(`Failed to parse JSON from ${filePath}: ${e.message}`);
    }
}




// Adds all GeoJSON points to the map at once, without staggering.
// - map: Leaflet map instance
// - filePath: path to the GeoJSON file
// - onEachFeatureCallback: function to run on each feature
// - pointToLayerCallback: function to create a layer for each point
export async function createGeoJsonPointLayer(filePath, onEachFeatureCallback, pointToLayerCallback) {
    // Fetch the GeoJSON data from the provided file path
    const geojsonData = await fetchGeoJson(filePath);

    // Set up options for the GeoJSON layer
    const layerOptions = {};
    if (onEachFeatureCallback) {
        layerOptions.onEachFeature = onEachFeatureCallback;
    }
    if (pointToLayerCallback) {
        layerOptions.pointToLayer = pointToLayerCallback;
    }

    // Create the GeoJSON layer (not added to the map here; the caller does that).
    const layer = L.geoJSON(geojsonData, layerOptions)

    // Return the created layer.
    return layer;
}




/**
 * Adds a clustered GeoJSON point layer to the map.
 * This function fetches GeoJSON data and adds the points to a MarkerClusterGroup.
 *
 * @param {string} filePath - The path to the GeoJSON file.
 * @param {Function} onEachFeatureCallback - Callback for each feature.
 * @param {Function} pointToLayerCallback - Callback to create a layer for each point.
 * @returns {Promise<L.MarkerClusterGroup>} - A promise that resolves with the marker cluster group.
 */
export async function addClusteredGeoJsonPointLayer(filePath, onEachFeatureCallback, pointToLayerCallback) {
    // This function creates the custom icon for each cluster.
    const createClusterIcon = function (cluster) {
        // Get all markers in the cluster.
        const childMarkers = cluster.getAllChildMarkers();
        // Get the HTML for the first, second, and third marker icons if they exist.
        const firstMarkerIconHtml = childMarkers[0]?.options.icon.options.html || '';
        const secondMarkerIconHtml = childMarkers[1]?.options.icon.options.html || '';
        const thirdMarkerIconHtml = childMarkers[2]?.options.icon.options.html || '';

        // Build the HTML for the stack.
        // The order here is first, second, third (bottom to top in the DOM).
        // The CSS z-index should control the visual stacking.
        let clusterHtml = `
            <div class="custom-cluster-stack">
                <div class="stack-item stack-item-1">${firstMarkerIconHtml}</div>
                <div class="stack-item stack-item-2">${secondMarkerIconHtml}</div>
        `;
        // Only include the third stack item if there is a third marker.
        if (thirdMarkerIconHtml) {
            clusterHtml += `<div class="stack-item stack-item-3">${thirdMarkerIconHtml}</div>`;
        }
        clusterHtml += `
            </div>
        `;

        // Create a new Leaflet DivIcon using our custom HTML.
        return L.divIcon({
            html: clusterHtml,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // Create a new marker cluster group with our custom iconCreateFunction.
    const markers = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 15,
        zoomToBoundsOnClick: true,
        iconCreateFunction: createClusterIcon
    });

    // Fetch the GeoJSON data.
    const geojsonData = await fetchGeoJson(filePath);

    // Define the options for the GeoJSON layer, including callbacks.
    const layerOptions = {};
    if (onEachFeatureCallback) {
        layerOptions.onEachFeature = onEachFeatureCallback;
    }
    if (pointToLayerCallback) {
        layerOptions.pointToLayer = pointToLayerCallback;
    }

    // Create a GeoJSON layer with the data and options.
    const geoJsonLayer = L.geoJSON(geojsonData, layerOptions);

    // Add the markers from the GeoJSON layer to the cluster group.
    markers.addLayer(geoJsonLayer);

    // Return the created cluster group.
    return markers;
}


/**
 * Creates a GeoJSON line layer using the provided file path and style,
 * but does not add it to the map.
 *
 * @param {string} filePath - URL/path to the GeoJSON file.
 * @param {object} style - Styling options for the layer.
 * @returns {Promise<Layer>} - A promise resolving to the created GeoJSON layer.
 */
export async function createGeoJsonLineLayer(filePath, style) {
    // Fetch the GeoJSON data (fetchGeoJson handles HTTP and JSON-parse errors).
    const geojson = await fetchGeoJson(filePath);
    // Create the layer using Leaflet's geoJSON factory.
    const layer = L.geoJSON(geojson, {
        style: style
    });
    // Return the layer (do not add it to any map yet).
    return layer;
}

/**
 * Manages the visibility of a layer based on the map's zoom level.
 * The layer will be added to the map when the zoom level is at or above `minZoom`,
 * and removed when it is below `minZoom`.
 *
 * @param {L.Map} map - The Leaflet map instance.
 * @param {L.Layer} layer - The layer to manage.
 * @param {number} minZoom - The minimum zoom level at which the layer should be visible.
 */
export function manageLayerVisibilityByZoom(map, layer, minZoom) {
    // This function checks the map's current zoom level and decides whether to show or hide the layer.
    const updateVisibility = () => {
        // Get the current zoom level from the map instance.
        const currentZoom = map.getZoom();

        // Check if the current zoom is at or above our minimum threshold.
        if (currentZoom >= minZoom) {
            // If the layer isn't already on the map, add it.
            // The map.hasLayer() check prevents errors from adding a layer that's already present.
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
            }
        } else {
            // If the zoom is below the threshold, remove the layer if it's currently on the map.
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    };

    // Listen for the 'zoomend' event on the map. This event fires every time a zoom animation completes.
    // When it fires, we call our function to update the layer's visibility.
    map.on('zoomend', updateVisibility);

    // We also call the function once right after setting it up.
    // This ensures the layer's visibility is correctly set when the map first loads.
    updateVisibility();
}

/**
 * Animates a marker (e.g., a plane) along a line from a GeoJSON file.
 * The line itself is invisible; only the marker moves.
 * Returns a promise that resolves when the animation finishes.
 *
 * @param {L.Map} map - The Leaflet map instance.
 * @param {string} filePath - Path to the GeoJSON file (should contain a single LineString).
 * @param {string} svgPath - Path to the SVG file used as the moving marker icon.
 * @param {number} [speed=1500000] - Animation speed (meters per hour).
 * @returns {Promise<void>}
 */
export async function animateMarkerAlongLine(map, filePath, svgPath, speed = 1500000) {
    // Fetch the GeoJSON data
    const geojson = await fetchGeoJson(filePath);
    const feature = geojson.features[0];

    // Fetch the SVG file as text
    let svgText = await fetch(svgPath).then(res => res.text());
    // Inject motion-base="-48" into the root <svg> tag so Leaflet.Motion rotates it
    svgText = svgText.replace(
        /<svg([\s\S]*?)>/i,
        '<svg$1 motion-base="-48">'
    );

    // Declare markerIcon as a constant
    const markerIcon = L.divIcon({
        html: svgText,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    // Convert coordinates to [lat, lng]
    const coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);

    // Create the motion polyline with invisible style and easing
    const layer = L.motion.polyline(
        coords,
        { color: "#000", opacity: 0, weight: 2 }, // invisible line
        { auto: true, speed: speed, easing: L.Motion.Ease.easeOutSine },
        { icon: markerIcon }
    ).addTo(map);

    // Return a promise that resolves when the animation ends
    return new Promise(resolve => {
        layer.once(L.Motion.Event.Ended, () => {
            map.removeLayer(layer);
            resolve();
        });
    });
}