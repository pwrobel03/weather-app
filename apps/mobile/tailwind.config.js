// The generated file does `module.exports = tokens`, so it must NOT be
// destructured - `const { tokens } = require(...)` yields undefined and every
// colour below silently becomes undefined with it. That was the previous
// version, and it never surfaced only because no screen had rendered yet.
const tokens = require("@weather-app/design-tokens/generated/tokens.cjs");

/**
 * camelCase -> kebab-case, mirroring packages/design-tokens/scripts/build.ts,
 * so `tloCiemne` is `bg-tlo-ciemne` here and `--dt-color-tlo-ciemne` on web.
 */
function kebab(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

// Derived, not hand-listed. Listing them by hand meant a token added to
// tokens.ts silently never reached NativeWind, with nothing to say why.
const colors = Object.fromEntries(
  Object.entries(tokens.colors).map(([name, value]) => [kebab(name), value]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Single source of truth: packages/design-tokens (markdown/design.md).
      //
      // The four surfaces below are overridden to read CSS variables instead of
      // fixed token values, because they are the ones that differ between
      // themes. Everything else - primary, the IMGW warning scale, the hero's
      // own ground - is the same colour whatever the theme, and stays a token.
      colors: {
        ...colors,
        tlo: "rgb(var(--tlo) / <alpha-value>)",
        powierzchnia: "rgb(var(--powierzchnia) / <alpha-value>)",
        tekst: "rgb(var(--tekst) / <alpha-value>)",
        "tekst-muted": "rgb(var(--tekst-muted) / <alpha-value>)",
        linia: "rgb(var(--linia) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
