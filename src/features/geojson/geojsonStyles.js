// Styles used by animateChainedGeoJson, now including speed
export const AnimatedLineStyles = {
  // default style for any line with no special "type"
  default: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 200000,
    dashArray: "2, 4"      // default motion speed
  },
  // style for Shinkansen features
  Shinkansen: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 400000,
    dashArray: "4, 6"     // fast speed for Shinkansen
  },
  // style for LongFerry features
  LongFerry: {
    color: "#ff5e00ff",
    weight: 2.5,
    opacity: 0.9,
    speed: 600000,
    dashArray: "5, 10"     // fast speed for ferry
  }
};

// Styles used by addGeoJsonLineLayer (static layers)
export const LineStyles = {
  publicTransport: {
    color: "#ff5e00ff",
    weight: 2,
    opacity: 0.9,
  },
  cycling: {
    color: "#24afffff",
    weight: 1.5,
    opacity: 0.9
  },
  walking: {
    color: "#8826ffff",
    weight: 1.5,
    opacity: 0.9,
  },
  ferry: {
    color: "#ff5e00ff",
    weight: 2,
    opacity: 0.9,
  }
};