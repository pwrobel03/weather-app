import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectAlertSocket, type IncomingAlert } from "../src/lib/realtime/socket";

/**
 * The alert socket, tested for the behaviour that only shows up over time:
 * reconnecting, backing off, and not reconnecting when there is nothing to
 * reconnect as.
 *
 * A phone loses this socket constantly - tunnels, lifts, the screen locking -
 * so the reconnect path runs far more often than the happy path, and a bug in
 * it means warnings silently stop arriving rather than anything visibly
 * breaking.
 */
class FakeSocket {
  static instances: FakeSocket[] = [];

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Simulates the connection dropping from the other end. */
  drop() {
    this.onclose?.();
  }

  deliver(alert: IncomingAlert) {
    this.onmessage?.({ data: JSON.stringify(alert) });
  }
}

const ALERT: IncomingAlert = {
  id: 42,
  event: "Silny wiatr",
  severity: "2",
  matchedLocations: ["Warszawa"],
};

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("connectAlertSocket", () => {
  it("passes the token in the query string, since the API allows no headers", () => {
    const dispose = connectAlertSocket({ getToken: () => "tok en", onAlert: () => {} });

    expect(FakeSocket.instances[0]?.url).toContain("/api/ws/alerts?token=tok%20en");
    dispose();
  });

  it("delivers parsed alerts and survives a payload it cannot parse", () => {
    const onAlert = vi.fn();
    const dispose = connectAlertSocket({ getToken: () => "token", onAlert });

    const socket = FakeSocket.instances[0]!;
    socket.onmessage?.({ data: "not json" });
    socket.deliver(ALERT);

    expect(onAlert).toHaveBeenCalledExactlyOnceWith(ALERT);
    // A bad frame must not take the connection down with it.
    expect(socket.closed).toBe(false);
    dispose();
  });

  it("reconnects with exponential backoff, and reads the token again each time", async () => {
    const tokens = ["first", "second", "third"];
    let index = 0;
    const dispose = connectAlertSocket({
      getToken: () => tokens[index++],
      onAlert: () => {},
    });

    FakeSocket.instances[0]!.drop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    // A reconnect after a long background may need a token that did not exist
    // when the first connection was opened.
    expect(FakeSocket.instances[1]!.url).toContain("token=second");

    FakeSocket.instances[1]!.drop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances, "backoff should have doubled to 2s").toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(3);

    dispose();
  });

  it("resets the backoff once a connection succeeds", async () => {
    const dispose = connectAlertSocket({ getToken: () => "token", onAlert: () => {} });

    FakeSocket.instances[0]!.drop();
    await vi.advanceTimersByTimeAsync(1000);

    // A long-lived connection that later drops must retry after 1s again, not
    // after however long the last outage had grown the delay to.
    FakeSocket.instances[1]!.onopen?.();
    FakeSocket.instances[1]!.drop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(FakeSocket.instances).toHaveLength(3);
    dispose();
  });

  it("does not connect or retry without a session", async () => {
    const dispose = connectAlertSocket({ getToken: () => undefined, onAlert: () => {} });

    await vi.advanceTimersByTimeAsync(60_000);

    // Signed out is a door closed on purpose; a retry loop here would hammer
    // the backend for every visitor who never logs in.
    expect(FakeSocket.instances).toHaveLength(0);
    dispose();
  });

  it("stops reconnecting once disposed", async () => {
    const dispose = connectAlertSocket({ getToken: () => "token", onAlert: () => {} });

    const socket = FakeSocket.instances[0]!;
    dispose();
    socket.drop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeSocket.instances).toHaveLength(1);
    expect(socket.closed).toBe(true);
  });
});
