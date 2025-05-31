// Wait for the DOM to be fully loaded before running map logic
document.addEventListener('DOMContentLoaded', function () {

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
    function addGeoJsonTrack(trackUrl) {
            fetch(trackUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok ' + response.statusText);
                    }
                    return response.json(); // Parse the response body as JSON
                })
                .then(geojsonFeature => {
                    // Successfully loaded and parsed the GeoJSON
                    L.geoJSON(geojsonFeature, {
                        style: function (feature) {
                            return {
                                color: "green",
                                weight: 3,
                                opacity: 0.8
                            };
                        }
                        // You can also add onEachFeature to bind popups, etc.
                        // onEachFeature: function (feature, layer) {
                        //    if (feature.properties && feature.properties.name) {
                        //        layer.bindPopup(feature.properties.name);
                        //    }
                        // }
                    }).addTo(map);

                    // Optional: Fit the map bounds to the loaded track
                    // This might be a bit aggressive if you load multiple tracks
                    // or have other points of interest.
                    // You might want to collect all bounds and fit once.
                    // var trackLayer = L.geoJSON(geojsonFeature);
                    // map.fitBounds(trackLayer.getBounds());

                })
                .catch(error => {
                    console.error('Error loading or parsing GeoJSON track:', error);
                });
    }

    addGeoJsonTrack('data/polyline_output.geojson')
    addGeoJsonTrack('data/public_transport_out.geojson')




    // Example: Add a marker for Tokyo
    var tokyoMarker = L.marker([35.6895, 139.6917]).addTo(map);
    tokyoMarker.bindPopup("<b>Tokyo</b><br>Capital of Japan.").openPopup();

    // Example: Add a marker for Kyoto
    var kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");

    // You can add more markers, tracklines, photo popups etc. here

});