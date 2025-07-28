// This file contains functions for displaying 'place' markers on the map.

import { placeEmojis } from './placeEmojis.js';

/**
 * A callback function for Leaflet's onEachFeature option.
 * It binds a tooltip to each place marker to show its title on hover.
 *
 * @param {Object} feature - The GeoJSON feature.
 * @param {L.Layer} layer - The Leaflet layer for the feature.
 */
export function onEachPlaceFeature(feature, layer) {
    // Check if the feature has a 'Title' property.
    if (feature.properties && feature.properties.Title) {
        // Bind a tooltip to the layer.
        // The tooltip will show the 'Title' of the place.
        // 'direction: 'right'' makes it appear to the right of the icon.
        // 'offset: [10, 0]' moves it 10 pixels to the right.
        // 'className: 'place-tooltip'' allows for custom styling.
        layer.bindTooltip(feature.properties.Title, {
            direction: 'right',
            offset: [10, 0],
            className: 'place-tooltip'
        });
    }
}

/**
 * A callback function for Leaflet's pointToLayer option.
 * It creates a custom emoji marker for each place feature.
 *
 * @param {Object} feature - The GeoJSON feature for the place.
 * @param {L.LatLng} latlng - The marker's location.
 * @returns {L.Marker} - The Leaflet marker.
 */
export function pointToLayerForPlaces(feature, latlng) {
    // Get the place list category from the feature's properties.
    const placeCategory = feature.properties.placeList;

    // Look up the corresponding emoji from the placeEmojis map.
    // If the category isn't found, we'll use a default pushpin emoji.
    const emoji = placeEmojis[placeCategory] || '📍';

    // Create a custom icon using L.divIcon, which lets us use HTML for the marker.
    const customIcon = L.divIcon({
        html: `<div class="place-marker">${emoji}</div>`,
        className: '', // No extra class on the container
        iconSize: [24, 24], // The size of the icon.
        iconAnchor: [12, 12] // The point of the icon which will correspond to marker's location.
    });

    // Return a new Leaflet marker at the given latlng with our custom icon.
    return L.marker(latlng, { icon: customIcon });
}