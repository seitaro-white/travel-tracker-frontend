import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from 'geojson';

// These interfaces describe the fields the app consumes, not every field
// carried by the source exports. Null is meaningful in the actual GeoJSON.
export interface PhotoProperties {
    filename: string | null;
    description: string | null;
    timestamp: string | null;
    priority?: string | null;
}
export interface PlaceProperties {
    Title: string;
    placeList: string;
}
export interface InfoProperties {
    Name: string;
    Description: string | null;
}
export interface AnimationProperties {
    name: string | null;
    type: string | null;
    // Production data uses numbers; the E2E stubs use string identifiers.
    uuid: number | string;
    triggers: (number | string)[];
}
export interface FlightProperties {
    from: string;
    to: string;
    name: string;
}

// Raw photos include the known blank record (null geometry/all-null fields).
// A favourite is narrower: the carousel can safely display it and fly to it.
export type PhotoFeature = Feature<Point | null, PhotoProperties | null>;
export type FavouritePhoto = Feature<Point, PhotoProperties & { filename: string }>;
export type Photos = FeatureCollection<Point | null, PhotoProperties | null>;
export type AnimationFeature = Feature<LineString | MultiLineString, AnimationProperties>;
export type Animations = FeatureCollection<LineString | MultiLineString, AnimationProperties>;
