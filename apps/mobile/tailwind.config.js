/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Tokeny z markdown/design.md — te same wartości co apps/web/src/app/globals.css (.dark)
        ziemia: "#0B0E14",
        powierzchnia: "#141922",
        tekst: "#E8ECF2",
        "tekst-muted": "#8A94A6",
        primary: "#2E6FA8",
        warning: {
          1: "#F5C518",
          2: "#F08A24",
          3: "#E0342B",
        },
      },
    },
  },
  plugins: [],
};
