"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * RSC stays the default (design.md / roadmap Faza 7 intent) - this only
 * exists for client-side interactive fragments (e.g. a manual refresh
 * control) that need their own cache and refetch lifecycle. The page's
 * first paint is still server-rendered; nothing here blocks or replaces that.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Matches the backend's own Cache-Control for /api/forecast/current
            // (commit 16) - refetching client-side sooner than that wouldn't
            // get fresher data anyway, just a cached response.
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
