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
      className="flex gap-3 overflow-x-auto pb-3 pt-2 px-1 select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Prognoza godzinowa"
    >
      {upcoming.map((entry, index) => {
        const isCurrent = index === 0;
        return (
          <li
            key={entry.time}
            className={`group/hour relative flex min-w-[5.25rem] sm:min-w-[5.75rem] shrink-0 flex-col items-center justify-between gap-3 rounded-[2rem] border py-4 px-2.5 transition-[transform,background-color,border-color,box-shadow] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.04] active:scale-[0.96] cursor-default ${
              isCurrent
                ? "border-white/35 bg-gradient-to-br from-[#00d2ff] via-[#0094ff] to-[#0062ff] text-white shadow-[0_12px_28px_-6px_rgba(0,140,255,0.7)] scale-[1.03] z-10"
                : "border-white/5 bg-card/60 dark:bg-[#151a24] text-foreground hover:border-white/20 hover:bg-card/80 dark:hover:bg-[#1c2230] hover:shadow-lg"
            }`}
          >
            {/* Top: Temperature (d.png hierarchy) */}
            <div className="flex flex-col items-center">
              <span className={`font-mono text-xl sm:text-2xl leading-none font-bold tabular-nums tracking-tight ${
                isCurrent ? "text-white drop-shadow-sm" : "text-foreground"
              }`}>
                {Math.round(entry.temperatureCelsius)}°
              </span>
              {entry.precipitationProbabilityPercent > 10 && !isCurrent && (
                <span className="mt-1 font-mono text-[0.65rem] font-semibold text-sky-500 dark:text-sky-400 tabular-nums">
                  {entry.precipitationProbabilityPercent}%
                </span>
              )}
            </div>

            {/* Middle: Atmospheric Icon */}
            <div className="my-0.5 transform transition-transform duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/hour:scale-115 group-hover/hour:rotate-3">
              <WeatherArt
                code={entry.weatherCode}
                timeOfDay={timeOfDayFromHour(hourOf(entry.time))}
                className={`size-11 sm:size-12 ${isCurrent ? "drop-shadow-[0_8px_16px_rgba(0,30,90,0.45)]" : "drop-shadow-sm"}`}
              />
            </div>

            {/* Bottom: Time */}
            <span className={`font-mono text-xs tabular-nums tracking-wide ${
              isCurrent ? "font-bold text-white/95" : "font-medium text-muted-foreground group-hover/hour:text-foreground/90"
            }`}>
              {formatHourMinute(entry.time)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
