import { HourlyForecastStrip } from "@/components/hourly-forecast-strip";
import { TemperatureDisplay } from "@/components/temperature-display";
import { ThemeToggle } from "@/components/theme-toggle";
import { WeatherBackground } from "@/components/weather-background";
import { WeatherIcon } from "@/components/weather-icon";
import { timeOfDay } from "@/lib/weather/channels";
import { fetchCurrentConditions } from "@/lib/weather/current-conditions";
import { fetchHourlyForecast } from "@/lib/weather/hourly-forecast";

// Warszawa - placeholder default location until location search (Faza 7) lands.
const DEFAULT_LATITUDE = 52.23;
const DEFAULT_LONGITUDE = 21.01;

// Forecast is fetched live from the backend per request - never prerender
// statically at build time, when no backend is reachable.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [conditions, hourly] = await Promise.all([
    fetchCurrentConditions(DEFAULT_LATITUDE, DEFAULT_LONGITUDE),
    fetchHourlyForecast(DEFAULT_LATITUDE, DEFAULT_LONGITUDE),
  ]);

  // With no reading there is no state to encode, so the background falls back
  // to a neutral overcast rather than inventing weather.
  const weatherCode = conditions?.weatherCode ?? 3;
  const temperatureCelsius = conditions?.temperatureCelsius ?? 0;
  const currentTimeOfDay = timeOfDay(new Date());

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero: edge-to-edge on mobile, a contained rounded tile from md up
          (design.md revision, 2026-07-27) - see .weather-background in
          globals.css for the breakpoint. */}
      <div className="md:mx-auto md:w-full md:max-w-2xl md:px-6 md:pt-6">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
            <WeatherIcon weatherCode={weatherCode} timeOfDay={currentTimeOfDay} className="size-14" />
            {conditions ? (
              <TemperatureDisplay temperatureCelsius={conditions.temperatureCelsius} />
            ) : (
              <p className="text-sm text-[#8a94a6]">—</p>
            )}
          </div>
        </WeatherBackground>
      </div>

      {/* design.md: "osobna powierzchnia na prognozę godzinową" - daily list
          (commit 61) joins this surface next. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8 md:px-6">
        <section className="mt-4 rounded-3xl bg-card p-6 text-card-foreground md:mt-6">
          <HourlyForecastStrip entries={hourly} />
        </section>
      </div>
    </div>
  );
}
