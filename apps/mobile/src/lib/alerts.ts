import type { components } from "@weather-app/api-client";

import type { AlertRevision } from "@weather-app/core";

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
 * The warnings from that list which cover one saved place.
 *
 * `/api/alerts/active` answers for the account, not for a place: one call
 * carries everything in force across every location the user keeps, each
 * warning naming the ones it covers. That is the right shape for one request
 * instead of one per page - but a screen showing a single place has to narrow
 * it, or Biskupice reports a warning issued for Zgierz.
 *
 * Matched on id rather than on name: two saved places can share a name, and
 * the id is what the server matched against a powiat in the first place.
 */
export function alertsForLocation(alerts: ActiveAlert[], savedLocationId: number): ActiveAlert[] {
  return alerts.filter((alert) =>
    alert.affectedLocations.some((location) => location.id === savedLocationId),
  );
}

/**
 * Every warning ever recorded for one saved location, newest first.
 *
 * The backend scopes this by user as well as by location, so a guessed id
 * returns 404 rather than someone else's timeline.
 */
/**
 * Warnings in force where the device is, for a position nobody saved.
 *
 * Separate from `fetchActiveAlerts` because the questions differ: that one
 * asks what covers the places this account keeps, this one asks what covers
 * the ground under the phone. Nothing about the position is stored, so no push
 * follows from it - the warning is seen by looking.
 */
export async function fetchAlertsAt(latitude: number, longitude: number): Promise<ActiveAlert[]> {
  try {
    const { data } = await authorizedClient().GET("/api/alerts/at", {
      params: { query: { latitude, longitude } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Publishes a test warning over the powiat containing a point.
 *
 * Admin-only on the backend and reachable only from a development build, for
 * the same reason twice over: a warning that is not real must never be one tap
 * away from somebody who would read it as real.
 *
 * Returns how many saved locations it matched, which is the number worth
 * seeing - zero means the warning landed in a powiat nobody is watching, and
 * no notification will follow.
 */
export async function publishTestAlert(
  latitude: number,
  longitude: number,
): Promise<{ ok: true; matched: number } | { ok: false; status: number }> {
  const { data, response } = await authorizedClient().POST("/api/admin/alerts/test", {
    body: { latitude, longitude },
  });
  return data ? { ok: true, matched: data.matchedLocations } : { ok: false, status: response.status };
}

/**
 * What this warning said before each amendment, oldest first.
 *
 * Empty for a warning that has never changed - most of them - and empty for
 * any failure. A detail screen missing its amendment line is a screen missing
 * one line; one that throws is a warning nobody can read.
 */
export async function fetchAlertRevisions(alertId: number): Promise<AlertRevision[]> {
  try {
    const { data } = await authorizedClient().GET("/api/alerts/{alertId}/revisions", {
      params: { path: { alertId } },
    });
    return data ?? [];
  } catch {
    return [];
  }
}

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
