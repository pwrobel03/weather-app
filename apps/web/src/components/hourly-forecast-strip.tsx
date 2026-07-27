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
      className="flex gap-3 overflow-x-auto pb-2 pt-1 select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Prognoza godzinowa"
    >
      {upcoming.map((entry, index) => {
        const isCurrent = index === 0;
        return (
          <li
            key={entry.time}
            className={`group/hour relative flex min-w-[5.25rem] shrink-0 flex-col items-center justify-between gap-2.5 rounded-2xl border px-3 py-3 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.04] hover:shadow-md active:scale-[0.96] cursor-default ${
              isCurrent
                ? "border-primary/40 bg-primary/10 shadow-sm dark:bg-primary/15"
                : "border-transparent bg-muted/25 hover:border-border/60 hover:bg-muted/60"
            }`}
          >
            {isCurrent && (
              <span className="absolute -top-1 right-2 flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-primary" />
              </span>
            )}
            <span className={`font-mono text-[0.75rem] tabular-nums tracking-wide transition-colors ${
              isCurrent ? "font-bold text-primary" : "opacity-75 group-hover/hour:opacity-100 text-muted-foreground"
            }`}>
              {formatHourMinute(entry.time)}
            </span>
            <div className="my-0.5 transform transition-transform duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/hour:scale-110 group-hover/hour:rotate-3">
              <WeatherArt
                code={entry.weatherCode}
                timeOfDay={timeOfDayFromHour(hourOf(entry.time))}
                className="size-10 drop-shadow-sm"
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="font-mono text-xl leading-none font-semibold tabular-nums tracking-tighter text-foreground">
                {Math.round(entry.temperatureCelsius)}°
              </span>
              {entry.precipitationProbabilityPercent > 10 && (
                <span className="mt-1 font-mono text-[0.65rem] font-medium text-sky-500 dark:text-sky-400 tabular-nums">
                  {entry.precipitationProbabilityPercent}%
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
