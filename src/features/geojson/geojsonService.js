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


export async function addGeoJsonPointLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback, staggerMs = 50) { // Added staggerMs with a default value
    const addedLayers = []; // Array to store added layers
    try {
        const geojsonData = await fetchGeoJson(filePath);

        const layerOptions = {};
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        if (pointToLayerCallback) {
            layerOptions.pointToLayer = pointToLayerCallback;
        }

        if (geojsonData && geojsonData.features) {
            for (const feature of geojsonData.features) {
                // Create a GeoJSON object for the single feature to process it individually
                const singleFeatureGeoJson = {
                    type: "FeatureCollection",
                    features: [feature]
                };
                const layer = L.geoJSON(singleFeatureGeoJson, layerOptions).addTo(map);
                addedLayers.push(layer); // Add the created layer to our array

                // Wait for the specified stagger duration before adding the next marker
                if (staggerMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, staggerMs));
                }
            }
        } else {
            // Fallback if geojsonData.features is not available or empty
            console.warn(`No features found or invalid GeoJSON structure in ${filePath}. Attempting to add layer directly.`);
            const layer = L.geoJSON(geojsonData, layerOptions).addTo(map);
            addedLayers.push(layer); // Add the created layer
        }
        return addedLayers; // Return the array of added layers

    } catch (error) {
        // Catch any unexpected errors during the L.geoJSON processing or other parts
        console.error('Error processing Point GeoJSON:', filePath, error);
        throw error; // Re-throw the error
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
    // Create a new marker cluster group.
    // See https://github.com/Leaflet/Leaflet.markercluster for options.
    const markers = L.markerClusterGroup();

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
    // This will create markers but not add them to the map yet.
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