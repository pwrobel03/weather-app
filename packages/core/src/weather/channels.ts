/**
 * The background encodes state; it does not decorate (markdown/design.md).
 *
 * Rather than authoring one gradient per weather situation - 4 seasons x 4
 * times of day x 5 phenomena is 80 combinations nobody can maintain - the
 * background is composed from independent channels. Each channel owns exactly
 * one visual dimension, and combinations fall out on their own.
 *
 * This module derives the channel values. Rendering them is the background
 * component's job; keeping the two apart is what makes the mapping testable
 * without a DOM.
 *
 * The season channel (hue tilt) is deliberately absent - it belongs to Faza 9.
 */

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export type Phenomenon =
  | "clear"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "hail"
  | "thunderstorm";

/** Pure bucketing, split out so callers with an hour already in hand (e.g. a
 * naive local timestamp string, see time.ts) don't have to round-trip
 * through a Date/Intl just to classify it. */
export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/**
 * Drives glow brightness and position.
 *
 * Hours are local to the location being displayed, not to the viewer: someone
 * in London looking at Warszawa should see Warszawa's night.
 */
export function timeOfDay(now: Date, timeZone = "Europe/Warsaw"): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    }).format(now),
  );

  return timeOfDayFromHour(hour);
}

/**
 * Maps a WMO weather code (as returned by Open-Meteo) to the phenomenon
 * channel, which drives overlay texture and contrast.
 *
 * Grouped rather than exhaustive: the background needs "is it raining", not
 * the difference between light and moderate freezing drizzle. The literal
 * weather is carried by the icon, not by the background.
 */
export function phenomenonFromWeatherCode(code: number): Phenomenon {
  if (code === 0) return "clear";
  if (code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  if (code === 96 || code === 99) return "hail";
  return "cloud";
}

/** Coldest and warmest temperatures the saturation ramp spans, in °C. */
const SATURATION_FLOOR_C = -20;
const SATURATION_CEILING_C = 35;
const SATURATION_MIN = 0.72;
const SATURATION_MAX = 1.14;

/**
 * Drives colour saturation: cold reads washed out, warm reads dense.
 *
 * Clamped at both ends so a freak reading cannot drain the background to grey
 * or oversaturate it into competing with the warning scale.
 */
export function temperatureSaturation(celsius: number): number {
  if (Number.isNaN(celsius)) return 1;

  const clamped = Math.min(Math.max(celsius, SATURATION_FLOOR_C), SATURATION_CEILING_C);
  const ratio = (clamped - SATURATION_FLOOR_C) / (SATURATION_CEILING_C - SATURATION_FLOOR_C);

  return Number((SATURATION_MIN + ratio * (SATURATION_MAX - SATURATION_MIN)).toFixed(3));
}

export type WeatherChannels = {
  timeOfDay: TimeOfDay;
  phenomenon: Phenomenon;
  saturation: number;
};

export function resolveWeatherChannels(input: {
  weatherCode: number;
  temperatureCelsius: number;
  now?: Date;
  timeZone?: string;
}): WeatherChannels {
  return {
    timeOfDay: timeOfDay(input.now ?? new Date(), input.timeZone),
    phenomenon: phenomenonFromWeatherCode(input.weatherCode),
    saturation: temperatureSaturation(input.temperatureCelsius),
  };
}
