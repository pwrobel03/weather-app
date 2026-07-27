import { createWeatherApiClient } from "@weather-app/api-client";
import type { CurrentConditions } from "@weather-app/core";

export type { CurrentConditions };

/**
 * Reads current conditions, returning null instead of throwing.
 *
 * The client rejects on transport failure and on an unparseable body, and the
 * page must survive both: the background encodes weather state, and a screen
 * that 500s encodes nothing at all. Seen for real when an unrelated service
 * occupied the backend's default port and answered with HTML - the JSON parse
 * threw and took the whole render with it.
 */
export async function fetchCurrentConditions(
  latitude: number,
  longitude: number,
): Promise<CurrentConditions | null> {
  const client = createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );

  try {
    const { data } = await client.GET("/api/forecast/current", {
      params: { query: { latitude, longitude } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}
