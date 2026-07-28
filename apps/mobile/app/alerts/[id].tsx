import { useQuery } from "@tanstack/react-query";
import { alertUiMessages, appMessages, authMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocale } from "../../src/lib/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertEntry } from "../../src/components/alert-entry";
import { findAlertById } from "../../src/lib/alerts";
import { useAuth } from "../../src/lib/auth/context";

/**
 * One warning in full - IMGW's own text, its validity, the places it covers.
 *
 * This is where a push notification lands, so it has to hold up for a warning
 * that expired between the notification arriving and the user opening it: the
 * entry dims rather than disappearing, because "this is over" is an answer and
 * an empty screen is not.
 */
export default function AlertDetailScreen() {
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const labels = alertUiMessages[locale];
  const { session, ready } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alertId = Number(id);

  const alert = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => findAlertById(alertId),
    enabled: Number.isInteger(alertId) && Boolean(session),
  });

  return (
    <ScrollView
      className="flex-1 bg-tlo-ciemne"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
        gap: 20,
      }}
    >
      <Link href="/" className="text-sm text-tekst-muted">
        ← {appMessages[locale].back}
      </Link>

      {ready && !session ? (
        <View className="gap-3">
          <Text className="text-2xl font-bold text-tekst">{labels.warning}</Text>
          <Link href="/login" className="text-base font-semibold text-primary">
            {authMessages[locale].signIn}
          </Link>
        </View>
      ) : alert.isPending ? (
        <ActivityIndicator color="#8A94A6" />
      ) : alert.data ? (
        <>
          <AlertEntry alert={alert.data} locale={locale} now={new Date()} detailed />
          <Text className="text-xs text-tekst-muted">{labels.disclaimer}</Text>
        </>
      ) : (
        <Text className="text-sm text-tekst-muted">{labels.notFound}</Text>
      )}
    </ScrollView>
  );
}
