import L from '../../lib/leaflet';
import type { FeatureCollection, LineString } from 'geojson';
import { fetchGeoJson } from '../geojson/fetchGeoJson';

/**
 * Animates a marker (e.g., a plane) along a line from a GeoJSON file.
 * The line itself is invisible; only the marker moves.
 * Returns a promise that resolves when the animation finishes.
 *
 * @param group - The opening's layer group; removing it stops the whole opening.
 * @param filePath - Path to the GeoJSON file (should contain a single LineString).
 * @param svgPath - Path to the SVG file used as the moving marker icon.
 * @param [speed=1500000] - Animation speed (km/h, as expected by leaflet.motion).
 */
export async function animateMarkerAlongLine(group: L.LayerGroup, filePath: string, svgPath: string, speed = 1500000) {
    // Fetch the GeoJSON data
    const geojson = await fetchGeoJson<FeatureCollection<LineString>>(filePath);
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
    const coords = feature.geometry.coordinates.map((c): L.LatLngTuple => [c[1], c[0]]);

    // Create the motion polyline with invisible style and easing
    const layer = L.motion.polyline(
        coords,
        { color: "#000", opacity: 0, weight: 2 }, // invisible line
        { auto: true, speed: speed, easing: L.Motion.Ease.easeOutSine },
        { icon: markerIcon }
    );

    // Subscribe before auto-starting: a zero/tiny distance can finish during
    // addTo itself, so attaching Ended afterwards could leave this pending.
    await new Promise<void>(resolve => {
        layer.once(L.Motion.Event.Ended, () => resolve());
        layer.addTo(group);
    });
    // Removing the group on skip also fires Ended, while Leaflet is still
    // removing this layer. Resuming after await lets that removal finish first:
    // synchronous cleanup inside the handler would remove the layer twice.
    group.removeLayer(layer);
}
