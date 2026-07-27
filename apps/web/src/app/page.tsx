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
import { SavedLocationsTile } from "@/components/tiles/saved-locations-tile";
import { Tile } from "@/components/tiles/tile";
import { Button } from "@/components/ui/button";
import { WeatherBackground } from "@/components/weather-background";
import { getActiveLocation, type ActiveLocation } from "@/lib/active-location/cookie";
import { fetchActiveAlerts } from "@/lib/alerts/api";
import { isAuthenticated } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/messages";
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

  // Severity of the warning covering *this* powiat, if any.
  //
  // Matched on the warning's own teryt codes, not simply taken from the first
  // active alert: the user may watch several places, and colouring the county
  // tile because some other town of theirs is under a storm is a false alarm -
  // in an app whose whole job is warnings, worse than showing nothing.
  const powiatSeverity =
    (outline
      ? alerts.find((alert) => alert.terytCodes.includes(outline.terytCode))?.severity
      : undefined) ?? null;

  // Passed down rather than read inside a component: the React Compiler
  // rejects impure calls during render, and one clock for the whole page keeps
  // every countdown consistent with every other.
  const renderedAt = new Date();

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5 lg:px-6 lg:py-6">
      {/* Mobile: hero edge-to-edge, everything else stacked beneath.
          lg and up: a bento grid with the hero as its largest cell
          (design.md §6). */}
      <div className="px-3 pt-3 lg:col-span-2 lg:row-span-2 lg:p-0">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle />
          </div>
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <LocationSwitcher active={active} savedLocations={savedLocations} />
            {authenticated ? (
              // A signed-in visitor must be able to find their places and
              // their settings without being told where to look.
              <>
                <Button render={<Link href="/locations" />} nativeButton={false} variant="glass" size="sm">
                  Moje miejsca
                </Button>
                <Button
                  render={<Link href="/settings" />}
                  nativeButton={false}
                  variant="glass"
                  size="icon-sm"
                  aria-label="Ustawienia"
                >
                  <Settings />
                </Button>
              </>
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

      {/* Warnings take the top-right cell: the most valuable slot after the
          hero, and the reason this app exists. */}
      <div className="px-4 lg:px-0">
        <AlertsTile alerts={alerts} authenticated={authenticated} locale={locale} now={renderedAt} />
      </div>

      <div className="px-4 lg:px-0">
        {outline ? (
          <PowiatTile outline={outline} severity={powiatSeverity} locale={locale} />
        ) : conditions ? (
          <MetricsTile conditions={conditions} locale={locale} />
        ) : null}
      </div>

      <div className="px-4 lg:col-span-2 lg:px-0">
        <Tile>
          <HourlyForecastStrip entries={hourly} />
        </Tile>
      </div>

      <div className="px-4 lg:row-span-2 lg:px-0">
        <Tile>
          <DailyForecastList entries={daily} />
        </Tile>
      </div>

      <div className="px-4 lg:px-0">
        <PrecipitationTile entries={hourly} locale={locale} />
      </div>

      {conditions && outline && (
        <div className="px-4 lg:px-0">
          <MetricsTile conditions={conditions} locale={locale} />
        </div>
      )}

      <div className={`px-4 pb-8 lg:px-0 lg:pb-0 ${outline ? "lg:col-span-3" : "lg:col-span-2"}`}>
        <SavedLocationsTile locations={savedLocations} locale={locale} />
      </div>

      {/* Live delivery of warnings over the WebSocket (roadmap 77). Renders
          nothing until one arrives. */}
      {authenticated && <AlertLiveConnection locale={locale} />}
    </div>
  );
}
