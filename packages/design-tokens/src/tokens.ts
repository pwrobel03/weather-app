/**
 * Canonical values from markdown/design.md. This file is the single source of
 * truth: apps/mobile's NativeWind config imports it directly, apps/web consumes
 * it via the generated CSS custom properties (see scripts/build.ts) since
 * Tailwind v4 is CSS-first. Never hand-duplicate these values in either app.
 */
export const tokens = {
  colors: {
    /**
     * Hero base (design.md revision 2026-07-27b). A deep, near-uniform navy
     * rather than a saturated gradient: three of the four references in
     * idea/updated sit on a calm dark ground, and the saturated version was
     * tiring to look at. Weather still drives the colour, but as a tilt of
     * this base rather than a flood of its own.
     */
    ziemia: "#0F1826",
    powierzchnia: "#16202F",
    /** Page ground in the light theme. Never pure white - a saturated or very
     * dark block against #FFF is the harsh edge that made the first version
     * hurt to look at. */
    tloJasne: "#E8EDF5",
    /**
     * Page ground in the dark theme. Deliberately much darker than the hero
     * (d.png): when the page and the hero share a value the hero stops reading
     * as its own element and dissolves into the background - which is exactly
     * why the light theme looked better, not the colour itself.
     */
    tloCiemne: "#070A11",
    /**
     * The alert card's material. Opaque by rule: it is the one surface in the
     * app that must stay legible over a shifting gradient, and now that
     * everything around it is glass, its opacity is itself the signal
     * (design.md §4).
     */
    alertMaterial: "#10141B",
    tekst: "#E8ECF2",
    tekstMuted: "#8A94A6",
    primary: "#2E6FA8",
    /**
     * IMGW's public warning scale.
     *
     * Reserved by role, not by pixel (design.md §3): forbidden on anything
     * that signals state - tile backgrounds, badges, buttons, borders, chart
     * series. Permitted on icons that depict a phenomenon, e.g. a yellow bolt.
     * Severity is never conveyed by colour alone: always colour + label +
     * shape.
     */
    warning1: "#F5C518",
    warning2: "#F08A24",
    warning3: "#E0342B",
  },
  /**
   * Glow strength is roughly half what it was. The channel still reads - day
   * is unmistakably brighter than night - but it tints the navy rather than
   * replacing it.
   */
  glow: {
    dawn: "rgba(132, 158, 214, 0.42)",
    day: "rgba(122, 186, 236, 0.46)",
    dusk: "rgba(164, 126, 214, 0.42)",
    night: "rgba(52, 88, 148, 0.34)",
  },
  /**
   * The hero gradient, per time of day: `a` is the top stop, `b` the bottom,
   * `glowB` the secondary radial tint and `glowY` where the primary glow sits
   * vertically.
   *
   * These lived only in apps/web's globals.css until the mobile hero needed
   * them. A gradient copied by hand into a second app is a gradient that will
   * differ by one hex digit within a month, and nobody will be able to say
   * which one is right - so the values move here and both apps read them.
   *
   * Note dusk leans violet rather than the literal orange of a sunset:
   * orange is IMGW severity level 2, and the background must never speak in
   * the warning scale (design.md §3).
   */
  sky: {
    dawn: { a: "#5B7FC7", b: "#2E3F73", glowB: "rgba(46, 84, 140, 0.4)", glowY: "22%" },
    day: { a: "#4C9EDE", b: "#245A93", glowB: "rgba(38, 84, 138, 0.42)", glowY: "8%" },
    dusk: { a: "#7B5AB8", b: "#332F62", glowB: "rgba(58, 74, 150, 0.45)", glowY: "30%" },
    night: { a: "#1E3358", b: "#0C1220", glowB: "rgba(18, 32, 64, 0.55)", glowY: "14%" },
  },
  /**
   * The phenomenon channel: how much dark veil sits over the sky, and how much
   * the veil pushes contrast. Rain is heavier than drizzle, a thunderstorm
   * heavier still - the ordering is the whole point, the exact values are
   * tuned by eye.
   *
   * `contrast` is a CSS backdrop-filter value on web. React Native has no
   * equivalent, so the mobile background uses only `opacity` - the ordering
   * survives, the last few percent of the effect does not.
   */
  veil: {
    clear: { opacity: "0", contrast: "1" },
    cloud: { opacity: "0.3", contrast: "0.97" },
    fog: { opacity: "0.55", contrast: "0.88" },
    drizzle: { opacity: "0.42", contrast: "0.95" },
    rain: { opacity: "0.58", contrast: "0.92" },
    snow: { opacity: "0.34", contrast: "1.04" },
    hail: { opacity: "0.62", contrast: "1.06" },
    thunderstorm: { opacity: "0.72", contrast: "1.1" },
  },
  /**
   * iOS-flavoured glass (design.md §4).
   *
   * Saturation matters as much as blur: blur alone desaturates whatever shows
   * through and yields grey sludge rather than glass. The bright top edge is
   * the detail that reads as light catching a real material.
   */
  glass: {
    darkBackground: "rgba(255, 255, 255, 0.10)",
    lightBackground: "rgba(255, 255, 255, 0.28)",
    darkBorder: "rgba(255, 255, 255, 0.14)",
    lightBorder: "rgba(255, 255, 255, 0.30)",
    darkEdge: "rgba(255, 255, 255, 0.30)",
    lightEdge: "rgba(255, 255, 255, 1)",
    /**
     * Back up, and deliberately so. Glass only reads as glass when the blur
     * has something behind it to bend; at 14px over a flat ground it was
     * indistinguishable from a matte panel. Paired with the page backdrop in
     * globals.css, which gives it something to work on.
     */
    /**
     * Low on purpose. The frosted read comes from the inner glow in the box
     * shadow, not from the blur - which is why the material still looks like
     * glass over a flat ground, where a heavy blur has nothing to bend.
     */
    blur: "5px",
    saturate: "180%",
  },
  /**
   * Tracking is size-specific by rule - a single letter-spacing value is wrong
   * somewhere. Large text needs negative tracking as it grows, small text
   * needs a touch of positive to stay legible (design.md §9).
   */
  type: {
    tempTracking: "-0.045em",
    tempLeading: "0.92",
    tempWeight: "200",
    headingTracking: "0.02em",
    labelTracking: "0.04em",
  },
  easing: {
    // Named after its role, not its shape - used throughout for anything
    // arriving/settling (alert takeover, pulses, glass materialising).
    out: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
} as const;

export type DesignTokens = typeof tokens;
