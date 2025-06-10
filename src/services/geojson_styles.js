// Styles used by animateChainedGeoJson
export const AnimatedLineStyles = {
  // default style for any line with no special "type"
  default: {
    color: "black",
    weight: 1.5,
    opacity: 0.6,
  },
  // style for Shinkansen features
  Shinkansen: {
    color: "#1E90FF",
    weight: 3,
    opacity: 0.8,
  },
  // style for LongFerry features
  LongFerry: {
    color: "#FF4500",
    weight: 2,
    opacity: 0.6,
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