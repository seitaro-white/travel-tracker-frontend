// Styles used by animateChainedGeoJson, now including speed
export const AnimatedLineStyles = {
  // default style for any line with no special "type"
  default: {
    color: "#FF4500",
    weight: 2.5,
    opacity: 0.9,
    speed: 200000,
    dashArray: "2, 4"      // default motion speed
  },
  // style for Shinkansen features
  Shinkansen: {
    color: "#FF4500",
    weight: 2.5,
    opacity: 0.9,
    speed: 400000,
    dashArray: "4, 6"     // fast speed for Shinkansen
  },
  // style for LongFerry features
  LongFerry: {
    color: "#FF4500",
    weight: 2.5,
    opacity: 0.9,
    speed: 600000,
    dashArray: "5, 10"     // fast speed for ferry
  }
};

// Styles used by addGeoJsonLineLayer (static layers)
export const LineStyles = {
  publicTransport: {
    color: "#6A0DAD",
    weight: 1.5,
    opacity: 0.6,
  },
  cycling: {
    color: "#FFD700",
    weight: 1.5,
    opacity: 0.7
  },
  walking: {
    color: "#F04E30",
    weight: 1,
    opacity: 0.7,
  },
  ferry: {
    color: "#FFFFFF",
    weight: 2,
    opacity: 0.7,
  }
};