export type Season = "winter" | "spring" | "summer" | "autumn";

export type SeasonBlend = { from: Season; to: Season; t: number };

/**
 * The season channel: a hue tilt on the sky, nothing else.
 *
 * `design.md` asks for four seasons as one of the four axes. They are anchored
 * at the middle of each meteorological season and blended between, for the same
 * reason the time-of-day channel is: a step change on 1 March would be a
 * visible cut, and nobody experiences the seasons as a switch.
 *
 * The tilts are small on purpose - eight degrees at the extreme. Two reasons,
 * and the second is a hard constraint rather than taste:
 *
 * A sky is recognisably a sky across the whole year; a season that repainted it
 * would stop being a channel and start being a theme. And more importantly,
 * IMGW's warning scale owns yellow, orange and red (design.md §3), so an autumn
 * that leaned into warm hues the way an autumn photograph does would put the
 * background in the same colour family as a level 2 warning. The winter tilt is
 * towards blue and the summer tilt stays inside the blues - the composition
 * tests assert that every combination stays clear of the warning band.
 */
export const SEASON_TILT: Record<Season, { hueShift: number; chromaScale: number }> = {
  // Colder and paler: low sun, thin light.
  winter: { hueShift: -8, chromaScale: 0.88 },
  spring: { hueShift: -2, chromaScale: 1.02 },
  // The most saturated the sky gets, still without leaving the blues.
  summer: { hueShift: 4, chromaScale: 1.08 },
  autumn: { hueShift: 2, chromaScale: 0.94 },
};

/** Day of year at which each season is fully itself; wraps through winter. */
const ANCHORS: readonly { season: Season; at: number }[] = [
  { season: "winter", at: 15 },
  { season: "spring", at: 105 },
  { season: "summer", at: 196 },
  { season: "autumn", at: 288 },
  { season: "winter", at: 380 },
];

export function seasonBlendFromDayOfYear(dayOfYear: number): SeasonBlend {
  // Days before the first anchor belong to the autumn-to-winter segment that
  // wrapped past New Year, so 3 January is 368 rather than a case of its own.
  const day = dayOfYear < ANCHORS[0]!.at ? dayOfYear + 365 : dayOfYear;

  for (let index = 0; index < ANCHORS.length - 1; index += 1) {
    const from = ANCHORS[index]!;
    const to = ANCHORS[index + 1]!;
    if (day >= from.at && day < to.at) {
      return { from: from.season, to: to.season, t: (day - from.at) / (to.at - from.at) };
    }
  }

  return { from: "winter", to: "winter", t: 0 };
}

export function seasonBlend(now: Date, timeZone = "Europe/Warsaw"): SeasonBlend {
  return seasonBlendFromDayOfYear(dayOfYear(now, timeZone));
}

/** The discrete season, for a data attribute or a test. */
export function season(now: Date, timeZone = "Europe/Warsaw"): Season {
  const blend = seasonBlendFromDayOfYear(dayOfYear(now, timeZone));
  return blend.t < 0.5 ? blend.from : blend.to;
}

/**
 * Day of year in the location's own zone.
 *
 * Read through Intl rather than from the Date's own getters, which would answer
 * for whatever machine happens to be running - the same reason every other
 * channel here takes a timeZone.
 */
function dayOfYear(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const start = Date.UTC(value("year"), 0, 1);
  const today = Date.UTC(value("year"), value("month") - 1, value("day"));

  return Math.floor((today - start) / 86_400_000) + 1;
}
