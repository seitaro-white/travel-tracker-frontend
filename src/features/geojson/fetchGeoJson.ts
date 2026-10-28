// Kept separate from Leaflet layer construction so data-only consumers (and
// their Node unit tests) don't need a browser or a map library loaded.
export async function fetchGeoJson<T>(filePath: string): Promise<T> {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Network response was not ok for ${filePath}: ${response.statusText}`);
    }
    try {
        // JSON has no static type at runtime. The caller supplies the dataset
        // contract; schema tests check the source files independently.
        return await response.json() as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON from ${filePath}: ${(error as Error).message}`);
    }
}
