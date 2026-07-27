import { timeOfDayFromHour } from "@/lib/weather/channels";
import type { HourlyForecastEntry } from "@/lib/weather/hourly-forecast";
import { WeatherArt } from "@/components/weather-art/weather-art";
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
      {upcoming.map((entry, index) => (
        <li
          key={entry.time}
          className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-3 py-2"
          style={{
            // The nearest hour is the anchor, highlighted the way the active
            // chip is in d.png - one accent in the row, not a row of accents.
            background:
              index === 0 ? "color-mix(in srgb, var(--primary) 18%, transparent)" : undefined,
          }}
        >
          <span className="font-mono text-xs tabular-nums opacity-60">
            {formatHourMinute(entry.time)}
          </span>
          <WeatherArt
            code={entry.weatherCode}
            timeOfDay={timeOfDayFromHour(hourOf(entry.time))}
            className="size-9"
          />
          <span className="font-mono text-lg leading-none font-light tabular-nums">
            {Math.round(entry.temperatureCelsius)}°
          </span>
        </li>
      ))}
    </ol>
  );
}
