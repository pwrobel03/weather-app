import {
  formatHourMinute,
  hourOf,
  nowAsNaiveIsoTimestamp,
  timeOfDayFromHour,
  type HourlyForecastEntry,
} from "@weather-app/core";
import { ScrollView, Text, View } from "react-native";

import { WeatherArt } from "./weather-art/weather-art";

const HOURS_TO_SHOW = 24;

type HourlyForecastStripProps = {
  entries: HourlyForecastEntry[];
  /** Injectable clock, so "which hour is next" is deterministic in tests. */
  now?: Date;
};

/**
 * The next 24 hours, horizontally - apps/web's strip on React Native.
 *
 * The nearest hour is the one accented chip in the row, matching web and the
 * active chip in idea/updated/d.png. One accent per row is the rule: a second
 * highlighted chip would leave the eye with nothing to land on.
 *
 * Entries are filtered against a naive local timestamp rather than a Date.
 * The backend queries Open-Meteo with timezone=auto, so "2026-07-27T14:00:00"
 * means 14:00 where the forecast is for, with no offset attached - parsing it
 * as a Date would silently reinterpret it in the phone's own timezone.
 */
export function HourlyForecastStrip({ entries, now = new Date() }: HourlyForecastStripProps) {
  const nowLocal = nowAsNaiveIsoTimestamp(now);
  const upcoming = entries.filter((entry) => entry.time >= nowLocal).slice(0, HOURS_TO_SHOW);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 4 }}
    >
      {upcoming.map((entry, index) => {
        const isCurrent = index === 0;
        return (
          <View
            key={entry.time}
            className={`w-[84px] items-center justify-between gap-2 rounded-[28px] border py-4 ${
              isCurrent
                ? "border-white/35 bg-primary"
                : "border-white/5 bg-powierzchnia"
            }`}
          >
            <View className="items-center">
              <Text className="text-xl font-bold text-tekst">
                {Math.round(entry.temperatureCelsius)}°
              </Text>
              {entry.precipitationProbabilityPercent > 10 && !isCurrent && (
                <Text className="mt-1 text-[11px] font-semibold text-primary">
                  {entry.precipitationProbabilityPercent}%
                </Text>
              )}
            </View>

            <WeatherArt
              code={entry.weatherCode}
              timeOfDay={timeOfDayFromHour(hourOf(entry.time))}
              size={44}
            />

            <Text
              className={`text-xs ${isCurrent ? "font-bold text-white" : "font-medium text-tekst-muted"}`}
            >
              {formatHourMinute(entry.time)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
