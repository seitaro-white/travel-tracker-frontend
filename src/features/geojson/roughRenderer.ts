// A hand-drawn Leaflet renderer, backed by rough.js.
//
// Leaflet turns a polyline's projected pixel points into an SVG `d` attribute
// in exactly one place -- `L.SVG._updatePoly` -- so that is the only method we
// replace. Everything else about a line layer is untouched: stroke colour and
// weight still come from the style objects in geojsonStyles.ts, clicks still
// work, and each feature still has the `_path` element that the fade helpers in
// script.ts reach for during the intro crossfade.
//
// Usage: put the renderer in a style object (see geojsonStyles.ts) and Leaflet
// hands that layer to us instead of its own SVG renderer. Layers without it --
// notably the animated intro lines -- are unaffected.

import L from '../../lib/leaflet';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type { Point } from 'roughjs/bin/geometry';

// The npm 4.6.6 bundle is byte-identical to the former vendored rough.js.
// Its headless generator produces SVG path strings without a canvas or DOM.
const generator = rough.generator();

// Tuned for map lines specifically. `roughness` and `bowing` are measured in
// screen pixels and do not scale with zoom, which is what we want -- the lines
// look equally sketchy however far you zoom in.
//
// These were picked by eye against dense Tokyo walking routes at zoom 13. Much
// below this and the effect is too timid to notice; much above (roughness ~3)
// and the lines wander far enough off the real streets that a route stops
// looking like a route and starts looking like noise.
const DEFAULT_ROUGH_OPTIONS = {
    roughness: 2.2,
    bowing: 1.8,
    // Rough draws every stroke twice by default, for a sketched-over look. We
    // only want one pass. It halves the work (these layers carry tens of
    // thousands of points between them) and stops the doubled line muddying the
    // dash patterns in geojsonStyles.ts.
    disableMultiStroke: true,
};

class RoughSVG extends L.SVG {
    constructor(private readonly roughOptions: Options) {
        super();
    }

    // Leaflet 1.9.4 calls this private hook with clipped/projected points. Its
    // public types deliberately omit _parts and _setPath, so keep the private
    // contract local rather than weakening all Leaflet layers with `any`.
    _updatePoly(layer: L.Polyline, closed: boolean) {
        const parts = (layer as L.Polyline & { _parts: L.Point[][] })._parts;
        const svg = this as unknown as { _setPath(layer: L.Polyline, path: string): void };
        svg._setPath(layer, roughPointsToPath(parts, closed, seedFor(layer), this.roughOptions));
    }
}

/**
 * Rough re-rolls its randomness on every call, and Leaflet redraws every path
 * on every zoom -- and on every pan far enough to reset the SVG viewport.
 * Without a fixed seed the wobble would be different each time and the lines
 * would visibly shimmer as you moved around the map.
 *
 * `L.Util.stamp` gives each layer a small integer id that is stable for the
 * life of the page, which is exactly the seed we need. (The pixel coordinates
 * still change with zoom, so a line is not drawn identically at every zoom
 * level -- but it holds still while you pan around at one.)
 */
function seedFor(layer: L.Layer) {
    return L.Util.stamp(layer);
}

/**
 * The hand-drawn counterpart to Leaflet's own `L.SVG.pointsToPath`.
 *
 * @param {Array<Array<L.Point>>} parts - Clipped, simplified pixel points, one
 *   array per line part. This is Leaflet's `layer._parts`.
 * @param {boolean} closed - True for polygons, whose rings must be closed.
 * @param {number} seed - Stable per-layer randomness seed (see seedFor).
 * @param {object} roughOptions - Options passed through to rough.js.
 * @returns {string} An SVG path `d` string.
 */
function roughPointsToPath(parts: L.Point[][], closed: boolean, seed: number, roughOptions: Options) {
    let str = '';

    for (const points of parts) {
        // rough wants plain [x, y] pairs; Leaflet gives us L.Point objects.
        const coords = points.map((p): Point => [p.x, p.y]);

        // rough's linearPath just joins the points it is given, so a polygon's
        // ring has to be closed by hand.
        if (closed && coords.length > 2) {
            coords.push(coords[0]);
        }

        // Fewer than two points is not a line.
        if (coords.length < 2) continue;

        const drawable = generator.linearPath(coords, { ...roughOptions, seed });
        // One drawable can be several paths; with disableMultiStroke it is
        // always one, but concatenating is correct either way since every `d`
        // starts with its own `M`.
        for (const path of generator.toPaths(drawable)) {
            str += path.d;
        }
    }

    // SVG complains about an empty `d` -- the same guard Leaflet's own
    // pointsToPath uses.
    return str || 'M0 0';
}

/**
 * Creates a Leaflet SVG renderer that draws polylines as if by hand.
 *
 * Share one renderer between layers that need to keep their relative z-order:
 * each renderer instance owns its own <svg> element in the overlay pane, so
 * layers in different renderers stack by renderer, not by the order they were
 * added.
 *
 * @param {object} [roughOptions] - Overrides for DEFAULT_ROUGH_OPTIONS.
 * @returns {L.SVG} A renderer to pass as the `renderer` option of a line style.
 */
export function createRoughRenderer(roughOptions: Options = {}): L.SVG {
    return new RoughSVG({ ...DEFAULT_ROUGH_OPTIONS, ...roughOptions });
}
