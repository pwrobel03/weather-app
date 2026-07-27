import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appMessages, authMessages, DEFAULT_LOCALE, unitLabels } from "@weather-app/core";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/lib/auth/context";
import { fetchProfile, updatePreferences, type UnitPreferences } from "../src/lib/user";

type UnitField = keyof typeof unitLabels;

/**
 * Unit preferences and signing out.
 *
 * Each control PATCHes only the field it owns, which is why there is no save
 * button: the backend's partial-update semantics (commit 32) make a change
 * atomic per preference, so a failure can only ever lose the one tap that
 * failed rather than silently reverting the other two.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const locale = DEFAULT_LOCALE;
  const messages = appMessages[locale];
  const { session, ready, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    enabled: Boolean(session),
  });

  const save = useMutation({
    mutationFn: (preferences: UnitPreferences) => updatePreferences(preferences),
    onSuccess: (ok) => {
      setError(ok ? null : messages.saveFailedGeneric);
      if (ok) void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => setError(messages.saveFailedGeneric),
  });

  if (ready && !session) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-tlo-ciemne px-8"
        style={{ paddingTop: insets.top }}
      >
        <Link href="/login" className="text-base font-semibold text-primary">
          {authMessages[locale].signIn}
        </Link>
      </View>
    );
  }

  const labels: Record<UnitField, string> = {
    temperatureUnit: messages.temperature,
    windSpeedUnit: messages.windSpeed,
    precipitationUnit: messages.precipitationUnit,
  };

  return (
    <ScrollView
      className="flex-1 bg-tlo-ciemne"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
        gap: 24,
      }}
    >
      <Link href="/" className="text-sm text-tekst-muted">
        ← {messages.back}
      </Link>

      <Text className="text-3xl font-bold text-tekst">{messages.settings}</Text>

      {profile.isPending ? (
        <ActivityIndicator color="#8A94A6" />
      ) : (
        <View className="gap-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-tekst-muted">
            {messages.units}
          </Text>

          {(Object.keys(unitLabels) as UnitField[]).map((field) => (
            <View key={field} className="gap-2">
              <Text className="text-sm font-medium text-tekst">{labels[field]}</Text>
              <View className="flex-row gap-2">
                {Object.entries(unitLabels[field]).map(([value, symbol]) => {
                  const selected = profile.data?.[field] === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => save.mutate({ [field]: value } as UnitPreferences)}
                      className={`rounded-xl border px-4 py-2 active:opacity-70 ${
                        selected ? "border-primary bg-primary" : "border-white/10 bg-powierzchnia"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? "text-white" : "text-tekst-muted"
                        }`}
                      >
                        {symbol}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {error && (
            <Text className="text-sm text-warning-3" accessibilityRole="alert">
              {error}
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={async () => {
          await signOut();
          // The cached profile, saved places and warnings all belong to the
          // account that just left. Without this the next person to sign in on
          // this device sees them until each query happens to refetch.
          queryClient.clear();
          router.replace("/");
        }}
        className="mt-4 h-12 items-center justify-center rounded-2xl border border-white/10 bg-powierzchnia active:opacity-70"
      >
        <Text className="text-base font-semibold text-tekst">{authMessages[locale].signOut}</Text>
      </Pressable>
    </ScrollView>
  );
}
