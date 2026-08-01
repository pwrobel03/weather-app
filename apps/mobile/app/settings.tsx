import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appMessages, authMessages, unitLabels } from "@weather-app/core";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Row, Section, Segmented } from "../src/components/settings-list";
import { publishTestAlert } from "../src/lib/alerts";
import { useActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import { useLocale } from "../src/lib/locale";
import { releasePushToken } from "../src/lib/realtime/push";
import { createSavedLocation, type SavedLocation } from "../src/lib/saved-locations";
import { useTheme, type ThemeChoice } from "../src/lib/theme";
import { fetchProfile, updatePreferences, type UnitPreferences } from "../src/lib/user";

type UnitField = keyof typeof unitLabels;

/**
 * Unit preferences, appearance, and the account.
 *
 * Each control PATCHes only the field it owns, which is why there is no save
 * button: the backend's partial-update semantics (commit 32) make a change
 * atomic per preference, so a failure can only ever lose the one tap that
 * failed rather than silently reverting the other two.
 *
 * Grouped into cards by what a change affects - the phone's numbers, the
 * phone's appearance, the account behind both. The previous version was one
 * flat column of labels and loose pills, where the only thing separating two
 * unrelated decisions was a larger margin.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { locale, choose: chooseLocale } = useLocale();
  const { theme, choose: chooseTheme } = useTheme();
  const messages = appMessages[locale];
  const auth = authMessages[locale];
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

  const unitRows: { field: UnitField; label: string }[] = [
    { field: "temperatureUnit", label: messages.temperature },
    { field: "windSpeedUnit", label: messages.windSpeed },
    { field: "precipitationUnit", label: messages.precipitationUnit },
  ];

  return (
    <ScrollView
      className="flex-1 bg-tlo"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 24,
      }}
    >
      <View className="gap-3 px-1">
        <Link href="/" className="text-sm font-semibold text-primary">
          ← {messages.back}
        </Link>
        {/* Negative tracking at this size: large type sets loose by default. */}
        <Text className="text-[34px] font-bold tracking-[-0.02em] text-tekst">
          {messages.settings}
        </Text>
      </View>

      {profile.isPending ? (
        <ActivityIndicator color="#8A94A6" />
      ) : (
        <Section title={messages.units}>
          {unitRows.map(({ field, label }, index) => (
            <Row key={field} label={label} first={index === 0}>
              <Segmented
                options={Object.entries(unitLabels[field]).map(([value, symbol]) => ({
                  value,
                  label: symbol,
                }))}
                value={profile.data?.[field]}
                onChange={(value) => save.mutate({ [field]: value } as UnitPreferences)}
              />
            </Row>
          ))}
        </Section>
      )}

      {error && (
        <Text className="px-4 text-sm text-warning-3" accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Section title={messages.appearance}>
        {/* Stacked: three theme names at a legible tap size do not fit beside
            their label on a small phone. */}
        <Row label={messages.theme} stacked first>
          <Segmented
            fill
            options={(["system", "light", "dark"] as const).map((option) => ({
              value: option,
              label: messages.themeNames[option],
            }))}
            value={theme}
            onChange={(option: ThemeChoice) => void chooseTheme(option)}
          />
        </Row>

        <Row label={messages.language}>
          <Segmented
            options={(["pl", "en"] as const).map((option) => ({
              value: option,
              // Each language named in itself - "Polski", not "Polish" - or the
              // label is unreadable to the person who needs it.
              label: appMessages[option].languageNames[option],
            }))}
            value={locale}
            onChange={(option) => void chooseLocale(option)}
          />
        </Row>
      </Section>

      <Section title={messages.account}>
        {registered ? (
          <Row label={auth.signOut} first>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={auth.signOut}
              onPress={async () => {
                // Read while still signed in, and kept afterwards. Signing out
                // of an account should not empty the phone of the places being
                // watched on it - they are the reason the app is open. They stay
                // on the account as well, so this makes two independent copies:
                // removing one afterwards does not remove the other, and signing
                // back in merges them by position rather than duplicating.
                const places = queryClient.getQueryData<SavedLocation[]>(["saved-locations"]) ?? [];

                // Before signOut, not after: unregistering is itself an
                // authenticated call, so clearing the tokens first would leave
                // this device registered with no way left to reach the
                // registration - and the next warning for this account landing
                // on a phone somebody else is now holding.
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
              className="rounded-lg px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-warning-3">{auth.signOut}</Text>
            </Pressable>
          </Row>
        ) : (
          // No account on this device. Everything here still works - the places
          // and the warnings belong to it already - so this says what an account
          // adds rather than what it unlocks.
          <View className="gap-3 p-4">
            <Text className="text-sm leading-5 text-tekst-muted">{auth.accountBenefit}</Text>

            <Link
              href="/register"
              className="h-11 rounded-xl bg-primary text-center text-sm font-semibold leading-[44px] text-white"
            >
              {auth.signUp}
            </Link>

            <Link
              href="/login"
              className="h-11 rounded-xl border border-linia/10 text-center text-sm font-semibold leading-[44px] text-tekst"
            >
              {auth.signIn}
            </Link>
          </View>
        )}
      </Section>

      {/* Development builds only. Not a feature flag and not a hidden setting -
          it simply does not exist in a shipped app, because a warning that is
          not real must never be one tap away from somebody who would read it
          as real. Requires an ADMIN account; anything else comes back 403. */}
      {__DEV__ && (
        <Section
          title="Tylko build deweloperski"
          footer="Publikuje ostrzeżenie oznaczone jako testowe dla powiatu, w którym leży aktywne miejsce. Przechodzi tą samą ścieżką co ostrzeżenie z IMGW: dopasowanie, socket, push."
        >
          <View className="gap-2 p-4">
            <Pressable
              accessibilityRole="button"
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
              <Text className="text-sm font-semibold text-warning-2">
                Opublikuj ostrzeżenie testowe
              </Text>
            </Pressable>
            {testResult && <Text className="text-xs text-tekst-muted">{testResult}</Text>}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}
