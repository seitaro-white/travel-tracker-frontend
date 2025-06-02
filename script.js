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

// Function to load a GeoJSON layer and add it to the map
async function addGeoJsonLayer(map, filePath, styleOptions, onEachFeatureCallback, pointToLayerCallback) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        const featuresToProcess = geojsonData.features;
        const nonLineFeatures = []; // To collect features not handled by L.motion

        // Define an invisible icon
        const invisibleIcon = L.divIcon({
            html: '', // No HTML content
            className: 'leaflet-motion-invisible-marker', // Optional: for potential CSS targeting, but primarily for no default styling
            iconSize: [0, 0], // Zero size
            iconAnchor: [0, 0] // Zero anchor
        });

        for (const feature of featuresToProcess) {
            const geometryType = feature.geometry ? feature.geometry.type : null;
            const coordinates = feature.geometry ? feature.geometry.coordinates : null;

            // Check if L.motion is available
            if (typeof L.motion === 'undefined') {
                console.error('Leaflet.motion plugin not loaded.');
                // Fallback to standard L.geoJSON for all features if plugin is missing
                nonLineFeatures.push(feature);
                continue;
            }

            if ((geometryType === 'LineString' || geometryType === 'MultiLineString') && coordinates) {
                const motionLineOptions = { // These are the polyline's style options
                    ...styleOptions // Spread the style options from your config
                };

                const motionAnimationOptions = {
                    auto: true,      // Automatically start the animation
                    duration: 10000, // Animation duration in milliseconds (10 seconds)
                    // easing: L.Motion.Ease.linear // Optional: default is linear
                };

                // Helper to convert GeoJSON [lng, lat] to Leaflet [lat, lng]
                const processCoordsToLatLng = (coords) => coords.map(c => [c[1], c[0]]);

                const markerOptions = {
                    icon: invisibleIcon,
                    // showMarker: false // Keep this or remove, the custom icon should override
                };

                if (geometryType === 'LineString') {
                    const latLngs = processCoordsToLatLng(coordinates);
                    if (latLngs.length > 0) {
                        const motionLayer = L.motion.polyline(
                            latLngs,
                            motionLineOptions,
                            motionAnimationOptions,
                            markerOptions // Use the markerOptions with the invisible icon
                        ).addTo(map);
                        if (onEachFeatureCallback) {
                            onEachFeatureCallback(feature, motionLayer); // Apply popups or other interactions
                        }
                    }
                } else if (geometryType === 'MultiLineString') {
                    for (const lineSegmentCoords of coordinates) {
                        const latLngs = processCoordsToLatLng(lineSegmentCoords);
                        if (latLngs.length > 0) {
                            const motionLayer = L.motion.polyline(
                                latLngs,
                                motionLineOptions,
                                motionAnimationOptions,
                                markerOptions // Use the markerOptions with the invisible icon
                            ).addTo(map);
                            // For MultiLineString, onEachFeatureCallback applies to the whole feature.
                            // If you need distinct behavior per segment, you might need to adjust feature data.
                            if (onEachFeatureCallback) {
                                onEachFeatureCallback(feature, motionLayer);
                            }
                        }
                    }
                }
            } else {
                // Collect non-line features (e.g., points for photos)
                nonLineFeatures.push(feature);
            }
        }

        // Process non-line features (like photo points) with the standard L.geoJSON
        if (nonLineFeatures.length > 0) {
            const otherGeoJsonData = { type: "FeatureCollection", features: nonLineFeatures };
            const layerProcessingOptions = {};
            if (styleOptions && Object.keys(styleOptions).length > 0 && !pointToLayerCallback) {
                 // Apply styleOptions only if they are general and not for points handled by pointToLayer
                layerProcessingOptions.style = styleOptions;
            }
            if (onEachFeatureCallback) {
                layerProcessingOptions.onEachFeature = onEachFeatureCallback;
            }
            if (pointToLayerCallback) {
                layerProcessingOptions.pointToLayer = pointToLayerCallback;
            }
            L.geoJSON(otherGeoJsonData, layerProcessingOptions).addTo(map);
        }

    } catch (error) {
        console.error('Error loading or parsing GeoJSON:', filePath, error);
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
        { filePath: 'assets/lines/public_transport.geojson', style: geoJSONLayerStyles.publicTransport },
        { filePath: 'assets/lines/walking_routes.geojson', style: geoJSONLayerStyles.walking },
        { filePath: 'assets/lines/cycling_routes.geojson', style: geoJSONLayerStyles.cycling },
        { filePath: 'assets/lines/ferries.geojson', style: geoJSONLayerStyles.ferry },
        {
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos
        }
    ];

    // Load all GeoJSON layers
    for (const layerConfig of layersToLoad) {
        await addGeoJsonLayer(map, layerConfig.filePath, layerConfig.style, layerConfig.onEachFeature, layerConfig.pointToLayer);
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here
}

// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', setupMap);