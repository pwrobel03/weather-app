"use server";

import { createWeatherApiClient } from "@weather-app/api-client";
import { authMessages } from "@weather-app/core";
import { redirect } from "next/navigation";

import { getRequestLocale } from "../locale";
import { clearSessionCookies, setSessionCookies } from "./session";

export type AuthActionState = { error?: string };

function client() {
  return createWeatherApiClient(
    process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
  );
}

/**
 * Runs on the server, so the backend call never touches the browser - same
 * reason as the forecast proxy (commit 62): no CORS configuration needed,
 * and here it also means the tokens never pass through client JS at all.
 */
export async function loginAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { data, response } = await client().POST("/api/auth/login", {
    body: { email, password },
  });

  if (!data) {
    const messages = authMessages[await getRequestLocale()];
    return { error: response.status === 401 ? messages.invalidCredentials : messages.failed };
  }

  await setSessionCookies(data.accessToken, data.refreshToken);
  redirect("/");
}

export async function registerAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();

  const { data, response } = await client().POST("/api/auth/register", {
    body: { email, password, displayName: displayNameRaw || undefined },
  });

  if (!data) {
    const messages = authMessages[await getRequestLocale()];
    if (response.status === 409) return { error: messages.emailTaken };
    if (response.status === 400) return { error: messages.invalidInput };
    return { error: messages.failed };
  }

  await setSessionCookies(data.accessToken, data.refreshToken);
  redirect("/");
}

/**
 * Clears the session cookies and returns to the home screen.
 *
 * Only the cookies are dropped - the refresh token stays valid in the backend
 * until it expires or is rotated. Revoking it server-side would need an
 * endpoint that does not exist yet; noted rather than silently pretended.
 */
export async function logoutAction(): Promise<void> {
  await clearSessionCookies();
  redirect("/");
}
