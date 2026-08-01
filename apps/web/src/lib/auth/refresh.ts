import "server-only";

import { createWeatherApiClient } from "@weather-app/api-client";

import { clearSessionCookies, getRefreshToken, setSessionCookies } from "./session";

const client = createWeatherApiClient(
  process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
);

/**
 * Silently renews the session using the HttpOnly refresh token cookie.
 * Shared by the /api/auth/refresh route handler (commit 64, called from
 * client code on a 401) and any server-side authorized fetch that hits a
 * stale access token directly (commit 66) - one place that knows how to
 * rotate a session, not two copies of the same logic.
 *
 * Returns the new access token on success, or null (having cleared the dead
 * cookies) on failure.
 */
export async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const { data } = await client.POST("/api/auth/refresh", {
    body: { refreshToken },
  });

  if (!data) {
    await clearSessionCookies();
    return null;
  }

  await setSessionCookies(data.accessToken, data.refreshToken);
  return data.accessToken;
}
