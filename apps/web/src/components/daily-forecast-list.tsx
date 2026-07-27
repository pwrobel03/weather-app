import { WeatherArt } from "@/components/weather-art/weather-art";
import type { DailyForecastEntry } from "@/lib/weather/daily-forecast";
import { weekdayName } from "@/lib/weather/naive-time";

type DailyForecastListProps = {
  entries: DailyForecastEntry[];
};

/**
 * Seven days as a row of cards rather than a table of rows.
 *
 * The table version was seven lines of small type that had to be read one at a
 * time; a row of cards is taken in at a glance, which is how every bento
 * reference in idea/updated presents a week. On narrow screens it scrolls
 * horizontally instead of stacking, so the week stays one gesture.
 *
 * Daily icons always use the "day" bucket - a whole-day summary has no single
 * hour to derive dawn/dusk/night from, and every weather app shows daily icons
 * as their daytime variant regardless.
 */
export function DailyForecastList({ entries }: DailyForecastListProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {entries.map((entry, index) => (
        <li
          key={entry.date}
          className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-3"
          style={{
            // Today reads as the anchor of the week, the way the active hour
            // chip does in d.png.
            background: index === 0 ? "color-mix(in srgb, var(--primary) 14%, transparent)" : undefined,
          }}
        >
          <span className="text-xs font-medium capitalize opacity-70">
            {weekdayName(entry.date)}
          </span>
          <WeatherArt code={entry.weatherCode} timeOfDay="day" className="size-9" />
          <span className="flex flex-col items-center font-mono tabular-nums">
            <span className="text-lg leading-none font-light">
              {Math.round(entry.temperatureMaxCelsius)}°
            </span>
            <span className="text-xs opacity-55">
              {Math.round(entry.temperatureMinCelsius)}°
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
