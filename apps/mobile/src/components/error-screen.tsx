import { appMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { Pressable, Text, View } from "react-native";

/**
 * What a screen becomes when its render throws.
 *
 * Exported from the root layout as expo-router's `ErrorBoundary`, so a failure
 * anywhere in the tree lands here instead of on a red box in development and a
 * white screen in production. Phase 9.5 produced three of these in one
 * afternoon - a missing Intl API, a fetch that failed an instanceof check - and
 * every one of them showed as nothing at all.
 *
 * `retry` remounts the segment. That is enough for the failures actually seen
 * so far, all of which were a render reading data that arrived in an
 * unexpected shape rather than a permanently broken screen.
 *
 * The default locale, deliberately: the boundary sits above the provider that
 * knows the chosen one, and a boundary that can itself throw is not a boundary.
 */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  const messages = appMessages[DEFAULT_LOCALE];

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-tlo px-8">
      <Text className="text-center text-base font-semibold text-tekst">
        {messages.forecastUnavailable}
      </Text>

      {__DEV__ && (
        // Only in a development build. In a shipped app the message is a stack
        // frame to the person reading it, which is noise dressed as detail.
        <Text className="text-center text-xs text-tekst-muted">{error.message}</Text>
      )}

      <Pressable
        onPress={retry}
        accessibilityRole="button"
        className="rounded-xl border border-linia/20 bg-powierzchnia px-5 py-2.5 active:opacity-70"
      >
        <Text className="text-sm font-semibold text-tekst">{messages.retry}</Text>
      </Pressable>
    </View>
  );
}
