import "server-only";

import { createWeatherApiClient, type components } from "@weather-app/api-client";

import { refreshSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";

export type SavedLocation = components["schemas"]["SavedLocation"];

function client(accessToken: string) {
  return createWeatherApiClient({
    // Spreading an explicit `baseUrl: undefined` here would overwrite the
    // client's own default (it merges as `{ baseUrl: default, ...options }`),
    // so the key must be omitted entirely when unset, not set to undefined.
    ...(process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : {}),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function fetchSavedLocations(): Promise<SavedLocation[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  const first = await client(accessToken).GET("/api/users/me/locations");
  let data = first.data;
  if (first.response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      return [];
    }
    data = (await client(refreshed).GET("/api/users/me/locations")).data;
  }

  return data ?? [];
}

export type SaveLocationResult = { ok: true } | { ok: false; error: string };

export async function createSavedLocation(
  name: string,
  latitude: number,
  longitude: number,
): Promise<SaveLocationResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Musisz się zalogować." };
  }

  const body = { name, latitude, longitude };
  let { data, response } = await client(accessToken).POST("/api/users/me/locations", { body });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
    }
    ({ data, response } = await client(refreshed).POST("/api/users/me/locations", { body }));
  }

  if (!data) {
    if (response.status === 409) {
      return { ok: false, error: "Ta lokalizacja jest już zapisana." };
    }
    if (response.status === 400) {
      return { ok: false, error: "Sprawdź poprawność danych." };
    }
    return { ok: false, error: "Nie udało się zapisać lokalizacji." };
  }

  return { ok: true };
}

export async function deleteSavedLocation(id: number): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  let { response } = await client(accessToken).DELETE("/api/users/me/locations/{id}", {
    params: { path: { id } },
  });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      return false;
    }
    ({ response } = await client(refreshed).DELETE("/api/users/me/locations/{id}", {
      params: { path: { id } },
    }));
  }

  return response.ok;
}

/**
 * Sets the lowest warning level worth notifying about at one place.
 *
 * Same shape as every other write here, retry on 401 included: an access token
 * that expired while somebody was looking at the list should cost a refresh,
 * not a silently dropped setting.
 */
export async function updateMinSeverity(
  id: number,
  minSeverity: "1" | "2" | "3",
): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  const body = { minSeverity };
  let { response } = await client(accessToken).PATCH("/api/users/me/locations/{id}", {
    params: { path: { id } },
    body,
  });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      return false;
    }
    ({ response } = await client(refreshed).PATCH("/api/users/me/locations/{id}", {
      params: { path: { id } },
      body,
    }));
  }

  return response.ok;
}
