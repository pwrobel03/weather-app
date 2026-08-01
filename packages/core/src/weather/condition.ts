/**
 * Coarse condition key for the phrase shown under the temperature
 * ("Thunderstorm" in major.png).
 *
 * A third granularity, deliberately: the background channel buckets into eight
 * groups, the icon distinguishes ~20 WMO codes, and this sits between them.
 * "Light rain" and "moderate rain" want the same word but different icons.
 */
export type ConditionKey =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavyRain"
  | "showers"
  | "snow"
  | "heavySnow"
  | "thunderstorm"
  | "thunderstormHail";

export function conditionFromWeatherCode(code: number): ConditionKey {
  if (code === 0) return "clear";
  if (code === 1) return "mainlyClear";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 61 || code === 63) return "rain";
  if (code === 65 || code === 66 || code === 67) return "heavyRain";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 75 || code === 86) return "heavySnow";
  if ((code >= 71 && code <= 77) || code === 85) return "snow";
  if (code === 96 || code === 99) return "thunderstormHail";
  if (code === 95) return "thunderstorm";
  return "overcast";
}
