import { createWeatherApiClient } from "@weather-app/api-client";
import { authMessages, type Locale } from "@weather-app/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../api";
import { endSession, getSession, hydrate, isHydrated, setSession, subscribe } from "./session";
import type { StoredSession } from "./storage";

type Credentials = { email: string; password: string; displayName?: string };

type AuthContextValue = {
  session: StoredSession | null;
  /** False until the stored session has been read off the device. Screens must
   * not decide "signed out" before this flips, or a returning user sees the
   * login screen flash on every cold start. */
  ready: boolean;
  signIn: (credentials: Credentials) => Promise<string | null>;
  signUp: (credentials: Credentials) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/**
 * Mirrors the module-level session store into React state.
 *
 * The store is the source of truth (see ./session on why); this exists so the
 * UI re-renders when the session changes, and so sign-in and sign-up have one
 * place that maps a backend status onto a translated message.
 */
export function AuthProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [session, setLocalSession] = useState<StoredSession | null>(getSession);
  const [ready, setReady] = useState(isHydrated);

  useEffect(() => {
    const unsubscribe = subscribe(setLocalSession);
    if (!isHydrated()) {
      void hydrate().finally(() => setReady(true));
    }
    return unsubscribe;
  }, []);

  const authenticate = useCallback(
    async (path: "/api/auth/login" | "/api/auth/register", credentials: Credentials) => {
      const messages = authMessages[locale];
      const body =
        path === "/api/auth/register"
          ? {
              email: credentials.email,
              password: credentials.password,
              displayName: credentials.displayName?.trim() || undefined,
            }
          : { email: credentials.email, password: credentials.password };

      try {
        const { data, response } = await createWeatherApiClient({ baseUrl: API_BASE_URL }).POST(
          path,
          { body },
        );

        if (!data) {
          if (response.status === 401) return messages.invalidCredentials;
          if (response.status === 409) return messages.emailTaken;
          if (response.status === 400) return messages.invalidInput;
          return messages.failed;
        }

        await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return null;
      } catch {
        return messages.failed;
      }
    },
    [locale],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      signIn: (credentials) => authenticate("/api/auth/login", credentials),
      signUp: (credentials) => authenticate("/api/auth/register", credentials),
      signOut: endSession,
    }),
    [session, ready, authenticate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
