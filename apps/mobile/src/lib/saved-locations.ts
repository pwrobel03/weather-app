import type { components } from "@weather-app/api-client";

import { authorizedClient } from "./auth/session";

export type SavedLocation = components["schemas"]["SavedLocation"];
export type LocationSearchResult = components["schemas"]["LocationSearchResult"];

/**
 * Saved locations and the search that feeds them.
 *
 * Far shorter than apps/web's equivalent, and the difference is structural
 * rather than a shortcut: on web every call re-checks the access token and
 * hand-retries after refreshing it, because a Server Action has no long-lived
 * client to hang that on. Here `authorizedClient` owns signing and renewal, so
 * these are ordinary calls.
 */
export type SaveResult = { ok: true } | { ok: false; status: number };

export async function fetchSavedLocations(): Promise<SavedLocation[]> {
  const { data } = await authorizedClient().GET("/api/users/me/locations");
  return data ?? [];
}

export async function createSavedLocation(
  name: string,
  latitude: number,
  longitude: number,
): Promise<SaveResult> {
  const { data, response } = await authorizedClient().POST("/api/users/me/locations", {
    body: { name, latitude, longitude },
  });
  return data ? { ok: true } : { ok: false, status: response.status };
}

/**
 * Persists the whole order. The server takes every id exactly once, so this
 * sends the list as displayed rather than a diff.
 */
export async function reorderSavedLocations(orderedIds: number[]): Promise<boolean> {
  const { response } = await authorizedClient().PUT("/api/users/me/locations/order", {
    body: { orderedIds },
  });
  return response.ok;
}

export async function deleteSavedLocation(id: number): Promise<boolean> {
  const { response } = await authorizedClient().DELETE("/api/users/me/locations/{id}", {
    params: { path: { id } },
  });
  return response.ok;
}

/** Geocoding, open to anyone - searching does not need a session. */
export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const { data } = await authorizedClient().GET("/api/locations/search", {
    params: { query: { query } },
  });
  return data ?? [];
}
