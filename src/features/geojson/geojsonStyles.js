import { createRoughRenderer } from './roughRenderer.js';

// Styles used by animateChainedGeoJson, now including speed
export const AnimatedLineStyles = {
  // default style for any line with no special "type"
  default: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 600000,
    dashArray: "2, 4"      // default motion speed
  },
  // style for Shinkansen features
  Shinkansen: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 1000000,
    dashArray: "4, 6"     // fast speed for Shinkansen
  },
  // style for LongFerry features
  LongFerry: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 2400000,
    dashArray: "10, 20"     // fast speed for ferry
  }
};

// All the static lines share one hand-drawn renderer. Sharing matters: each
// renderer instance owns its own <svg> in the overlay pane, so splitting these
// across several renderers would make them stack by renderer rather than by the
// order they are added in script.js's STATIC_LINE_LAYERS.
//
// The animated intro lines deliberately do NOT use this. leaflet.motion redraws
// them as they grow, so the wobble would be re-rolled every frame and the line
// would boil -- and the crossfade reads better as tidy lines dissolving into
// hand-drawn ones.
const roughRenderer = createRoughRenderer();

// Styles used by addGeoJsonLineLayer (static layers)
//
// `smoothFactor` is Leaflet's own Douglas-Peucker tolerance, in pixels. It is
// turned up well past the default of 1 on the heavier layers for two reasons:
// it cuts how much geometry rough.js has to redraw on every zoom, and a sketchy
// line wants fewer points anyway -- rough overshoots each segment by a couple of
// pixels, so tracing every GPS wiggle turns into a scribble.
export const LineStyles = {
  // Solid and the heaviest of the static lines: these are the trunk routes the
  // trip hangs off, so they should read first. Deliberately undashed -- the
  // hand-drawn wobble is the character here, and a short dash pattern chops it
  // up into ticks and hides it. Colour alone still separates these from the
  // purple walking/cycling lines (and from the still-dashed ferries).
  publicTransport: {
    color: "#ff5e00ff",
    weight: 3,
    opacity: 0.8,
    renderer: roughRenderer,
    smoothFactor: 4
  },
  cycling: {
    color: "#b100c9ff",
    weight: 1.5,
    opacity: 0.9,
    renderer: roughRenderer,
    smoothFactor: 3
  },
  walking: {
    color: "#b100c9ff",
    weight: 1.5,
    opacity: 0.9,
    renderer: roughRenderer,
    smoothFactor: 4
  },
  ferry: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    dashArray: "10, 20",
    renderer: roughRenderer,
    smoothFactor: 2
  },
  // Arcs for past flights: a dashed light-blue hairline. Very thin so it stays
  // understated, but fully opaque so it reads clearly. Only shown in the
  // zoomed-out band (see flight zoom-gating in script.js).
  //
  // No smoothFactor override: these are synthesised smooth curves rather than
  // GPS traces (see flightArcs.js), and simplifying them would flatten the bow.
  flight: {
    color: "#3fa9f5",
    weight: 1,
    opacity: 1,
    dashArray: "4, 8",
    renderer: roughRenderer
  }
};