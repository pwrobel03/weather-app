import type { TimeOfDay } from "@weather-app/core";
import { weatherIcon } from "@/lib/weather/icon";

type WeatherIconProps = {
  weatherCode: number;
  timeOfDay: TimeOfDay;
  className?: string;
};

/** design.md: "dosłowność pogody niesie ikona, nie tło" - the one bold icon. */
export function WeatherIcon({ weatherCode, timeOfDay, className }: WeatherIconProps) {
  return weatherIcon(weatherCode, timeOfDay, { className, "aria-hidden": true });
}
