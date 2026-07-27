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

  const allMins = entries.map((e) => e.temperatureMinCelsius);
  const allMaxs = entries.map((e) => e.temperatureMaxCelsius);
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const totalSpan = Math.max(globalMax - globalMin, 1);

  return (
    <ol className="flex gap-3 overflow-x-auto pb-2 pt-1 select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {entries.map((entry, index) => {
        const isToday = index === 0;
        const leftPct = Math.max(0, Math.min(100, ((entry.temperatureMinCelsius - globalMin) / totalSpan) * 100));
        const widthPct = Math.max(12, Math.min(100 - leftPct, ((entry.temperatureMaxCelsius - entry.temperatureMinCelsius) / totalSpan) * 100));

        return (
          <li
            key={entry.date}
            className={`group/day relative flex min-w-[6.5rem] flex-1 shrink-0 flex-col items-center justify-between gap-3 rounded-2xl border px-3 py-3.5 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.03] hover:shadow-md active:scale-[0.97] cursor-default ${
              isToday
                ? "border-primary/40 bg-primary/10 shadow-sm dark:bg-primary/15"
                : "border-transparent bg-muted/25 hover:border-border/60 hover:bg-muted/60"
            }`}
          >
            <span className={`text-xs font-semibold capitalize tracking-wide transition-colors ${
              isToday ? "text-primary font-bold" : "text-muted-foreground opacity-85 group-hover/day:opacity-100 group-hover/day:text-foreground"
            }`}>
              {weekdayName(entry.date)}
            </span>

            <div className="my-1 transform transition-transform duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/day:scale-110 group-hover/day:rotate-2">
              <WeatherArt code={entry.weatherCode} timeOfDay="day" className="size-11 drop-shadow-sm" />
            </div>

            <div className="w-full flex flex-col items-center gap-1.5 font-mono tabular-nums">
              <div className="w-full flex justify-between items-baseline px-0.5 text-xs">
                <span className="text-muted-foreground opacity-80 font-normal text-[0.7rem]">{Math.round(entry.temperatureMinCelsius)}°</span>
                <span className="font-bold text-foreground text-sm">{Math.round(entry.temperatureMaxCelsius)}°</span>
              </div>
              {/* Apple-style temperature range indicator bar */}
              <div className="w-full h-1.5 bg-border/40 dark:bg-border/30 rounded-full overflow-hidden relative shadow-inner">
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 opacity-90 shadow-xs"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
