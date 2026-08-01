import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  alertMessages,
  alertUiMessages,
  appMessages,
  conditionFromWeatherCode,
  DEFAULT_LOCALE,
  weatherMessages,
  type Locale,
  phenomenonName,
} from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import { Link, router } from "expo-router";
import { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useLocale } from "../src/lib/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherArt } from "../src/components/weather-art/weather-art";
import { fetchActiveAlerts, type ActiveAlert } from "../src/lib/alerts";
import { fetchCurrentConditions } from "../src/lib/weather";
import { useDebouncedValue } from "../src/lib/use-debounced-value";
import { useActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import {
  createSavedLocation,
  deleteSavedLocation,
  fetchSavedLocations,
  reorderSavedLocations,
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
  const { locale } = useLocale();
  const messages = appMessages[locale];
  const { session } = useAuth();
  const { active, choose } = useActiveLocation();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Typing "Warszawa" is eight keystrokes and would be eight geocoding
  // requests, seven of them for prefixes nobody wants results for.
  const debouncedQuery = useDebouncedValue(query, 300);

  const saved = useQuery({
    queryKey: ["saved-locations"],
    queryFn: fetchSavedLocations,
    enabled: Boolean(session),
  });

  // Same key as the home screen, so the two share one cache entry.
  const alerts = useQuery({
    queryKey: ["active-alerts"],
    queryFn: fetchActiveAlerts,
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
        setSearchOpen(false);
        Keyboard.dismiss();
        void queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
        return;
      }
      if (outcome.status === 409) setError(messages.alreadySaved);
      else if (outcome.status === 401) setError(messages.sessionExpired);
      else setError(messages.saveFailed);
    },
  });

  const reorder = useMutation({
    mutationFn: reorderSavedLocations,
    // Only on failure. A refetch on success would swap `data` a second time
    // for an identical list, and every swap costs the list a remount of its
    // cells - the thing this screen has been fighting.
    onError: () => {
      setError(messages.saveFailed);
      void queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteSavedLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-locations"] }),
  });

  /**
   * Applies a drop to the query cache and persists it.
   *
   * Written straight into the cache rather than into a second piece of state
   * mirroring it. Two copies is what broke this: the list rendered from the
   * mirror while an effect kept overwriting it from the server, so the indices
   * the drop reported belonged to one array and the ids were read out of
   * another - producing a hole, throwing inside the handler, and leaving the
   * row visually snapped back the instant it landed.
   *
   * The cache is also read here rather than closed over, so the reorder always
   * applies to exactly what the list was showing.
   */
  /**
   * Persists a drop.
   *
   * The list hands over the whole reordered array rather than a pair of
   * indices, which is why this is three lines and not a minefield: there is no
   * arithmetic to get wrong, no index to arrive stale, and nothing to guard
   * against a second, contradictory report of the same gesture.
   */
  const onDragEnd = (next: SavedLocation[]) => {
    queryClient.setQueryData(["saved-locations"], next);
    reorder.mutate(next.map((place) => place.id));
  };

  // If the active place has been deleted - here or on another device - the
  // home screen would keep showing coordinates that no longer belong to any
  // saved location.
  useEffect(() => {
    if (!saved.data || active.savedLocationId === null) return;
    if (!saved.data.some((location) => location.id === active.savedLocationId)) {
      void choose({ ...active, savedLocationId: null });
    }
  }, [saved.data, active, choose]);


  const searching = debouncedQuery.trim().length >= 2;

  // `router.back()` alone would strand anyone who arrived here first - a push
  // notification deep link opens its own screen, not the home screen beneath it.
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setError(null);
    Keyboard.dismiss();
  };

  return (
    <View className="flex-1 bg-tlo" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-5 pb-3">
        {/* The only way out that does not depend on the platform's edge swipe -
            which is invisible, and on Android is a different gesture entirely. */}
        <Pressable onPress={goHome} hitSlop={8} className="mb-3 self-start active:opacity-60">
          <Text className="text-sm text-tekst-muted">← {messages.back}</Text>
        </Pressable>

        <Text className="text-3xl font-bold text-tekst">{messages.savedPlaces}</Text>
      </View>

      <View className="flex-1">
        <GestureHandlerRootView style={{ flex: 1 }}>
        <DraggableFlatList
          data={saved.data ?? []}
          keyExtractor={(item) => String(item.id)}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          onDragEnd={({ data }) => onDragEnd(data)}
          ListEmptyComponent={
            saved.isPending ? (
              <ActivityIndicator className="mt-6" color="#8A94A6" />
            ) : (
              <Text className="mt-6 text-center text-sm text-tekst-muted">
                {messages.noSavedPlaces}
              </Text>
            )
          }
          renderItem={({ item, drag, isActive: isDragging }: RenderItemParams<SavedLocation>) => (
            <ScaleDecorator>
              <SavedRow
                location={item}
                isActive={item.id === active.savedLocationId}
                isDragging={isDragging}
                drag={drag}
                alert={alerts.data?.find((alert) =>
                  alert.affectedLocations.some((affected) => affected.id === item.id),
                )}
                locale={locale}
                removeLabel={messages.remove}
                historyLabel={alertUiMessages[locale].warningHistory}
                onSelect={async () => {
                  await choose({
                    savedLocationId: item.id,
                    name: item.name,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  });
                  // Chosen, so go and look at it. `back()` alone would depend
                  // on how this screen was reached - from a push notification
                  // there is no home screen underneath to go back to.
                  goHome();
                }}
                onRemove={() => remove.mutate(item.id)}
              />
            </ScaleDecorator>
          )}
        />
        </GestureHandlerRootView>

        {/* Opaque, covering the saved list rather than tinting it. A
            translucent sheet sounds like useful context and is not: at any
            opacity that keeps suggestions legible, what shows through is
            unreadable anyway, so it reads as a rendering fault rather than as
            the list underneath. */}
        {searchOpen && (
          <View className="absolute inset-0 bg-tlo">
            <FlatList
              data={results.data ?? []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
              // Without this the first tap only dismisses the keyboard, so
              // picking a suggestion takes two taps and feels broken.
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              ListEmptyComponent={
                results.isFetching ? (
                  <ActivityIndicator className="mt-6" color="#8A94A6" />
                ) : searching ? (
                  <Text className="mt-6 text-center text-sm text-tekst-muted">
                    {messages.noSearchResults}
                  </Text>
                ) : null
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
          </View>
        )}
      </View>

      {/* Search lives at the bottom, within thumb reach on a tall phone, and
          rides above the keyboard rather than hiding behind it. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          className="border-t border-linia/10 bg-tlo px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {error && (
            <Text className="mb-2 text-sm text-warning-3" accessibilityRole="alert">
              {error}
            </Text>
          )}

          <View className="flex-row items-center gap-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchOpen(true)}
              placeholder={messages.searchPlaceholder}
              placeholderTextColor="#8A94A6"
              autoCorrect={false}
              returnKeyType="search"
              className="h-12 flex-1 rounded-2xl border border-linia/10 bg-powierzchnia px-4 text-base text-tekst"
            />
            {searchOpen && (
              <Pressable onPress={closeSearch} hitSlop={8} className="active:opacity-60">
                <Text className="text-sm font-semibold text-primary">{messages.cancel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * One saved place, carrying the two things worth knowing about it at a glance:
 * what the weather is doing there and whether it is under a warning.
 *
 * The conditions are fetched per row rather than in one call, which is a
 * deliberate trade at this size - the alternative is a batch endpoint, and a
 * handful of places does not justify one. A list long enough to feel it would.
 * The cache key matches the home screen's, so opening a place that is already
 * the active one costs nothing.
 */
const SavedRow = memo(function SavedRow({
  location,
  isActive,
  isDragging,
  drag,
  alert,
  locale,
  removeLabel,
  historyLabel,
  onSelect,
  onRemove,
}: {
  location: SavedLocation;
  isActive: boolean;
  /** True while this row is the one being carried. */
  isDragging: boolean;
  /** Starts the drag; the list owns the gesture from there. */
  drag: () => void;
  /** The warning covering this place, if any - matched on the saved id. */
  alert: ActiveAlert | undefined;
  locale: Locale;
  removeLabel: string;
  historyLabel: string;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const conditions = useQuery({
    queryKey: ["current", location.latitude, location.longitude],
    queryFn: () => fetchCurrentConditions(location.latitude, location.longitude),
  });

  const weather = weatherMessages[locale];
  const severityColor = alert ? tokens.colors[`warning${alert.severity}`] : undefined;

  return (
    // Spacing as padding on an outer box rather than a margin on the card. A
    // margin sits outside the view, so it is absent from what `onLayout`
    // reports: the list would measure every cell 8pt shorter than the space it
    // really occupies, and that error accumulates down the list until a drop
    // lands a whole row away from where it was aimed.
    <View style={{ paddingBottom: 8 }}>
    <View
      className={`gap-2 rounded-2xl px-4 py-3.5 ${isActive ? "border border-primary bg-powierzchnia" : "bg-powierzchnia"
        }`}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onSelect}
          onLongPress={drag}
          // Taps must not fight the carry: while this row is being dragged it
          // stops being a button.
          disabled={isDragging}
          // Matches the delay the list itself uses to tell a drag from a tap.
          delayLongPress={220}
          className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-70"
        >
          {/* Fixed box whether or not the icon has arrived, so the names stay
              on one vertical line instead of jumping as each row resolves. */}
          <View className="h-11 w-11 items-center justify-center">
            {conditions.data ? (
              <WeatherArt code={conditions.data.weatherCode} timeOfDay="day" size={40} />
            ) : (
              conditions.isPending && <ActivityIndicator color="#8A94A6" />
            )}
          </View>

          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-tekst" numberOfLines={1}>
              {location.name}
            </Text>
            <Text className="text-xs text-tekst-muted" numberOfLines={1}>
              {conditions.data
                ? `${weather.condition[conditionFromWeatherCode(conditions.data.weatherCode)]} · ${Math.round(conditions.data.temperatureCelsius)}°`
                : ""}
            </Text>
          </View>
        </Pressable>

        <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-60">
          <Text className="text-sm font-medium text-tekst-muted">{removeLabel}</Text>
        </Pressable>
      </View>

      {alert && (
        // Level in words next to the colour, never colour alone - the same rule
        // AlertEntry follows, and for the same reason (design.md §3).
        <View className="flex-row items-center gap-2">
          <View className="h-3.5 w-1 rounded-full" style={{ backgroundColor: severityColor }} />
          <Text className="text-xs font-semibold" style={{ color: severityColor }} numberOfLines={1}>
            {phenomenonName(alert.event, locale)} · {alertMessages[locale].severityLabel[alert.severity]}
          </Text>
        </View>
      )}

      <Link
        href={{ pathname: "/locations/[id]/alerts", params: { id: location.id } }}
        className="self-start text-xs text-tekst-muted"
      >
        {historyLabel}
      </Link>
    </View>
    </View>
  );
});
