import { useQuery } from "@tanstack/react-query";
import {
  alertUiMessages,
  appMessages,
  authMessages,
  DEFAULT_LOCALE,
  localHourFromForecast,
  weatherMessages,
} from "@weather-app/core";
import { Link } from "expo-router";
import { useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertLiveConnection } from "../src/components/alert-live-connection";
import { AlertsTile } from "../src/components/alerts-tile";
import { DailyForecastList } from "../src/components/daily-forecast-list";
import { Hero } from "../src/components/hero";
import { HourlyForecastStrip } from "../src/components/hourly-forecast-strip";
import { Tile } from "../src/components/tile";
import { WeatherBackground } from "../src/components/weather-background";
import { useActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import { fetchActiveAlerts } from "../src/lib/alerts";
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
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { active } = useActiveLocation();
  const { latitude, longitude } = active;
  const locale = DEFAULT_LOCALE;
  const messages = appMessages[locale];
  const weather = weatherMessages[locale];
  const { session, ready } = useAuth();

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
                    {ready && session && (
                      <Link href="/settings" className="text-sm font-semibold text-white/90">
                        {messages.settings}
                      </Link>
                    )}
                  </View>
                  <Text className="text-base font-semibold text-white">
                    {active.name}
                  </Text>
                  <View className="w-24 items-end">
                    {ready &&
                      (session ? (
                        <Link href="/locations" className="text-sm font-semibold text-white/90">
                          {messages.savedPlaces}
                        </Link>
                      ) : (
                        <Link href="/login" className="text-sm font-semibold text-white/90">
                          {authMessages[locale].signIn}
                        </Link>
                      ))}
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
