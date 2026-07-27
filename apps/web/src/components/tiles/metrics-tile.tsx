import { Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { Metric } from "@/components/tiles/metric";
import { Tile } from "@/components/tiles/tile";
import { weatherMessages, type Locale } from "@/lib/i18n/messages";
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
    <Tile title={TITLE[locale]}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Metric
          icon={<Wind aria-hidden="true" className="size-3.5" />}
          label={messages.wind}
          value={`${Math.round(conditions.windSpeedKmh)}`}
          unit="km/h"
        />
        <Metric
          icon={<Droplets aria-hidden="true" className="size-3.5" />}
          label={messages.humidity}
          value={`${conditions.relativeHumidityPercent}`}
          unit="%"
        />
        <Metric
          icon={<Thermometer aria-hidden="true" className="size-3.5" />}
          label={messages.feelsLike}
          value={`${Math.round(conditions.apparentTemperatureCelsius)}`}
          unit="°C"
        />
        <Metric
          icon={<Gauge aria-hidden="true" className="size-3.5" />}
          label={messages.precipitation}
          value={conditions.precipitationMm.toFixed(1)}
          unit="mm"
        />
      </dl>
    </Tile>
  );
}
