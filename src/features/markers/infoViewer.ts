import L from '../../lib/leaflet';
import type { Feature, Point } from 'geojson';
import type { InfoProperties } from '../../types/geojson';
import { openOverlay } from '../overlays/overlayBase';

/**
 * Shows an overlay with the information from a feature.
 * This function creates and displays a DOM element containing the
 * feature's description, using the shared overlay panel styles.
 *
 * @param feature - A GeoJSON feature with a 'Description' property.
 */
export function showInfoOverlay(feature: Feature<Point, InfoProperties>) {
    // Get the description text from the feature properties.
    const description = feature.properties.Description || "No description available.";

    // Create the content container for the text, using the overlay panel class.
    const panel = document.createElement('div');
    panel.className = 'overlay-panel-panel info-panel';

    // Build a simple index card / note card structure - minimal like the polaroid
    panel.innerHTML = `
        <div class="info-panel-badge">i</div>
        <div class="info-panel-content">
            <p>${description}</p>
        </div>
    `;

    // Dismissable by clicking the backdrop or pressing Escape; fades out on close.
    openOverlay({
        wrapperClass: 'overlay-panel-overlay',
        panel,
    });
}

/**
 * A callback function for Leaflet's onEachFeature option.
 * It attaches event listeners to each information marker layer.
 *
 * @param feature - The GeoJSON feature.
 * @param layer - The Leaflet layer for the feature.
 */
export function onEachInfoFeature(feature: Feature<Point, InfoProperties>, layer: L.Layer) {
    // When the marker is clicked, show the info overlay for that feature.
    layer.on('click', () => {
        showInfoOverlay(feature);
    });
}

/**
 * A callback function for Leaflet's pointToLayer option.
 * It creates a custom marker icon for each information point.
 *
 * @param feature - The GeoJSON feature.
 * @param latlng - The latitude and longitude of the point.
 * @returns A Leaflet marker with a custom 'i' icon.
 */
export function pointToLayerForInfo(feature: Feature<Point, InfoProperties>, latlng: L.LatLng) {
  // Create the HTML for the custom icon. It's a simple div with the letter 'i'.
  const iconHtml = `<div class="info-marker-icon">i</div>`;

  // Use Leaflet's DivIcon to create an icon from our HTML.
  const customIcon = L.divIcon({
    html: iconHtml,
    className: '',      // we rely on .info-marker-icon for styling
  });

  // By specifying pane: 'shadowPane' (z-index 500), this marker
  // will always render underneath the default markerPane (600)
  return L.marker(latlng, {
    icon: customIcon,
    pane: 'shadowPane'
  });
}