import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ActiveLocationProvider } from "../src/lib/active-location";
import { AuthProvider } from "../src/lib/auth/context";

/**
 * The app shell.
 *
 * Route names deliberately mirror apps/web's: `/`, `/locations`, `/alerts/[id]`,
 * `/settings`. That is the reason expo-router is here rather than React
 * Navigation - a push notification carries a warning id and has to open that
 * warning on either client, and with matching routes that is one link, not two
 * mappings that can drift.
 *
 * Headers are off across the stack: every screen paints its own gradient to the
 * top edge, and a stack header would sit as an opaque strip on top of it.
 */
export default function RootLayout() {
  // Created once per mount, not at module scope: a module-level client is
  // shared across Fast Refresh reloads and keeps serving a stale cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A forecast an hour old is wrong; one a minute old is not. This
            // stops a screen focus from refetching the whole home screen.
            staleTime: 60_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider locale={DEFAULT_LOCALE}>
        <ActiveLocationProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: tokens.colors.tloCiemne },
              }}
            />
          </SafeAreaProvider>
        </ActiveLocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
