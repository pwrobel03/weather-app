import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appMessages, authMessages, DEFAULT_LOCALE, unitLabels } from "@weather-app/core";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/lib/auth/context";
import { releasePushToken } from "../src/lib/realtime/push";
import { publishTestAlert } from "../src/lib/alerts";
import { useActiveLocation } from "../src/lib/active-location";
import { createSavedLocation, type SavedLocation } from "../src/lib/saved-locations";
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
  const { session, registered, signOut } = useAuth();
  const { active } = useActiveLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

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

      {/* Development builds only. Not a feature flag and not a hidden setting -
          it simply does not exist in a shipped app, because a warning that is
          not real must never be one tap away from somebody who would read it
          as real. Requires an ADMIN account; anything else comes back 403. */}
      {__DEV__ && (
        <View className="mt-8 gap-2 rounded-2xl border border-warning-2/40 bg-powierzchnia p-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-warning-2">
            Tylko build deweloperski
          </Text>
          <Text className="text-xs text-tekst-muted">
            Publikuje ostrzeżenie oznaczone jako testowe dla powiatu, w którym leży aktywne miejsce.
            Przechodzi tą samą ścieżką co ostrzeżenie z IMGW: dopasowanie, socket, push.
          </Text>
          <Pressable
            onPress={async () => {
              const outcome = await publishTestAlert(active.latitude, active.longitude);
              setTestResult(
                outcome.ok
                  ? `Opublikowane. Dopasowanych miejsc: ${outcome.matched}.`
                  : outcome.status === 403
                    ? "403 — to konto nie ma roli ADMIN."
                    : `Nie udało się (${outcome.status}).`,
              );
              if (outcome.ok) void queryClient.invalidateQueries({ queryKey: ["active-alerts"] });
            }}
            className="h-11 items-center justify-center rounded-xl bg-warning-2/20 active:opacity-70"
          >
            <Text className="text-sm font-semibold text-warning-2">Opublikuj ostrzeżenie testowe</Text>
          </Pressable>
          {testResult && <Text className="text-xs text-tekst-muted">{testResult}</Text>}
        </View>
      )}

      {registered ? (
        <Pressable
          onPress={async () => {
            // Read while still signed in, and kept afterwards. Signing out of
            // an account should not empty the phone of the places being
            // watched on it - they are the reason the app is open. They stay
            // on the account as well, so this makes two independent copies:
            // removing one afterwards does not remove the other, and signing
            // back in merges them by position rather than duplicating.
            const places = queryClient.getQueryData<SavedLocation[]>(["saved-locations"]) ?? [];

            // Before signOut, not after: unregistering is itself an
            // authenticated call, so clearing the tokens first would leave this
            // device registered with no way left to reach the registration -
            // and the next warning for this account landing on a phone somebody
            // else is now holding.
            await releasePushToken();
            await signOut();

            // Recreated one at a time on the device's new anonymous user, in
            // the order they were shown. A failure here costs a place on the
            // phone, never on the account, which still has all of them.
            for (const place of places) {
              await createSavedLocation(place.name, place.latitude, place.longitude);
            }
            // Signing out already emptied the cache of the account's data;
            // this pulls in the copies just written for the device.
            await queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
            router.replace("/");
          }}
          className="mt-4 h-12 items-center justify-center rounded-2xl border border-white/10 bg-powierzchnia active:opacity-70"
        >
          <Text className="text-base font-semibold text-tekst">{authMessages[locale].signOut}</Text>
        </Pressable>
      ) : (
        // No account on this device. Everything here still works - the places
        // and the warnings belong to it already - so this says what an account
        // adds rather than what it unlocks.
        <View className="mt-4 gap-3">
          <Text className="text-sm text-tekst-muted">{authMessages[locale].accountBenefit}</Text>

          <Link
            href="/register"
            className="h-12 rounded-2xl bg-primary text-center text-base font-semibold leading-[48px] text-white"
          >
            {authMessages[locale].signUp}
          </Link>

          <Link
            href="/login"
            className="h-12 rounded-2xl border border-white/10 bg-powierzchnia text-center text-base font-semibold leading-[48px] text-tekst"
          >
            {authMessages[locale].signIn}
          </Link>
        </View>
      )}
    </ScrollView>
  );
}
