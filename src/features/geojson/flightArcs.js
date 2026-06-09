import { fetchGeoJson } from './geojsonService.js';

// Number of straight segments used to approximate each arc. More segments = a
// smoother curve at the cost of a few more points; ~48 looks smooth at the
// zoomed-out levels where these flight lines are visible.
const ARC_SEGMENTS = 48;

// How far the arc bows away from the straight line, as a fraction of the
// route's length. 0 would be a straight line; ~0.2 gives a gentle, flight-path
// style curve. Tune to taste.
const ARC_CURVATURE = 0.2;

/**
 * Builds the points of a curved arc between two [lat, lng] endpoints.
 *
 * GeoJSON flight lines are stored as just two coordinates (start + end), which
 * Leaflet would draw as a dead-straight segment. To get the classic "flight
 * arc" look we synthesise the curve here: we offset a control point
 * perpendicular to the route's midpoint, then sample a quadratic Bézier curve
 * through start -> control -> end.
 *
 * The maths is done directly in lat/lng space. That isn't geographically exact
 * (it ignores the Earth's curvature / projection), but at these scales it's
 * visually indistinguishable from a "proper" great-circle arc and is far
 * simpler.
 *
 * @param {[number, number]} start - [lat, lng] of the origin airport.
 * @param {[number, number]} end - [lat, lng] of the destination airport.
 * @returns {Array<[number, number]>} Sampled [lat, lng] points along the arc.
 */
function buildArcPoints(start, end) {
    const [lat1, lng1] = start;
    const [lat2, lng2] = end;

    // Vector from start to end, and the route's straight-line length.
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const length = Math.sqrt(dLat * dLat + dLng * dLng);

    // Midpoint of the straight route.
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;

    // Unit vector perpendicular to the route. Rotating (dLat, dLng) by 90°
    // gives (-dLng, dLat); dividing by `length` normalises it. (length is only
    // zero if start === end, which we don't expect for a real flight.)
    const perpLat = -dLng / length;
    const perpLng = dLat / length;

    // The Bézier control point: the midpoint pushed out along the perpendicular
    // by a fraction of the route length. This is what makes the line bow.
    const offset = length * ARC_CURVATURE;
    const ctrlLat = midLat + perpLat * offset;
    const ctrlLng = midLng + perpLng * offset;

    // Sample the quadratic Bézier curve at evenly spaced values of t in [0, 1].
    // B(t) = (1-t)^2 * start + 2(1-t)t * control + t^2 * end
    const points = [];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const t = i / ARC_SEGMENTS;
        const mt = 1 - t;
        const a = mt * mt;       // weight for the start point
        const b = 2 * mt * t;    // weight for the control point
        const c = t * t;         // weight for the end point
        points.push([
            a * lat1 + b * ctrlLat + c * lat2,
            a * lng1 + b * ctrlLng + c * lng2,
        ]);
    }
    return points;
}

/**
 * Fetches a flights GeoJSON file and returns a Leaflet layer of arced flight
 * lines. Each feature is expected to be a LineString with exactly two
 * coordinates (origin and destination airport, in [lng, lat] GeoJSON order).
 *
 * The returned value is an L.featureGroup of L.polylines, which behaves like
 * the other static line layers (it supports eachLayer, addTo, etc.) so it can
 * be faded in and zoom-gated the same way.
 *
 * @param {string} filePath - Path to the flights GeoJSON file.
 * @param {object} style - Leaflet path style applied to every flight arc.
 * @returns {Promise<L.FeatureGroup>} The group of arced flight polylines.
 */
export async function createArcedFlightLayer(filePath, style) {
    const geojson = await fetchGeoJson(filePath);

    // Turn each two-point flight into a curved polyline.
    const arcs = geojson.features.map((feature) => {
        // GeoJSON stores coordinates as [lng, lat]; Leaflet wants [lat, lng].
        const [[lng1, lat1], [lng2, lat2]] = feature.geometry.coordinates;
        const arcPoints = buildArcPoints([lat1, lng1], [lat2, lng2]);
        return L.polyline(arcPoints, style);
    });

    return L.featureGroup(arcs);
}
