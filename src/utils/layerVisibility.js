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
