import { CloudLightning } from "lucide-react";
import { createWeatherApiClient } from "@weather-app/api-client";

// Warszawa - placeholder default location until location search (Faza 3) lands.
const DEFAULT_LATITUDE = 52.23;
const DEFAULT_LONGITUDE = 21.01;

// Forecast is fetched live from the backend per request - never prerender
// statically at build time, when no backend is reachable.
export const dynamic = "force-dynamic";

export default async function Home() {
  const client = createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );

  const { data, error } = await client.GET("/api/forecast/current", {
    params: { query: { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE } },
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background text-foreground">
      <CloudLightning className="size-10 text-primary" />
      <p className="text-muted-foreground">Weather App</p>
      {data ? (
        <p className="text-4xl font-light tabular-nums">{Math.round(data.temperatureCelsius)}°C</p>
      ) : (
        <p className="text-sm text-destructive">
          Nie udało się pobrać prognozy{error ? `: ${JSON.stringify(error)}` : ""}
        </p>
      )}
    </div>
  );
}
