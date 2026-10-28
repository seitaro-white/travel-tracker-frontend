import type * as Leaflet from 'leaflet';

declare global {
    interface Window {
        __APP_CONFIG__?: {
            useThunderforest?: boolean;
            thunderforestApiKey?: string;
        };
        // Legacy plugins need the same mutable Leaflet object, not an ESM
        // namespace copy. Application modules still import it explicitly.
        L: typeof Leaflet;
        // Only the E2E init script sets this; ordinary app sessions have no
        // map registry. Tests can use it after their setup has captured a map.
        __leafletMap?: Leaflet.Map;
    }
}
