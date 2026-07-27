import { timeOfDayFromHour } from "@/lib/weather/channels";
import type { HourlyForecastEntry } from "@/lib/weather/hourly-forecast";
import { weatherIcon } from "@/lib/weather/icon";
import { formatHourMinute, hourOf, nowAsNaiveIsoTimestamp } from "@/lib/weather/naive-time";

type HourlyForecastStripProps = {
  entries: HourlyForecastEntry[];
  now?: Date;
};

const HOURS_TO_SHOW = 24;

/** design.md: "osobna powierzchnia na prognozę godzinową" - horizontal strip,
 * meant to sit inside its own card, not the weather background. */
export function HourlyForecastStrip({ entries, now = new Date() }: HourlyForecastStripProps) {
  const nowLocal = nowAsNaiveIsoTimestamp(now);
  const upcoming = entries.filter((entry) => entry.time >= nowLocal).slice(0, HOURS_TO_SHOW);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <ol
      className="flex gap-5 overflow-x-auto pb-1"
      aria-label="Prognoza godzinowa"
    >
      {upcoming.map((entry) => (
        <li key={entry.time} className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatHourMinute(entry.time)}
          </span>
          {weatherIcon(entry.weatherCode, timeOfDayFromHour(hourOf(entry.time)), { className: "size-6" })}
          <span className="font-mono text-sm font-medium tabular-nums">
            {Math.round(entry.temperatureCelsius)}°
          </span>
        </li>
      ))}
    </ol>
  );
}
