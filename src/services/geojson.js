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


// Function to filter GeoJSON features
function filterGeoJsonFeatures(geojsonData, animationOrderFilter) {

    if (typeof animationOrderFilter !== 'undefined' && animationOrderFilter !== null) {
        return geojsonData.features.filter(feature =>

            feature.properties && feature.properties.AnimationOrder === animationOrderFilter
        );
    }
    return geojsonData.features;
}

// helper to turn a single coords array into a motion layer
function animateCoords(map, coords, styleOptions, onEachFeatureCallback, feature, invisibleIcon, duration, createdLayers) {
    const latLngs = coords.map(c => [c[1], c[0]]);
    // If no coordinates, skip creating a layer
    if (!latLngs.length) return;

    const motionLayer = L.motion
        .polyline(latLngs,
            { ...styleOptions },
            { auto: true, duration },
            { icon: invisibleIcon })
        .addTo(map);

    if (onEachFeatureCallback) onEachFeatureCallback(feature, motionLayer);
    createdLayers.push(motionLayer);
}

function animateFeatures(map, features, styleOptions, onEachFeatureCallback, duration = 2000) {
    const createdLayers = [];
    const invisibleIcon = L.divIcon({
        html: '',
        className: 'leaflet-motion-invisible-marker',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    for (const feature of features) {
        const { type, coordinates } = feature.geometry;
        if (type === 'LineString') {
            animateCoords(map, coordinates, styleOptions, onEachFeatureCallback, feature, invisibleIcon, duration, createdLayers);
        }
        else if (type === 'MultiLineString') {
            for (const segment of coordinates) {
                animateCoords(map, segment, styleOptions, onEachFeatureCallback, feature, invisibleIcon, duration, createdLayers);
            }
        }
    }

    return createdLayers;
}

// Refactored function to load and add animated GeoJSON LineString/MultiLineString layers
export async function addAnimatedLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback, animationOrderFilter, duration) { // Added duration parameter
    try {
        const geojsonData = await fetchGeoJson(filePath); // Now throws on error

        const featuresToAnimate = filterGeoJsonFeatures(geojsonData, animationOrderFilter);
        // animateFeatures now returns the layers
        const animatedLayers = animateFeatures(map, featuresToAnimate, styleOptions, onEachFeatureCallback, duration); // Pass duration
        return animatedLayers; // Return the created layers

    } catch (error) {
        console.error(`Critical error loading/processing GeoJSON from ${filePath}:`, error);
        throw error; // Re-throw the error so the caller knows something went wrong
    }
}

// NEW function to load and add STATIC GeoJSON Point layers
export async function addPointGeoJsonLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback, staggerMs = 50) { // Added staggerMs with a default value
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
export async function addStaticLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
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