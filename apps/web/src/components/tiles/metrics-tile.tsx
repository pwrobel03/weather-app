import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";

import { Tile } from "@/components/tiles/tile";
import { weatherMessages, type Locale } from "@/lib/i18n/messages";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

const TITLE: Record<Locale, string> = { pl: "Warunki", en: "Conditions" };

/**
 * The small metrics, as separate readings rather than a strip.
 *
 * On mobile these live inside the hero as one glass bar (major.png); on a wide
 * screen there is room to give each its own cell, which is what every bento
 * inspiration in idea/updated does.
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
    <Tile title={TITLE[locale]}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Metric
          icon={<Wind aria-hidden="true" className="size-4" />}
          label={messages.wind}
          value={`${Math.round(conditions.windSpeedKmh)}`}
          unit="km/h"
        />
        <Metric
          icon={<Droplets aria-hidden="true" className="size-4" />}
          label={messages.humidity}
          value={`${conditions.relativeHumidityPercent}`}
          unit="%"
        />
        <Metric
          icon={<Thermometer aria-hidden="true" className="size-4" />}
          label={messages.feelsLike}
          value={`${Math.round(conditions.apparentTemperatureCelsius)}`}
          unit="°C"
        />
        <Metric
          icon={<Gauge aria-hidden="true" className="size-4" />}
          label={messages.precipitation}
          value={conditions.precipitationMm.toFixed(1)}
          unit="mm"
        />
      </dl>
    </Tile>
  );
}

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt
        className="on-glass-muted flex items-center gap-1.5 text-[0.625rem] uppercase"
        style={{ letterSpacing: "var(--dt-type-label-tracking)" }}
      >
        {icon}
        {label}
      </dt>
      <dd className="on-glass font-mono text-xl tabular-nums">
        {value}
        <span className="on-glass-muted ml-1 text-xs">{unit}</span>
      </dd>
    </div>
  );
}
