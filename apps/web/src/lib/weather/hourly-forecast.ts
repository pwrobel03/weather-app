import { createWeatherApiClient, type components } from "@weather-app/api-client";

export type HourlyForecastEntry = components["schemas"]["HourlyForecastEntry"];

/** Same null-on-failure contract as fetchCurrentConditions - an upstream hiccup
 * should leave the strip empty, not take the whole page down with it. */
export async function fetchHourlyForecast(
  latitude: number,
  longitude: number,
): Promise<HourlyForecastEntry[]> {
  const client = createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );

  try {
    const { data } = await client.GET("/api/forecast/hourly", {
      params: { query: { latitude, longitude } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}
