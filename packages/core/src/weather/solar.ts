/**
 * Where the sun is, for a place and a day.
 *
 * The time-of-day channel has anchored on fixed hours since phase 9, and the
 * comment there admitted what that costs: across a Polish year real sunrise
 * moves by about three hours, so in December the app paints daylight while it
 * is dark outside. This is the calculation that comment was waiting for.
 *
 * The algorithm is NOAA's, the one behind their published solar calculator.
 * It is a truncated series rather than a full ephemeris - good to well under a
 * minute for the latitudes this app serves, and wrong by more than that only
 * inside the polar circles, where it stops answering at all and says so.
 *
 * No dependency, by decision 18. The alternative was reading `sunrise` and
 * `sunset` off Open-Meteo's daily response, which is authoritative and free -
 * but the hero paints before that request returns, so the first frame of every
 * cold start would carry the wrong sky. This also works offline and for the
 * device's own position, which has no daily query of its own.
 */

/** Refraction plus the sun's own radius: the disc's edge, not its centre. */
const SUNRISE_ZENITH = 90.833;

/** Sun 6° below the horizon - the point where the brightest stars appear. */
const CIVIL_TWILIGHT_ZENITH = 96;

export type SolarTimes = {
  /**
   * Hours after local midnight, fractional - 4.23 is 04:14.
   *
   * Null above the polar circles, where the sun may not cross the horizon at
   * all. Poland never sees that, but the type does not know it is Polish, and
   * a caller handed NaN would paint a sky nobody could explain.
   */
  sunrise: number | null;
  sunset: number | null;
  /** The sun's highest point. Always defined - even a polar night has one. */
  solarNoon: number;
  /** First light and last light, for the dawn and dusk anchors. */
  dawn: number | null;
  dusk: number | null;
};

/**
 * Sunrise, sunset and the twilights, as local hours of day.
 *
 * The timezone defaults to Warsaw for the same reason `nowAsNaiveIsoTimestamp`
 * does: every place this app shows is in Poland, TERYT and all. It stays a
 * parameter rather than a constant so the assumption is visible at the call
 * site instead of buried three files down.
 */
export function solarTimes(
  date: Date,
  latitude: number,
  longitude: number,
  timeZone = "Europe/Warsaw",
): SolarTimes {
  const offset = utcOffsetHours(date, timeZone);
  const toLocal = (minutesUtc: number | null) =>
    minutesUtc === null ? null : wrapHours(minutesUtc / 60 + offset);

  const noon = solarNoonMinutesUtc(date, longitude);

  return {
    sunrise: toLocal(eventMinutesUtc(date, latitude, longitude, SUNRISE_ZENITH, "rise")),
    sunset: toLocal(eventMinutesUtc(date, latitude, longitude, SUNRISE_ZENITH, "set")),
    solarNoon: wrapHours(noon / 60 + offset),
    dawn: toLocal(eventMinutesUtc(date, latitude, longitude, CIVIL_TWILIGHT_ZENITH, "rise")),
    dusk: toLocal(eventMinutesUtc(date, latitude, longitude, CIVIL_TWILIGHT_ZENITH, "set")),
  };
}

/**
 * Minutes after UTC midnight at which the sun reaches `zenith`.
 *
 * Exported because it is what a test can pin without a timezone database in
 * the way: published tables give UTC, and a local-time assertion that fails
 * cannot say whether the sun or the offset was wrong.
 *
 * Null when the sun never reaches that angle on that day - a polar summer has
 * no sunrise, and returning a number for one would be an invention.
 */
export function eventMinutesUtc(
  date: Date,
  latitude: number,
  longitude: number,
  zenith: number,
  direction: "rise" | "set",
): number | null {
  const t = julianCentury(date);
  const declination = sunDeclination(t);

  const hourAngle = sunriseHourAngle(latitude, declination, zenith);
  if (hourAngle === null) return null;

  const noon = solarNoonMinutesUtc(date, longitude);
  return noon + (direction === "rise" ? -4 : 4) * hourAngle;
}

/** Minutes after UTC midnight at which the sun is due south. */
export function solarNoonMinutesUtc(date: Date, longitude: number): number {
  const t = julianCentury(date);
  return 720 - 4 * longitude - equationOfTime(t);
}

/**
 * How far the sun is from due south when it touches `zenith`, in degrees.
 *
 * Null when the cosine falls outside [-1, 1], which is the arithmetic saying
 * the sun never gets that low (polar day) or never that high (polar night) -
 * not an error, and specifically not a case to clamp. Clamping would put
 * sunrise at solar noon in Tromsø in June and look plausible while being
 * nonsense.
 */
function sunriseHourAngle(
  latitude: number,
  declination: number,
  zenith: number,
): number | null {
  const cosine =
    Math.cos(rad(zenith)) / (Math.cos(rad(latitude)) * Math.cos(rad(declination))) -
    Math.tan(rad(latitude)) * Math.tan(rad(declination));

  if (cosine > 1 || cosine < -1) return null;

  return deg(Math.acos(cosine));
}

/**
 * Centuries since J2000, taken at noon rather than at midnight.
 *
 * The series below drift slightly across a day, and noon is the middle of the
 * interval both events sit in - so one evaluation serves sunrise and sunset
 * with the error split between them instead of piled onto the later one.
 */
function julianCentury(date: Date): number {
  const julianDay = Math.floor(date.getTime() / 86_400_000) + 2_440_587.5 + 0.5;
  return (julianDay - 2_451_545) / 36_525;
}

function sunDeclination(t: number): number {
  return deg(
    Math.asin(Math.sin(rad(obliquityCorrection(t))) * Math.sin(rad(sunApparentLongitude(t)))),
  );
}

/**
 * How far a sundial runs ahead of a clock, in minutes.
 *
 * Swings by roughly half an hour over a year - the reason solar noon in one
 * place is not the same clock time in February and November, and the single
 * biggest correction in this file.
 */
function equationOfTime(t: number): number {
  const l0 = rad(geometricMeanLongitude(t));
  const m = rad(geometricMeanAnomaly(t));
  const e = orbitalEccentricity(t);
  const y = Math.tan(rad(obliquityCorrection(t) / 2)) ** 2;

  return (
    4 *
    deg(
      y * Math.sin(2 * l0) -
        2 * e * Math.sin(m) +
        4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
        0.5 * y * y * Math.sin(4 * l0) -
        1.25 * e * e * Math.sin(2 * m),
    )
  );
}

function geometricMeanLongitude(t: number): number {
  return mod360(280.46646 + t * (36_000.76983 + t * 0.0003032));
}

function geometricMeanAnomaly(t: number): number {
  return 357.52911 + t * (35_999.05029 - 0.0001537 * t);
}

function orbitalEccentricity(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunApparentLongitude(t: number): number {
  const m = rad(geometricMeanAnomaly(t));
  const centre =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289;

  const trueLongitude = geometricMeanLongitude(t) + centre;
  return trueLongitude - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
}

function obliquityCorrection(t: number): number {
  const mean = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  return mean + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
}

/**
 * The zone's offset from UTC in hours, on that date.
 *
 * Read from Intl rather than assumed, because Poland changes it twice a year
 * and the whole point of this module is the days at either end of that swing.
 */
function utcOffsetHours(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date);

  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) + Number(match[3]) / 60);
}

/** Keeps an hour inside [0, 24) - a UTC event can land either side of local midnight. */
function wrapHours(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

function mod360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function deg(radians: number): number {
  return (radians * 180) / Math.PI;
}
