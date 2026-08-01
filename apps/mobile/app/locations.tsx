import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertUiMessages, appMessages, authMessages, DEFAULT_LOCALE } from "@weather-app/core";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDebouncedValue } from "../src/lib/use-debounced-value";
import { useActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import {
  createSavedLocation,
  deleteSavedLocation,
  fetchSavedLocations,
  searchLocations,
  type LocationSearchResult,
  type SavedLocation,
} from "../src/lib/saved-locations";

/**
 * Saved places: search, add, remove, and pick the one the home screen shows.
 *
 * Picking happens here rather than in a switcher on the home screen, which is
 * the shape apps/web arrived at after measuring: choosing a place is a setup
 * task you do once, and it was taking almost twice the space of the warnings
 * tile on a screen whose whole purpose is warnings.
 */
export default function LocationsScreen() {
  const insets = useSafeAreaInsets();
  const locale = DEFAULT_LOCALE;
  const messages = appMessages[locale];
  const { session, ready } = useAuth();
  const { active, choose } = useActiveLocation();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Typing "Warszawa" is eight keystrokes and would be eight geocoding
  // requests, seven of them for prefixes nobody wants results for.
  const debouncedQuery = useDebouncedValue(query, 300);

  const saved = useQuery({
    queryKey: ["saved-locations"],
    queryFn: fetchSavedLocations,
    enabled: Boolean(session),
  });

  const results = useQuery({
    queryKey: ["location-search", debouncedQuery],
    queryFn: () => searchLocations(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: (result: LocationSearchResult) =>
      createSavedLocation(result.name, result.latitude, result.longitude),
    onSuccess: (outcome) => {
      if (outcome.ok) {
        setQuery("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
        return;
      }
      if (outcome.status === 409) setError(messages.alreadySaved);
      else if (outcome.status === 401) setError(messages.sessionExpired);
      else setError(messages.saveFailed);
    },
  });

  const remove = useMutation({
    mutationFn: deleteSavedLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-locations"] }),
  });

  // If the active place has been deleted - here or on another device - the
  // home screen would keep showing coordinates that no longer belong to any
  // saved location.
  useEffect(() => {
    if (!saved.data || active.savedLocationId === null) return;
    if (!saved.data.some((location) => location.id === active.savedLocationId)) {
      void choose({ ...active, savedLocationId: null });
    }
  }, [saved.data, active, choose]);

  if (ready && !session) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-tlo-ciemne px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-center text-base text-tekst-muted">{messages.signInToSave}</Text>
        <Link href="/login" className="text-base font-semibold text-primary">
          {authMessages[locale].signIn}
        </Link>
      </View>
    );
  }

  const searching = debouncedQuery.trim().length >= 2;

  return (
    <View className="flex-1 bg-tlo-ciemne" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-5 pb-3">
        <Text className="mb-4 text-3xl font-bold text-tekst">{messages.savedPlaces}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={messages.searchPlaceholder}
          placeholderTextColor="#8A94A6"
          autoCorrect={false}
          className="h-12 rounded-2xl border border-white/10 bg-powierzchnia px-4 text-base text-tekst"
        />
        {error && (
          <Text className="mt-2 text-sm text-warning-3" accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>

      {searching ? (
        <FlatList
          data={results.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            results.isFetching ? <ActivityIndicator className="mt-6" color="#8A94A6" /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => add.mutate(item)}
              className="mb-2 rounded-2xl bg-powierzchnia px-4 py-3.5 active:opacity-70"
            >
              <Text className="text-base font-semibold text-tekst">{item.name}</Text>
              {item.admin1 && <Text className="text-xs text-tekst-muted">{item.admin1}</Text>}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            saved.isPending ? (
              <ActivityIndicator className="mt-6" color="#8A94A6" />
            ) : (
              <Text className="mt-6 text-center text-sm text-tekst-muted">
                {messages.noSavedPlaces}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <SavedRow
              location={item}
              isActive={item.id === active.savedLocationId}
              removeLabel={messages.remove}
              historyLabel={alertUiMessages[locale].warnings}
              onSelect={async () => {
                await choose({
                  savedLocationId: item.id,
                  name: item.name,
                  latitude: item.latitude,
                  longitude: item.longitude,
                });
                router.back();
              }}
              onRemove={() => remove.mutate(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function SavedRow({
  location,
  isActive,
  removeLabel,
  historyLabel,
  onSelect,
  onRemove,
}: {
  location: SavedLocation;
  isActive: boolean;
  removeLabel: string;
  historyLabel: string;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <View
      className={`mb-2 flex-row items-center gap-3 rounded-2xl px-4 py-3.5 ${
        isActive ? "border border-primary bg-powierzchnia" : "bg-powierzchnia"
      }`}
    >
      <Pressable onPress={onSelect} className="flex-1 active:opacity-70">
        <Text className="text-base font-semibold text-tekst">{location.name}</Text>
        <Link
          href={{ pathname: "/locations/[id]/alerts", params: { id: location.id } }}
          className="mt-0.5 text-xs text-tekst-muted"
        >
          {historyLabel}
        </Link>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-60">
        <Text className="text-sm font-medium text-tekst-muted">{removeLabel}</Text>
      </Pressable>
    </View>
  );
}
