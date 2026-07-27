import type { DailyForecastEntry } from "@/lib/weather/daily-forecast";
import { WeatherArt } from "@/components/weather-art/weather-art";
import { weekdayName } from "@/lib/weather/naive-time";

type DailyForecastListProps = {
  entries: DailyForecastEntry[];
};

/** Daily icons always use the "day" bucket - a whole-day summary has no
 * single hour to derive dawn/dusk/night from, and every other weather app
 * convention shows daily icons as their daytime variant regardless. */
export function DailyForecastList({ entries }: DailyForecastListProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <ol className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.date} className="flex items-center gap-3 py-2.5">
          <span className="w-10 shrink-0 text-sm font-medium capitalize">
            {weekdayName(entry.date)}
          </span>
          <WeatherArt code={entry.weatherCode} timeOfDay="day" className="size-7 shrink-0" />
          <span className="ml-auto flex items-baseline gap-2 font-mono text-sm tabular-nums">
            <span className="text-muted-foreground">{Math.round(entry.temperatureMinCelsius)}°</span>
            <span className="font-medium">{Math.round(entry.temperatureMaxCelsius)}°</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
