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
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-3 py-3 lg:grid-cols-12 lg:gap-5 lg:px-6 lg:py-6">
      {/* Hero and warnings share the top band. Warnings used to be the
          smallest tile on a screen whose entire purpose is IMGW warnings,
          while the saved-places list took nearly twice its area - the layout
          said the opposite of what the product is. */}
      <div className="lg:col-span-8">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle />
          </div>
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <LocationSwitcher active={active} savedLocations={savedLocations} />
            {authenticated ? (
              <Button
                render={<Link href="/settings" />}
                nativeButton={false}
                variant="glass"
                size="icon-sm"
                aria-label="Ustawienia"
              >
                <Settings />
              </Button>
            ) : (
              <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm">
                Zaloguj się
              </Button>
            )}
          </div>
          {/* The one client-side, TanStack Query-backed fragment on this page
              (roadmap commit 62) - everything else here is plain RSC. */}
          <CurrentConditionsClient
            latitude={latitude}
            longitude={longitude}
            locale={locale}
            localHour={localHour}
            initialData={conditions ?? undefined}
          />
        </WeatherBackground>
      </div>

      <div className="lg:col-span-4">
        <AlertsTile alerts={alerts} authenticated={authenticated} locale={locale} now={renderedAt} />
      </div>

      {/* d.png keeps the hourly strip directly under the hero, as part of the
          same visual block. */}
      <div className="lg:col-span-8">
        <Tile>
          <HourlyForecastStrip entries={hourly} />
        </Tile>
      </div>

      {outline && (
        <div className="lg:col-span-4">
          <PowiatTile outline={outline} severity={powiatSeverity} locale={locale} />
        </div>
      )}

      <div className="lg:col-span-8">
        <Tile title={weatherMessages[locale].sevenDays}>
          <DailyForecastList entries={daily} />
        </Tile>
      </div>

      <div className="lg:col-span-4">
        {conditions && <MetricsTile conditions={conditions} locale={locale} />}
      </div>

      {/* A chart earns its width - full span rather than a quarter. */}
      <div className="lg:col-span-12">
        <PrecipitationTile entries={hourly} locale={locale} />
      </div>

      {/* Saved places left the home screen entirely: it is a setup task, looked
          at once, and it was taking nearly twice the area of the warnings. It
          lives at /locations, reachable from the location switcher. */}

      {/* Live delivery of warnings over the WebSocket (roadmap 77). Renders
          nothing until one arrives. */}
      {authenticated && <AlertLiveConnection locale={locale} />}
    </div>
  );
}
