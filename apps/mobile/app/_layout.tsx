import "../global.css";
// Side-effect import, next to the stylesheet it belongs with: it has to run
// before any screen renders a Link.
import "../src/lib/link-styling";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { tokens } from "@weather-app/design-tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorScreen } from "../src/components/error-screen";
import { ActiveLocationProvider } from "../src/lib/active-location";
import { CACHE_VERSION, MAX_AGE_MS, persister, shouldPersist } from "../src/lib/offline-cache";
import { LocaleProvider } from "../src/lib/locale";
import { ThemeProvider } from "../src/lib/theme";
import { holdSplash } from "../src/lib/splash";
import { AuthProvider } from "../src/lib/auth/context";

// One deprecation warning, raised from inside react-native-draggable-flatlist
// and not actionable from here. Silenced by its exact text rather than
// wholesale, so anything of ours still shows up.
LogBox.ignoreLogs(["InteractionManager has been deprecated"]);

// At module scope, before any screen mounts: the native splash has to be
// claimed before React gets a chance to draw over it.
holdSplash();

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
function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

/**
 * expo-router renders this instead of the tree when a screen throws.
 *
 * Named exactly `ErrorBoundary` because that is the contract - renaming it
 * silently reverts to the default white screen.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}

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
            // Longer than staleTime and shorter than the persisted maximum: a
            // query dropped from memory before it is written out cannot be
            // restored, so this is what makes the disk copy reachable at all.
            gcTime: MAX_AGE_MS,
          },
        },
      }),
  );

  return (
    // Gesture handling needs a root of its own; without it a pan gesture never
    // reaches the component that declared it.
    // Background on the root view, not only on the stack's screens: between the
    // splash going and the first screen painting there is a frame of the root
    // view alone, and React Native paints that white by default - the exact
    // flash the splash exists to prevent.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.colors.tloCiemne }}>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: MAX_AGE_MS,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      <ThemeProvider>
      <LocaleProvider>
      <AuthProvider>
        <ActiveLocationProvider>
          <SafeAreaProvider>
            {/* Follows the theme, because most screens are now a themed
                surface. The home screen overrides it back to light: its top is
                the hero, which is dark whatever the theme says. */}
            <ThemedStatusBar />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: tokens.colors.tloCiemne },
              }}
            />
          </SafeAreaProvider>
        </ActiveLocationProvider>
      </AuthProvider>
      </LocaleProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
