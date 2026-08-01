"use client";

import { appMessages, DEFAULT_LOCALE, type Locale } from "@weather-app/core";
import { useEffect, useState } from "react";

/**
 * Registers the offline cache, and says so when the page is coming from it.
 *
 * The registration and the banner live together because they are one feature:
 * a worker that serves a stale page without saying it is stale would be worse
 * than no worker at all. This page can hold a warning that has since expired,
 * and the timestamp is the only thing standing between "cached" and "wrong".
 *
 * Nothing renders while the network is up, which is the common case - so this
 * costs a listener and no layout.
 */
export function OfflineBanner({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Failure here is not worth surfacing: the app works without it, and the
      // one thing lost is a page the user cannot reach anyway when offline.
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    // navigator.onLine is only trustworthy in the negative - "true" can mean a
    // connection to a router that reaches nothing - and the negative is
    // precisely what this asks.
    const sync = () => setOffline(!navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!offline || !("caches" in window)) return;

    let cancelled = false;
    void caches
      .match(location.href)
      .then((response) => {
        const stamp = response?.headers.get("x-cached-at");
        if (!cancelled && stamp) setCachedAt(stamp);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [offline]);

  if (!offline) return null;

  const messages = appMessages[locale];
  const time = cachedAt
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(cachedAt),
      )
    : null;

  return (
    <div
      role="status"
      // Polite, not assertive: losing signal is worth knowing and never worth
      // interrupting whatever is being read.
      aria-live="polite"
      // The severity scale is reserved for warnings (design.md §3), and losing
      // signal is not one. A neutral surface with a border says "a condition
      // applies" without borrowing the vocabulary that means "a storm is
      // coming".
      className="sticky top-0 z-50 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border bg-muted px-4 py-2 text-sm"
    >
      <span className="font-semibold">{messages.offlineTitle}</span>
      {time && <span className="text-muted-foreground">{messages.offlineAsOf(time)}</span>}
    </div>
  );
}
