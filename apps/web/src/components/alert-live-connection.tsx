"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { alertMessages, type Locale } from "@weather-app/core";

type IncomingAlert = {
  id: number;
  event: string;
  severity: "1" | "2" | "3";
  matchedLocations: string[];
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * Live warning delivery over the backend's WebSocket (commit 48).
 *
 * Renders nothing until a warning arrives. On arrival it announces the warning
 * to assistive technology and refreshes the server components, so the alert
 * tile and the takeover layer pick it up through their normal data path rather
 * than this component duplicating their rendering.
 *
 * Reconnects with exponential backoff. That is not just resilience: the server
 * runs as a single instance (follow-up.md point 4), so a deploy drops every
 * socket at once, and the backend replays anything missed on reconnect
 * (commit 50).
 */
export function AlertLiveConnection({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [latest, setLatest] = useState<IncomingAlert | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      if (disposed) return;

      let token: string;
      try {
        const response = await fetch("/api/ws-ticket");
        if (!response.ok) {
          // Anonymous, or the session expired. Nothing to listen to; a retry
          // loop here would hammer the endpoint for a signed-out visitor.
          return;
        }
        ({ token } = await response.json());
      } catch {
        scheduleRetry();
        return;
      }

      if (disposed) return;

      const base = window.location.origin.replace(/^http/, "ws");
      const socket = new WebSocket(`${base}/api/ws/alerts?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attempt = 0;
      });

      socket.addEventListener("message", (event) => {
        try {
          const alert = JSON.parse(event.data as string) as IncomingAlert;
          setLatest(alert);
          // The tiles and the takeover read from the server; refreshing lets
          // them update through their own path instead of being mirrored here.
          router.refresh();
        } catch {
          // A payload we cannot parse is not worth breaking the connection for.
        }
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        scheduleRetry();
      });
    }

    function scheduleRetry() {
      if (disposed) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    }

    void connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, [router]);

  const messages = alertMessages[locale];

  return (
    // Always in the tree so assistive technology has a stable region to watch;
    // a live region added at the same moment as its content is often missed.
    <div
      // role="alert" rather than role="status" with aria-live overridden: the
      // two say opposite things about urgency, and a screen reader given a
      // contradiction is a screen reader whose behaviour depends on which one
      // it happens to honour. A warning interrupts.
      role="alert"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {latest && (
        <p
          className="pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm shadow-lg"
          // Opaque, like every other alert surface (design.md §4).
          style={{ background: "var(--dt-color-alert-material)", color: "#E8ECF2" }}
        >
          <TriangleAlert
            aria-hidden="true"
            className="size-4 shrink-0"
            style={{ color: `var(--dt-color-warning-${latest.severity})` }}
          />
          <span>
            <strong className="font-semibold">{latest.event}</strong>
            {" · "}
            {messages.severityLabel[latest.severity]}
            {latest.matchedLocations.length > 0 && ` · ${latest.matchedLocations.join(", ")}`}
          </span>
        </p>
      )}
    </div>
  );
}
