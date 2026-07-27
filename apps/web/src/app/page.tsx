import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CurrentConditionsClient } from "@/components/current-conditions-client";
import { DailyForecastList } from "@/components/daily-forecast-list";
import { HourlyForecastStrip } from "@/components/hourly-forecast-strip";
import { LocationSwitcher } from "@/components/location-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { WeatherBackground } from "@/components/weather-background";
import { getActiveLocation, type ActiveLocation } from "@/lib/active-location/cookie";
import { isAuthenticated } from "@/lib/auth/session";
import { fetchSavedLocations } from "@/lib/saved-locations/api";
import { DEFAULT_LOCALE } from "@/lib/i18n/messages";
import { hourOf } from "@/lib/weather/naive-time";
import { fetchCurrentConditions } from "@/lib/weather/current-conditions";
import { fetchDailyForecast } from "@/lib/weather/daily-forecast";
import { fetchHourlyForecast } from "@/lib/weather/hourly-forecast";

// Warszawa - fallback until a location is chosen (commit 67's switcher) or
// picked up from a saved location.
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

  const [conditions, hourly, daily, authenticated, savedLocations] = await Promise.all([
    fetchCurrentConditions(latitude, longitude),
    fetchHourlyForecast(latitude, longitude),
    fetchDailyForecast(latitude, longitude),
    isAuthenticated(),
    fetchSavedLocations(),
  ]);

  // With no reading there is no state to encode, so the background falls back
  // to a neutral overcast rather than inventing weather.
  const weatherCode = conditions?.weatherCode ?? 3;
  const temperatureCelsius = conditions?.temperatureCelsius ?? 0;
  // Hour at the displayed location, not on the server: someone in London
  // looking at Warszawa should see Warszawa's night.
  const localHour = conditions ? hourOf(conditions.observedAt) : 12;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero: edge-to-edge on mobile, a contained rounded tile from md up
          (design.md revision, 2026-07-27) - see .weather-background in
          globals.css for the breakpoint. */}
      <div className="md:mx-auto md:w-full md:max-w-2xl md:px-6 md:pt-6">
        <WeatherBackground weatherCode={weatherCode} temperatureCelsius={temperatureCelsius}>
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle />
          </div>
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <LocationSwitcher active={active} savedLocations={savedLocations} />
            {/* Settings screen (commit 70) will replace this with a real
                account menu once there's something to show once logged in. */}
            {!authenticated && (
              <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm">
                Zaloguj się
              </Button>
            )}
          </div>
          {/* The one client-side, TanStack Query-backed fragment on this
              page (roadmap commit 62) - everything else here is plain RSC. */}
          <CurrentConditionsClient
            latitude={latitude}
            longitude={longitude}
            locale={DEFAULT_LOCALE}
            localHour={localHour}
            initialData={conditions ?? undefined}
          />
        </WeatherBackground>
      </div>

      {/* design.md: "osobna powierzchnia na prognozę godzinową" - hourly
          strip on top, daily list below, same surface. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8 md:px-6">
        <section className="mt-4 rounded-3xl bg-card p-6 text-card-foreground md:mt-6">
          <HourlyForecastStrip entries={hourly} />
          <div className="mt-4 border-t border-border pt-2">
            <DailyForecastList entries={daily} />
          </div>
        </section>
      </div>
    </div>
  );
}
