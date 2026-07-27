import { createWeatherApiClient } from "@weather-app/api-client";
import { NextResponse } from "next/server";

import { clearSessionCookies, getRefreshToken, setSessionCookies } from "@/lib/auth/session";

const client = createWeatherApiClient(
  process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
);

/**
 * Silently renews the session using the HttpOnly refresh token cookie -
 * meant to be called by client code when an authenticated request 401s, not
 * directly by the user. The backend rotates refresh tokens on every use
 * (commit 28: reusing an already-spent one 401s), so a successful call here
 * always writes a brand new pair, never just a fresh access token.
 */
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const { data, response } = await client.POST("/api/auth/refresh", {
    body: { refreshToken },
  });

  if (!data) {
    // The stored refresh token is dead either way (expired, or already
    // rotated out by a previous refresh) - clear it rather than leave a
    // cookie around that will just fail the same way again.
    await clearSessionCookies();
    return NextResponse.json({ error: "refresh failed" }, { status: response.status === 401 ? 401 : 502 });
  }

  await setSessionCookies(data.accessToken, data.refreshToken);
  return NextResponse.json({ ok: true });
}
