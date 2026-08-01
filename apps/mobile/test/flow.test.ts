import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { API_BASE_URL } from "../src/lib/api";
import { endSession, getSession, setSession } from "../src/lib/auth/session";
import { findAlertById, fetchActiveAlerts } from "../src/lib/alerts";
import { createSavedLocation, fetchSavedLocations, searchLocations } from "../src/lib/saved-locations";
import { __reset } from "./stubs/expo-secure-store";

/**
 * The Faza 7 checkpoint, as far as it can be driven without a browser: sign
 * in, find a town, save it, and see the warning that covers it.
 *
 * Run against a modelled backend rather than a real one for one specific
 * reason: the last step is "a warning arrives", and that cannot be made to
 * happen on demand against a live stack - IMGW would have to be issuing one.
 * The trade-off is stated in the commit: this cannot catch a contract change
 * on the backend, which the generated client and the backend's own tests
 * cover instead.
 */
const state = {
  saved: [] as { id: number; userId: number; name: string; latitude: number; longitude: number }[],
  nextId: 1,
  alerts: [] as unknown[],
};

const ALERT = {
  id: 900,
  event: "Silny wiatr",
  severity: "2",
  validFrom: "2026-07-27T12:00:00Z",
  validTo: "2026-07-27T22:00:00Z",
  terytCodes: ["1465"],
  affectedLocations: [{ id: 1, name: "Warszawa" }],
  content: "Prognozuje się wystąpienie silnego wiatru.",
};

const authed = (request: Request) => request.headers.get("Authorization") === "Bearer access-1";

const server = setupServer(
  http.post(`${API_BASE_URL}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== "correct-horse") {
      return HttpResponse.json({ error: "bad credentials" }, { status: 401 });
    }
    return HttpResponse.json({ accessToken: "access-1", refreshToken: "refresh-1" });
  }),

  http.get(`${API_BASE_URL}/api/locations/search`, ({ request }) => {
    const query = new URL(request.url).searchParams.get("query") ?? "";
    return HttpResponse.json(
      query.toLowerCase().startsWith("wars")
        ? [{ id: 756135, name: "Warszawa", latitude: 52.2297, longitude: 21.0122, admin1: "Mazowieckie" }]
        : [],
    );
  }),

  http.get(`${API_BASE_URL}/api/users/me/locations`, ({ request }) =>
    authed(request)
      ? HttpResponse.json(state.saved)
      : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
  ),

  http.post(`${API_BASE_URL}/api/users/me/locations`, async ({ request }) => {
    if (!authed(request)) return HttpResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = (await request.json()) as { name: string; latitude: number; longitude: number };
    if (state.saved.some((location) => location.name === body.name)) {
      return HttpResponse.json({ error: "duplicate" }, { status: 409 });
    }

    const created = { id: state.nextId++, userId: 1, ...body };
    state.saved.push(created);
    // The backend matches warnings already in force the moment a location is
    // saved (commit 38 follow-up) - without that, adding a place during a
    // storm shows nothing until the next ingest.
    state.alerts = [ALERT];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${API_BASE_URL}/api/alerts/active`, ({ request }) =>
    authed(request)
      ? HttpResponse.json(state.alerts)
      : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
  ),

  http.get(`${API_BASE_URL}/api/users/me/locations/:id/alerts`, ({ request }) =>
    authed(request)
      ? HttpResponse.json([ALERT])
      : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(async () => {
  __reset();
  await endSession();
  state.saved = [];
  state.nextId = 1;
  state.alerts = [];
});

afterEach(() => server.resetHandlers());

async function signIn(password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "someone@example.com", password }),
  });
  if (!response.ok) return false;

  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  await setSession({ ...tokens, anonymous: false });
  return true;
}

describe("sign in, save a place, see its warning", () => {
  it("walks the whole checkpoint", async () => {
    expect(await signIn("correct-horse")).toBe(true);
    expect(getSession()?.accessToken).toBe("access-1");

    const results = await searchLocations("Warszawa");
    expect(results).toHaveLength(1);

    const saved = await createSavedLocation(
      results[0]!.name,
      results[0]!.latitude,
      results[0]!.longitude,
    );
    expect(saved).toEqual({ ok: true });
    expect(await fetchSavedLocations()).toHaveLength(1);

    // The point of the whole application: the place is saved, so the warning
    // covering it is now the user's warning.
    const active = await fetchActiveAlerts();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ id: 900, severity: "2" });
  });

  it("reports a duplicate rather than silently saving twice", async () => {
    await signIn("correct-horse");
    await createSavedLocation("Warszawa", 52.2297, 21.0122);

    expect(await createSavedLocation("Warszawa", 52.2297, 21.0122)).toEqual({
      ok: false,
      status: 409,
    });
  });

  it("shows nothing to someone who is not signed in, instead of failing", async () => {
    // Every one of these is a 401 underneath. A home screen that renders
    // nothing because the alert query threw is worse than one showing the
    // forecast and no warnings.
    expect(await fetchActiveAlerts()).toEqual([]);
    expect(await fetchSavedLocations()).toEqual([]);
  });

  it("wrong password leaves no session behind", async () => {
    expect(await signIn("hunter2")).toBe(false);
    expect(getSession()).toBeNull();
  });
});

describe("findAlertById", () => {
  it("falls back to a location's history for a warning that has expired", async () => {
    await signIn("correct-horse");
    await createSavedLocation("Warszawa", 52.2297, 21.0122);
    // The warning stopped being active between the push notification arriving
    // and the user opening it - the tap must still land on the warning.
    state.alerts = [];

    expect(await findAlertById(900)).toMatchObject({ id: 900 });
  });

  it("returns null for an id that is not the caller's to see", async () => {
    await signIn("correct-horse");
    await createSavedLocation("Warszawa", 52.2297, 21.0122);

    expect(await findAlertById(12345)).toBeNull();
  });
});
