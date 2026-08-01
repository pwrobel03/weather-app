import { DEFAULT_LOCALE, weatherMessages, localHourFromForecast } from "@weather-app/core";
import { AlertLiveConnection } from "@/components/alert-live-connection";
import { CurrentConditionsClient } from "@/components/current-conditions-client";
import { DailyForecastList } from "@/components/daily-forecast-list";
import { ForecastTrend } from "@/components/forecast-trend";
import { HourlyForecastStrip } from "@/components/hourly-forecast-strip";
import { AlertsTile } from "@/components/tiles/alerts-tile";
import { MetricsTile } from "@/components/tiles/metrics-tile";
import { PowiatTile } from "@/components/tiles/powiat-tile";
import { PrecipitationTile } from "@/components/tiles/precipitation-tile";
import { Tile } from "@/components/tiles/tile";
import { WeatherBackground } from "@/components/weather-background";
import { getActiveLocation, type ActiveLocation } from "@/lib/active-location/cookie";
import { fetchActiveAlerts } from "@/lib/alerts/api";
import { isAuthenticated } from "@/lib/auth/session";
import { fetchSavedLocations } from "@/lib/saved-locations/api";
import { fetchPowiatOutline } from "@/lib/weather/boundary";
import { fetchCurrentConditions } from "@/lib/weather/current-conditions";
import { fetchDailyForecast } from "@/lib/weather/daily-forecast";
import { fetchHourlyForecast } from "@/lib/weather/hourly-forecast";
import { getRequestLocale } from "@/lib/locale";

// Warszawa - fallback until a location is chosen or picked up from a saved one.
const DEFAULT_LOCATION: ActiveLocation = {
  savedLocationId: null,
  name: "Warszawa",
  latitude: 52.2297,
  longitude: 21.0122,
};

// Forecast is fetched live from the backend per request - never prerender
// statically at build time, when no backend is reachable.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [activeFromCookie, savedLocations, authenticated] = await Promise.all([
    getActiveLocation(),
    fetchSavedLocations(),
    isAuthenticated(),
  ]);

  // When a user selects a saved location on another device, the cookie keeps
  // pointing to the old coordinates; if that saved item got updated or deleted,
  // we re-sync from savedLocations (roadmap commit 52).
  let active = activeFromCookie ?? (savedLocations[0] ? {
    savedLocationId: savedLocations[0].id,
    name: savedLocations[0].name,
    latitude: savedLocations[0].latitude,
    longitude: savedLocations[0].longitude,
  } : DEFAULT_LOCATION);

  if (active.savedLocationId) {
    const matched = savedLocations.find((loc) => loc.id === active.savedLocationId);
    if (matched) {
      active = {
        savedLocationId: matched.id,
        name: matched.name,
        latitude: matched.latitude,
        longitude: matched.longitude,
      };
    } else {
      active = DEFAULT_LOCATION;
    }
  }

  const { latitude, longitude } = active;
  const locale = await getRequestLocale();

  const [conditions, hourly, daily, alerts, outline] = await Promise.all([
    fetchCurrentConditions(latitude, longitude).catch(() => null),
    fetchHourlyForecast(latitude, longitude),
    fetchDailyForecast(latitude, longitude),
    fetchActiveAlerts(),
    fetchPowiatOutline(latitude, longitude),
  ]);

  const weatherCode = conditions?.weatherCode ?? 0;
  const temperatureCelsius = conditions?.temperatureCelsius ?? 0;
  const localHour = localHourFromForecast(hourly, new Date());

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
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-0 py-0 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-8">
      {/* Hero card: edge-to-edge on mobile with only bottom rounded corners (Screen 1 aesthetic) */}
      <div className="order-1 lg:order-1 lg:col-span-8 animate-in-card stagger-1 relative overflow-hidden w-full rounded-none rounded-b-[2.5rem] sm:rounded-[3rem] shadow-[0_24px_60px_-10px_rgba(0,0,0,0.6)] border-b border-white/20 sm:border sm:border-white/20">
        <WeatherBackground
          weatherCode={weatherCode}
          temperatureCelsius={temperatureCelsius}
          windSpeedKmh={conditions?.windSpeedKmh}
          latitude={latitude}
          longitude={longitude}
        >
          <CurrentConditionsClient
            latitude={latitude}
            longitude={longitude}
            locale={locale}
            localHour={localHour}
            initialData={conditions ?? undefined}
            active={active}
            savedLocations={savedLocations}
            authenticated={authenticated}
          />
        </WeatherBackground>
      </div>

      {/* Hourly Forecast (Today): order-2 on mobile so it immediately follows Hero without interruption */}
      <div className="order-2 lg:order-3 lg:col-span-8 animate-in-card stagger-3 w-full px-4 sm:px-0 flex flex-col justify-center">
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
          {/* Under the strip, not instead of it: the strip answers "what is it
              doing at four", the plots answer the shape of the day, and neither
              question is served well by the other's layout. */}
          <ForecastTrend entries={hourly} />
        </Tile>
      </div>

      {/* Daily Forecast (7 Days): order-3 on mobile as direct continuation from Today */}
      <div id="7-days" className="order-3 lg:order-5 lg:col-span-8 animate-in-card stagger-5 w-full px-4 sm:px-0 flex flex-col justify-center scroll-mt-6">
        <Tile title={weatherMessages[locale].sevenDays} className="h-full justify-center">
          <DailyForecastList entries={daily} locale={locale} />
        </Tile>
      </div>

      {/* Alerts / Warnings: order-4 on mobile so it does not block forecasts when empty/inactive, order-2 on desktop bento */}
      <div className="order-4 lg:order-2 lg:col-span-4 animate-in-card stagger-2 w-full px-4 sm:px-0">
        <AlertsTile alerts={alerts} authenticated={authenticated} locale={locale} now={renderedAt} />
      </div>

      {outline && (
        <div className="order-5 lg:order-4 lg:col-span-4 animate-in-card stagger-4 w-full px-4 sm:px-0">
          <PowiatTile outline={outline} severity={powiatSeverity} locale={locale} />
        </div>
      )}

      <div className="order-6 lg:order-6 lg:col-span-4 animate-in-card stagger-6 w-full px-4 sm:px-0">
        {conditions && <MetricsTile conditions={conditions} locale={locale} />}
      </div>

      {/* A chart earns its width - full span analytical precipitation curve. */}
      <div className="order-7 lg:order-7 lg:col-span-12 animate-in-card stagger-6 w-full px-4 sm:px-0 pb-8 sm:pb-0">
        <PrecipitationTile entries={hourly} locale={locale} />
      </div>

      {/* Live delivery of warnings over the WebSocket (roadmap 77). Renders nothing until one arrives. */}
      {authenticated && <AlertLiveConnection locale={locale} />}
    </div>
  );
}
