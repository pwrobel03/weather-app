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
    <div className="relative flex flex-1 flex-col justify-between gap-8 px-6 pt-20 pb-8 md:px-10 md:pt-22 md:pb-10 lg:pt-24 w-full h-full">
      {actions}

      {/* Main Hero Showcase: editorial layout with temperature left, floating art right */}
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left z-10">
          {/* Live Status Chip */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse-subtle shadow-[0_0_8px_rgba(52,211,153,0.8)]" aria-hidden="true" />
            <span>{messages.condition[condition]}</span>
          </div>

          <div className="relative flex items-baseline">
            <p
              className="tabular-nums text-white font-light tracking-tighter drop-shadow-md select-none"
              style={{
                fontSize: "clamp(4.25rem, 14vw, 7.5rem)",
                letterSpacing: "var(--dt-type-temp-tracking, -0.04em)",
                lineHeight: "var(--dt-type-temp-leading, 0.9)",
                fontWeight: "var(--dt-type-temp-weight, 200)",
              }}
            >
              {Math.round(conditions.temperatureCelsius)}
            </p>
            <span className="text-4xl sm:text-5xl md:text-6xl font-extralight text-white/90 -mt-4 ml-1 select-none">°</span>
          </div>

          <p className="mt-2 text-sm font-medium tracking-wide text-white/80 md:text-base">
            {formatHeroDate(new Date(), locale)}
          </p>
        </div>

        {/* Floating atmospheric icon with deep responsive shadow */}
        <div className="relative flex items-center justify-center sm:pr-4 transition-transform duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/hero:scale-105">
          <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl transform scale-75 pointer-events-none" />
          <WeatherArt
            code={conditions.weatherCode}
            timeOfDay={timeOfDayFromHour(localHour)}
            className="relative size-28 sm:size-36 md:size-44 drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)] transition-transform duration-[500ms] hover:rotate-2 hover:scale-108"
          />
        </div>
      </div>

      {/* Glass Telemetry Strip - immersive full-span translucent instrumentation */}
      <div className="mx-auto w-full max-w-5xl mt-auto">
        <dl className="glass grid grid-cols-3 divide-x divide-white/15 rounded-2xl p-4 sm:p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-[transform,box-shadow,background-color] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-black/40 hover:shadow-2xl">
          <Metric
            icon={<Wind aria-hidden="true" className="size-4 text-sky-300" />}
            label={messages.wind}
            value={`${Math.round(conditions.windSpeedKmh)} km/h`}
          />
          <Metric
            icon={<Droplets aria-hidden="true" className="size-4 text-blue-300" />}
            label={messages.humidity}
            value={`${conditions.relativeHumidityPercent}%`}
          />
          <Metric
            icon={<Umbrella aria-hidden="true" className="size-4 text-purple-300" />}
            label={messages.precipitation}
            value={`${conditions.precipitationMm.toFixed(1)} mm`}
          />
        </dl>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2 text-center text-white sm:px-4">
      <span className="flex items-center gap-1.5 opacity-90 transition-transform duration-[200ms] hover:scale-110">{icon}</span>
      <dd className="font-mono text-sm sm:text-base md:text-lg font-semibold tracking-tight tabular-nums drop-shadow-sm">{value}</dd>
      <dt
        className="text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wider text-white/70"
        style={{ letterSpacing: "var(--dt-type-label-tracking, 0.08em)" }}
      >
        {label}
      </dt>
    </div>
  );
}
