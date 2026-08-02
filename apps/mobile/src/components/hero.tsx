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
 * The hero, in the layout of idea/updated/major.png and matching apps/web:
 * icon, then a very large temperature, then the condition, then the date,
 * with a strip of metrics beneath.
 *
 * Type follows design.md §9 - the number carries negative tracking and tight
 * leading, because letterforms read too far apart as they grow. Web gets that
 * from Tailwind classes; here the two values that Tailwind cannot express on
 * React Native (letterSpacing in ems, a sub-1 lineHeight) are set inline.
 */
/**
 * Vertical room the block spends on things that do not scale: the two paddings,
 * three gaps, the condition line and the date.
 */
const FIXED_CONTENT = 116;

/** Below this the phone is too short for a hero at all, and cropping beats collapsing. */
const MIN_FREE = 140;

/** Ceilings, so a tall screen looks exactly as it did before this became responsive. */
const MAX_ART = 168;
const MAX_NUMBER = 96;

/** How the remaining room divides between the icon and the number. */
const ART_SHARE = 0.6;
const NUMBER_SHARE = 0.4;

/** The number's line box relative to its font size - 100/96, as it was fixed. */
const NUMBER_LINE_RATIO = 1.04;

export function Hero({ conditions, locale, localHour, header, now }: HeroProps) {
  const messages = weatherMessages[locale];
  const reduceTransparency = useReduceTransparency();
  const condition = conditionFromWeatherCode(conditions.weatherCode);
  const temperature = Math.round(conditions.temperatureCelsius);

  // Everything in the block that is not the icon or the number: the paddings,
  // the three gaps, the condition line and the date. Subtracted first so the
  // two flexible pieces divide what is actually left rather than what a
  // designer's phone happened to have.
  const [boxHeight, setBoxHeight] = useState(0);
  const free = Math.max(boxHeight - FIXED_CONTENT, MIN_FREE);
  const artSize = Math.min(MAX_ART, Math.round(free * ART_SHARE));
  const numberSize = Math.min(MAX_NUMBER, Math.round((free * NUMBER_SHARE) / NUMBER_LINE_RATIO));

  return (
    <View className="flex-1 justify-between">
      {header}

      <View
        className="flex-1 items-center justify-center px-6 pb-8 pt-4"
        // Measured rather than assumed. The hero is 62% of the viewport, so its
        // contents have to be a proportion of *it* - a fixed 168pt icon and a
        // fixed 96pt number were tuned against one phone, and on a shorter one
        // they overflowed a centred flex child, which spills at both ends: the
        // place name ended up over the icon and the date under the metrics
        // shelf. This device has 471dp of hero for about 530dp of content.
        onLayout={(event) => setBoxHeight(event.nativeEvent.layout.height)}
      >
        <WeatherArt
          code={conditions.weatherCode}
          timeOfDay={timeOfDayFromHour(localHour)}
          size={artSize}
        />

        <View className="mt-2 flex-row items-start">
          <Text
            className="font-bold text-white"
            // includeFontPadding is Android-only and defaults to true: the
            // platform reserves vertical room for the tallest glyph any script
            // might need, which at 96pt is tens of pixels of nothing. iOS has
            // no equivalent, so the same hero was measurably taller here - and
            // a flex child that overflows a centred box spills at both ends,
            // which is how the place name ended up over the icon and the date
            // under the metrics shelf.
            style={{
              fontSize: numberSize,
              lineHeight: Math.round(numberSize * NUMBER_LINE_RATIO),
              letterSpacing: -numberSize / 24,
              includeFontPadding: false,
            }}
          >
            {temperature}
          </Text>
          <Text
            className="mt-3 text-5xl font-light text-white/90"
            style={{ includeFontPadding: false }}
          >
            °
          </Text>
        </View>

        <Text
          className="mt-1 text-2xl font-bold text-white"
          style={{ includeFontPadding: false }}
        >
          {messages.condition[condition]}
        </Text>
        <Text
          className="mt-1 text-sm font-medium text-white/75"
          style={{ includeFontPadding: false }}
        >
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
