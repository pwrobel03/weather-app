"use server";

import { createWeatherApiClient } from "@weather-app/api-client";
import { redirect } from "next/navigation";

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
    if (response.status === 401) {
      return { error: "Nieprawidłowy e-mail lub hasło." };
    }
    return { error: "Logowanie nie powiodło się. Spróbuj ponownie." };
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
    if (response.status === 409) {
      return { error: "Ten adres e-mail jest już zarejestrowany." };
    }
    if (response.status === 400) {
      return { error: "Sprawdź poprawność danych - hasło musi mieć od 8 do 72 znaków." };
    }
    return { error: "Rejestracja nie powiodła się. Spróbuj ponownie." };
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
