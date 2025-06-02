import { geoJSONLayerStyles } from './geojson_styles.js';


// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', async function () {

    // Initialize the map and set its view to Japan's coordinates and a good zoom level
    // Coordinates for central Japan (approx): [36.2048, 138.2529]
    // Zoom level 5 or 6 is usually good for a country overview
    var map = L.map('map').setView([36.2048, 138.2529], 5.7);

    // Add a tile layer (the basemap)
    // Using OpenStreetMap tiles here.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, // Max zoom level for the tiles
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // --- Future additions will go here ---
    function loadGeoJson(trackUrl, styleOptions, onEachFeatureCallback, pointToLayerCallback) { // Added pointToLayerCallback parameter
        return fetch(trackUrl)
            // Check if the response is ok (status in the range 200-299)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            // Define styles
            .then(geojsonFeature => {
                const defaultStyle = {
                    color: "blue", // Default color
                    weight: 3,
                    opacity: 0.7
                };
                const currentStyle = styleOptions || defaultStyle; // Use passed options or default

                const geoJsonLayerOptions = {
                    style: function (feature) {
                        // If styleOptions is a function, call it. Otherwise, use it as an object.
                        if (typeof currentStyle === 'function') {
                            return currentStyle(feature);
                        }
                        return currentStyle;
                    }
                };

                // Add in onEachFeature
                if (onEachFeatureCallback) {
                    geoJsonLayerOptions.onEachFeature = onEachFeatureCallback;
                }

                // Add in pointToLayer
                if (pointToLayerCallback) {
                    geoJsonLayerOptions.pointToLayer = pointToLayerCallback;
                }

                return L.geoJSON(geojsonFeature, geoJsonLayerOptions);
            })
            .catch(error => {
                console.error('Error loading or parsing GeoJSON track:', error);
                return null;
            });
    }


    const public_transport = await loadGeoJson(
        'data/lines/public_transport.geojson', geoJSONLayerStyles.publicTransport, null, null);
    if (public_transport) {
        public_transport.addTo(map);
    }


    const walking = await loadGeoJson(
        'data/lines/walking_routes.geojson', geoJSONLayerStyles.walking, null, null);
    if (walking) {
        walking.addTo(map);
    }

    const cycling = await loadGeoJson(
        'data/lines/cycling_routes.geojson', geoJSONLayerStyles.cycling, null, null);
    if (cycling) {
        cycling.addTo(map);
    }

    const ferries = await loadGeoJson(
        'data/lines/ferries.geojson', geoJSONLayerStyles.ferry, null, null);
    if (ferries) {
        ferries.addTo(map);
    }

    const photos = await loadGeoJson(
        'data/points/geotagged_photos.geojson',
        null, // styleOptions - not needed as pointToLayer creates markers
        function(feature, layer) { // onEachFeature - for popups
            if (feature.properties && feature.properties.filepath) {
                const imagePath = feature.properties.filepath;
                // Ensure the image path is correct relative to your HTML file.
                // Example: <img src="data/geotagged_photos/2025-03-22 Kimiidera and Yuasa/converted/P3222520.jpg" ...>
                const popupContent = `<img src="${imagePath}" alt="Photo" style="width:200px; height:200px; object-fit:cover; border-radius: 50%;">`;
                layer.bindPopup(popupContent);
            }
        },
        function(feature, latlng) { // pointToLayer - for custom image markers
            if (feature.properties && feature.properties.filepath) {
                const imagePath = feature.properties.filepath;
                const iconHtml = `<img src="${imagePath}" alt="Photo location" style="width:20px; height:20px; border-radius:50%; object-fit:cover; display:block;">`;

                const customIcon = L.divIcon({
                    html: "<div>x</div>",
                    className: '', // Set to empty to avoid default Leaflet divIcon styling
                    iconSize: [20, 20], // Size of the icon
                    iconAnchor: [10, 10], // Point of the icon which will correspond to marker's location (center for 20x20)
                    popupAnchor: [0, -10] // Point from which the popup should open relative to the iconAnchor (centered above the icon)
                });
                return L.marker(latlng, { icon: customIcon });
            }
            // Fallback to default marker if no filepath is found
            return L.marker(latlng);
        }
    );
    if (photos) {
        photos.addTo(map);
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here

});