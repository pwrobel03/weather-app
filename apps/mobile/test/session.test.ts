import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizedClient,
  endSession,
  refreshAccessToken,
  setSession,
} from "../src/lib/auth/session";
import { __reset } from "./stubs/expo-secure-store";

/**
 * The session layer, tested at the two points where it is genuinely easy to
 * get wrong: renewing a token, and retrying the request that discovered it was
 * stale.
 *
 * Both failure modes here are silent in normal use. A duplicated refresh only
 * bites when two requests race, and a retry that loses its body only bites on
 * a POST - which is to say, only when saving a location, which is only done by
 * a signed-in user, which is only most of the app.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  __reset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await setSession({ accessToken: "access-1", refreshToken: "refresh-1" });
});

afterEach(async () => {
  await endSession();
  vi.unstubAllGlobals();
});

describe("refreshAccessToken", () => {
  it("collapses concurrent refreshes into one request", async () => {
    // Each refresh rotates the refresh token server-side. Two in flight means
    // the second invalidates the first, and whichever request loses the race
    // signs the user out for no reason they could ever describe.
    fetchMock.mockResolvedValue(json({ accessToken: "access-2", refreshToken: "refresh-2" }));

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["access-2", "access-2", "access-2"]);
  });

  it("keeps the session when the network fails", async () => {
    // Offline is not proof the session is dead. Signing someone out because
    // they walked into a lift is its own bug.
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    expect(await refreshAccessToken()).toBeNull();

    fetchMock.mockResolvedValue(json({ accessToken: "access-2", refreshToken: "refresh-2" }));
    expect(await refreshAccessToken()).toBe("access-2");
  });

  it("ends the session when the backend rejects the refresh token", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid" }, 401));

    expect(await refreshAccessToken()).toBeNull();
    // Second attempt has no token left to send.
    expect(await refreshAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("authorizedClient", () => {
  it("signs requests with the access token", async () => {
    fetchMock.mockResolvedValue(json([]));

    await authorizedClient().GET("/api/users/me/locations");

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("refreshes once on a 401 and replays the request with its body intact", async () => {
    fetchMock
      // Reads the body, as a real fetch does. Without that the original
      // Request stays unconsumed and the missing-clone bug hides here.
      .mockImplementationOnce(async (request: Request) => {
        await request.text();
        return json({ error: "expired" }, 401);
      })
      .mockResolvedValueOnce(json({ accessToken: "access-2", refreshToken: "refresh-2" }))
      .mockResolvedValueOnce(json({ id: 7, name: "Warszawa" }, 201));

    const { data } = await authorizedClient().POST("/api/users/me/locations", {
      body: { name: "Warszawa", latitude: 52.2297, longitude: 21.0122 },
    });

    expect(data).toMatchObject({ id: 7 });

    const replay = fetchMock.mock.calls[2]?.[0] as Request;
    expect(replay.headers.get("Authorization")).toBe("Bearer access-2");
    // The original Request was consumed by the first fetch; without the clone
    // taken before sending, this body is empty and the backend 400s.
    expect(await replay.json()).toMatchObject({ name: "Warszawa" });
  });

  it("does not retry forever when the session is genuinely gone", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "expired" }, 401))
      .mockResolvedValueOnce(json({ accessToken: "access-2", refreshToken: "refresh-2" }))
      .mockResolvedValueOnce(json({ error: "expired" }, 401));

    const { response } = await authorizedClient().GET("/api/users/me/locations");

    expect(response.status).toBe(401);
    // One original, one refresh, one replay - the replay uses plain fetch so it
    // cannot re-enter the middleware.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
