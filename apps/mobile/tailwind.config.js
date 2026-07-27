const { tokens } = require("@weather-app/design-tokens/generated/tokens.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Single source of truth: packages/design-tokens (markdown/design.md).
        ziemia: tokens.colors.ziemia,
        powierzchnia: tokens.colors.powierzchnia,
        tekst: tokens.colors.tekst,
        "tekst-muted": tokens.colors.tekstMuted,
        primary: tokens.colors.primary,
        warning: {
          1: tokens.colors.warning1,
          2: tokens.colors.warning2,
          3: tokens.colors.warning3,
        },
      },
    },
  },
  plugins: [],
};
