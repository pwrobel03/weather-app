import type { components } from "@weather-app/api-client";

import { authorizedClient } from "./auth/session";

export type UserProfile = components["schemas"]["UserResponse"];
export type UnitPreferences = components["schemas"]["UpdatePreferencesRequest"];

export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const { data } = await authorizedClient().GET("/api/users/me");
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Partial update: an omitted field leaves that preference alone, matching the
 * backend's PATCH semantics (commit 32). That is what lets each control send
 * only what it owns instead of the settings screen resubmitting a whole
 * profile and racing itself.
 */
export async function updatePreferences(preferences: UnitPreferences): Promise<boolean> {
  try {
    const { response } = await authorizedClient().PATCH("/api/users/me/preferences", {
      body: preferences,
    });
    return response.ok;
  } catch {
    return false;
  }
}
