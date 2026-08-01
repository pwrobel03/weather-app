"use client";

import { appMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * What the page becomes when the backend is not there.
 *
 * The home screen awaits the forecast server-side, so an upstream that is down
 * throws during render and, without this, Next's own error page takes over -
 * a screen with no way back other than the browser's reload button.
 *
 * `reset()` re-runs the segment rather than reloading the document, which is
 * the difference between "try again" and "start over": a transient failure
 * recovers without losing the rest of the page.
 *
 * Locale is the default here, deliberately. Reading it would mean reaching for
 * a cookie in a boundary that exists precisely because something upstream is
 * broken - see roadmap 110 for where this stops being a compromise.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept until commit 120 gives it somewhere to go. The digest is the only
    // handle on the server-side stack, which the client is never shown.
    console.error("page failed to render", error.digest, error);
  }, [error]);

  const messages = appMessages[DEFAULT_LOCALE];

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">{messages.forecastUnavailable}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        {messages.upstreamUnavailable}
      </p>
      <Button onClick={reset}>{messages.retry}</Button>
    </main>
  );
}
