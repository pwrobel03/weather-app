import type { components } from "@weather-app/api-client";

import { authorizedClient } from "./auth/session";
import { fetchSavedLocations } from "./saved-locations";

export type ActiveAlert = components["schemas"]["AlertResponse"];

/**
 * Warnings in force for the caller's saved locations.
 *
 * Returns an empty list rather than throwing for every failure mode -
 * anonymous, expired session, backend unreachable. A home screen that renders
 * nothing because the alert query failed is worse than one showing the
 * forecast and no warnings.
 */
export async function fetchActiveAlerts(): Promise<ActiveAlert[]> {
  try {
    const { data } = await authorizedClient().GET("/api/alerts/active");
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Every warning ever recorded for one saved location, newest first.
 *
 * The backend scopes this by user as well as by location, so a guessed id
 * returns 404 rather than someone else's timeline.
 */
export async function fetchAlertHistory(locationId: number): Promise<ActiveAlert[]> {
  try {
    const { data } = await authorizedClient().GET(
      "/api/users/me/locations/{locationId}/alerts",
      { params: { path: { locationId } } },
    );
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * One warning by id, searched across everything the caller can see.
 *
 * The backend exposes no GET /api/alerts/{id} - warnings are only ever listed,
 * as active or as a location's history. Resolving from those lists rather than
 * adding an endpoint for one screen has a useful consequence: a caller can
 * only open a warning that actually concerns them, so an id belonging to
 * someone else is indistinguishable from one that never existed.
 *
 * This is also what a push notification's deep link lands on, which is why it
 * has to work for a warning that has since expired.
 */
export async function findAlertById(alertId: number): Promise<ActiveAlert | null> {
  const active = await fetchActiveAlerts();
  const fromActive = active.find((alert) => alert.id === alertId);
  if (fromActive) return fromActive;

  const locations = await fetchSavedLocations();
  const histories = await Promise.all(
    locations.map((location) => fetchAlertHistory(location.id)),
  );
  return histories.flat().find((alert) => alert.id === alertId) ?? null;
}
