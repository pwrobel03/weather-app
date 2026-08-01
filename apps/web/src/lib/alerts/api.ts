import type { AlertRevision } from "@weather-app/core";
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

/**
 * Every warning ever recorded for one saved location, newest first.
 *
 * Scoped by location id; the backend additionally scopes by user, so a guessed
 * id returns 404 rather than someone else's timeline.
 */
export async function fetchAlertHistory(locationId: number): Promise<ActiveAlert[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  const params = { params: { path: { locationId } } } as const;

  try {
    const first = await client(accessToken).GET("/api/users/me/locations/{locationId}/alerts", params);
    let data = first.data;
    if (first.response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        return [];
      }
      data = (await client(refreshed).GET("/api/users/me/locations/{locationId}/alerts", params)).data;
    }
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * One warning by id, searched across everything the caller can see.
 *
 * The backend exposes no GET /api/alerts/{id} - warnings are only ever listed,
 * as active or as a location's history. Rather than add an endpoint for a
 * single screen, this resolves the id from those lists, which also means a
 * caller can only ever open a warning that actually concerns them.
 */
export async function findAlertById(alertId: number): Promise<ActiveAlert | null> {
  const active = await fetchActiveAlerts();
  const fromActive = active.find((alert) => alert.id === alertId);
  if (fromActive) {
    return fromActive;
  }

  const { fetchSavedLocations } = await import("@/lib/saved-locations/api");
  const locations = await fetchSavedLocations();

  const histories = await Promise.all(
    locations.map((location) => fetchAlertHistory(location.id)),
  );
  return histories.flat().find((alert) => alert.id === alertId) ?? null;
}

/**
 * What this warning said before each amendment, oldest first.
 *
 * Empty for a warning that has never changed, which is most of them - and
 * empty, rather than throwing, for any failure. A detail page that renders no
 * amendment notice is a page missing one line; one that fails to render is a
 * warning nobody can read.
 */
export async function fetchAlertRevisions(alertId: number): Promise<AlertRevision[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  try {
    const first = await client(accessToken).GET("/api/alerts/{alertId}/revisions", {
      params: { path: { alertId } },
    });
    let data = first.data;
    if (first.response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        return [];
      }
      data = (
        await client(refreshed).GET("/api/alerts/{alertId}/revisions", {
          params: { path: { alertId } },
        })
      ).data;
    }
    return data ?? [];
  } catch {
    return [];
  }
}
