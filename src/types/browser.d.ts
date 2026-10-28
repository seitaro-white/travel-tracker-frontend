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
        // Opt-in E2E seam: a test installs this before navigation. Bundled
        // Leaflet has no interceptable CDN assignment or public map registry.
        __onLeafletMapCreated?: (map: Leaflet.Map) => void;
        __leafletMap: Leaflet.Map;
    }
}
