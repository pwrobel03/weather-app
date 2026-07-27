import Link from "next/link";
import { MapPin } from "lucide-react";

import { Tile } from "@/components/tiles/tile";
import type { Locale } from "@weather-app/core";
import type { SavedLocation } from "@/lib/saved-locations/api";

const LABELS: Record<Locale, { title: string; empty: string; manage: string; outside: string }> = {
  pl: {
    title: "Twoje miejsca",
    empty: "Nie obserwujesz jeszcze żadnego miejsca",
    manage: "Zarządzaj",
    outside: "poza Polską",
  },
  en: {
    title: "Your places",
    empty: "You are not watching any places yet",
    manage: "Manage",
    outside: "outside Poland",
  },
};

/**
 * The watched locations, as "Other Cities" in idea/updated.
 *
 * Shows the powiat code rather than a temperature: a reading per location
 * would mean one upstream forecast call per row on every home-screen render,
 * and the code is what actually decides whether a warning reaches that place.
 * Temperatures can come later behind a batched endpoint.
 */
export function SavedLocationsTile({
  locations,
  locale,
}: {
  locations: SavedLocation[];
  locale: Locale;
}) {
  const labels = LABELS[locale];

  return (
    <Tile
      title={labels.title}
      aside={
        <Link href="/locations" className="on-glass-muted text-xs underline-offset-4 hover:underline">
          {labels.manage}
        </Link>
      }
    >
      {locations.length === 0 ? (
        <p className="on-glass-muted text-sm">{labels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {locations.map((location) => (
            <li key={location.id} className="flex items-center justify-between gap-3">
              <span className="on-glass flex min-w-0 items-center gap-2 text-sm">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
                <span className="truncate">{location.name}</span>
              </span>
              <span className="on-glass-muted shrink-0 font-mono text-xs tabular-nums">
                {location.terytCode ?? labels.outside}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
