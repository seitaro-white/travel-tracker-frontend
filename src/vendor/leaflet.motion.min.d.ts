import 'leaflet';

// The unchanged vendored script installs these APIs onto the shared global L.
declare module 'leaflet' {
    // Only the 0.3.2 API used by this app is declared here. Speed is km/h
    // (the plugin converts metres/ms internally).
    namespace motion {
        function polyline(
            points: LatLngExpression[],
            style: PolylineOptions,
            options: {
                auto: boolean;
                speed: number;
                easing?: (progress: number, elapsed: number, start: number, change: number, duration: number) => number;
            },
            markerOptions: MarkerOptions,
        ): Polyline;
    }
    namespace Motion {
        const Event: { Ended: string };
        namespace Ease {
            function easeOutSine(progress: number, elapsed: number, start: number, change: number, duration: number): number;
        }
    }
}
