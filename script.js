// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', async function () {

    // Initialize the map and set its view to Japan's coordinates and a good zoom level
    // Coordinates for central Japan (approx): [36.2048, 138.2529]
    // Zoom level 5 or 6 is usually good for a country overview
    var map = L.map('map').setView([36.2048, 138.2529], 5.7);

    // Add a tile layer (the basemap)
    // Using OpenStreetMap tiles here.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, // Max zoom level for the tiles
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- Future additions will go here ---
    function addGeoJsonTrack(trackUrl, styleOptions) { // Added styleOptions parameter
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
                        // You can also add onEachFeature to bind popups, etc.
                        // onEachFeature: function (feature, layer) {
                        //    if (feature.properties && feature.properties.name) {
                        //        layer.bindPopup(feature.properties.name);
                        //    }
                        // }
                    });
                })
                .catch(error => {
                    console.error('Error loading or parsing GeoJSON track:', error);
                    return null;
                });
    }

    // Define style for public transport
    const publicTransportStyle = {
        color: "green",
        weight: 2,
        opacity: 0.7
    };
    const public_transport = await addGeoJsonTrack('data/public_transport_out.geojson', publicTransportStyle);
    if (public_transport) {
        public_transport.addTo(map);
    }

    // Define style for cycling (or use default by not passing styleOptions)
    const cyclingStyle = {
        color: "red",
        weight: 2,
        opacity: 0.8
    };
    const cycling = await addGeoJsonTrack('data/polyline_output.geojson', cyclingStyle);
    if (cycling) {
        cycling.addTo(map);
    }


    // Example: Add a marker for Tokyo
    const tokyoMarker = L.marker([35.6895, 139.6917]).addTo(map);
    tokyoMarker.bindPopup("<b>Tokyo</b><br>Capital of Japan.");

    // Example: Add a marker for Kyoto
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here

});