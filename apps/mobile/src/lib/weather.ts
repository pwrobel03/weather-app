import type { CurrentConditions, DailyForecastEntry, HourlyForecastEntry } from "@weather-app/core";

import { createApiClient } from "./api";

/**
 * Forecast reads, with the same null-on-failure contract apps/web uses: an
 * upstream hiccup leaves a section empty rather than taking the screen down.
 * The background encodes the weather, and a screen that crashes encodes
 * nothing at all.
 */
export async function fetchCurrentConditions(
  latitude: number,
  longitude: number,
): Promise<CurrentConditions | null> {
  try {
    const { data } = await createApiClient().GET("/api/forecast/current", {
      params: { query: { latitude, longitude } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchHourlyForecast(
  latitude: number,
  longitude: number,
): Promise<HourlyForecastEntry[]> {
  try {
    const { data } = await createApiClient().GET("/api/forecast/hourly", {
      params: { query: { latitude, longitude } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchDailyForecast(
  latitude: number,
  longitude: number,
): Promise<DailyForecastEntry[]> {
  try {
    const { data } = await createApiClient().GET("/api/forecast/daily", {
      params: { query: { latitude, longitude } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}
