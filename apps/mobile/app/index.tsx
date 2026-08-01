import { useQuery } from "@tanstack/react-query";
import {
  alertUiMessages,
  appMessages,
  DEFAULT_LOCALE,
  localHourFromForecast,
  weatherMessages,
} from "@weather-app/core";
import { Link, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertLiveConnection } from "../src/components/alert-live-connection";
import { AlertsTile } from "../src/components/alerts-tile";
import { DailyForecastList } from "../src/components/daily-forecast-list";
import { Hero } from "../src/components/hero";
import { HomeSkeleton, Skeleton } from "../src/components/skeleton";
import { ForecastTrend } from "../src/components/forecast-trend";
import { HourlyForecastStrip } from "../src/components/hourly-forecast-strip";
import { Tile } from "../src/components/tile";
import { WeatherBackground } from "../src/components/weather-background";
import { useActiveLocation, type ActiveLocation } from "../src/lib/active-location";
import { StatusBar } from "expo-status-bar";

import { GlassBar } from "../src/components/glass-bar";

import { useDeviceLocation } from "../src/lib/device-location";
import { useLocale } from "../src/lib/locale";
import { releaseSplash } from "../src/lib/splash";
import { useAuth } from "../src/lib/auth/context";
import { alertsForLocation, fetchActiveAlerts, fetchAlertsAt } from "../src/lib/alerts";
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
  const { width, height } = useWindowDimensions();
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

  // Waited for before the pager renders, deliberately. Prepending a page after
  // the fact would shift every index under a finger that may already be
  // swiping - the same class of bug as deriving the page list from the active
  // place. One extra frame on a cold start buys a list that never renumbers.
  const { locale } = useLocale();
  const device = useDeviceLocation(appMessages[locale].myLocation);

  const pages = useMemo<ActiveLocation[]>(() => {
    const fromSaved: ActiveLocation[] = (saved.data ?? []).map((location) => ({
      savedLocationId: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }));

    const here = device.status === "ready" ? device.location : null;
    if (here) {
      // Where you are comes first, ahead of anywhere you chose to keep an eye
      // on. The unsaved fallback is dropped in that case - it is the Warszawa
      // default or a previous position, and neither is worth a page once the
      // real one exists.
      return [here, ...fromSaved];
    }

    const alreadyThere = fromSaved.some((page) => page.savedLocationId === initial.savedLocationId);
    return alreadyThere ? fromSaved : [initial, ...fromSaved];
  }, [saved.data, initial, device]);

  const settled = device.status === "ready";

  const initialIndex = Math.max(
    pages.findIndex((page) => page.savedLocationId === initial.savedLocationId),
    0,
  );

  /**
   * Follows the active place when it is chosen elsewhere.
   *
   * This screen stays mounted while the saved-places screen sits on top of it,
   * so picking a place there and coming back would otherwise land on whatever
   * page the pager was left on - the choice apparently ignored.
   *
   * The index is held twice on purpose: the ref is what the effect below
   * compares against, and reading a ref written during a scroll is the only
   * way to avoid scrolling back over a swipe that already happened. The state
   * exists because the dots render from it, and a ref would leave them on the
   * page the screen opened at.
   */
  const pagerRef = useRef<FlatList<ActiveLocation>>(null);
  const shownIndex = useRef(initialIndex);
  const [dotIndex, setDotIndex] = useState(initialIndex);

  // The pager's position in pixels, written on every scroll frame on the UI
  // thread. The dots read it from there, so following the finger costs no
  // React renders at all - which is what lets them follow it at 120Hz while
  // three forecast queries are settling on the page underneath.
  const scrollX = useSharedValue(initialIndex * width);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // In pages rather than pixels, so the dots never need to know how wide the
  // screen is.
  const pageProgress = useDerivedValue(() => scrollX.value / width);

  useEffect(() => {
    const index = pages.findIndex((page) => page.savedLocationId === active.savedLocationId);
    if (index < 0 || index === shownIndex.current) return;

    shownIndex.current = index;
    setDotIndex(index);
    // Moved with the list rather than left to the scroll event: this jump is
    // unanimated, and an unanimated scroll is not guaranteed to emit one.
    scrollX.value = index * width;
    pagerRef.current?.scrollToIndex({ index, animated: false });
  }, [active.savedLocationId, pages]);

  // Nothing to page through until it is known whether there is a first page.
  // Shaped rather than blank: the splash releases on the first forecast, so
  // whatever shows here is what somebody sees while the location resolves.
  if (!settled) {
    return <HomeSkeleton heroHeight={Math.max(Math.round(height * 0.62), 440)} />;
  }

  return (
    // An explicit box, not a fragment: an absolutely positioned child needs a
    // laid-out ancestor to sit against, and a fragment gives it none.
    <View className="flex-1">
    {/* The hero is dark in both themes, so the clock above it has to be light
        in both - this overrides the themed one set in the layout. */}
    <StatusBar style="light" />
    <Animated.FlatList
      ref={pagerRef}
      data={pages}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={scrollHandler}
      // Every frame, not every sixteenth: the dots are driven from this, and a
      // throttled offset is exactly the stutter this replaces.
      scrollEventThrottle={16}
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
        setDotIndex(index);
        if (page.savedLocationId !== active.savedLocationId) void choose(page);
      }}
      renderItem={({ item, index }) => (
        <View style={{ width }}>
          <LocationPage
            location={item}
            pageIndex={index}
            isDeviceLocation={index === 0 && device.status === "ready" && device.location !== null}
          />
        </View>
      )}
    />

    {/* Outside the pager, so it belongs to the screen rather than to a page:
        one bar, not one per place, and it does not slide with the swipe. */}
    <GlassBar
      left={{
        label: appMessages[locale].settings,
        icon: "settings",
        onPress: () => router.push("/settings"),
      }}
      right={{
        label: appMessages[locale].savedPlaces,
        icon: "places",
        onPress: () => router.push("/locations"),
      }}
      dots={
        pages.length > 1
          ? { count: pages.length, current: dotIndex, progress: pageProgress }
          : undefined
      }
    />
    </View>
  );
}

function LocationPage({
  location,
  pageIndex,
  isDeviceLocation,
}: {
  location: ActiveLocation;
  pageIndex: number;
  /** True for the page showing where the phone is, rather than a saved place. */
  isDeviceLocation: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { latitude, longitude } = location;
  const { locale } = useLocale();
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

  // Two different questions, so two queries. A saved place asks what covers
  // the places this account keeps - matched server-side and able to arrive by
  // push. The device's own page asks what covers the ground it is standing on,
  // which nothing recorded and nothing can notify about.
  const atPosition = location.savedLocationId === null && isDeviceLocation;

  const alerts = useQuery({
    queryKey: ["active-alerts"],
    queryFn: fetchActiveAlerts,
    enabled: Boolean(session) && !atPosition,
  });

  const alertsHere = useQuery({
    queryKey: ["alerts-at", latitude, longitude],
    queryFn: () => fetchAlertsAt(latitude, longitude),
    enabled: atPosition,
  });

  // Narrowed to this page's place. The account-wide query is shared by every
  // page - one request, not one per swipe - so the page is what has to ask the
  // narrower question of the answer.
  const alertsShown = useMemo(() => {
    if (atPosition) return alertsHere.data ?? [];
    if (location.savedLocationId === null) return [];
    return alertsForLocation(alerts.data ?? [], location.savedLocationId);
  }, [atPosition, alertsHere.data, alerts.data, location.savedLocationId]);

  // Released on the first page only, and on settled rather than on success: a
  // forecast that failed still has a screen to show, and holding the splash for
  // it would turn one dead request into an app that never starts.
  useEffect(() => {
    if (pageIndex === 0 && !conditions.isPending) releaseSplash();
  }, [pageIndex, conditions.isPending]);

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
      className="flex-1 bg-tlo"
      // Room for the floating bar, not just for the home indicator: a control
      // that hovers over the content has to leave the content somewhere to end.
      contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: heroHeight }} className="overflow-hidden rounded-b-[2.5rem]">
        <WeatherBackground
          weatherCode={conditions.data?.weatherCode ?? 0}
          temperatureCelsius={conditions.data?.temperatureCelsius ?? 0}
          latitude={latitude}
          longitude={longitude}
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
                  className="flex-row items-center justify-center px-5"
                >
                  {/* The dots moved to the bottom row, where the thumb is.
                      What stays here is the name, with the room that freed. */}
                  <Text className="text-2xl font-semibold text-white">{location.name}</Text>
                </View>
              }
            />
          ) : (
            <View
              className="flex-1 items-center justify-center gap-4 px-8"
              style={{ paddingTop: insets.top }}
            >
              {conditions.isPending ? (
                // Shaped like the hero's own contents rather than a spinner:
                // the icon, the number, the phrase. A spinner in the middle of
                // a full-bleed gradient says "wait" and nothing about what for.
                <View className="items-center gap-4" accessibilityLabel={messages.loading}>
                  <Skeleton className="h-24 w-24 rounded-full bg-white/20" />
                  <Skeleton className="h-16 w-32 bg-white/20" />
                  <Skeleton className="h-5 w-40 bg-white/20" />
                </View>
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
        {/* Under the strip, not instead of it: the strip answers "what is it
            doing at four", the plots answer the shape of the day. */}
        <ForecastTrend entries={hourly.data ?? []} />
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
          alerts={alertsShown}
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
