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
    tloJasne: "#EEF2F8",
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
    dawn: "rgba(96, 124, 184, 0.30)",
    day: "rgba(64, 132, 194, 0.34)",
    dusk: "rgba(126, 90, 176, 0.32)",
    night: "rgba(38, 66, 116, 0.26)",
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
