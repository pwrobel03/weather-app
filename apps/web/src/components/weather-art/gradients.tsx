/**
 * Every gradient the weather icons use, defined once.
 *
 * Rendered a single time near the root of the document; the icons reference
 * these by id. The alternative - inlining <defs> in each icon - duplicates ids
 * across the DOM the moment two icons appear on one screen, which is invalid
 * markup and leaves the browser resolving references by document order.
 *
 * All gradients use gradientUnits="userSpaceOnUse" over the shared 64x64
 * viewBox. The default (objectBoundingBox) is relative to each element's own
 * box, which collapses on zero-width or zero-height geometry - a perfectly
 * vertical raindrop or a horizontal fog line then renders with no paint at
 * all. Only the slanted heavy-rain drops survived that, which is exactly how
 * the bug hid.
 *
 * Colour note (design.md §3): the warm yellows here are *depiction* - they draw
 * the sun and the lightning. The reservation on IMGW's scale covers anything
 * that signals state, which an icon of the weather is not. Severity is never
 * carried by colour alone anywhere in the app.
 */
export function WeatherArtGradients() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="wa-sun" gradientUnits="userSpaceOnUse" x1="32" y1="12" x2="32" y2="42">
          <stop offset="0%" stopColor="#FFE58A" />
          <stop offset="55%" stopColor="#FFD24D" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>

        <linearGradient id="wa-moon" gradientUnits="userSpaceOnUse" x1="20" y1="14" x2="46" y2="40">
          <stop offset="0%" stopColor="#F2F6FF" />
          <stop offset="100%" stopColor="#C3D0E6" />
        </linearGradient>

        {/* Fair-weather cloud: cool white, never grey - grey reads as gloom
            even when the forecast is mild. */}
        <linearGradient id="wa-cloud-light" gradientUnits="userSpaceOnUse" x1="32" y1="10" x2="32" y2="48">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#C8D4E4" />
        </linearGradient>

        {/* Storm cloud: the weight comes from value, not from saturation, so it
            stays in the cool neutrals the base palette lives in. */}
        <linearGradient id="wa-cloud-dark" gradientUnits="userSpaceOnUse" x1="32" y1="10" x2="32" y2="52">
          <stop offset="0%" stopColor="#B9C4D6" />
          <stop offset="55%" stopColor="#8A94A6" />
          <stop offset="100%" stopColor="#5B6472" />
        </linearGradient>

        <linearGradient id="wa-rain" gradientUnits="userSpaceOnUse" x1="32" y1="44" x2="32" y2="60">
          <stop offset="0%" stopColor="#7CC0F0" />
          <stop offset="100%" stopColor="#2E6FA8" />
        </linearGradient>

        {/* Blue enough to survive a light ground. Pure white flakes vanish on
            the light theme, which only shows up when both themes are compared
            side by side. */}
        <linearGradient id="wa-snow" gradientUnits="userSpaceOnUse" x1="32" y1="44" x2="32" y2="60">
          <stop offset="0%" stopColor="#EAF6FF" />
          <stop offset="100%" stopColor="#8FC4EA" />
        </linearGradient>

        <linearGradient id="wa-bolt" gradientUnits="userSpaceOnUse" x1="32" y1="34" x2="32" y2="60">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#F5C518" />
        </linearGradient>

        {/* Soft contact shadow. major.png's icons read as objects sitting in
            space rather than stickers because of exactly this. */}
        <filter id="wa-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#0B0E14" floodOpacity="0.28" />
        </filter>
      </defs>
    </svg>
  );
}
