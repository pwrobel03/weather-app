import type { components } from "@weather-app/api-client";
import type { GeoJsonPolygonGeometry } from "@weather-app/core";

import { authorizedClient } from "./auth/session";

export type PowiatFeature = {
  properties: { terytCode: string; name: string; voivodeship: string };
  geometry: GeoJsonPolygonGeometry;
};

type RawFeature = components["schemas"]["PowiatGeoJsonFeature"];

/**
 * Outlines for a set of powiats, in one request.
 *
 * The batch endpoint (commit 80) exists precisely so this is one round trip:
 * a phone on mobile data asking for a hundred boundaries one at a time is a
 * screen that never finishes loading.
 */
export async function fetchPowiatBoundaries(terytCodes: string[]): Promise<PowiatFeature[]> {
  if (terytCodes.length === 0) return [];

  try {
    const { data } = await authorizedClient().GET("/api/boundaries/geojson", {
      params: { query: { teryt: terytCodes } },
    });
    return (data?.features ?? []).map(normalise);
  } catch {
    return [];
  }
}

/**
 * The generated client types `geometry` as a string; the wire format is a
 * nested object. The backend emits PostGIS's own ST_AsGeoJSON output verbatim
 * via @JsonRawValue, which springdoc documents by its declared Kotlin type.
 * Same mismatch apps/web handles; the real fix belongs in the backend schema.
 */
function normalise(feature: RawFeature): PowiatFeature {
  return {
    properties: feature.properties as PowiatFeature["properties"],
    geometry: (typeof feature.geometry === "string"
      ? JSON.parse(feature.geometry)
      : feature.geometry) as GeoJsonPolygonGeometry,
  };
}
