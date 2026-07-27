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
    <div className="relative flex w-full flex-1 flex-col justify-between overflow-hidden h-full">
      {/* Top right actions vector (refresh, location, settings) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {actions}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col items-center sm:items-start justify-center px-6 pt-20 pb-10 md:px-12 md:pt-24 md:pb-12 z-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-8 sm:flex-row sm:items-end">
          
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            {/* Live Updating Status Badge (d.png style) */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/95 shadow-lg backdrop-blur-md">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" aria-hidden="true" />
              <span className="font-mono tracking-widest text-[0.7rem]">UPDATING</span>
              <span className="opacity-40">•</span>
              <span className="text-white font-medium">{messages.condition[condition]}</span>
            </div>

            {/* Massive geometric temperature readout */}
            <div className="relative flex items-baseline justify-center sm:justify-start">
              <p
                className="tabular-nums text-white font-bold tracking-tight drop-shadow-md select-none font-sans leading-none text-[5.5rem] sm:text-[7rem] md:text-[8rem] lg:text-[9rem]"
                style={{ letterSpacing: "-0.04em" }}
              >
                {Math.round(conditions.temperatureCelsius)}
              </p>
              <span className="text-4xl sm:text-6xl md:text-7xl font-light text-white/90 -mt-6 ml-1.5 select-none drop-shadow-sm">°</span>
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
              {messages.condition[condition]}
            </h1>

            <p className="mt-1 text-sm font-medium tracking-wide text-white/75 md:text-base">
              {formatHeroDate(new Date(), locale)}
            </p>
          </div>

          {/* Floating Atmospheric Artwork with volumetric glowing shadows */}
          <div className="relative flex items-center justify-center pt-2 sm:pt-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105 group">
            <div className="absolute inset-0 rounded-full bg-white/15 blur-3xl transform scale-90 pointer-events-none" />
            <WeatherArt
              code={conditions.weatherCode}
              timeOfDay={timeOfDayFromHour(localHour)}
              className="relative size-36 sm:size-44 md:size-52 drop-shadow-[0_22px_35px_rgba(0,30,90,0.55)] transition-[transform,filter] duration-[500ms] group-hover:rotate-2 group-hover:scale-105"
            />
          </div>
        </div>
      </div>

      {/* Telemetry Glass Strip: molded flush into bottom curvature of card as in d.png */}
      <div className="w-full z-20 mt-auto">
        <dl className="w-full grid grid-cols-3 divide-x divide-white/15 bg-gradient-to-b from-black/25 via-black/45 to-black/60 backdrop-blur-2xl border-t border-white/20 p-4 sm:p-5 text-white shadow-xl transition-colors duration-[240ms] hover:bg-black/55">
          <Metric
            icon={<Wind aria-hidden="true" className="size-5 text-sky-300" />}
            label={messages.wind}
            value={`${Math.round(conditions.windSpeedKmh)} km/h`}
          />
          <Metric
            icon={<Droplets aria-hidden="true" className="size-5 text-sky-300" />}
            label={messages.humidity}
            value={`${conditions.relativeHumidityPercent}%`}
          />
          <Metric
            icon={<Umbrella aria-hidden="true" className="size-5 text-sky-300" />}
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
    <div className="group/metric flex flex-col items-center justify-center gap-1.5 px-2 text-center text-white sm:px-4">
      <span className="flex items-center justify-center transition-transform duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/metric:scale-125 group-hover/metric:-translate-y-0.5">{icon}</span>
      <dd className="font-mono text-sm sm:text-base md:text-lg font-bold tracking-tight tabular-nums drop-shadow-sm">{value}</dd>
      <dt className="text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wider text-white/70">
        {label}
      </dt>
    </div>
  );
}
