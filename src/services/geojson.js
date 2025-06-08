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

// Function to animate a set of GeoJSON features
function animateFeatures(map, features, styleOptions, onEachFeatureCallback, duration = 2000) { // Added duration parameter with default
    if (typeof L.motion === 'undefined') {
        console.error('Leaflet.motion plugin not loaded. Cannot animate lines. Animation will not occur.');
        return;
    }

    const invisibleIcon = L.divIcon({
        html: '',
        className: 'leaflet-motion-invisible-marker',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    const processCoordsToLatLng = (coords) => coords.map(c => [c[1], c[0]]);

    for (const feature of features) {
        const coordinates = feature.geometry.coordinates;
        const geometryType = feature.geometry.type;

        const motionLineOptions = { ...styleOptions };
        const motionAnimationOptions = {
            auto: true,
            duration: duration, // Use the passed duration
        };
        const markerOptions = { icon: invisibleIcon };

        if (geometryType === 'LineString') {
            const latLngs = processCoordsToLatLng(coordinates);
            if (latLngs.length > 0) {
                const motionLayer = L.motion.polyline(latLngs, motionLineOptions, motionAnimationOptions, markerOptions).addTo(map);
                if (onEachFeatureCallback) {
                    onEachFeatureCallback(feature, motionLayer);
                }
            }
        } else if (geometryType === 'MultiLineString') {
            for (const lineSegmentCoords of coordinates) {
                const latLngs = processCoordsToLatLng(lineSegmentCoords);
                if (latLngs.length > 0) {
                    const motionLayer = L.motion.polyline(latLngs, motionLineOptions, motionAnimationOptions, markerOptions).addTo(map);
                    if (onEachFeatureCallback) {
                        onEachFeatureCallback(feature, motionLayer);
                    }
                }
            }
        }
    }
}

// Refactored function to load and add animated GeoJSON LineString/MultiLineString layers
export async function addAnimatedLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback, animationOrderFilter, duration) { // Added duration parameter
    try {
        const geojsonData = await fetchGeoJson(filePath); // Now throws on error

        const featuresToAnimate = filterGeoJsonFeatures(geojsonData, animationOrderFilter);
        animateFeatures(map, featuresToAnimate, styleOptions, onEachFeatureCallback, duration); // Pass duration

    } catch (error) {
        console.error(`Critical error loading/processing GeoJSON from ${filePath}:`, error);
        throw error;

    }
}

// NEW function to load and add STATIC GeoJSON Point layers
export async function addPointGeoJsonLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback, staggerMs = 50) { // Added staggerMs with a default value
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
                L.geoJSON(singleFeatureGeoJson, layerOptions).addTo(map);

                // Wait for the specified stagger duration before adding the next marker
                if (staggerMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, staggerMs));
                }
            }
        } else {
            // Fallback if geojsonData.features is not available or empty
            console.warn(`No features found or invalid GeoJSON structure in ${filePath}. Attempting to add layer directly.`);
            L.geoJSON(geojsonData, layerOptions).addTo(map);
        }

    } catch (error) {
        // Catch any unexpected errors during the L.geoJSON processing or other parts
        console.error('Error processing Point GeoJSON:', filePath, error);
        // Depending on requirements, you might want to rethrow the error
        // throw error;
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
        L.geoJSON(geojsonData, layerOptions).addTo(map);

    } catch (error) {
        // Catch any unexpected errors during the L.geoJSON processing or other parts
        console.error('Error processing Static Line GeoJSON:', filePath, error);
    }
}