import "server-only";

import { createWeatherApiClient, type components } from "@weather-app/api-client";

import { refreshSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";

export type ActiveAlert = components["schemas"]["AlertResponse"];

function client(accessToken: string) {
  return createWeatherApiClient({
    // Spreading an explicit `baseUrl: undefined` would overwrite the client's
    // own default, so the key must be omitted entirely when unset.
    ...(process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : {}),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Warnings in force for the caller's saved locations.
 *
 * Returns an empty list rather than throwing for every failure mode -
 * anonymous, expired session, backend down. A home screen that renders
 * nothing because the alert query failed is worse than one that shows the
 * forecast and no warnings.
 */
export async function fetchActiveAlerts(): Promise<ActiveAlert[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  try {
    const first = await client(accessToken).GET("/api/alerts/active");
    let data = first.data;
    if (first.response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        return [];
      }
      data = (await client(refreshed).GET("/api/alerts/active")).data;
    }
    return data ?? [];
  } catch {
    return [];
  }
}
