// Selects the "favourite" photos that feed the polaroid carousel.
//
// Membership comes from the `priority` property already present on every
// feature in photos.geojson: a photo is a favourite when priority holds
// anything other than an empty value or the string "0". Nothing else in the
// app reads that field, so this module is its only consumer.

import { fetchGeoJson } from '../geojson/fetchGeoJson';
import type { FavouritePhoto, PhotoFeature, Photos } from '../../types/geojson';

const PHOTOS_FILE = 'assets/points/photos.geojson';

/**
 * True when a feature is a flagged favourite AND has everything the carousel
 * needs to display it: a filename to build the image path from, and
 * coordinates to fly the map to.
 *
 * The blank record at photos.geojson index 748 (tracked in todo.MD) has null
 * properties and null geometry, so it fails these checks and drops out here
 * without needing a special case.
 *
 * @param feature - A GeoJSON feature from photos.geojson.
 * The type predicate lets Array.filter narrow raw (possibly blank) records to
 * photos whose filename, properties, and geometry the carousel can rely on.
 */
export function isFavouritePhoto(feature: PhotoFeature): feature is FavouritePhoto {
    const properties = feature.properties;
    if (!properties || !properties.filename) {
        return false;
    }
    if (!feature.geometry || !feature.geometry.coordinates) {
        return false;
    }
    // Treat the flag as set for any truthy value except an explicit "0".
    return Boolean(properties.priority) && properties.priority !== '0';
}

/**
 * Returns a new array holding the same items in a random order, using a
 * Fisher-Yates shuffle. (Walking backwards and swapping each item with a
 * random earlier one gives every ordering an equal chance, which the
 * tempting-but-wrong `sort(() => Math.random() - 0.5)` does not.)
 *
 * The carousel reshuffles on every page load so a repeat visitor meets a
 * different photo first.
 *
 * @returns A shuffled copy; the input is left untouched.
 */
export function shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Swap the item at i with the one at j.
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Loads the shuffled favourites plus the welcome photo that will join them.
 *
 * We fetch the file again rather than sharing the copy the marker cluster layer
 * already parsed: it is only ~220 KB, this request is a browser cache hit
 * because the cluster layer asked for the same URL earlier in the intro, and
 * re-parsing it costs about a millisecond. That buys us a module with no
 * plumbing to thread through script.ts.
 *
 * @returns The carousel's photos, or null when no favourites are flagged.
 */
export async function loadCarouselPhotos(introFilename: string) {
    const geojson = await fetchGeoJson<Photos>(PHOTOS_FILE);
    const favourites = geojson.features.filter(isFavouritePhoto);
    if (favourites.length === 0) return null;

    // The welcome image need not be a flagged favourite, but once it joins the
    // pile it needs the same filename and map coordinates as every other card.
    const introPhoto = geojson.features.find((feature): feature is FavouritePhoto =>
        feature.properties?.filename === introFilename && feature.geometry !== null
    );
    if (!introPhoto) throw new Error(`Welcome photo not found: ${introFilename}`);
    return { favourites: shuffle(favourites), introPhoto };
}
