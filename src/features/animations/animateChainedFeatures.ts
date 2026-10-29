import L from '../../lib/leaflet';
import { AnimatedLineStyles, type AnimationStyle } from '../geojson/geojsonStyles';
import { fetchGeoJson } from '../geojson/fetchGeoJson';
import type { AnimationFeature, Animations } from '../../types/geojson';

// This function handles chained animations for GeoJSON features.
// It now returns an array of the animated layers.
export async function animateChainedGeoJson(group: L.LayerGroup, filePath: string, styleMap: Record<string, AnimationStyle> = AnimatedLineStyles) {
  // Fetch the GeoJSON data using our existing helper.
  const geojson = await fetchGeoJson<Animations>(filePath);
  const features = geojson.features;
  // Map features by their uuid for easy lookup.
  const byUUID = new Map(features.map(f => [f.properties.uuid, f]));
  // Find the initial feature that starts the animation.
  const initialFeature = features.find(f => f.properties.name === "Initial Haneda");
  // Create an invisible icon for the motion plugin.
  const invisibleIcon = L.divIcon({ html: "", className: "leaflet-motion-invisible-marker", iconSize: [0,0] });

  // Array to collect animated layers.
  const animatedLayers: L.Polyline[] = [];

  // Recursive function to animate a feature and its triggered children.
  async function play(feature: AnimationFeature): Promise<void> {
    // Choose the configuration for this feature based on the type.
    const cfg = styleMap[feature.properties.type ?? 'default'] || styleMap.default;
    // Extract the speed setting and keep the remaining properties for styling.
    const { speed: motionSpeed, ...pathStyle } = cfg;
    // Convert geometry into one or more segments.
    const segments = feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

    // Animate each segment concurrently.
    const layerPromises = segments.map(coords => {
      const latLngs = coords.map((c): L.LatLngTuple => [c[1], c[0]]);
      // Create the layer.
      const layer = L.motion.polyline(
        latLngs,
        pathStyle,
        { auto: true, speed: motionSpeed },
        { icon: invisibleIcon }
      );
      // Save a reference for later fade-out.
      animatedLayers.push(layer);
      // Subscribe before addTo: auto-start can finish synchronously for a tiny
      // segment. Subscribing afterwards would miss Ended and stall the intro.
      return new Promise<void>(resolve => {
        layer.once(L.Motion.Event.Ended, () => resolve());
        // A detached group keeps triggered children off the map after a skip.
        // They never auto-start, even though removing their parent fires Ended.
        layer.addTo(group);
      });
    });

    await Promise.all(layerPromises);

    // Animate any triggered children.
    const triggers = feature.properties.triggers || [];
    await Promise.all(triggers.map(id =>
      byUUID.has(id) ? play(byUUID.get(id)!) : Promise.resolve()
    ));
  }

  // Throw an error if no starting feature is found.
  if (!initialFeature) {
    throw new Error('No initial feature with Name "Initial Haneda" found.');
  }
  // Start the animation chain.
  await play(initialFeature);
  return animatedLayers;
}