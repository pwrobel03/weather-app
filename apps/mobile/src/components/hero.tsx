import {
  conditionFromWeatherCode,
  formatHeroDate,
  timeOfDayFromHour,
  weatherMessages,
  type CurrentConditions,
  type Locale,
} from "@weather-app/core";
import { useState } from "react";
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
 * The hero.
 *
 * Reordered 2026-08-02, and the order is the design: place, then when, then a
 * large icon, then the sky in words, then how warm it is. The temperature
 * deliberately does not lead - it is set at the same size as the place name,
 * which makes the icon the thing the screen is about.
 *
 * That is a reversal of what came before, where a 96pt figure dominated and the
 * icon illustrated it. Recorded in design.md §6 rather than left as drift.
 */

/**
 * Vertical room the block spends on what does not scale: its paddings, the two
 * gaps, the condition line and the temperature.
 */
const FIXED_CONTENT = 104;

/**
 * Room reserved either side of the temperature so the degree has somewhere to
 * sit without shifting the figure off the axis. Wide enough for the glyph at
 * 24pt; the exactness comes from it being applied to both sides, not from the
 * value being right.
 */
const DEGREE_SLOT = 9;

/** The icon is the only flexible element now, so it gets its own floor and ceiling. */
const MIN_ART = 120;
const MAX_ART = 210;

export function Hero({ conditions, locale, localHour, header, now }: HeroProps) {
  const messages = weatherMessages[locale];
  const reduceTransparency = useReduceTransparency();
  const condition = conditionFromWeatherCode(conditions.weatherCode);
  const temperature = Math.round(conditions.temperatureCelsius);

  // Measured rather than assumed. The hero is 62% of the viewport, so what it
  // holds has to be a proportion of *it* - fixed sizes tuned against one phone
  // overflowed a centred flex child on a shorter one, and an overflowing
  // centred child spills at both ends at once.
  const [boxHeight, setBoxHeight] = useState(0);
  const artSize = Math.min(MAX_ART, Math.max(MIN_ART, boxHeight - FIXED_CONTENT));

  return (
    <View className="flex-1 justify-between">
      {/* Place and date as one group. The date used to sit at the bottom of the
          block, three elements away from the name it qualifies; together they
          answer one question - where and when - before the screen says anything
          about weather. */}
      <View className="items-center">
        {header}
        <Text
          className="mt-1 text-sm font-medium text-white/75"
          style={{ includeFontPadding: false }}
        >
          {formatHeroDate(now ?? new Date(), locale)}
        </Text>
      </View>

      <View
        className="flex-1 items-center justify-center px-6 pb-8 pt-4"
        onLayout={(event) => setBoxHeight(event.nativeEvent.layout.height)}
      >
        <WeatherArt
          code={conditions.weatherCode}
          timeOfDay={timeOfDayFromHour(localHour)}
          size={artSize}
        />

        {/* The number is exactly centred, and the degree hangs in the padding.
            Symmetric horizontal padding is what makes it exact rather than
            close: the box is degree + number + degree wide, so its centre is
            the number's centre, whatever the glyph happens to measure.
            The degree is absolute so it adds no width - but positioned inside
            the right padding rather than past the box's edge, because Android
            clips children to their parent's bounds and an overhanging degree
            simply disappears there while rendering fine on iOS. */}
        <View className="mt-1" style={{ paddingHorizontal: DEGREE_SLOT }}>
          <Text
            className="text-4xl font-bold text-white"
            style={{ includeFontPadding: false, fontVariant: ["tabular-nums"] }}
          >
            {temperature}
          </Text>

          <Text
            className="text-4xl font-semibold text-white"
            style={{ position: "absolute", right: -5, top: -5, includeFontPadding: false }}
          >
            °
          </Text>
        </View>
        {/* The sky in words, directly under the icon that draws it. Not
            decoration: design.md §3 requires severity and state to be readable
            without colour, and this is the line that carries the weather for
            anyone who cannot separate the icon's hues or is reading a phone in
            sunlight. */}
        <Text
          className="mt-3 text-2xl font-bold text-white/75"
          style={{ includeFontPadding: false }}
        >
          {messages.condition[condition]}
        </Text>
      </View>

      {/* The metrics strip is a translucent shelf over the gradient. Under
          reduced transparency it becomes an opaque one - not a less
          translucent one, which would answer a question nobody asked. */}
      <View
        className={`w-full flex-row border-t border-white/20 px-4 py-4 ${reduceTransparency ? "bg-[#0B0E14]" : "bg-black/35"
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
