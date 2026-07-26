import type { CSSProperties, ReactNode } from "react";

import { resolveWeatherChannels } from "@/lib/weather/channels";

type WeatherBackgroundProps = {
  /** WMO code from Open-Meteo, via the backend forecast endpoint. */
  weatherCode: number;
  temperatureCelsius: number;
  /** IANA zone of the displayed location, not of the viewer. */
  timeZone?: string;
  /** Injectable clock, so the render is deterministic in tests and stories. */
  now?: Date;
  children?: ReactNode;
};

/**
 * Data-driven background gradient, composed from independent channels
 * (markdown/design.md).
 *
 * A Server Component on purpose: the whole thing is CSS driven by data
 * attributes and one custom property, so it ships zero JavaScript. Nothing
 * here reacts to user input - the background reacts to the weather.
 *
 * Note the palette stays in cool neutrals throughout. The IMGW warning scale
 * (yellow / orange / red) is reserved for warnings and must not appear as
 * decoration, which is also why dusk leans violet rather than the literal
 * orange of a sunset - that would collide with severity levels 2 and 3.
 */
export function WeatherBackground({
  weatherCode,
  temperatureCelsius,
  timeZone,
  now,
  children,
}: WeatherBackgroundProps) {
  const channels = resolveWeatherChannels({ weatherCode, temperatureCelsius, now, timeZone });

  return (
    <div
      className="weather-background"
      data-time-of-day={channels.timeOfDay}
      data-phenomenon={channels.phenomenon}
      style={{ "--bg-saturation": channels.saturation } as CSSProperties}
    >
      <div className="weather-background__glow" aria-hidden="true" />
      <div className="weather-background__phenomenon" aria-hidden="true" />
      <div className="weather-background__content">{children}</div>
    </div>
  );
}
