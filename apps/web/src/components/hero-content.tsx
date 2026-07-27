import { Droplets, Umbrella, Wind } from "lucide-react";
import type { ReactNode } from "react";

import { WeatherArt } from "@/components/weather-art/weather-art";
import { formatHeroDate, weatherMessages, type Locale } from "@/lib/i18n/messages";
import { timeOfDayFromHour } from "@/lib/weather/channels";
import { conditionFromWeatherCode } from "@/lib/weather/condition";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

type HeroContentProps = {
  conditions: CurrentConditions;
  locale: Locale;
  /** Hour at the displayed location, so night is the location's night. */
  localHour: number;
  /** Rendered top-right inside the hero (refresh, theme toggle, ...). */
  actions?: ReactNode;
};

/**
 * The hero, in the layout of idea/updated/major.png: icon, then a very large
 * temperature, then the condition, then the date, with a glass strip of
 * metrics beneath.
 *
 * Type follows design.md §9 - the number carries negative tracking and tight
 * leading because letterforms read too far apart as they grow, and every
 * numeric value is tabular so figures do not jump on refresh.
 */
export function HeroContent({ conditions, locale, localHour, actions }: HeroContentProps) {
  const messages = weatherMessages[locale];
  const condition = conditionFromWeatherCode(conditions.weatherCode);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10">
      {actions}

      <WeatherArt
        code={conditions.weatherCode}
        timeOfDay={timeOfDayFromHour(localHour)}
        className="size-28 drop-shadow-2xl md:size-32"
      />

      <p
        className="mt-2 tabular-nums text-white"
        style={{
          fontSize: "clamp(4rem, 12vw, 7rem)",
          letterSpacing: "var(--dt-type-temp-tracking)",
          lineHeight: "var(--dt-type-temp-leading)",
          fontWeight: "var(--dt-type-temp-weight)",
        }}
      >
        {Math.round(conditions.temperatureCelsius)}
        <sup className="align-super text-[0.32em] font-light tracking-normal">°</sup>
      </p>

      <p className="text-xl font-medium text-white/95">{messages.condition[condition]}</p>
      <p className="text-sm text-white/70">{formatHeroDate(new Date(), locale)}</p>

      {/* Glass strip inside the gradient - the one place in the hero where a
          translucent surface sits directly on the sky (design.md §4). */}
      <dl className="glass mt-6 grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl px-4 py-3">
        <Metric
          icon={<Wind aria-hidden="true" className="size-4" />}
          label={messages.wind}
          value={`${Math.round(conditions.windSpeedKmh)} km/h`}
        />
        <Metric
          icon={<Droplets aria-hidden="true" className="size-4" />}
          label={messages.humidity}
          value={`${conditions.relativeHumidityPercent}%`}
        />
        <Metric
          icon={<Umbrella aria-hidden="true" className="size-4" />}
          label={messages.precipitation}
          value={`${conditions.precipitationMm.toFixed(1)} mm`}
        />
      </dl>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-white">
      <span className="text-white/80">{icon}</span>
      <dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd>
      <dt
        className="text-[0.625rem] text-white/70"
        style={{ letterSpacing: "var(--dt-type-label-tracking)" }}
      >
        {label}
      </dt>
    </div>
  );
}
