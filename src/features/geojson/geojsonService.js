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



// Builds the options object passed to L.geoJSON, including only the callbacks
// that were actually provided. Shared by the point and cluster layer builders.
function buildLayerOptions(onEachFeatureCallback, pointToLayerCallback) {
    const layerOptions = {};
    if (onEachFeatureCallback) {
        layerOptions.onEachFeature = onEachFeatureCallback;
    }
    if (pointToLayerCallback) {
        layerOptions.pointToLayer = pointToLayerCallback;
    }
    return layerOptions;
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
    const layerOptions = buildLayerOptions(onEachFeatureCallback, pointToLayerCallback);

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
    const layerOptions = buildLayerOptions(onEachFeatureCallback, pointToLayerCallback);

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