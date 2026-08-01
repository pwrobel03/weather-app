import { alertUiMessages, authMessages, type Locale } from "@weather-app/core";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { ActiveAlert } from "../lib/alerts";
import { AlertEntry } from "./alert-entry";

/**
 * Warnings in force for the user's saved places.
 *
 * Collapses to a single line when there is nothing to report. That is the rule
 * apps/web settled on after measuring the home screen: a quiet warnings panel
 * holding a large empty box is the loudest thing on screen, and it is loud
 * about nothing.
 */
export function AlertsTile({
  alerts,
  authenticated,
  locale,
  now = new Date(),
}: {
  alerts: ActiveAlert[];
  authenticated: boolean;
  locale: Locale;
  now?: Date;
}) {
  const labels = alertUiMessages[locale];

  if (!authenticated) {
    return (
      <View className="gap-2">
        <Text className="text-sm text-tekst-muted">{labels.signInToSeeWarnings}</Text>
        <Link href="/login" className="text-sm font-semibold text-primary">
          {authMessages[locale].signIn}
        </Link>
      </View>
    );
  }

  if (alerts.length === 0) {
    return <Text className="text-sm text-tekst-muted">{labels.noActiveWarnings}</Text>;
  }

  return (
    <View className="gap-2">
      {alerts.map((alert) => (
        <Link key={alert.id} href={{ pathname: "/alerts/[id]", params: { id: alert.id } }} asChild>
          {/* Pressable, not View: `asChild` hands the press handler to its
              child, and a View has nowhere to put one. */}
          <Pressable className="active:opacity-80">
            <AlertEntry alert={alert} locale={locale} now={now} />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
