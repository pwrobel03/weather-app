import { useQuery } from "@tanstack/react-query";
import { alertUiMessages, appMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { Link } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocale } from "../src/lib/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PowiatMap } from "../src/components/powiat-map";
import { fetchActiveAlerts } from "../src/lib/alerts";
import { fetchPowiatBoundaries } from "../src/lib/boundaries";
import { useAuth } from "../src/lib/auth/context";
import { fetchSavedLocations } from "../src/lib/saved-locations";

/**
 * Which of the user's places are under a warning, as one picture.
 *
 * Scoped to the user rather than to the country, unlike the web map. A phone
 * screen showing 380 powiats gives each of them a few pixels; the question
 * someone opens this for is about the handful they actually watch, plus
 * whatever is warning near them.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const labels = alertUiMessages[locale];
  const messages = appMessages[locale];
  const { session } = useAuth();

  const saved = useQuery({
    queryKey: ["saved-locations"],
    queryFn: fetchSavedLocations,
    enabled: Boolean(session),
  });

  const alerts = useQuery({
    queryKey: ["active-alerts"],
    queryFn: fetchActiveAlerts,
    enabled: Boolean(session),
  });

  const severityByTeryt: Record<string, "1" | "2" | "3"> = {};
  for (const alert of alerts.data ?? []) {
    for (const terytCode of alert.terytCodes) {
      const current = severityByTeryt[terytCode];
      // A powiat can sit under several warnings; show the worst.
      if (!current || Number(alert.severity) > Number(current)) {
        severityByTeryt[terytCode] = alert.severity;
      }
    }
  }

  // The user's own powiats, plus every powiat under a warning that reached
  // them. Saved locations resolved before the TERYT backfill have no code yet.
  const terytCodes = [
    ...new Set([
      ...(saved.data ?? []).map((location) => location.terytCode).filter(Boolean),
      ...Object.keys(severityByTeryt),
    ]),
  ] as string[];

  const boundaries = useQuery({
    queryKey: ["boundaries", terytCodes.join(",")],
    queryFn: () => fetchPowiatBoundaries(terytCodes),
    enabled: terytCodes.length > 0,
    // Administrative boundaries do not change while the app is open, and the
    // backend serves them with a day-long cache for the same reason.
    staleTime: Infinity,
  });

  return (
    <ScrollView
      className="flex-1 bg-tlo"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
        gap: 16,
      }}
    >
      <Link href="/" className="text-sm text-tekst-muted">
        ← {messages.back}
      </Link>
      <Text className="text-3xl font-bold text-tekst">{labels.warnings}</Text>

      {boundaries.isFetching ? (
        <ActivityIndicator color="#8A94A6" accessibilityLabel={messages.loading} />
      ) : (
        <View className="rounded-3xl bg-powierzchnia/40 p-4">
          <PowiatMap
            features={boundaries.data ?? []}
            severityByTeryt={severityByTeryt}
            locale={locale}
            emptyLabel={session ? messages.noSavedPlaces : labels.signInToSeeWarnings}
          />
        </View>
      )}
    </ScrollView>
  );
}
