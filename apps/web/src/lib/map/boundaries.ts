import "server-only";

import { createWeatherApiClient } from "@weather-app/api-client";

export type PowiatFeature = {
  type: "Feature";
  properties: { terytCode: string; name: string; voivodeship: string };
  geometry: unknown;
};

export type PowiatFeatureCollection = {
  type: "FeatureCollection";
  features: PowiatFeature[];
};

/**
 * Every powiat's simplified outline, as one FeatureCollection.
 *
 * Fetched on the server and passed down as a prop rather than requested from
 * the browser. The response is large and identical for everyone, so serving it
 * through the Next.js render lets it ride the same cache as the page, and the
 * map has its geometry in the first paint rather than a second later.
 *
 * Returns an empty collection on failure. A map with no shapes is a visibly
 * empty map, which is a better failure than a page that will not render.
 */
export async function fetchAllPowiatBoundaries(): Promise<PowiatFeatureCollection> {
  const client = createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );

  try {
    const { data } = await client.GET("/api/boundaries/geojson", { params: { query: {} } });
    return normalise(data);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

/**
 * The generated client types `geometry` as a string; the wire format is a
 * nested object.
 *
 * The backend field is a Kotlin String annotated @JsonRawValue so PostGIS's own
 * ST_AsGeoJSON output is emitted verbatim instead of double-escaped - correct
 * on the wire, but springdoc documents the declared type, so the schema claims
 * `string`. Same mismatch the powiat tile handles; the real fix belongs in the
 * backend's schema annotations.
 */
function normalise(data: unknown): PowiatFeatureCollection {
  const features = (data as { features?: PowiatFeature[] } | undefined)?.features ?? [];

  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      ...feature,
      type: "Feature",
      geometry:
        typeof feature.geometry === "string" ? JSON.parse(feature.geometry) : feature.geometry,
    })),
  };
}
