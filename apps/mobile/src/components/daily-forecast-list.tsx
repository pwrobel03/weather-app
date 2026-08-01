import {
  conditionFromWeatherCode,
  weatherMessages,
  weekdayName,
  type DailyForecastEntry,
  type Locale,
} from "@weather-app/core";
import { Text, View } from "react-native";

import { WeatherArt } from "./weather-art/weather-art";

type DailyForecastListProps = {
  entries: DailyForecastEntry[];
  locale?: Locale;
};

/**
 * Seven days as rows: weekday, icon plus condition, then high and low.
 *
 * The row layout is the one apps/web settled on, and today is the anchored
 * row - the same "one accent per list" rule the hourly strip follows.
 */
export function DailyForecastList({ entries, locale = "pl" }: DailyForecastListProps) {
  if (entries.length === 0) {
    return null;
  }

  const messages = weatherMessages[locale];

  return (
    <View className="gap-1.5">
      {entries.map((entry, index) => {
        const isToday = index === 0;
        const condition = conditionFromWeatherCode(entry.weatherCode);
        const maxTemp = Math.round(entry.temperatureMaxCelsius);
        const minTemp = Math.round(entry.temperatureMinCelsius);

        return (
          <View
            key={entry.date}
            className={`flex-row items-center gap-3 rounded-2xl px-3.5 py-3 ${
              isToday ? "bg-powierzchnia" : "bg-transparent"
            }`}
          >
            <Text
              className={`w-14 text-base font-semibold capitalize ${
                isToday ? "text-primary" : "text-tekst-muted"
              }`}
            >
              {weekdayName(entry.date, locale === "pl" ? "pl-PL" : "en-GB")}
            </Text>

            <View className="flex-1 flex-row items-center gap-3">
              <WeatherArt code={entry.weatherCode} timeOfDay="day" size={34} />
              <Text className="flex-1 text-base font-medium text-tekst" numberOfLines={1}>
                {messages.condition[condition]}
              </Text>
            </View>

            <View className="flex-row items-baseline gap-2.5">
              <Text className="text-base font-bold text-tekst">
                {maxTemp > 0 ? `+${maxTemp}` : maxTemp}°
              </Text>
              <Text className="text-base font-medium text-tekst-muted">
                {minTemp > 0 ? `+${minTemp}` : minTemp}°
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
