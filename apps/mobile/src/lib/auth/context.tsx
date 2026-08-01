import { useQueryClient } from "@tanstack/react-query";
import { createWeatherApiClient } from "@weather-app/api-client";
import { authMessages } from "@weather-app/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../api";
import { useLocale } from "../locale";
import {
  endSession,
  getSession,
  refreshAccessToken,
  hydrate,
  isHydrated,
  setSession,
  startAnonymousSession,
  subscribe,
} from "./session";
import type { StoredSession } from "./storage";

type Credentials = { email: string; password: string; displayName?: string };

type AuthContextValue = {
  session: StoredSession | null;
  /**
   * Whether this device belongs to an account, as opposed to the anonymous
   * user every install gets. `session` is now almost always present, so it no
   * longer answers "is this person signed in?".
   */
  registered: boolean;
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
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Read here rather than passed in: the messages this maps backend statuses
  // onto have to follow the language the user picked, and threading it through
  // the layout would just be the same context read one level higher.
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [session, setLocalSession] = useState<StoredSession | null>(getSession);
  const [ready, setReady] = useState(isHydrated);

  useEffect(() => {
    const unsubscribe = subscribe(setLocalSession);
    if (!isHydrated()) {
      void hydrate()
        // No session on the device means a fresh install, so it gets one
        // before anything asks for it - saving a place and receiving a warning
        // both need a user, and neither should wait for a sign-up.
        .then((stored) => (stored ? stored : startAnonymousSession()))
        .finally(() => setReady(true));
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
        // Sent with the device's own session when it has one. That is what
        // lets the backend register *this* user instead of creating a second,
        // and lets a sign-in fold the places saved here into the account.
        //
        // Renewed first, and that is the whole point rather than caution: an
        // access token lives fifteen minutes, the backend ignores an expired
        // one without complaint, and the request then looks like it came from
        // nobody - so the merge quietly does not happen and the places stay
        // stranded on a user the device is about to stop being. Anyone who
        // installs the app, saves a place and signs in later than that hits it.
        const stored = getSession();
        const token = stored ? ((await refreshAccessToken()) ?? stored.accessToken) : undefined;
        const { data, response } = await createWeatherApiClient({ baseUrl: API_BASE_URL }).POST(
          path,
          {
            body,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );

        if (!data) {
          if (response.status === 401) return messages.invalidCredentials;
          if (response.status === 409) return messages.emailTaken;
          if (response.status === 400) return messages.invalidInput;
          return messages.failed;
        }

        await setSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          anonymous: false,
        });

        // Everything cached belongs to whoever this device was a moment ago.
        // The query keys carry no user - `["saved-locations"]` is the same key
        // for every account - so without this the account's places do not
        // appear until something happens to refetch them, which in practice
        // meant closing and reopening the app.
        queryClient.clear();
        return null;
      } catch {
        return messages.failed;
      }
    },
    [locale, queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      registered: session !== null && !session.anonymous,
      ready,
      signIn: (credentials) => authenticate("/api/auth/login", credentials),
      signUp: (credentials) => authenticate("/api/auth/register", credentials),
      // Signing out hands the device back to a *new* anonymous user rather
      // than leaving it with none. Without that, the app would be left unable
      // to save a place or receive a warning until someone signed in again -
      // less capable after signing out than it was on first install.
      signOut: async () => {
        await endSession();
        await startAnonymousSession();
        // Same reason as after signing in: the cache still holds the account's
        // places, profile and warnings.
        queryClient.clear();
      },
    }),
    [session, ready, authenticate, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
