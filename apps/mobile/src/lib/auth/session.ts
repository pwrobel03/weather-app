import { createWeatherApiClient, type ApiClient } from "@weather-app/api-client";

import { API_BASE_URL } from "../api";
import { clearSession, loadSession, saveSession, type StoredSession } from "./storage";

type Listener = (session: StoredSession | null) => void;

let current: StoredSession | null = null;
let hydrated = false;
const listeners = new Set<Listener>();

/**
 * The session, held in one place outside React.
 *
 * TanStack query functions are plain async functions, not components, so they
 * cannot read a context. Threading a token through every queryKey instead
 * would put a bearer token in the query cache and in devtools output. A module
 * store keeps the token in one place, and the provider in ./context mirrors it
 * into React state for the parts of the UI that need to re-render.
 */
export function getSession(): StoredSession | null {
  return current;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(current);
}

export async function hydrate(): Promise<StoredSession | null> {
  current = await loadSession();
  hydrated = true;
  emit();
  return current;
}

export async function setSession(session: StoredSession): Promise<void> {
  current = session;
  await saveSession(session);
  emit();
}

/**
 * Drops the tokens from the device.
 *
 * Only local state is cleared - the refresh token stays valid in the backend
 * until it expires or is rotated. Revoking it server-side needs an endpoint
 * that does not exist yet; noted rather than silently pretended, same as on
 * web.
 */
export async function endSession(): Promise<void> {
  current = null;
  await clearSession();
  emit();
}

/** Deduplicates concurrent refreshes: several 401s at once must not each
 * rotate the refresh token, which would invalidate the others. */
let inFlightRefresh: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  inFlightRefresh ??= doRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = current?.refreshToken;
  if (!refreshToken) return null;

  try {
    const { data } = await createWeatherApiClient({ baseUrl: API_BASE_URL }).POST(
      "/api/auth/refresh",
      { body: { refreshToken } },
    );

    if (!data) {
      await endSession();
      return null;
    }

    await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    // A transport failure is not proof the session is dead - the phone may
    // simply be offline. Keep the tokens and let the next call try again.
    return null;
  }
}

/**
 * A client that signs requests and renews the session once on a 401.
 *
 * The retry is deliberately single-shot: if the request still comes back
 * unauthorized with a freshly minted token, the session is genuinely gone and
 * retrying again would loop.
 */
export function authorizedClient(): ApiClient {
  const client = createWeatherApiClient({ baseUrl: API_BASE_URL });

  // A Request's body can only be read once, and by the time onResponse runs
  // fetch has consumed it - so the retry cannot reuse the original. The clone
  // is taken while the body is still intact.
  const pristine = new WeakMap<Request, Request>();

  client.use({
    onRequest({ request }) {
      const token = current?.accessToken;
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      pristine.set(request, request.clone());
      return request;
    },
    // Returning nothing means "untouched, use what you already have".
    //
    // Handing the response back instead looks equivalent and is not: openapi-
    // fetch treats any returned value as a replacement and rejects one that
    // fails `instanceof Response` - and React Native's fetch resolves to a
    // Response-*like* object that does exactly that. The request succeeds, the
    // guard throws, and every call through this client fails with
    // "onResponse: must return new Response() when modifying the response".
    async onResponse({ request, response }) {
      if (response.status !== 401) return;

      const token = await refreshAccessToken();
      if (!token) return;

      const original = pristine.get(request) ?? request;
      const retried = new Request(original, { headers: new Headers(original.headers) });
      retried.headers.set("Authorization", `Bearer ${token}`);

      // Plain fetch, not the client: the retry must not re-enter this
      // middleware, or a genuinely dead session would loop.
      const fresh = await fetch(retried);

      // Rebuilt through the global constructor for the same reason as above -
      // this one *is* a replacement, so it has to be a Response the guard
      // recognises. Statuses that forbid a body get none, or the constructor
      // throws on its own.
      const bodyless = fresh.status === 204 || fresh.status === 205 || fresh.status === 304;

      return new Response(bodyless ? null : await fresh.text(), {
        status: fresh.status,
        statusText: fresh.statusText,
        headers: fresh.headers,
      });
    },
  });

  return client;
}
