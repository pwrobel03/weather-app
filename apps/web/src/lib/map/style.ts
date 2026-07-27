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
    // `glyphs` is deliberately absent rather than set to undefined. MapLibre
    // validates the style object, and a key that is present with an undefined
    // value fails that validation with "glyphs: string expected, undefined
    // found" - which aborts the style load, so `load` never fires and no
    // layers are ever added. The map renders as an empty rectangle with its
    // controls, and nothing about it suggests a colour-parsing problem.
    //
    // Same class of mistake as the API client's `baseUrl: undefined`: an
    // explicit undefined is not the same as an omission.
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

/**
 * Turns any CSS colour into something MapLibre can parse.
 *
 * Necessary because the theme's custom properties resolve to modern colour
 * functions - Tailwind v4 emits `oklch()`, and the browser hands back
 * `lab(100% 0 0 / .1)` for some of them. MapLibre's style validator accepts
 * neither, and it rejects the whole layer rather than the one property:
 * `line-color: color expected, "lab(100% 0 0 / .1)" found`, after which the
 * layer is simply absent and the map renders as an empty rectangle with its
 * controls still on it. Nothing about that picture suggests a colour problem.
 *
 * Round-tripping through a canvas is the fix that does not need a list of
 * which properties are safe: the browser parses whatever CSS it supports, and
 * we read back four numbers.
 */
export function toRenderableColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallback;

    context.clearRect(0, 0, 1, 1);
    context.fillStyle = trimmed;
    // An unparseable value leaves fillStyle at its default black, which would
    // silently paint every powiat black rather than fail.
    if (context.fillStyle === "#000000" && !/^(#000000|black|rgb\(0, ?0, ?0\))$/i.test(trimmed)) {
      return fallback;
    }

    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

    return `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`;
  } catch {
    return fallback;
  }
}
