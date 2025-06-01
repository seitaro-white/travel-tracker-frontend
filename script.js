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
    function loadGeoJson(trackUrl, styleOptions) { // Added styleOptions parameter
        return fetch(trackUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(geojsonFeature => {
                const defaultStyle = {
                    color: "blue", // Default color
                    weight: 3,
                    opacity: 0.7
                };
                const currentStyle = styleOptions || defaultStyle; // Use passed options or default

                return L.geoJSON(geojsonFeature, {
                    style: function (feature) {
                        // If styleOptions is a function, call it. Otherwise, use it as an object.
                        if (typeof currentStyle === 'function') {
                            return currentStyle(feature);
                        }
                        return currentStyle;
                    }
                });
            })
            .catch(error => {
                console.error('Error loading or parsing GeoJSON track:', error);
                return null;
            });
    }


    const public_transport = await loadGeoJson(
        'data/lines/public_transport.geojson', geoJSONLayerStyles.publicTransport);
    if (public_transport) {
        public_transport.addTo(map);
    }


    const walking = await loadGeoJson(
        'data/lines/walking_routes.geojson', geoJSONLayerStyles.walking);
    if (walking) {
        walking.addTo(map);
    }

    const cycling = await loadGeoJson(
        'data/lines/cycling_routes.geojson', geoJSONLayerStyles.cycling);
    if (cycling) {
        cycling.addTo(map);
    }

    const ferries = await loadGeoJson(
        'data/lines/ferries.geojson', geoJSONLayerStyles.ferry);
    if (ferries) {
        ferries.addTo(map);
    }

    const photos = await loadGeoJson(
        'data/points/geotagged_photos.geojson');
    if (photos) {
        photos.addTo(map);
    }

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here

});