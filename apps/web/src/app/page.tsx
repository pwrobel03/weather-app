import { TemperatureDisplay } from "@/components/temperature-display";
import { WeatherBackground } from "@/components/weather-background";
import { fetchCurrentConditions } from "@/lib/weather/current-conditions";

// Warszawa - placeholder default location until location search (Faza 7) lands.
const DEFAULT_LATITUDE = 52.23;
const DEFAULT_LONGITUDE = 21.01;

// Forecast is fetched live from the backend per request - never prerender
// statically at build time, when no backend is reachable.
export const dynamic = "force-dynamic";

export default async function Home() {
  const conditions = await fetchCurrentConditions(DEFAULT_LATITUDE, DEFAULT_LONGITUDE);

  // With no reading there is no state to encode, so the background falls back
  // to a neutral overcast rather than inventing weather.
  const weatherCode = conditions?.weatherCode ?? 3;
  const temperatureCelsius = conditions?.temperatureCelsius ?? 0;

  return (
    <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
        {conditions ? (
          <TemperatureDisplay temperatureCelsius={conditions.temperatureCelsius} />
        ) : (
          <p className="text-sm text-[#8a94a6]">—</p>
        )}
      </main>
    </WeatherBackground>
  );
}
