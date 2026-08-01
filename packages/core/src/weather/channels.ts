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

/**
 * Note on `hail`: WMO codes only ever name hail *with* a thunderstorm (96 and
 * 99), so nothing maps to it from a code alone. This used to have a branch
 * that tried, placed after the 95-99 thunderstorm check and therefore
 * unreachable - dead code that read as a working feature. Hail now travels as
 * a property of the texture instead, which is also more truthful: a hailstorm
 * is a thunderstorm that happens to be throwing ice.
 */
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
export function timeOfDayFromHour(hour: number, solar?: SolarAnchorTimes): TimeOfDay {
  if (solar) {
    // Fully itself between real events: dawn is the twilight before the sun
    // clears the horizon, day is the sun being up, dusk the twilight after.
    // Narrower than the fixed windows below - dawn is forty minutes, not four
    // hours - which is what it always should have been. After sunrise it is
    // day, and the icon has no business still drawing a sunrise.
    const first = solar.dawn ?? solar.sunrise - 1;
    const last = solar.dusk ?? solar.sunset + 1;

    if (hour < first || hour >= last) return "night";
    if (hour < solar.sunrise) return "dawn";
    if (hour < solar.sunset) return "day";
    return "dusk";
  }

  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/**
 * Where the day currently sits between two time-of-day anchors.
 *
 * The discrete bucket above is still what a data attribute or a test wants,
 * but it is the wrong thing to paint from: it makes the sky jump at 17:00,
 * from the middle of afternoon to the middle of dusk in one frame, on a
 * background whose whole job is to be a state nobody has to read.
 *
 * Each bucket gets an anchor hour where it is fully itself, and every other
 * moment is a blend of the two it lies between.
 *
 * Those anchors were fixed hours until commit 128, with the cost written down
 * rather than hidden: across a Polish year real sunrise moves by about three
 * hours, so a 7am dawn anchor painted daylight over a dark December morning.
 * They now follow the sun where a location is known, and fall back to the old
 * hours where it is not - a preview page, a test, or the seam of a request
 * that has not resolved coordinates yet.
 */
export type TimeOfDayBlend = { from: TimeOfDay; to: TimeOfDay; t: number };

type Anchor = { timeOfDay: TimeOfDay; at: number };

/**
 * The fallback: hours at which each bucket used to be fully itself.
 *
 * Kept rather than deleted, because "we do not know where this is" is a real
 * state - the alert preview renders no location at all - and a sky is still
 * owed in it. Roughly an equinox day at Polish latitudes, which is the least
 * wrong constant available.
 */
const FIXED_ANCHORS: readonly Anchor[] = [
  { timeOfDay: "night", at: 1 },
  { timeOfDay: "dawn", at: 7 },
  { timeOfDay: "day", at: 13 },
  { timeOfDay: "dusk", at: 19 },
  { timeOfDay: "night", at: 25 },
];

/**
 * The same five anchors, placed by the sun instead of by the clock.
 *
 * Dawn sits at sunrise, day at solar noon, dusk at sunset, and night at solar
 * midnight either side. The shape is deliberately identical to the fixed
 * version - what changes is where the posts are, not how the blending between
 * them works, so this is not a second rendering path to keep in step.
 *
 * Twilight is not used as an anchor even though the module computes it. The
 * sky is fully "dawn" when the sun comes up, not when the first light does;
 * anchoring on civil twilight made the transition finish before the sunrise it
 * is meant to depict.
 */
function solarAnchors({ sunrise, solarNoon, sunset }: SolarAnchorTimes): Anchor[] {
  return [
    { timeOfDay: "night", at: solarNoon - 12 },
    { timeOfDay: "dawn", at: sunrise },
    { timeOfDay: "day", at: solarNoon },
    { timeOfDay: "dusk", at: sunset },
    { timeOfDay: "night", at: solarNoon + 12 },
  ];
}

/**
 * Where the sun actually is, for a place and a day.
 *
 * `dawn` and `dusk` are civil twilight and are optional: the blend does not
 * use them - the sky is fully "dawn" when the sun comes up, not when the first
 * light does - but the discrete bucket does, because night ends when you can
 * see, not when the disc clears the horizon.
 */
export type SolarAnchorTimes = {
  sunrise: number;
  solarNoon: number;
  sunset: number;
  dawn?: number;
  dusk?: number;
};

export function timeOfDayBlendFromHour(
  hourOfDay: number,
  solar?: SolarAnchorTimes,
): TimeOfDayBlend {
  const anchors = solar ? solarAnchors(solar) : FIXED_ANCHORS;

  // Everything before the first anchor belongs to the night segment that wraps
  // past midnight, so 00:30 is 24.5 rather than a case of its own.
  const hour = hourOfDay < anchors[0]!.at ? hourOfDay + 24 : hourOfDay;

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const from = anchors[index]!;
    const to = anchors[index + 1]!;
    if (hour >= from.at && hour < to.at) {
      return {
        from: from.timeOfDay,
        to: to.timeOfDay,
        t: (hour - from.at) / (to.at - from.at),
      };
    }
  }

  return { from: "night", to: "night", t: 0 };
}

export function timeOfDayBlend(
  now: Date,
  timeZone = "Europe/Warsaw",
  solar?: SolarAnchorTimes,
): TimeOfDayBlend {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return timeOfDayBlendFromHour(value("hour") + value("minute") / 60, solar);
}

/**
 * Drives glow brightness and position.
 *
 * Hours are local to the location being displayed, not to the viewer: someone
 * in London looking at Warszawa should see Warszawa's night.
 */
export function timeOfDay(
  now: Date,
  timeZone = "Europe/Warsaw",
  solar?: SolarAnchorTimes,
): TimeOfDay {
  // Minutes as well as hours. With solar anchors the boundaries fall at 04:14
  // and 21:01 rather than on the hour, and reading a whole hour would put the
  // bucket up to sixty minutes on the wrong side of one - visible as a sunrise
  // icon over a sky that has already gone to day.
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return timeOfDayFromHour(value("hour") + value("minute") / 60, solar);
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
 *
 * The ramp is eased rather than linear, and that is the whole point of the
 * calibration. Poland's record extremes are about -41 and +40, but a Polish
 * year lives between roughly -10 and +30; a linear ramp across the full range
 * spends half its resolution on temperatures that occur a few days a decade,
 * so ordinary days - which is every day a user actually opens the app - all
 * land within a few percent of each other and the channel says nothing.
 *
 * Smoothstep keeps the endpoints and the monotonicity exactly as they were and
 * moves the slope into the middle, where the readings are.
 */
export function temperatureSaturation(celsius: number): number {
  if (Number.isNaN(celsius)) return 1;

  const clamped = Math.min(Math.max(celsius, SATURATION_FLOOR_C), SATURATION_CEILING_C);
  const ratio = (clamped - SATURATION_FLOOR_C) / (SATURATION_CEILING_C - SATURATION_FLOOR_C);
  const eased = ratio * ratio * (3 - 2 * ratio);

  return Number((SATURATION_MIN + eased * (SATURATION_MAX - SATURATION_MIN)).toFixed(3));
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
