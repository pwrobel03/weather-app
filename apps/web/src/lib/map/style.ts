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
