import { useQuery } from "@tanstack/react-query";
import {
  alertUiMessages,
  appMessages,
  DEFAULT_LOCALE,
  localHourFromForecast,
  weatherMessages,
} from "@weather-app/core";
import { Link } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertLiveConnection } from "../src/components/alert-live-connection";
import { AlertsTile } from "../src/components/alerts-tile";
import { DailyForecastList } from "../src/components/daily-forecast-list";
import { Hero } from "../src/components/hero";
import { HourlyForecastStrip } from "../src/components/hourly-forecast-strip";
import { Tile } from "../src/components/tile";
import { WeatherBackground } from "../src/components/weather-background";
import { useActiveLocation, type ActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import { fetchActiveAlerts } from "../src/lib/alerts";
import { fetchSavedLocations } from "../src/lib/saved-locations";
import { fetchCurrentConditions, fetchDailyForecast, fetchHourlyForecast } from "../src/lib/weather";

/**
 * The home screen, matching apps/web's: a weather-driven gradient hero filling
 * most of the first view, with everything else scrolling beneath it.
 *
 * The hourly forecast does double duty: it fills the strip, and its first entry
 * still ahead of the clock gives the hour *at the displayed location*, which is
 * what decides whether the hero paints a night sky. Reading the device clock
 * instead would show someone in London Warszawa's daytime sky at 1am local.
 *
 * Order below is the forecasts first and warnings last, which is what apps/web
 * lays out on a narrow screen for a reason it states there: on most days the
 * warnings tile says "no active warnings", and a hero taking 62% of the
 * viewport plus an empty tile pushed the seven-day forecast past the second
 * screenful. Warnings still get the loud channels - a push notification and the
 * live socket - so they do not need to hold the position above the fold.
 */
/**
 * The pager over saved places - swipe left/right to move between them, as in
 * the platform's own weather app.
 *
 * The page list is captured once rather than derived from the active place on
 * every render, and that is load-bearing. Swiping calls `choose`, which changes
 * `active`; if the list depended on it, the page the user just swiped away from
 * could vanish (the unsaved default) and every index after it would shift under
 * the finger mid-gesture.
 */
export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { active, choose } = useActiveLocation();
  const { session } = useAuth();

  const saved = useQuery({
    queryKey: ["saved-locations"],
    queryFn: fetchSavedLocations,
    enabled: Boolean(session),
  });

  // The place showing when the screen mounted. Kept even if it is not saved -
  // otherwise someone with no account, or on the Warszawa default, would be
  // paging through an empty list.
  const initial = useRef(active).current;

  const pages = useMemo<ActiveLocation[]>(() => {
    const fromSaved: ActiveLocation[] = (saved.data ?? []).map((location) => ({
      savedLocationId: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }));

    const alreadyThere = fromSaved.some((page) => page.savedLocationId === initial.savedLocationId);
    return alreadyThere ? fromSaved : [initial, ...fromSaved];
  }, [saved.data, initial]);

  const initialIndex = Math.max(
    pages.findIndex((page) => page.savedLocationId === initial.savedLocationId),
    0,
  );

  /**
   * Follows the active place when it is chosen elsewhere.
   *
   * This screen stays mounted while the saved-places screen sits on top of it,
   * so picking a place there and coming back would otherwise land on whatever
   * page the pager was left on - the choice apparently ignored. The page index
   * is tracked in a ref rather than state because swiping writes it on every
   * settle and nothing renders from it.
   */
  const pagerRef = useRef<FlatList<ActiveLocation>>(null);
  const shownIndex = useRef(initialIndex);

  useEffect(() => {
    const index = pages.findIndex((page) => page.savedLocationId === active.savedLocationId);
    if (index < 0 || index === shownIndex.current) return;

    shownIndex.current = index;
    pagerRef.current?.scrollToIndex({ index, animated: false });
  }, [active.savedLocationId, pages]);

  return (
    <FlatList
      ref={pagerRef}
      data={pages}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(page) => String(page.savedLocationId ?? `${page.latitude},${page.longitude}`)}
      initialScrollIndex={initialIndex}
      // Required for initialScrollIndex, and free to state: every page is
      // exactly one screen wide.
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      // Only the visible page and its neighbours stay mounted. Each page runs
      // three forecast queries, so rendering all of them at once would fire a
      // burst of requests for places the user may never swipe to.
      windowSize={3}
      initialNumToRender={1}
      onMomentumScrollEnd={(event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        const page = pages[index];
        if (!page) return;

        // Recorded before `choose`, so the effect above sees the page the
        // finger already put us on and does not scroll it a second time.
        shownIndex.current = index;
        if (page.savedLocationId !== active.savedLocationId) void choose(page);
      }}
      renderItem={({ item, index }) => (
        <View style={{ width }}>
          <LocationPage location={item} pageIndex={index} pageCount={pages.length} />
        </View>
      )}
    />
  );
}

function LocationPage({
  location,
  pageIndex,
  pageCount,
}: {
  location: ActiveLocation;
  pageIndex: number;
  pageCount: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { latitude, longitude } = location;
  const locale = DEFAULT_LOCALE;
  const messages = appMessages[locale];
  const weather = weatherMessages[locale];
  const { session } = useAuth();

  const conditions = useQuery({
    queryKey: ["current", latitude, longitude],
    queryFn: () => fetchCurrentConditions(latitude, longitude),
  });

  const hourly = useQuery({
    queryKey: ["hourly", latitude, longitude],
    queryFn: () => fetchHourlyForecast(latitude, longitude),
  });

  const daily = useQuery({
    queryKey: ["daily", latitude, longitude],
    queryFn: () => fetchDailyForecast(latitude, longitude),
  });

  const alerts = useQuery({
    queryKey: ["active-alerts"],
    queryFn: fetchActiveAlerts,
    enabled: Boolean(session),
  });

  const localHour = localHourFromForecast(hourly.data ?? [], new Date());

  // 62% of the viewport, the same proportion as the web hero. Measured rather
  // than expressed as a viewport unit: NativeWind has no vh, and a fixed pixel
  // height would crop the metrics strip on a small phone.
  const heroHeight = Math.max(Math.round(height * 0.62), 440);

  // apps/web reaches the seven-day tile with an anchor; there is no such thing
  // here, so the shortcut scrolls to where that tile starts.
  //
  // Read off the *hourly* tile, whose bottom edge is by construction the
  // seven-day tile's top. That tile is also the one that changes size when the
  // forecast arrives, so its own `onLayout` is guaranteed to re-report - where
  // a view that merely gets pushed down is not.
  //
  // On a short forecast the scroll clamps at the end of the content and stops
  // above the requested offset. That is the right outcome, not a miss: the
  // point is to bring the tile into view, and at the end of the list it is.
  const scrollRef = useRef<ScrollView>(null);
  const sevenDaysY = useRef(0);

  const scrollToSevenDays = () => {
    // A little above the tile, so its heading is not flush against the edge.
    scrollRef.current?.scrollTo({ y: Math.max(sevenDaysY.current - 12, 0), animated: true });
  };

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-tlo-ciemne"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: heroHeight }} className="overflow-hidden rounded-b-[2.5rem]">
        <WeatherBackground
          weatherCode={conditions.data?.weatherCode ?? 0}
          temperatureCelsius={conditions.data?.temperatureCelsius ?? 0}
          windSpeedKmh={conditions.data?.windSpeedKmh}
        >
          {conditions.data ? (
            <Hero
              conditions={conditions.data}
              locale={locale}
              localHour={localHour}
              header={
                <View
                  style={{ paddingTop: insets.top + 8 }}
                  className="flex-row items-center justify-between px-5"
                >
                  <View className="w-24">
                    <Link href="/settings" className="text-sm font-semibold text-white/90">
                      {messages.settings}
                    </Link>
                  </View>
                  <View className="items-center">
                    <Text className="text-base font-semibold text-white">{location.name}</Text>
                    {pageCount > 1 && <PageDots count={pageCount} current={pageIndex} />}
                  </View>
                  {/* Saved places no longer wait for an account - the device
                      has a user of its own from first launch - so this is the
                      same link whether or not anyone has signed up. */}
                  <View className="w-24 items-end">
                    <Link href="/locations" className="text-sm font-semibold text-white/90">
                      {messages.savedPlaces}
                    </Link>
                  </View>
                </View>
              }
            />
          ) : (
            <View
              className="flex-1 items-center justify-center gap-4 px-8"
              style={{ paddingTop: insets.top }}
            >
              {conditions.isPending ? (
                <ActivityIndicator color="#fff" accessibilityLabel={messages.loading} />
              ) : (
                <>
                  <Text className="text-center text-sm text-white/80">
                    {messages.forecastUnavailable}
                  </Text>
                  <Pressable
                    onPress={() => conditions.refetch()}
                    className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-white">{messages.retry}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </WeatherBackground>
      </View>

      <View
        onLayout={(event) => {
          const { y, height: tileHeight } = event.nativeEvent.layout;
          sevenDaysY.current = y + tileHeight;
        }}
      >
      <Tile
        title={weather.today}
        aside={
          <Pressable onPress={scrollToSevenDays} className="active:opacity-70">
            <Text className="text-sm font-semibold text-primary">
              {weather.sevenDays} ›
            </Text>
          </Pressable>
        }
      >
        <HourlyForecastStrip entries={hourly.data ?? []} />
      </Tile>
      </View>

      <View>
        <Tile title={weather.sevenDays}>
          <DailyForecastList entries={daily.data ?? []} locale={locale} />
        </Tile>
      </View>

      <Tile
        title={alertUiMessages[locale].warnings}
        aside={
          session ? (
            <Link href="/map" className="text-sm font-semibold text-primary">
              {alertUiMessages[locale].map}
            </Link>
          ) : undefined
        }
      >
        <AlertsTile
          alerts={alerts.data ?? []}
          authenticated={Boolean(session)}
          locale={locale}
        />
      </Tile>
      {/* Live delivery over the WebSocket, plus push registration. Renders
          nothing until a warning arrives. */}
      {session && <AlertLiveConnection locale={locale} />}
    </ScrollView>
  );
}

/**
 * Which page of how many, under the place name.
 *
 * A swipe with no affordance is a swipe nobody discovers - the name alone
 * gives no hint that there is anything either side of it.
 */
function PageDots({ count, current }: { count: number; current: number }) {
  return (
    <View className="mt-1 flex-row gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className="h-1 w-1 rounded-full bg-white"
          style={{ opacity: index === current ? 0.95 : 0.35 }}
        />
      ))}
    </View>
  );
}
