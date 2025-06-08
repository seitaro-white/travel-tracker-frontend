export const geoJSONLayerStyles = {
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
    walking: { // Example for a new walking layer
        color: "#F04E30",
        weight: 1,
        opacity: 0.7,
    },
    ferry: { // Example for a new driving layer
        color: "#FFFFFF",
        weight: 2,
        opacity: 0.7,
    },

    flights: { // Example for a new flights layer
        color: "red",
        weight: 1.5,
        opacity: 0.6,
        dashArray: "10, 10"
    }
    // Add more styles here as needed
};