"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { HeroContent } from "@/components/hero-content";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/messages";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

type CurrentConditionsClientProps = {
  latitude: number;
  longitude: number;
  locale: Locale;
  /** Hour at the displayed location, computed on the server so the first paint
   * matches and hydration does not disagree about what time it is. */
  localHour: number;
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
export function CurrentConditionsClient({
  latitude,
  longitude,
  locale,
  localHour,
  initialData,
}: CurrentConditionsClientProps) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["current-conditions", latitude, longitude],
    queryFn: () => fetchViaProxy(latitude, longitude),
    initialData,
  });

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-white/70">—</p>
      </div>
    );
  }

  return (
    <HeroContent
      conditions={data}
      locale={locale}
      localHour={localHour}
      actions={
        <Button
          variant="glass"
          size="icon-sm"
          aria-label="Odśwież prognozę"
          className="absolute top-4 right-16 z-20 micro-press shadow-sm hover:rotate-12 transition-all duration-[200ms]"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? "animate-spin text-primary" : "text-white/90"} />
        </Button>
      }
    />
  );
}
