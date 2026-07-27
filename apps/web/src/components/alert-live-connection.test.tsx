import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlertLiveConnection } from "./alert-live-connection";

/**
 * The last step of the Faza 7 checkpoint: a warning arrives and the user sees
 * it without touching anything.
 *
 * This is the one part of that flow that cannot be tested against a real
 * backend, because it depends on IMGW issuing a warning at the moment the test
 * runs. Driving the socket directly is what makes it testable at all.
 */
const refresh = vi.fn();
// One stable object, as Next's own router is. Returning a fresh one per render
// re-runs the connect effect on every state change, which tears the socket
// down and reopens it - a property of the mock, not of the component.
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

class FakeSocket {
  static instances: FakeSocket[] = [];
  static listeners = new WeakMap<FakeSocket, Map<string, ((event: unknown) => void)[]>>();

  closed = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
    FakeSocket.listeners.set(this, new Map());
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    const map = FakeSocket.listeners.get(this)!;
    map.set(type, [...(map.get(type) ?? []), handler]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, event?: unknown) {
    for (const handler of FakeSocket.listeners.get(this)?.get(type) ?? []) handler(event);
  }
}

const ALERT = {
  id: 42,
  event: "Silny wiatr",
  severity: "2" as const,
  matchedLocations: ["Warszawa"],
};

beforeEach(() => {
  refresh.mockClear();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "access-token" }), { status: 200 }),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("AlertLiveConnection", () => {
  it("shows an arriving warning, with its level in words", async () => {
    render(<AlertLiveConnection locale="pl" />);

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    FakeSocket.instances[0]!.emit("message", { data: JSON.stringify(ALERT) });

    expect(await screen.findByText(/Silny wiatr/)).toBeInTheDocument();
    // design.md §3: severity is never carried by colour alone.
    expect(screen.getByText(/Ostrzeżenie 2\. stopnia/)).toBeInTheDocument();
    expect(screen.getByText(/Warszawa/)).toBeInTheDocument();
  });

  it("refreshes the server components so the tiles update through their own path", async () => {
    render(<AlertLiveConnection locale="pl" />);

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    FakeSocket.instances[0]!.emit("message", { data: JSON.stringify(ALERT) });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("exposes a live region before there is anything to announce", () => {
    // A live region added at the same moment as its content is frequently
    // missed by screen readers, so the region has to already be there.
    render(<AlertLiveConnection locale="pl" />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("translates the level for an English reader", async () => {
    render(<AlertLiveConnection locale="en" />);

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    FakeSocket.instances[0]!.emit("message", { data: JSON.stringify(ALERT) });

    expect(await screen.findByText(/Level 2 warning/)).toBeInTheDocument();
  });

  it("does not open a socket for a signed-out visitor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    render(<AlertLiveConnection locale="pl" />);

    // Retrying here would hammer the ticket endpoint for every anonymous
    // visitor on the site.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("survives a frame it cannot parse", async () => {
    render(<AlertLiveConnection locale="pl" />);

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances[0]!;
    socket.emit("message", { data: "<html>gateway error</html>" });
    socket.emit("message", { data: JSON.stringify(ALERT) });

    expect(await screen.findByText(/Silny wiatr/)).toBeInTheDocument();
    expect(socket.closed).toBe(false);
  });
});
