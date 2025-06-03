// Function to fetch GeoJSON data
async function fetchGeoJson(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        console.error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        return null;
    }
    return await response.json();
}


// Function to filter GeoJSON features
function filterGeoJsonFeatures(geojsonData, animationOrderFilter) {
    if (!geojsonData || !geojsonData.features) {
        return [];
    }
    if (typeof animationOrderFilter !== 'undefined' && animationOrderFilter !== null) {
        return geojsonData.features.filter(feature =>
            feature.properties && feature.properties.AnimationOrder === animationOrderFilter
        );
    }
    return geojsonData.features; // Return all features if no filter is applied
}

// Function to animate a set of GeoJSON features
function animateFeatures(map, features, styleOptions, onEachFeatureCallback) {
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
            duration: 2000, // This duration is for each individual line segment animation
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
export async function addAnimatedLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback, animationOrderFilter) {
    try {
        const geojsonData = await fetchGeoJson(filePath);
        if (!geojsonData) {
            return; // Error already logged by fetchGeoJson
        }

        const featuresToAnimate = filterGeoJsonFeatures(geojsonData, animationOrderFilter);

        animateFeatures(map, featuresToAnimate, styleOptions, onEachFeatureCallback);

    } catch (error) {
        // Catch any unexpected errors during the orchestration
        console.error('Error orchestrating animated line GeoJSON loading:', filePath, error);
    }
}


export async function addPointGeoJsonLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback) {
    try {
        const geojsonData = await fetchGeoJson(filePath);
        if (!geojsonData) {
            // Error is already logged by fetchGeoJson
            return;
        }

        const layerOptions = {};
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        if (pointToLayerCallback) {
            layerOptions.pointToLayer = pointToLayerCallback;
        }
        L.geoJSON(geojsonData, layerOptions).addTo(map);

    } catch (error) {
        // Catch any unexpected errors during the L.geoJSON processing or other parts
        console.error('Error processing Point GeoJSON:', filePath, error);
    }
}

// NEW function to load and add STATIC GeoJSON LineString/MultiLineString layers
export async function addStaticLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
    try {
        const geojsonData = await fetchGeoJson(filePath);
        if (!geojsonData) {
            // Error is already logged by fetchGeoJson
            return;
        }

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