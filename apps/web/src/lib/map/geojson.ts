export type PowiatFeature = {
  type: "Feature";
  properties: { terytCode: string; name: string; voivodeship: string };
  geometry: unknown;
};

/**
 * The shape the boundary endpoint returns, and the shape a MapLibre GeoJSON
 * source consumes - the same shape, which is why nothing reshapes it.
 *
 * Types only: the fetch itself belongs to the browser (see WarningMap), and
 * the proxy that serves it streams the body straight through without parsing.
 */
export type PowiatFeatureCollection = {
  type: "FeatureCollection";
  features: PowiatFeature[];
};
