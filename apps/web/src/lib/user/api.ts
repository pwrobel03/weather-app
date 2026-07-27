import "server-only";

import { createWeatherApiClient, type components } from "@weather-app/api-client";

import { refreshSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";

export type UserProfile = components["schemas"]["UserResponse"];
export type UnitPreferences = components["schemas"]["UpdatePreferencesRequest"];

function client(accessToken: string) {
  return createWeatherApiClient({
    ...(process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : {}),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function fetchProfile(): Promise<UserProfile | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  try {
    const first = await client(accessToken).GET("/api/users/me");
    let data = first.data;
    if (first.response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        return null;
      }
      data = (await client(refreshed).GET("/api/users/me")).data;
    }
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Partial update: an omitted field leaves that preference alone, matching the
 * backend's PATCH semantics (commit 32).
 */
export async function updatePreferences(preferences: UnitPreferences): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  const body = { body: preferences } as const;

  try {
    let { response } = await client(accessToken).PATCH("/api/users/me/preferences", body);
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        return false;
      }
      ({ response } = await client(refreshed).PATCH("/api/users/me/preferences", body));
    }
    return response.ok;
  } catch {
    return false;
  }
}
