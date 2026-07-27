import type { StyleSpecification } from "maplibre-gl";

/**
 * Poland's bounding box, in MapLibre's [west, south, east, north] order.
 *
 * Used both as the opening frame and as the pan limit: this map only ever has
 * Polish powiats on it, so letting someone drag off to the Atlantic gives them
 * an empty screen with no way to tell whether it broke.
 */
export const POLAND_BOUNDS: [number, number, number, number] = [14.12, 48.95, 24.16, 54.9];

/**
 * The map's own style, with no basemap behind it.
 *
 * There are no tiles and no third-party provider, which is a deliberate
 * decision rather than a stub. Two reasons, in order of weight:
 *
 * Every tile request tells whoever serves it which part of the country is
 * being looked at, and on this map that is "where I live" - the user's saved
 * location is what the frame is fitted to. Nothing here is worth handing that
 * over for.
 *
 * And the question this map answers is "is my powiat covered", which streets,
 * shop names and terrain do not help with. They are noise around the one
 * signal, and 380 powiats already draw a shape of Poland that is recognisable
 * without help.
 *
 * The cost is honest: zoomed in with no warning nearby, there is nothing to
 * orient against but the outlines themselves.
 */
export function warningMapStyle(background: string): StyleSpecification {
  return {
    version: 8,
    // Required by the spec even with no symbol layers; an empty object keeps
    // MapLibre from reaching for a default glyph server on the open internet.
    glyphs: undefined,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": background },
      },
    ],
  };
}

/**
 * The opening frame: everything the user watches, or the whole country when
 * they watch nothing yet.
 *
 * Opening on Poland for someone who saved only Gdańsk means their own powiat
 * is a few pixels wide in the corner, and the first thing they have to do is
 * find it. The frame follows what they chose to care about.
 *
 * A single saved location has no extent of its own, so a bare bounding box
 * would be a point and MapLibre would zoom to its maximum. `MIN_SPAN_DEGREES`
 * gives it roughly a region's worth of context - enough to see which
 * neighbours are also under a warning, which is usually the actual question.
 */
export function boundsForLocations(
  locations: readonly { latitude: number; longitude: number }[],
): [number, number, number, number] {
  if (locations.length === 0) return POLAND_BOUNDS;

  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);

  let west = Math.min(...longitudes);
  let east = Math.max(...longitudes);
  let south = Math.min(...latitudes);
  let north = Math.max(...latitudes);

  const padLongitude = Math.max(0, MIN_SPAN_DEGREES - (east - west)) / 2;
  const padLatitude = Math.max(0, MIN_SPAN_DEGREES - (north - south)) / 2;

  west -= padLongitude;
  east += padLongitude;
  south -= padLatitude;
  north += padLatitude;

  // Never wider than the country. Padding a location near the border would
  // otherwise push the frame past maxBounds, and MapLibre answers that by
  // silently clamping to somewhere neither we nor the user chose.
  return [
    Math.max(west, POLAND_BOUNDS[0]),
    Math.max(south, POLAND_BOUNDS[1]),
    Math.min(east, POLAND_BOUNDS[2]),
    Math.min(north, POLAND_BOUNDS[3]),
  ];
}

/** About 110 km of latitude - a powiat plus its neighbours. */
const MIN_SPAN_DEGREES = 1.0;

/**
 * The fill paint for the powiat layer, as a MapLibre expression.
 *
 * Extracted from the component because this is where "47 powiats under a level
 * 3 warning are drawn in the level 3 colour" is actually decided, and it
 * cannot be asserted through the map: MapLibre needs a WebGL context that
 * jsdom does not provide.
 *
 * `severityColor` is a lookup rather than a literal palette, so the colours
 * stay whatever the design tokens say they are.
 */
export function powiatFillPaint(
  quietColor: string,
  severityColor: (level: 1 | 2 | 3) => string,
) {
  return {
    "fill-color": [
      "match",
      ["coalesce", ["feature-state", "severity"], 0],
      3, severityColor(3),
      2, severityColor(2),
      1, severityColor(1),
      quietColor,
    ],
    "fill-opacity": [
      "case",
      ["boolean", ["to-boolean", ["coalesce", ["feature-state", "severity"], 0]], false],
      // Saturated fills are heavy at full opacity across a hundred
      // neighbouring shapes, and the border layer has to stay readable
      // through them.
      0.75,
      0.9,
    ],
  } as const;
}
