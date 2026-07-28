import { useQuery } from "@tanstack/react-query";
import { alertUiMessages, appMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { Link, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useLocale } from "../../../src/lib/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertEntry } from "../../../src/components/alert-entry";
import { fetchAlertHistory } from "../../../src/lib/alerts";

/**
 * Every warning ever recorded for one saved place, newest first.
 *
 * Expired entries stay, dimmed rather than hidden - the timeline's value is
 * precisely that it shows what has already passed, which is the question
 * someone asks after a storm rather than during one.
 */
export default function LocationAlertsScreen() {
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const labels = alertUiMessages[locale];
  const { id } = useLocalSearchParams<{ id: string }>();
  const locationId = Number(id);

  const history = useQuery({
    queryKey: ["alert-history", locationId],
    queryFn: () => fetchAlertHistory(locationId),
    enabled: Number.isInteger(locationId),
  });

  const now = new Date();

  return (
    <View className="flex-1 bg-tlo" style={{ paddingTop: insets.top + 12 }}>
      <View className="gap-4 px-5 pb-4">
        {/* Back to the list this was opened from. `back()` rather than a
            fixed link so browsing several places' histories in a row returns
            to the list each time, with the saved-places screen as the fallback
            for a deep link that had no list underneath it. */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/locations"))}
          hitSlop={8}
          className="self-start active:opacity-60"
        >
          <Text className="text-sm text-tekst-muted">← {appMessages[locale].back}</Text>
        </Pressable>
        <Text className="text-3xl font-bold text-tekst">{labels.warningHistory}</Text>
      </View>

      <FlatList
        data={history.data ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 8 }}
        ListEmptyComponent={
          history.isPending ? (
            <ActivityIndicator className="mt-6" color="#8A94A6" />
          ) : (
            <Text className="mt-6 text-center text-sm text-tekst-muted">
              {labels.noActiveWarnings}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: "/alerts/[id]", params: { id: item.id } }} asChild>
            <Pressable className="active:opacity-80">
              <AlertEntry alert={item} locale={locale} now={now} />
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
