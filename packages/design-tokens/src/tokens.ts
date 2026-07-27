/**
 * Canonical values from markdown/design.md ("Tokeny z prototypu" + the IMGW
 * severity scale). This file is the single source of truth: apps/mobile's
 * NativeWind config imports it directly, apps/web consumes it via the
 * generated CSS custom properties (see scripts/build-css.ts) since Tailwind
 * v4 is CSS-first. Never hand-duplicate these values in either app again.
 */
export const tokens = {
  colors: {
    ziemia: "#0B0E14",
    powierzchnia: "#141922",
    tekst: "#E8ECF2",
    tekstMuted: "#8A94A6",
    primary: "#2E6FA8",
    // IMGW's public warning scale. Reserved: must never appear anywhere in
    // the app except an active warning (markdown/design.md).
    warning1: "#F5C518",
    warning2: "#F08A24",
    warning3: "#E0342B",
  },
  glow: {
    day: "rgba(46, 111, 168, 0.60)",
    dusk: "rgba(120, 78, 168, 0.55)",
    night: "rgba(32, 58, 104, 0.62)",
  },
  easing: {
    // Named after its role, not its shape - used throughout for anything
    // arriving/settling (alert takeover, pulses).
    out: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
} as const;

export type DesignTokens = typeof tokens;
