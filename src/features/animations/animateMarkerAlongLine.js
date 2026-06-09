import { fetchGeoJson } from '../geojson/geojsonService.js';

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
