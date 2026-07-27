import { WeatherArt } from "@/components/weather-art/weather-art";
import { weatherMessages, type Locale } from "@/lib/i18n/messages";
import { conditionFromWeatherCode } from "@/lib/weather/condition";
import type { DailyForecastEntry } from "@/lib/weather/daily-forecast";
import { weekdayName } from "@/lib/weather/naive-time";

type DailyForecastListProps = {
  entries: DailyForecastEntry[];
  locale?: Locale;
};

/**
 * Seven days presented in the sleek, vertically organized row architecture
 * of d.png (Screen 2). Each day row features fluid hover translation,
 * crisp atmospheric iconography paired with condition text, and dual high/low figures.
 */
export function DailyForecastList({ entries, locale = "pl" }: DailyForecastListProps) {
  if (entries.length === 0) {
    return null;
  }

  const messages = weatherMessages[locale];

  return (
    <div className="flex flex-col gap-1.5 pt-1 pb-1 select-none" aria-label="Prognoza na 7 dni">
      {entries.map((entry, index) => {
        const isToday = index === 0;
        const condition = conditionFromWeatherCode(entry.weatherCode);
        const condLabel = messages.condition[condition];
        const maxTemp = Math.round(entry.temperatureMaxCelsius);
        const minTemp = Math.round(entry.temperatureMinCelsius);

        return (
          <div
            key={entry.date}
            className={`group/day grid grid-cols-[3.5rem_1fr_auto] sm:grid-cols-[4.5rem_1fr_auto] items-center gap-3 sm:gap-4 rounded-2xl py-3 px-3.5 sm:px-4 transition-[transform,background-color,border-color,box-shadow] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:translate-x-1.5 hover:bg-muted/50 dark:hover:bg-[#1c2230] cursor-default border ${
              isToday
                ? "border-primary/30 bg-primary/10 dark:bg-primary/15 font-semibold shadow-xs"
                : "border-transparent bg-transparent"
            }`}
          >
            {/* Left: Day Name */}
            <span className={`text-sm sm:text-base font-semibold capitalize tracking-wide transition-colors ${
              isToday ? "text-primary font-bold" : "text-muted-foreground group-hover/day:text-foreground"
            }`}>
              {weekdayName(entry.date)}
            </span>

            {/* Middle: Atmospheric Icon + Condition Label (d.png Style) */}
            <div className="flex items-center gap-3 min-w-0 pl-2">
              <div className="shrink-0 transform transition-transform duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/day:scale-120 group-hover/day:rotate-3">
                <WeatherArt code={entry.weatherCode} timeOfDay="day" className="size-8 sm:size-9 drop-shadow-sm" />
              </div>
              <span className="truncate text-sm sm:text-base font-medium text-foreground/90 group-hover/day:text-foreground">
                {condLabel}
              </span>
            </div>

            {/* Right: Dual High / Low Temperatures */}
            <div className="text-right font-mono tabular-nums tracking-tight text-sm sm:text-base pl-2">
              <span className="font-bold text-foreground mr-2.5 sm:mr-3.5">
                {maxTemp > 0 ? `+${maxTemp}` : maxTemp}°
              </span>
              <span className="font-medium text-muted-foreground/75">
                {minTemp > 0 ? `+${minTemp}` : minTemp}°
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
