import L from '../../lib/leaflet';
import type { FeatureCollection, Point, LineString, MultiLineString } from 'geojson';
import { fetchGeoJson } from './fetchGeoJson';



// Builds the options object passed to L.geoJSON, including only the callbacks
// that were actually provided. Shared by the point and cluster layer builders.
function buildLayerOptions<P>(
    onEachFeatureCallback?: L.GeoJSONOptions<P, Point>['onEachFeature'],
    pointToLayerCallback?: L.GeoJSONOptions<P, Point>['pointToLayer'],
) {
    const layerOptions: L.GeoJSONOptions<P, Point> = {};
    if (onEachFeatureCallback) {
        layerOptions.onEachFeature = onEachFeatureCallback;
    }
    if (pointToLayerCallback) {
        layerOptions.pointToLayer = pointToLayerCallback;
    }
    return layerOptions;
}


// Adds all GeoJSON points to the map at once, without staggering.
// - map: Leaflet map instance
// - filePath: path to the GeoJSON file
// - onEachFeatureCallback: function to run on each feature
// - pointToLayerCallback: function to create a layer for each point
export async function createGeoJsonPointLayer<P>(
    filePath: string,
    onEachFeatureCallback?: L.GeoJSONOptions<P, Point>['onEachFeature'],
    pointToLayerCallback?: L.GeoJSONOptions<P, Point>['pointToLayer'],
) {
    // Fetch the GeoJSON data from the provided file path
    const geojsonData = await fetchGeoJson<FeatureCollection<Point, P>>(filePath);

    // Set up options for the GeoJSON layer
    const layerOptions = buildLayerOptions(onEachFeatureCallback, pointToLayerCallback);

    // Create the GeoJSON layer (not added to the map here; the caller does that).
    const layer = L.geoJSON(geojsonData, layerOptions)

    // Return the created layer.
    return layer;
}




/**
 * Adds a clustered GeoJSON point layer to the map.
 * This function fetches GeoJSON data and adds the points to a MarkerClusterGroup.
 *
 * @param filePath - The path to the GeoJSON file.
 * @param onEachFeatureCallback - Callback for each feature.
 * @param pointToLayerCallback - Callback to create a layer for each point.
 * @returns The marker cluster group.
 */
export async function addClusteredGeoJsonPointLayer<P>(
    filePath: string,
    onEachFeatureCallback?: L.GeoJSONOptions<P, Point>['onEachFeature'],
    pointToLayerCallback?: L.GeoJSONOptions<P, Point>['pointToLayer'],
) {
    // This function creates the custom icon for each cluster.
    const createClusterIcon = function (cluster: L.MarkerCluster) {
        // Get all markers in the cluster.
        const childMarkers = cluster.getAllChildMarkers();
        // Get the HTML for the first, second, and third marker icons if they exist.
        // This group contains only the photo factory's DivIcons. Leaflet's
        // general Marker type also allows image Icons, hence the local cast.
        const iconHtml = (index: number) =>
            (childMarkers[index]?.options.icon as L.DivIcon | undefined)?.options.html || '';
        const firstMarkerIconHtml = iconHtml(0);
        const secondMarkerIconHtml = iconHtml(1);
        const thirdMarkerIconHtml = iconHtml(2);

        // Build the HTML for the stack.
        // The order here is first, second, third (bottom to top in the DOM).
        // The CSS z-index should control the visual stacking.
        let clusterHtml = `
            <div class="custom-cluster-stack">
                <div class="stack-item stack-item-1">${firstMarkerIconHtml}</div>
                <div class="stack-item stack-item-2">${secondMarkerIconHtml}</div>
        `;
        // Only include the third stack item if there is a third marker.
        if (thirdMarkerIconHtml) {
            clusterHtml += `<div class="stack-item stack-item-3">${thirdMarkerIconHtml}</div>`;
        }
        clusterHtml += `
            </div>
        `;

        // Create a new Leaflet DivIcon using our custom HTML.
        return L.divIcon({
            html: clusterHtml,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // Create a new marker cluster group with our custom iconCreateFunction.
    const markers = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 15,
        zoomToBoundsOnClick: true,
        iconCreateFunction: createClusterIcon
    });

    // Fetch the GeoJSON data.
    const geojsonData = await fetchGeoJson<FeatureCollection<Point, P>>(filePath);

    // Define the options for the GeoJSON layer, including callbacks.
    const layerOptions = buildLayerOptions(onEachFeatureCallback, pointToLayerCallback);

    // Create a GeoJSON layer with the data and options.
    const geoJsonLayer = L.geoJSON(geojsonData, layerOptions);

    // Add the markers from the GeoJSON layer to the cluster group.
    markers.addLayer(geoJsonLayer);

    // Return the created cluster group.
    return markers;
}


/**
 * Creates a GeoJSON line layer using the provided file path and style,
 * but does not add it to the map.
 *
 * @param filePath - URL/path to the GeoJSON file.
 * @param style - Styling options for the layer.
 * @returns The created GeoJSON layer, not yet added to the map.
 */
export async function createGeoJsonLineLayer(filePath: string, style: L.PolylineOptions) {
    // Fetch the GeoJSON data (fetchGeoJson handles HTTP and JSON-parse errors).
    const geojson = await fetchGeoJson<FeatureCollection<LineString | MultiLineString>>(filePath);
    // Create the layer using Leaflet's geoJSON factory.
    //
    // The style is spread into the options as well as passed as `style`,
    // because Leaflet hands the options object straight to each feature's
    // Polyline constructor. That matters for `renderer`: Leaflet reads it once,
    // when the layer is added to the map, so a renderer supplied only via
    // `style` (which is applied later) would be ignored and the layer would
    // silently fall back to the map's default renderer. The paint properties
    // ride along harmlessly; `style` still applies them.
    const layer = L.geoJSON(geojson, {
        ...style,
        style: style
    });
    // Return the layer (do not add it to any map yet).
    return layer;
}