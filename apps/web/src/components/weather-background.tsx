import { composeBackground } from "@weather-app/core";
import type { CSSProperties, ReactNode } from "react";

import type { WarningSeverityLevel } from "@/components/alert-takeover";

type WeatherBackgroundProps = {
  /** WMO code from Open-Meteo, via the backend forecast endpoint. */
  weatherCode: number;
  temperatureCelsius: number;
  /** IANA zone of the displayed location, not of the viewer. */
  timeZone?: string;
  /** Injectable clock, so the render is deterministic in tests and stories. */
  now?: Date;
  /**
   * IMGW severity of the warning in force, if any. Present means the warning
   * takes over the screen and the weather background recedes behind it.
   */
  alertSeverity?: WarningSeverityLevel | null;
  children?: ReactNode;
};

/**
 * Data-driven background gradient, composed from independent channels
 * (markdown/design.md).
 *
 * A Server Component on purpose: the whole thing is CSS driven by custom
 * properties, so it ships zero JavaScript. Nothing here reacts to user input -
 * the background reacts to the weather.
 *
 * The values are computed by `composeBackground` and handed to CSS inline,
 * rather than selected by a stylesheet keyed on data attributes. Removing that
 * indirection is what commit 90 is for: with one block per time of day and one
 * per phenomenon, adding the season channel would have multiplied the
 * stylesheet by four, and apps/mobile - which paints into a canvas and cannot
 * read CSS at all - could not have shared a line of it.
 *
 * The palette stays in cool neutrals throughout. The IMGW warning scale
 * (yellow / orange / red) is reserved for warnings and must not appear as
 * decoration, which is also why dusk leans violet rather than the literal
 * orange of a sunset - that would collide with severity levels 2 and 3.
 */
export function WeatherBackground({
  weatherCode,
  temperatureCelsius,
  timeZone,
  now,
  alertSeverity,
  children,
}: WeatherBackgroundProps) {
  const composition = composeBackground({ weatherCode, temperatureCelsius, timeZone, now });

  return (
    <div
      className="weather-background"
      // Kept as attributes although nothing selects on them any more: they are
      // how a screenshot or a bug report says which channels were active, and
      // that is worth more than the two lines they cost.
      data-time-of-day={composition.channels.timeOfDay}
      data-phenomenon={composition.channels.phenomenon}
      data-alert-severity={alertSeverity ?? undefined}
      style={
        {
          "--sky-a": composition.sky.from,
          "--sky-b": composition.sky.to,
          "--glow-a": composition.glow.color,
          "--glow-b": composition.glow.secondary,
          "--glow-y": composition.glow.y,
          "--veil-opacity": composition.veil.opacity,
          "--veil-contrast": composition.veil.contrast,
        } as CSSProperties
      }
    >
      <div className="weather-background__glow" aria-hidden="true" />
      <div className="weather-background__phenomenon" aria-hidden="true" />
      {alertSeverity && <div className="weather-background__alert" aria-hidden="true" />}
      <div className="weather-background__content">{children}</div>
    </div>
  );
}
