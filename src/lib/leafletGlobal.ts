import L from 'leaflet';

// Markercluster and the vendored motion plugin predate ES modules and read
// global L. This dependency runs before their side-effect imports in leaflet.ts,
// ensuring that both plugins extend the very object the app imports.
window.L = L;
export default L;
