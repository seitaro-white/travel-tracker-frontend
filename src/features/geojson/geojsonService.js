import { AnimatedLineStyles } from './geojsonStyles.js';

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


/**
 * Adds a clustered GeoJSON point layer to the map.
 * This function fetches GeoJSON data and adds the points to a MarkerClusterGroup.
 *
 * @param {L.Map} map - The Leaflet map instance.
 * @param {string} filePath - The path to the GeoJSON file.
 * @param {Function} onEachFeatureCallback - Callback for each feature.
 * @param {Function} pointToLayerCallback - Callback to create a layer for each point.
 * @returns {Promise<L.MarkerClusterGroup>} - A promise that resolves with the marker cluster group.
 */
export async function addClusteredGeoJsonPointLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback) {
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
        maxClusterRadius: 30,
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

    // Add the cluster group to the map.
    map.addLayer(markers);

    // Return the created cluster group.
    return markers;
}


/**
 * Animate features in a chained sequence using motion speed.
 *
 * This function:
 *   1. Fetches the GeoJSON.
 *   2. Builds a map of features keyed on each feature's fid.
 *   3. Finds the starting feature with name "Initial Haneda".
 *   4. Animates it using L.motion.polyline with a speed (in km/h) and waits for the animation to finish.
 *   5. Once done, recursively triggers any features indicated in its triggers array.
 *
 * @param {Object} map - The Leaflet map instance.
 * @param {string} filePath - Path to the GeoJSON file.
 * @param {Object} styleOptions - Style for the animated polyline.
 * @param {number} defaultSpeedKmH - Default motion speed in km/h if not specified in feature.
 */
export async function animateChainedGeoJson(
  map,
  filePath,
  styleMap = AnimatedLineStyles
) {
  const geojson = await fetchGeoJson(filePath);
  const features = geojson.features;
  const byUUID = new Map(features.map(f => [f.properties.uuid, f]));
  const initialFeature = features.find(f => f.properties.name === "Initial Haneda");
  const invisibleIcon = L.divIcon({ html: "", className: "leaflet-motion-invisible-marker", iconSize: [0,0] });

  async function play(feature) {
    // pick this feature’s config or fall back
    const cfg = styleMap[feature.properties.type] || styleMap.default;
    // pull speed out, the rest is pure path styling
    const { speed: motionSpeed, ...pathStyle } = cfg;

    // break into one or more segments
    const segments = feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

    // animate each segment
    await Promise.all(segments.map(coords => {
      const latLngs = coords.map(c => [c[1], c[0]]);
      const layer = L.motion
        .polyline(
          latLngs,
          pathStyle,                    // only color/weight/opacity…
          { auto: true, speed: motionSpeed }, // …and speed in motion options
          { icon: invisibleIcon }
        )
        .addTo(map);
      return new Promise(r => layer.once(L.Motion.Event.Ended, r));
    }));

    // then recurse to any triggered children
    const triggers = feature.properties.triggers || [];
    await Promise.all(triggers.map(id =>
      byUUID.has(id) ? play(byUUID.get(id)) : Promise.resolve()
    ));
  }

  if (!initialFeature) {
    throw new Error('No initial feature with Name "Initial Haneda" found.');
  }
  await play(initialFeature);
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
    // Fetch the GeoJSON data.
    const response = await fetch(filePath);
    const geojson = await response.json();
    // Create the layer using Leaflet's geoJSON factory.
    const layer = L.geoJSON(geojson, {
        style: style
    });
    // Return the layer (do not add it to any map yet).
    return layer;
}