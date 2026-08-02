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

/**
 * Ceilings. The number's came down from 96 once the icon moved beneath it: the
 * two now read as one stack rather than as competing headlines, and the figure
 * no longer needs to be the loudest thing on the screen to hold its place.
 */
const MAX_ART = 168;
const MAX_NUMBER = 84;

/** How the remaining room divides between the icon and the number. */
const ART_SHARE = 0.6;
const NUMBER_SHARE = 0.4;

/** design.md §9: leading 0.92 for the temperature figure. */
const NUMBER_LINE_RATIO = 0.92;

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
  const degreeWidth = Math.round(numberSize * 0.26);

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
        {/* The number sits dead centre because the degree is balanced by an
            empty box of the same width on the left. The obvious version -
            absolutely positioning the degree past the number's right edge -
            works on iOS and vanishes on Android, where a View clips children to
            its bounds by default. Same family of trap as the font padding. */}
        <View className="mt-2 flex-row items-start">
          <View style={{ width: degreeWidth }} />

          <Text
            className="text-white"
            style={{
              fontSize: numberSize,
              // design.md §9: weight 200, leading 0.92, tracking -0.045em.
              // Mobile had been rendering this bold at 1.04 - heavier and
              // taller than the design asks - which is why the hero read as
              // chunky rather than as the thin figure apps/web shows.
              fontWeight: "200",
              lineHeight: Math.round(numberSize * NUMBER_LINE_RATIO),
              letterSpacing: -numberSize * 0.045,
              includeFontPadding: false,
              // Digits of equal width, or the number jogs sideways every time
              // it ticks over.
              fontVariant: ["tabular-nums"],
            }}
          >
            {temperature}
          </Text>

          <Text
            className="font-light text-white/90"
            style={{
              width: degreeWidth,
              marginTop: numberSize * 0.06,
              fontSize: numberSize * 0.32,
              includeFontPadding: false,
            }}
          >
            °
          </Text>
        </View>

        {/* The icon sits with the words it illustrates, not three elements
            away from them. It used to lead the block while its own caption -
            "Bezchmurnie" - sat under the temperature, which split one statement
            about the sky across two halves of the screen.
            Deliberately not enlarged in the move. The two elements do not
            benefit from size equally: conditions are a category anybody reads
            from a thumbnail, while a temperature is a value that has to be read
            as digits. And the background already carries the weather across all
            four channels (design.md §2), so the icon repeats what the sky says
            while the number is the only thing saying its own piece. */}
        <WeatherArt
          code={conditions.weatherCode}
          timeOfDay={timeOfDayFromHour(localHour)}
          size={artSize}
        />

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
