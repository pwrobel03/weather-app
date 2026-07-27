import { API_BASE_URL } from "../api";

export type IncomingAlert = {
  id: number;
  event: string;
  severity: "1" | "2" | "3";
  matchedLocations: string[];
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

type Options = {
  /** Read fresh on every attempt - a reconnect after a long background may
   * need a token that did not exist when the connection was first opened. */
  getToken: () => string | undefined;
  onAlert: (alert: IncomingAlert) => void;
};

/**
 * Live warning delivery over the backend's WebSocket (commit 48).
 *
 * Reconnects with exponential backoff. That is not only resilience: the
 * backend runs as a single instance (follow-up.md point 4), so a deploy drops
 * every socket at once, and anything missed is replayed on reconnect
 * (commit 50). On a phone the same path covers coming back from a tunnel or a
 * lift, which happens far more often than a deploy.
 *
 * The token goes in the query string because the WebSocket API allows no
 * custom headers, so the backend reads it from there. Same trade-off apps/web
 * documents at its ws-ticket route, with the same bound: it is the 15-minute
 * access token, never the refresh token. The proper fix is a single-use ticket
 * exchanged at handshake time, an open item from the Faza 5 review.
 */
export function connectAlertSocket({ getToken, onAlert }: Options): () => void {
  let disposed = false;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleRetry() {
    if (disposed) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    attempt += 1;
    retryTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (disposed) return;

    const token = getToken();
    if (!token) {
      // Signed out. Retrying would be a loop against a door that is closed on
      // purpose; the caller reconnects when a session appears.
      return;
    }

    const base = API_BASE_URL.replace(/^http/, "ws");
    socket = new WebSocket(`${base}/api/ws/alerts?token=${encodeURIComponent(token)}`);

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = (event) => {
      try {
        onAlert(JSON.parse(String(event.data)) as IncomingAlert);
      } catch {
        // A payload we cannot parse is not worth dropping the connection for.
      }
    };

    socket.onclose = () => {
      socket = null;
      scheduleRetry();
    };

    // Without a handler, React Native logs an unhandled socket error as a
    // redbox in development. onclose follows and drives the retry.
    socket.onerror = () => {};
  }

  connect();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
