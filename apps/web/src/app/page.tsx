import Link from "next/link";
import { Settings } from "lucide-react";

import { AlertLiveConnection } from "@/components/alert-live-connection";
import { CurrentConditionsClient } from "@/components/current-conditions-client";
import { DailyForecastList } from "@/components/daily-forecast-list";
import { HourlyForecastStrip } from "@/components/hourly-forecast-strip";
import { LocationSwitcher } from "@/components/location-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertsTile } from "@/components/tiles/alerts-tile";
import { MetricsTile } from "@/components/tiles/metrics-tile";
import { PowiatTile } from "@/components/tiles/powiat-tile";
import { PrecipitationTile } from "@/components/tiles/precipitation-tile";
import { Tile } from "@/components/tiles/tile";
import { Button } from "@/components/ui/button";
import { WeatherBackground } from "@/components/weather-background";
import { getActiveLocation, type ActiveLocation } from "@/lib/active-location/cookie";
import { fetchActiveAlerts } from "@/lib/alerts/api";
import { isAuthenticated } from "@/lib/auth/session";
import { DEFAULT_LOCALE, weatherMessages } from "@/lib/i18n/messages";
import { fetchSavedLocations } from "@/lib/saved-locations/api";
import { fetchPowiatOutline } from "@/lib/weather/boundary";
import { fetchCurrentConditions } from "@/lib/weather/current-conditions";
import { fetchDailyForecast } from "@/lib/weather/daily-forecast";
import { fetchHourlyForecast } from "@/lib/weather/hourly-forecast";
import { hourOf } from "@/lib/weather/naive-time";

// Warszawa - fallback until a location is chosen or picked up from a saved one.
const DEFAULT_LOCATION: ActiveLocation = {
  savedLocationId: null,
  name: "Warszawa",
  latitude: 52.23,
  longitude: 21.01,
};

// Forecast is fetched live from the backend per request - never prerender
// statically at build time, when no backend is reachable.
export const dynamic = "force-dynamic";

export default async function Home() {
  const active = (await getActiveLocation()) ?? DEFAULT_LOCATION;
  const { latitude, longitude } = active;
  const locale = DEFAULT_LOCALE;

  // Every read is independent, so none of them waits on another.
  const [conditions, hourly, daily, authenticated, savedLocations, alerts, outline] =
    await Promise.all([
      fetchCurrentConditions(latitude, longitude),
      fetchHourlyForecast(latitude, longitude),
      fetchDailyForecast(latitude, longitude),
      isAuthenticated(),
      fetchSavedLocations(),
      fetchActiveAlerts(),
      fetchPowiatOutline(latitude, longitude),
    ]);

  // With no reading there is no state to encode, so the background falls back
  // to a neutral overcast rather than inventing weather.
  const weatherCode = conditions?.weatherCode ?? 3;
  const temperatureCelsius = conditions?.temperatureCelsius ?? 0;
  // Hour at the displayed location, not on the server: someone in London
  // looking at Warszawa should see Warszawa's night.
  const localHour = conditions ? hourOf(conditions.observedAt) : 12;

  // Severity of the warning covering *this* powiat, matched on the warning's
  // own teryt codes rather than taken from the first active alert - a user may
  // watch several places, and colouring the tile for a storm somewhere else
  // would be a false alarm.
  const powiatSeverity =
    (outline
      ? alerts.find((alert) => alert.terytCodes.includes(outline.terytCode))?.severity
      : undefined) ?? null;

  // One clock for the whole page, so every countdown agrees - and because the
  // React Compiler rejects impure calls during render.
  const renderedAt = new Date();

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-3 py-3 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-8">
      {/* Hero card: order-1 everywhere */}
      <div className="order-1 lg:order-1 lg:col-span-8 animate-in-card stagger-1 relative overflow-hidden rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_24px_60px_-10px_rgba(0,0,0,0.6)] border border-white/20">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-5 right-5 z-30 micro-press">
            <ThemeToggle />
          </div>
          <div className="absolute top-5 left-5 z-30 flex items-center gap-2.5">
            <LocationSwitcher active={active} savedLocations={savedLocations} />
            {authenticated ? (
              <Button
                render={<Link href="/settings" />}
                nativeButton={false}
                variant="glass"
                size="icon-sm"
                aria-label="Ustawienia"
                className="micro-press shadow-sm hover:rotate-6"
              >
                <Settings />
              </Button>
            ) : (
              <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm" className="micro-press shadow-sm font-medium">
                Zaloguj się
              </Button>
            )}
          </div>
          <CurrentConditionsClient
            latitude={latitude}
            longitude={longitude}
            locale={locale}
            localHour={localHour}
            initialData={conditions ?? undefined}
          />
        </WeatherBackground>
      </div>

      {/* Hourly Forecast (Today): order-2 on mobile so it immediately follows Hero without interruption */}
      <div className="order-2 lg:order-3 lg:col-span-8 animate-in-card stagger-3 w-full flex flex-col justify-center">
        <Tile
          title={weatherMessages[locale].today}
          aside={
            <a href="#7-days" className="text-xs sm:text-sm font-bold text-sky-400 hover:text-sky-300 transition-colors drop-shadow-sm">
              {weatherMessages[locale].sevenDays} &gt;
            </a>
          }
          className="h-full justify-center"
        >
          <HourlyForecastStrip entries={hourly} />
        </Tile>
      </div>

      {/* Daily Forecast (7 Days): order-3 on mobile as direct continuation from Today */}
      <div id="7-days" className="order-3 lg:order-5 lg:col-span-8 animate-in-card stagger-5 w-full flex flex-col justify-center scroll-mt-6">
        <Tile title={weatherMessages[locale].sevenDays} className="h-full justify-center">
          <DailyForecastList entries={daily} locale={locale} />
        </Tile>
      </div>

      {/* Alerts / Warnings: order-4 on mobile so it does not block forecasts when empty/inactive, order-2 on desktop bento */}
      <div className="order-4 lg:order-2 lg:col-span-4 animate-in-card stagger-2 w-full">
        <AlertsTile alerts={alerts} authenticated={authenticated} locale={locale} now={renderedAt} />
      </div>

      {outline && (
        <div className="order-5 lg:order-4 lg:col-span-4 animate-in-card stagger-4 w-full">
          <PowiatTile outline={outline} severity={powiatSeverity} locale={locale} />
        </div>
      )}

      <div className="order-6 lg:order-6 lg:col-span-4 animate-in-card stagger-6 w-full">
        {conditions && <MetricsTile conditions={conditions} locale={locale} />}
      </div>

      {/* A chart earns its width - full span analytical precipitation curve. */}
      <div className="order-7 lg:order-7 lg:col-span-12 animate-in-card stagger-6 w-full">
        <PrecipitationTile entries={hourly} locale={locale} />
      </div>

      {/* Live delivery of warnings over the WebSocket (roadmap 77). Renders nothing until one arrives. */}
      {authenticated && <AlertLiveConnection locale={locale} />}
    </div>
  );
}
