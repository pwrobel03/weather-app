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
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-8">
      {/* Hero and warnings share the top band. Engineered spatial layout with staggered motion. */}
      <div className="lg:col-span-8 animate-in-card stagger-1 relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-white/15">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-4 right-4 z-20 micro-press">
            <ThemeToggle />
          </div>
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <LocationSwitcher active={active} savedLocations={savedLocations} />
            {authenticated ? (
              <Button
                render={<Link href="/settings" />}
                nativeButton={false}
                variant="glass"
                size="icon-sm"
                aria-label="Ustawienia"
                className="micro-press shadow-sm hover:rotate-4"
              >
                <Settings />
              </Button>
            ) : (
              <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm" className="micro-press shadow-sm">
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

      <div className="lg:col-span-4 animate-in-card stagger-2 h-full">
        <AlertsTile alerts={alerts} authenticated={authenticated} locale={locale} now={renderedAt} />
      </div>

      <div className="lg:col-span-8 animate-in-card stagger-3 h-full flex flex-col justify-center">
        <Tile className="h-full justify-center">
          <HourlyForecastStrip entries={hourly} />
        </Tile>
      </div>

      {outline && (
        <div className="lg:col-span-4 animate-in-card stagger-4 h-full">
          <PowiatTile outline={outline} severity={powiatSeverity} locale={locale} />
        </div>
      )}

      <div className="lg:col-span-8 animate-in-card stagger-5 h-full flex flex-col justify-center">
        <Tile title={weatherMessages[locale].sevenDays} className="h-full justify-center">
          <DailyForecastList entries={daily} />
        </Tile>
      </div>

      <div className="lg:col-span-4 animate-in-card stagger-6 h-full">
        {conditions && <MetricsTile conditions={conditions} locale={locale} />}
      </div>

      {/* A chart earns its width - full span analytical precipitation curve. */}
      <div className="lg:col-span-12 animate-in-card stagger-6">
        <PrecipitationTile entries={hourly} locale={locale} />
      </div>

      {/* Live delivery of warnings over the WebSocket (roadmap 77). Renders nothing until one arrives. */}
      {authenticated && <AlertLiveConnection locale={locale} />}
    </div>
  );
}
