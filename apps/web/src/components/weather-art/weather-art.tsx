import type { TimeOfDay } from "@/lib/weather/channels";

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
 * Deliberately more literal than the background's phenomenon channel, which
 * buckets into eight coarse groups. design.md assigns literalness to the icon:
 * light rain and violent showers get different icons even though the gradient
 * treats both as simply "rain".
 */
export function WeatherArt({ code, timeOfDay, className, title }: WeatherArtProps) {
  const isNight = timeOfDay === "night";

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      filter="url(#wa-soft)"
    >
      {renderScene(code, isNight)}
    </svg>
  );
}

function renderScene(code: number, isNight: boolean) {
  // Clear
  if (code === 0) {
    return isNight ? <Moon /> : <Sun />;
  }

  // Mainly clear / partly cloudy - luminary peeking from behind the cloud.
  if (code === 1 || code === 2) {
    return (
      <>
        {isNight ? <Moon cx={41} cy={20} r={9} /> : <Sun cx={42} cy={20} r={8.5} />}
        <Cloud x={-4} y={4} scale={0.92} />
      </>
    );
  }

  // Overcast
  if (code === 3) {
    return <Cloud y={2} />;
  }

  // Fog
  if (code === 45 || code === 48) {
    return (
      <>
        <Cloud y={-4} scale={0.9} variant="light" />
        <FogLines />
      </>
    );
  }

  // Drizzle, including freezing drizzle
  if (code >= 51 && code <= 57) {
    return (
      <>
        <Cloud y={-4} />
        <Drops count={4} />
      </>
    );
  }

  // Rain: slight / moderate, and slight / moderate showers
  if (code === 61 || code === 63 || code === 80 || code === 81) {
    return (
      <>
        <Cloud y={-4} variant="dark" />
        <Drops count={3} />
      </>
    );
  }

  // Rain: heavy, freezing rain, violent showers
  if (code === 65 || code === 66 || code === 67 || code === 82) {
    return (
      <>
        <Cloud y={-4} variant="dark" />
        <Drops count={5} heavy />
      </>
    );
  }

  // Snow, including grains and showers
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <>
        <Cloud y={-4} />
        <Flakes count={code === 75 || code === 86 ? 5 : 3} />
      </>
    );
  }

  // Thunderstorm
  if (code === 95) {
    return (
      <>
        <Cloud y={-6} variant="dark" />
        <Bolt />
      </>
    );
  }

  // Thunderstorm with hail
  if (code === 96 || code === 99) {
    return (
      <>
        <Cloud y={-6} variant="dark" />
        <Bolt />
        <Hailstones />
      </>
    );
  }

  return <Cloud y={2} />;
}
