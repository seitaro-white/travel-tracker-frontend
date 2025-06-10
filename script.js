import { LineStyles } from './src/features/geojson/geojsonStyles.js';
import { addGeoJsonLineLayer, addGeoJsonPointLayer } from './src/features/geojson/geojsonService.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';
import { onEachPhotoFeature, pointToLayerForPhotos } from './src/features/photos/photoViewer.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        maxZoom: 20,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png',
    }).addTo(map);
    return map;
}

// Main function to set up the map and layers
async function setupMap() {
    const map = initializeMap('map', [36.2048, 138.2529], 7);

    // Start the chained line animation
    await animateChainedGeoJson(map, 'assets/lines/animation_tracks.geojson');

    // Add static GeoJSON line layers
    await addGeoJsonLineLayer(map, 'assets/lines/public_transport.geojson', LineStyles.publicTransport);
    await addGeoJsonLineLayer(map, 'assets/lines/walking_routes.geojson', LineStyles.walking);
    await addGeoJsonLineLayer(map, 'assets/lines/cycling_routes.geojson', LineStyles.cycling);
    await addGeoJsonLineLayer(map, 'assets/lines/ferries.geojson', LineStyles.ferry);

    // Configuration and loading of point layers.
    const pointLayersConfig = [
        {
            type: 'point',
            filePath: 'assets/points/geotagged_photos.geojson',
            onEachFeature: onEachPhotoFeature,
            pointToLayer: pointToLayerForPhotos,
            staggerDelay: 1
        }
    ];

    for (const layerConfig of pointLayersConfig) {
        if (layerConfig.type === 'point') {
            const staggerMilliseconds = layerConfig.staggerDelay !== undefined ? layerConfig.staggerDelay : 50;
            await addGeoJsonPointLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer, staggerMilliseconds);
        }
    }

    // Example marker for Kyoto.
    const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
    kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");
}

// Wait for the DOM to be fully loaded before initializing the map.
document.addEventListener('DOMContentLoaded', setupMap);