import { weatherScene, type TimeOfDay, type WeatherScenePart } from "@weather-app/core";

import { Bolt, Cloud, Drops, Flakes, FogLines, Hailstones, Moon, Sun } from "./parts";

type WeatherArtProps = {
  /** WMO code from Open-Meteo. */
  code: number;
  timeOfDay: TimeOfDay;
  className?: string;
  /** Accessible name. Omit for decorative use next to a text label. */
  title?: string;
};

/**
 * Gradient weather icon, in the spirit of idea/updated/major.png.
 *
 * Vector rather than a 3D raster pack (design.md §5): scales to any size,
 * weighs a couple of kB, follows the theme, and does not reintroduce the
 * "one asset per weather state" problem the illustrated landscapes were
 * rejected for.
 *
 * Which shapes make up a given code lives in @weather-app/core, not here.
 * apps/mobile draws the same set with react-native-svg primitives; the two
 * renderers are necessarily separate, but they must not be free to disagree
 * about whether code 82 shows a dark cloud.
 */
export function WeatherArt({ code, timeOfDay, className, title }: WeatherArtProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      filter="url(#wa-soft)"
    >
      {weatherScene(code, timeOfDay === "night").map((item, index) => (
        <Part key={index} item={item} />
      ))}
    </svg>
  );
}

function Part({ item }: { item: WeatherScenePart }) {
  switch (item.part) {
    case "sun":
      return <Sun cx={item.cx} cy={item.cy} r={item.r} />;
    case "moon":
      return <Moon cx={item.cx} cy={item.cy} r={item.r} />;
    case "cloud":
      return <Cloud variant={item.variant} x={item.x} y={item.y} scale={item.scale} />;
    case "drops":
      return <Drops count={item.count} heavy={item.heavy} />;
    case "flakes":
      return <Flakes count={item.count} />;
    case "fogLines":
      return <FogLines />;
    case "bolt":
      return <Bolt />;
    case "hailstones":
      return <Hailstones />;
  }
}
