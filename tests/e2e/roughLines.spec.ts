import { test, expect, type Page } from './fixtures';
import type { LatLngTuple, Layer } from 'leaflet';

// These tests intentionally inspect/redraw Leaflet 1.9.4's private SVG paths.
// Keep the private contract confined to this test rather than broad `any` casts.
type VectorLayer = Layer & { _path?: SVGPathElement; _reset?: () => void };
import { openFinishedMap } from './mapTestHarness';

/**
 * The hand-drawn line renderer (src/features/geojson/roughRenderer.ts).
 *
 * Both things asserted here fail *silently* if they break — the map still draws
 * lines, they just stop being hand-drawn, or they start shimmering — so neither
 * would be caught by the smoke test.
 */

// Tokyo at zoom 12: the densest part of the walking/cycling/transport data, so
// there is guaranteed to be a static line on screen to inspect.
const TOKYO: LatLngTuple = [35.70, 139.70];

/**
 * Collects the `d` attribute of every static line currently on the map.
 *
 * Leaflet has no public list of a layer's SVG paths, so we walk the map's
 * layers and pick out the ones the rough renderer is responsible for. Empty
 * paths ("M0 0") are Leaflet's placeholder for a line clipped entirely out of
 * the viewport — not interesting, so they are dropped.
 */
async function staticLinePaths(page: Page) {
    return page.evaluate(() => {
        const ds: string[] = [];
        window.__leafletMap!.eachLayer((layer) => {
            // Line features live inside L.geoJSON / L.featureGroup wrappers.
            if (!('eachLayer' in layer)) return;
            (layer as import('leaflet').LayerGroup).eachLayer((feature) => {
                const d = (feature as VectorLayer)._path?.getAttribute('d');
                if (d && d !== 'M0 0') ds.push(d);
            });
        });
        return ds;
    });
}

test('static lines use hand-drawn paths which remain stable across redraws', async ({ page }) => {
    await openFinishedMap(page);
    await page.evaluate((c) => window.__leafletMap!.setView(c, 12, { animate: false }), TOKYO);
    const before = await staticLinePaths(page);
    expect(before.length).toBeGreaterThan(0);

    // Leaflet's own pointsToPath emits only M and L commands. rough.js draws
    // every segment as a bezier, so a C command is proof the line went through
    // our renderer rather than falling back to the default one — which is
    // exactly what happens if the `renderer` option stops reaching the Polyline
    // constructor (see createGeoJsonLineLayer in geojsonService.ts).
    expect(before.some((d) => d.includes('C'))).toBe(true);

    // _reset() reprojects and redraws every path. The map has not moved, so the
    // pixel coordinates fed to rough are identical — and with a stable per-layer
    // seed the generated paths must be identical too. Without the seed rough
    // re-rolls its randomness here and the lines visibly jump.
    await page.evaluate(() => {
        window.__leafletMap!.eachLayer((layer) => {
            if (!('eachLayer' in layer)) return;
            (layer as import('leaflet').LayerGroup).eachLayer((feature) => (feature as VectorLayer)._reset?.());
        });
    });

    expect(await staticLinePaths(page)).toEqual(before);
});
