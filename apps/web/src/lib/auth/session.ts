import "server-only";

import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "wx_access_token";
const REFRESH_TOKEN_COOKIE = "wx_refresh_token";

// Matches the backend's own JWT TTLs (commit 28) - no point holding a cookie
// longer than the token inside it stays valid.
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Both tokens live only as HttpOnly cookies, set here on the server - never
 * handed to client JS. This is the BFF pattern the roadmap calls for
 * explicitly at commit 64 (refresh); login/register (commit 63) start it.
 */
export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  store.set(ACCESS_TOKEN_COOKIE, accessToken, { ...shared, maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS });
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...shared, maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getAccessToken()) !== undefined;
}
