// This module handles marker logic for photo features.
// The overlay logic is now imported from the overlays module.

import L from '../../lib/leaflet';
import type { Feature, Point } from 'geojson';
import type { PhotoProperties } from '../../types/geojson';
import { showAnimatedPolaroid } from '../overlays/polaroidOverlay';

/**
 * Callback function to attach events for photo features in the GeoJSON layer.
 * When a marker is clicked, it shows the animated polaroid overlay.
 * Also sets up mouseover/mouseout for marker hover effects.
 *
 * @param feature - The GeoJSON feature for the photo.
 * @param layer - The Leaflet marker layer.
 */
export function onEachPhotoFeature(feature: Feature<Point, PhotoProperties>, layer: L.Layer) {
    // If the feature has a valid photo filename, attach a click event that shows the polaroid overlay.
    if (feature.properties && feature.properties.filename) {
        layer.on('click', function () {
            showAnimatedPolaroid(feature);
        });
    }
    // Add mouseover and mouseout events to modify the marker's appearance.
    layer.on('mouseover', () => {
        // GeoJSON's point factory returns a Marker; getElement() is its public
        // API for the icon, avoiding the old untyped `this._icon` access.
        const iconDiv = (layer as L.Marker).getElement();
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                imgElement.classList.add('photo-marker-image-hover');
            }
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = '1000';
        }
    });
    layer.on('mouseout', () => {
        const iconDiv = (layer as L.Marker).getElement();
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                imgElement.classList.remove('photo-marker-image-hover');
            }
        }
    });
}

/**
 * Callback function to create a custom marker for photo features.
 * Returns a Leaflet marker with a circular photo thumbnail.
 *
 * @param feature - The GeoJSON feature for the photo.
 * @param latlng - The marker's location.
 * @returns The Leaflet marker.
 */
export function pointToLayerForPhotos(feature: Feature<Point, PhotoProperties>, latlng: L.LatLng) {
    if (feature.properties && feature.properties.filename) {
        const imagePath = `assets/photos/thumbnail/${feature.properties.filename}.webp`;
        const iconHtml = `<img src="${imagePath}" alt="Photo location" class="photo-marker-image">`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // No default styling
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
        return L.marker(latlng, { icon: customIcon });
    }
    return L.marker(latlng);
}