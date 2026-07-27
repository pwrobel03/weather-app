import { useQuery } from "@tanstack/react-query";
import { appMessages, authMessages, DEFAULT_LOCALE, hourOf, weatherMessages } from "@weather-app/core";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyForecastList } from "../src/components/daily-forecast-list";
import { Hero } from "../src/components/hero";
import { HourlyForecastStrip } from "../src/components/hourly-forecast-strip";
import { Tile } from "../src/components/tile";
import { WeatherBackground } from "../src/components/weather-background";
import { useActiveLocation } from "../src/lib/active-location";
import { useAuth } from "../src/lib/auth/context";
import { fetchCurrentConditions, fetchDailyForecast, fetchHourlyForecast } from "../src/lib/weather";

/**
 * The home screen, matching apps/web's: a weather-driven gradient hero filling
 * most of the first view, with everything else scrolling beneath it.
 *
 * The hourly forecast does double duty: it fills the strip, and its first entry
 * gives the hour *at the displayed location*, which is what decides whether the
 * hero paints a night sky. Reading the device clock instead would show someone
 * in London Warszawa's daytime sky at 1am local.
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

  const localHour = hourOf(hourly.data?.[0]?.time ?? new Date().toISOString());

  // 62% of the viewport, the same proportion as the web hero. Measured rather
  // than expressed as a viewport unit: NativeWind has no vh, and a fixed pixel
  // height would crop the metrics strip on a small phone.
  const heroHeight = Math.max(Math.round(height * 0.62), 440);

  return (
    <ScrollView
      className="flex-1 bg-tlo-ciemne"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: heroHeight }} className="overflow-hidden rounded-b-[2.5rem]">
        <WeatherBackground
          weatherCode={conditions.data?.weatherCode ?? 0}
          temperatureCelsius={conditions.data?.temperatureCelsius ?? 0}
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
                  {/* Balances the row so the name stays optically centred. */}
                  <View className="w-24" />
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

      <Tile title={weather.today}>
        <HourlyForecastStrip entries={hourly.data ?? []} />
      </Tile>

      <Tile title={weather.sevenDays}>
        <DailyForecastList entries={daily.data ?? []} locale={locale} />
      </Tile>
    </ScrollView>
  );
}
