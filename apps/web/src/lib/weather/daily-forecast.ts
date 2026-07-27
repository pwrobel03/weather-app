import { createWeatherApiClient } from "@weather-app/api-client";
import type { DailyForecastEntry } from "@weather-app/core";

export type { DailyForecastEntry };

/** Same null-on-failure contract as fetchCurrentConditions/fetchHourlyForecast. */
export async function fetchDailyForecast(
  latitude: number,
  longitude: number,
): Promise<DailyForecastEntry[]> {
  const client = createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );

  try {
    const { data } = await client.GET("/api/forecast/daily", {
      params: { query: { latitude, longitude } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}
