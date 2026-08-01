import "server-only";

import { createWeatherApiClient } from "@weather-app/api-client";

function client() {
  return createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );
}

export type PowiatOutline = {
  terytCode: string;
  name: string;
  voivodeship: string;
  /** GeoJSON geometry, already simplified by the backend. */
  geometry: GeoJsonMultiPolygon;
};

type GeoJsonMultiPolygon = {
  type: "MultiPolygon" | "Polygon";
  coordinates: number[][][][] | number[][][];
};

/**
 * Resolves coordinates to a powiat and fetches its simplified outline.
 *
 * Uses the boundary endpoints from commits 23 and 25, which have been in the
 * backend since Faza 2 and had no consumer until now. Both are public - the
 * powiat you are standing in is not private information.
 *
 * Returns null for anything outside Poland's boundaries, which is an expected
 * outcome rather than an error.
 */
export async function fetchPowiatOutline(
  latitude: number,
  longitude: number,
): Promise<PowiatOutline | null> {
  try {
    const resolved = await client().GET("/api/boundaries/resolve", {
      params: { query: { latitude, longitude } },
    });
    const terytCode = resolved.data?.terytCode;
    if (!terytCode) {
      return null;
    }

    const feature = await client().GET("/api/boundaries/{terytCode}/geojson", {
      params: { path: { terytCode } },
    });
    if (!feature.data?.geometry) {
      return null;
    }

    return {
      terytCode,
      name: resolved.data?.name ?? "",
      voivodeship: resolved.data?.voivodeship ?? "",
      geometry: parseGeometry(feature.data.geometry),
    };
  } catch {
    return null;
  }
}

/**
 * The generated client types `geometry` as a string, but the wire format is a
 * nested object.
 *
 * The backend field is a Kotlin `String` annotated `@JsonRawValue` so Postgres'
 * own ST_AsGeoJSON output is emitted verbatim rather than double-escaped -
 * correct on the wire, but springdoc documents the declared type, so the
 * OpenAPI schema (and therefore the generated client) claims `string`.
 *
 * Handled here rather than trusted, because a `JSON.parse` on an object throws
 * and the tile simply vanishes. The real fix belongs in the backend, where the
 * schema should be annotated to match what is actually sent.
 */
function parseGeometry(value: unknown): GeoJsonMultiPolygon {
  return (typeof value === "string" ? JSON.parse(value) : value) as GeoJsonMultiPolygon;
}

/**
 * Flattens a GeoJSON MultiPolygon into SVG path data, fitted to a unit box.
 *
 * Drawn as a path rather than with a map library: this tile shows one
 * administrative shape with no panning, zooming or tiles behind it, and
 * MapLibre for that would be several hundred kB to draw an outline we already
 * have the coordinates for. The real map arrives in Faza 8.
 */
export function outlineToSvgPath(geometry: GeoJsonMultiPolygon, size = 100): string {
  const rings: number[][][] =
    geometry.type === "MultiPolygon"
      ? (geometry.coordinates as number[][][][]).flat()
      : (geometry.coordinates as number[][][]);

  const points = rings.flat();
  if (points.length === 0) {
    return "";
  }

  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Latitude degrees are longer than longitude degrees away from the equator;
  // at Polish latitudes ignoring that squashes every powiat horizontally.
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(midLat);

  const width = (maxLon - minLon) * lonScale;
  const height = maxLat - minLat;
  const scale = size / Math.max(width, height);
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;

  return rings
    .map((ring) => {
      const commands = ring.map(([lon, lat], index) => {
        const x = (lon - minLon) * lonScale * scale + offsetX;
        // SVG y grows downward, latitude grows northward.
        const y = size - ((lat - minLat) * scale + offsetY);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      return `${commands.join("")}Z`;
    })
    .join(" ");
}
