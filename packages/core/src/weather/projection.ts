export type GeoJsonPolygonGeometry = {
  type: "MultiPolygon" | "Polygon";
  coordinates: number[][][][] | number[][][];
};

export type ProjectedShape = {
  terytCode: string;
  name: string;
  /** SVG path data in the requested box. */
  d: string;
};

type Feature = {
  properties: { terytCode: string; name: string };
  geometry: GeoJsonPolygonGeometry;
};

/**
 * Projects several powiat outlines into one SVG box, sharing a single frame.
 *
 * The shared frame is the whole point. Fitting each shape to its own box - the
 * per-shape helper apps/web uses for a single powiat - would scale every one
 * differently and destroy the only thing a multi-powiat picture is for:
 * showing where they sit relative to each other.
 *
 * Lives here rather than in either app because it is arithmetic over
 * coordinates with no renderer attached. apps/mobile draws the result with
 * react-native-svg; anything else could draw it with anything else.
 */
export function projectShapes(
  features: readonly Feature[],
  size = 100,
  padding = 4,
): ProjectedShape[] {
  const rings = features.map((feature) => ({
    terytCode: feature.properties.terytCode,
    name: feature.properties.name,
    rings: ringsOf(feature.geometry),
  }));

  const points = rings.flatMap((shape) => shape.rings.flat());
  if (points.length === 0) return [];

  const longitudes = points.map((point) => point[0] as number);
  const latitudes = points.map((point) => point[1] as number);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);

  // Latitude degrees are longer than longitude degrees away from the equator;
  // at Polish latitudes, ignoring that squashes every powiat horizontally.
  const lonScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const width = (maxLon - minLon) * lonScale;
  const height = maxLat - minLat;
  const inner = size - padding * 2;
  // Guard the degenerate case: a single tiny powiat can have a zero-width or
  // zero-height extent at this precision, and dividing by it yields Infinity
  // and a path of NaNs that renders as nothing at all.
  const scale = inner / Math.max(width, height, Number.EPSILON);

  const offsetX = padding + (inner - width * scale) / 2;
  const offsetY = padding + (inner - height * scale) / 2;

  return rings.map((shape) => ({
    terytCode: shape.terytCode,
    name: shape.name,
    d: shape.rings
      .map((ring) => {
        const commands = ring.map((point, index) => {
          const x = ((point[0] as number) - minLon) * lonScale * scale + offsetX;
          // SVG y grows downward, latitude grows northward.
          const y = size - (((point[1] as number) - minLat) * scale + offsetY);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        });
        return `${commands.join("")}Z`;
      })
      .join(" "),
  }));
}

function ringsOf(geometry: GeoJsonPolygonGeometry): number[][][] {
  return geometry.type === "MultiPolygon"
    ? (geometry.coordinates as number[][][][]).flat()
    : (geometry.coordinates as number[][][]);
}
