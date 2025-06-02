import { geoJSONLayerStyles } from './geojson_styles.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
}

// NEW function to load and add GeoJSON Point layers
async function addPointGeoJsonLayer(map, filePath, onEachFeatureCallback, pointToLayerCallback) {
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
async function addStaticLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
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
async function addAnimatedLineGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback) {
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
                duration: 10000,
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


// Specific callback for photo popups
function onEachPhotoFeature(feature, layer) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/display/${feature.properties.filepath}`;
        const popupContent = `<img src="${imagePath}" alt="Photo" style="width:500px; height:500px; object-fit:cover">`;
        layer.bindPopup(popupContent, { maxWidth: 500 });
    }

    // Mouseover event
    layer.on('mouseover', function (e) {
        const iconDiv = this._icon; // Get the L.divIcon's main div element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                // Apply hover styles to the img element
                imgElement.style.transform = 'scale(1.5)'; // Adjusted scale for a less extreme jump
                imgElement.style.border = "2px solid red";
                // Apply transition - ensure it's consistently applied
                imgElement.style.transition = 'transform 0.2s ease-in-out, border-color 0.2s ease-in-out, border-width 0.2s ease-in-out, border-style 0.2s ease-in-out';
            }

            // Ensure the iconDiv container allows the (now larger) image to be fully visible
            // and that the iconDiv itself is on top.
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000;
        }
    });

    // Mouseoff event
    layer.on('mouseout', function (e) {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img');
            if (imgElement) {
                // Revert img element to its original style
                imgElement.style.transform = 'scale(1)';
                // Transition border properties for a smooth disappearance
                imgElement.style.borderColor = 'transparent'; // Make color transparent
                imgElement.style.borderWidth = '0px';       // Make width zero
                // border-style will remain 'solid' from hover, but invisible with 0px width / transparent color
                // The transition property set on mouseover will apply to these changes.

            }

            //iconDiv.style.zIndex = ''; // Revert z-index
            // iconDiv.style.overflow = 'hidden'; // Revert overflow to default, typically hidden for divIcon
        }
    });
}

// Specific callback for photo markers
function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/thumbnail/${feature.properties.filepath}`;
        // Ensure the img fills the iconDiv and maintains its appearance
        const iconHtml = `<img src="${imagePath}" alt="Photo location" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;

        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Set to empty to avoid default Leaflet divIcon styling
            iconSize: [20, 20], // This sets the initial size of the iconDiv
            iconAnchor: [10, 10], // Anchor should be center of the iconSize
            popupAnchor: [0, -10]
        });
        return L.marker(latlng, { icon: customIcon });
    }
    return L.marker(latlng); // Fallback to default marker
}


// Main function to set up the map and layers
async function setupMap() {
    const map = initializeMap('map', [36.2048, 138.2529], 5.7);

    // Define layers to load
    const layersToLoad = [
        // Line Layers
        { type: 'line', filePath: 'assets/lines/public_transport.geojson', style: geoJSONLayerStyles.publicTransport /*, onEachFeature: optionalCallbackForLines */ },
        { type: 'line', filePath: 'assets/lines/walking_routes.geojson', style: geoJSONLayerStyles.walking },
        { type: 'line', filePath: 'assets/lines/cycling_routes.geojson', style: geoJSONLayerStyles.cycling },
        { type: 'line', filePath: 'assets/lines/ferries.geojson', style: geoJSONLayerStyles.ferry },
        // Point Layer
        {
            type: 'point',
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos
        }
    ];

    // Load all GeoJSON layers
    for (const layerConfig of layersToLoad) {
        if (layerConfig.type === 'line') {
            await addAnimatedLineGeoJsonLayer(map, layerConfig.filePath, layerConfig.style, layerConfig.onEachFeature);
        } else if (layerConfig.type === 'point') {
            await addPointGeoJsonLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer);
        }
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here
}

// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', setupMap);