/**
 * Canonical values from markdown/design.md. This file is the single source of
 * truth: apps/mobile's NativeWind config imports it directly, apps/web consumes
 * it via the generated CSS custom properties (see scripts/build.ts) since
 * Tailwind v4 is CSS-first. Never hand-duplicate these values in either app.
 */
export const tokens = {
  colors: {
    ziemia: "#0B0E14",
    powierzchnia: "#141922",
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
  glow: {
    dawn: "rgba(88, 116, 176, 0.50)",
    day: "rgba(46, 111, 168, 0.60)",
    dusk: "rgba(120, 78, 168, 0.55)",
    night: "rgba(32, 58, 104, 0.62)",
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
    lightBackground: "rgba(255, 255, 255, 0.60)",
    darkBorder: "rgba(255, 255, 255, 0.14)",
    lightBorder: "rgba(255, 255, 255, 0.70)",
    darkEdge: "rgba(255, 255, 255, 0.28)",
    lightEdge: "rgba(255, 255, 255, 0.95)",
    blur: "24px",
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
