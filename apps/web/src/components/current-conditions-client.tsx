"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TemperatureDisplay } from "@/components/temperature-display";
import { WeatherIcon } from "@/components/weather-icon";
import { timeOfDay } from "@/lib/weather/channels";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

type CurrentConditionsClientProps = {
  latitude: number;
  longitude: number;
  /** Seeds the query so first paint is still the server-rendered value -
   * this component only takes over for refetches after that. Undefined when
   * the server-side fetch itself failed; the query then fetches on mount. */
  initialData?: CurrentConditions;
};

async function fetchViaProxy(latitude: number, longitude: number): Promise<CurrentConditions> {
  const response = await fetch(`/api/forecast/current?latitude=${latitude}&longitude=${longitude}`);
  if (!response.ok) {
    throw new Error(`forecast refresh failed: ${response.status}`);
  }
  return response.json();
}

/** The one interactive fragment on the home screen (roadmap commit 62) - the
 * rest of the page stays plain RSC. */
export function CurrentConditionsClient({ latitude, longitude, initialData }: CurrentConditionsClientProps) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["current-conditions", latitude, longitude],
    queryFn: () => fetchViaProxy(latitude, longitude),
    initialData,
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
      {data ? (
        <>
          <WeatherIcon weatherCode={data.weatherCode} timeOfDay={timeOfDay(new Date())} className="size-14" />
          <TemperatureDisplay temperatureCelsius={data.temperatureCelsius} />
        </>
      ) : (
        <p className="text-sm text-[#8a94a6]">—</p>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Odśwież prognozę"
        onClick={() => refetch()}
        disabled={isFetching}
      >
        <RefreshCw className={isFetching ? "animate-spin" : ""} />
      </Button>
    </div>
  );
}
