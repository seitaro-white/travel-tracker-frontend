export async function addPointGeoJsonLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        const layerOptions = {};
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        if (pointToLayerCallback) {
            layerOptions.pointToLayer = pointToLayerCallback;
        }
        // Points don't typically use the general 'style' option in the same way lines do,
        // styling is often handled within pointToLayer by creating custom icons.
        L.geoJSON(geojsonData, layerOptions).addTo(map);

    } catch (error) {
        console.error('Error loading or parsing Point GeoJSON:', filePath, error);
    }
}

// NEW function to load and add STATIC GeoJSON LineString/MultiLineString layers
export async function addStaticLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        const layerOptions = {};
        if (styleOptions) {
            layerOptions.style = styleOptions;
        }
        if (onEachFeatureCallback) {
            layerOptions.onEachFeature = onEachFeatureCallback;
        }
        // L.geoJSON handles LineString and MultiLineString features with the provided style.
        L.geoJSON(geojsonData, layerOptions).addTo(map);

    } catch (error) {
        console.error('Error loading or parsing Static Line GeoJSON:', filePath, error);
    }
}

// Function to load and add animated GeoJSON LineString/MultiLineString layers
export async function addAnimatedLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        // Define an invisible icon for leaflet.motion markers
        const invisibleIcon = L.divIcon({
            html: '',
            className: 'leaflet-motion-invisible-marker',
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        if (typeof L.motion === 'undefined') {
            console.error('Leaflet.motion plugin not loaded. Cannot animate lines from:', filePath, '. Animation will not occur.');
            // No fallback to static lines; if the plugin isn't there, animation simply won't happen.
            return; // Exit the function if the plugin is not available.
        }

        for (const feature of geojsonData.features) {
            // We assume features are LineString or MultiLineString as per the new function's responsibility
            const coordinates = feature.geometry.coordinates;
            const geometryType = feature.geometry.type;

            const motionLineOptions = { ...styleOptions };
            const motionAnimationOptions = {
                auto: true,
                speed: 800000,
            };
            const markerOptions = { icon: invisibleIcon };

            const processCoordsToLatLng = (coords) => coords.map(c => [c[1], c[0]]);

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
            // If features are not LineString or MultiLineString, they will be ignored by this function,
            // as it's specialized for animating lines.
        }
    } catch (error) {
        console.error('Error loading or parsing Animated Line GeoJSON:', filePath, error);
    }
}