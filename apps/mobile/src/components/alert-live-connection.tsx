import { useQueryClient } from "@tanstack/react-query";
import { alertMessages, type Locale } from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../lib/auth/context";
import { registerForPushNotifications } from "../lib/realtime/push";
import { connectAlertSocket, type IncomingAlert } from "../lib/realtime/socket";
import { getSession } from "../lib/auth/session";

/**
 * Live warning delivery, plus the push registration that covers the app being
 * closed.
 *
 * Renders nothing until a warning arrives. On arrival it invalidates the alert
 * queries so the tiles update through their own data path rather than this
 * component mirroring their rendering, and shows a tappable banner.
 *
 * The two channels are deliberately not merged: the socket is instant but only
 * exists in the foreground, which is when a warning matters least. Push is the
 * one that wakes someone at 3am, which is the reason this app exists.
 */
export function AlertLiveConnection({ locale }: { locale: Locale }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [latest, setLatest] = useState<IncomingAlert | null>(null);

  useEffect(() => {
    if (!session) return;

    return connectAlertSocket({
      getToken: () => getSession()?.accessToken,
      onAlert: (alert) => {
        setLatest(alert);
        void queryClient.invalidateQueries({ queryKey: ["active-alerts"] });

        // Spoken as well as shown. accessibilityRole="alert" on the banner
        // covers a banner that is *rendered into* the tree, but VoiceOver does
        // not reliably re-announce one whose props merely changed - and a
        // second warning arriving over the first is exactly the case that must
        // not pass in silence.
        AccessibilityInfo.announceForAccessibility(
          `${alertMessages[locale].severityLabel[alert.severity]}: ${alert.event}`,
        );
      },
    });
  }, [session, queryClient, locale]);

  useEffect(() => {
    if (!session) return;
    void registerForPushNotifications();
  }, [session]);

  // Tapping a notification opens the warning it is about. The id travels in
  // the payload the dispatcher builds (commit 51), and the route matches
  // apps/web's - which is the whole reason expo-router is here.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response.notification.request.content.data?.alertId;
      if (alertId !== undefined) {
        router.push({ pathname: "/alerts/[id]", params: { id: String(alertId) } });
      }
    });
    return () => subscription.remove();
  }, []);

  if (!latest) return null;

  const messages = alertMessages[locale];

  return (
    <View
      className="absolute inset-x-0 z-50 px-4"
      style={{ bottom: insets.bottom + 16 }}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="alert"
        // Read as one sentence rather than as four fragments. Left to itself
        // the row reads "Silny wiatr", "middot", "Stopien 2" - punctuation
        // announced as a word between the two facts that matter.
        accessible
        accessibilityLabel={[
          messages.severityLabel[latest.severity],
          latest.event,
          latest.matchedLocations.join(", "),
        ]
          .filter(Boolean)
          .join(". ")}
        onPress={() => {
          router.push({ pathname: "/alerts/[id]", params: { id: String(latest.id) } });
          setLatest(null);
        }}
        className="flex-row items-center gap-2 rounded-2xl px-4 py-3 active:opacity-80"
        // Opaque, like every other alert surface (design.md §4).
        style={{ backgroundColor: tokens.colors.alertMaterial }}
      >
        <View
          className="h-full w-1 rounded-full"
          style={{ backgroundColor: tokens.colors[`warning${latest.severity}`] }}
        />
        <Text className="flex-1 text-sm text-tekst">
          <Text className="font-semibold">{latest.event}</Text>
          {" · "}
          {messages.severityLabel[latest.severity]}
          {latest.matchedLocations.length > 0 && ` · ${latest.matchedLocations.join(", ")}`}
        </Text>
      </Pressable>
    </View>
  );
}
