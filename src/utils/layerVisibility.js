/**
 * Manages the visibility of a layer based on the map's zoom level.
 * The layer is shown while the zoom level is within the [minZoom, maxZoom]
 * range (inclusive), and removed otherwise.
 *
 * By default `maxZoom` is Infinity, so passing only `minZoom` gives the
 * original "show once zoomed in past minZoom" behaviour. Passing a finite
 * `maxZoom` (with a low `minZoom`) gives the inverse: a layer that is only
 * visible when zoomed out, which is how the faint flight arcs are gated.
 *
 * @param {L.Map} map - The Leaflet map instance.
 * @param {L.Layer} layer - The layer to manage.
 * @param {number} minZoom - The minimum zoom level at which the layer should be visible.
 * @param {number} [maxZoom=Infinity] - The maximum zoom level at which the layer should be visible.
 */
export function manageLayerVisibilityByZoom(map, layer, minZoom, maxZoom = Infinity) {
    // This function checks the map's current zoom level and decides whether to show or hide the layer.
    const updateVisibility = () => {
        // Get the current zoom level from the map instance.
        const currentZoom = map.getZoom();

        // Check if the current zoom sits within our visible range.
        if (currentZoom >= minZoom && currentZoom <= maxZoom) {
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
