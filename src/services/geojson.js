// Function to fetch GeoJSON data
async function fetchGeoJson(filePath) {
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

// NEW function to load and add STATIC GeoJSON LineString/MultiLineString layers
export async function addGeoJsonLineLayer(map, filePath, styleOptions, onEachFeatureCallback) {
    try {
        const geojsonData = await fetchGeoJson(filePath);

        const layerOptions = {};
        if (styleOptions) {
            layerOptions.style = styleOptions;
        }
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        const layer = L.geoJSON(geojsonData, layerOptions).addTo(map);
        return layer; // Return the created layer

    } catch (error) {
        // Catch any unexpected errors during the L.geoJSON processing or other parts
        console.error('Error processing Static Line GeoJSON:', filePath, error);
        throw error; // Re-throw the error
    }
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
 * @param {number} [defaultSpeedKmH=1] - Default motion speed in km/h if not specified in feature.
 */
export async function animateChainedGeoJson(map, filePath, styleOptions, defaultSpeedKmH = 500000) {
    // Fetch GeoJSON data from the given file path.
    const geojson = await fetchGeoJson(filePath);
    const features = geojson.features;

    // Build a map of features using feature.properties.fid as key.
    const byUUID = new Map(features.map(f => [f.properties.uuid, f]));

    // Find the starting feature with name "Initial Haneda".
    const initialFeature = features.find(f => f.properties.name === "Initial Haneda");
    if (!initialFeature) {
        throw new Error('No initial feature with Name "Initial Haneda" found.');
    }

    // Define an invisible icon used for the motion layer.
    const invisibleIcon = L.divIcon({
        html: '',
        className: 'leaflet-motion-invisible-marker',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    /**
     * Recursively animate a feature and then its triggers.
     *
     * @param {Object} feature - The GeoJSON feature to animate.
     */
    async function play(feature) {
        // Use the feature's speed if available, otherwise fallback to defaultSpeedKmH.
        const speed = feature.properties.speed || defaultSpeedKmH;

        // Build an array of coordinate sets (single or multiple segments).
        let segments = [];
        if (feature.geometry.type === 'LineString') {
            segments = [feature.geometry.coordinates];
        } else if (feature.geometry.type === 'MultiLineString') {
            segments = feature.geometry.coordinates;
        }

        console.log(`Started animating feature: ${feature.properties.name}`);

        // Animate all segments concurrently and wait for them to finish.
        await Promise.all(
            segments.map(coords => {
                // Convert each coordinate to a latLng pair ([lat, lng]).
                const latLngs = coords.map(c => [c[1], c[0]]);
                // Create and add the motion polyline to the map using the speed option.
                const layer = L.motion
                    .polyline(latLngs, { ...styleOptions }, { auto: true, speed: speed }, { icon: invisibleIcon })
                    .addTo(map);
                console.log(`Animating segment for feature: ${feature.properties.name} at ${speed} km/h`);
                // Return a Promise that resolves when the motion animation ends.
                return new Promise(resolve => layer.once(L.Motion.Event.Ended, resolve));
            })
        );
        console.log(`Finished animating feature: ${feature.properties.name}`);

        // Process any triggered features recursively.
        const triggerArray = feature.properties.triggers || [];
        await Promise.all(
            triggerArray.map(fid => {
                const nextFeature = byUUID.get(fid);
                console.log(`Triggering feature with fid: ${fid}`);
                if (nextFeature) {
                    return play(nextFeature);
                }
                return Promise.resolve();
            })
        );
    }

    // Start the chain by playing the initial feature.
    await play(initialFeature);
}