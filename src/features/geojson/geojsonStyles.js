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

// Styles used by addGeoJsonLineLayer (static layers)
export const LineStyles = {
  publicTransport: {
    color: "#ff5e00ff",
    weight: 2,
    opacity: 0.8,
    dashArray: "4, 6"
  },
  cycling: {
    color: "#b100c9ff",
    weight: 1.5,
    opacity: 0.9
  },
  walking: {
    color: "#b100c9ff",
    weight: 1.5,
    opacity: 0.9,
  },
  ferry: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    dashArray: "10, 20"
  },
  // Arcs for past flights: a dashed light-blue hairline. Very thin so it stays
  // understated, but fully opaque so it reads clearly. Only shown in the
  // zoomed-out band (see flight zoom-gating in script.js).
  flight: {
    color: "#3fa9f5",
    weight: 1,
    opacity: 1,
    dashArray: "4, 8"
  }
};