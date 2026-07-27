import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { Metric } from "@/components/tiles/metric";
import { Tile } from "@/components/tiles/tile";
import { weatherMessages, type Locale } from "@weather-app/core";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

const TITLE: Record<Locale, string> = { pl: "Warunki", en: "Conditions" };

/**
 * The small readings, as separate values rather than a strip.
 *
 * On mobile these live inside the hero as one glass bar (d.png); on a wide
 * screen there is room to give each its own cell, which is what every bento
 * reference in idea/updated does.
 */
export function MetricsTile({
  conditions,
  locale,
}: {
  conditions: CurrentConditions;
  locale: Locale;
}) {
  const messages = weatherMessages[locale];

  return (
    <Tile title={TITLE[locale]} className="h-full">
      <dl className="grid grid-cols-2 gap-3 h-full">
        <div className="group/item relative flex flex-col justify-between rounded-2xl border border-border/50 bg-muted/20 p-3.5 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] hover:bg-muted/50 hover:border-border/80 hover:shadow-sm">
          <Metric
            icon={<Wind aria-hidden="true" className="size-4 text-sky-500 dark:text-sky-400 transition-transform group-hover/item:rotate-12" />}
            label={messages.wind}
            value={`${Math.round(conditions.windSpeedKmh)}`}
            unit="km/h"
            size="md"
          />
        </div>
        <div className="group/item relative flex flex-col justify-between rounded-2xl border border-border/50 bg-muted/20 p-3.5 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] hover:bg-muted/50 hover:border-border/80 hover:shadow-sm">
          <Metric
            icon={<Droplets aria-hidden="true" className="size-4 text-blue-500 dark:text-blue-400 transition-transform group-hover/item:scale-110" />}
            label={messages.humidity}
            value={`${conditions.relativeHumidityPercent}`}
            unit="%"
            size="md"
          />
        </div>
        <div className="group/item relative flex flex-col justify-between rounded-2xl border border-border/50 bg-muted/20 p-3.5 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] hover:bg-muted/50 hover:border-border/80 hover:shadow-sm">
          <Metric
            icon={<Thermometer aria-hidden="true" className="size-4 text-amber-500 dark:text-amber-400 transition-transform group-hover/item:scale-110" />}
            label={messages.feelsLike}
            value={`${Math.round(conditions.apparentTemperatureCelsius)}`}
            unit="°C"
            size="md"
          />
        </div>
        <div className="group/item relative flex flex-col justify-between rounded-2xl border border-border/50 bg-muted/20 p-3.5 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] hover:bg-muted/50 hover:border-border/80 hover:shadow-sm">
          <Metric
            icon={<Gauge aria-hidden="true" className="size-4 text-emerald-500 dark:text-emerald-400 transition-transform group-hover/item:rotate-12" />}
            label={messages.precipitation}
            value={conditions.precipitationMm.toFixed(1)}
            unit="mm"
            size="md"
          />
        </div>
      </dl>
    </Tile>
  );
}
