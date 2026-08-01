import {
  conditionFromWeatherCode,
  formatHeroDate,
  timeOfDayFromHour,
  weatherMessages,
  type CurrentConditions,
  type Locale,
} from "@weather-app/core";
import { Text, View } from "react-native";

import { useReduceTransparency } from "../lib/reduce-transparency";
import { WeatherArt } from "./weather-art/weather-art";

type HeroProps = {
  conditions: CurrentConditions;
  locale: Locale;
  /** Hour at the displayed location, so night is the location's night. */
  localHour: number;
  /** Rendered above the temperature - the location name and its actions. */
  header?: React.ReactNode;
  /** Injectable clock, so the date under the temperature is deterministic. */
  now?: Date;
};

/**
 * The hero, in the layout of idea/updated/major.png and matching apps/web:
 * icon, then a very large temperature, then the condition, then the date,
 * with a strip of metrics beneath.
 *
 * Type follows design.md §9 - the number carries negative tracking and tight
 * leading, because letterforms read too far apart as they grow. Web gets that
 * from Tailwind classes; here the two values that Tailwind cannot express on
 * React Native (letterSpacing in ems, a sub-1 lineHeight) are set inline.
 */
export function Hero({ conditions, locale, localHour, header, now }: HeroProps) {
  const messages = weatherMessages[locale];
  const reduceTransparency = useReduceTransparency();
  const condition = conditionFromWeatherCode(conditions.weatherCode);
  const temperature = Math.round(conditions.temperatureCelsius);

  return (
    <View className="flex-1 justify-between">
      {header}

      <View className="flex-1 items-center justify-center px-6 pb-8 pt-4">
        <WeatherArt code={conditions.weatherCode} timeOfDay={timeOfDayFromHour(localHour)} size={168} />

        <View className="mt-2 flex-row items-start">
          <Text
            className="font-bold text-white"
            style={{ fontSize: 96, lineHeight: 100, letterSpacing: -4 }}
          >
            {temperature}
          </Text>
          <Text className="mt-3 text-5xl font-light text-white/90">°</Text>
        </View>

        <Text className="mt-1 text-2xl font-bold text-white">{messages.condition[condition]}</Text>
        <Text className="mt-1 text-sm font-medium text-white/75">
          {formatHeroDate(now ?? new Date(), locale)}
        </Text>
      </View>

      {/* The metrics strip is a translucent shelf over the gradient. Under
          reduced transparency it becomes an opaque one - not a less
          translucent one, which would answer a question nobody asked. */}
      <View
        className={`w-full flex-row border-t border-white/20 px-4 py-4 ${
          reduceTransparency ? "bg-[#0B0E14]" : "bg-black/35"
        }`}
      >
        <Metric label={messages.wind} value={`${Math.round(conditions.windSpeedKmh)} km/h`} />
        <Metric label={messages.humidity} value={`${conditions.relativeHumidityPercent}%`} />
        <Metric label={messages.precipitation} value={`${conditions.precipitationMm.toFixed(1)} mm`} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1">
      <Text className="text-base font-bold text-white">{value}</Text>
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {label}
      </Text>
    </View>
  );
}
