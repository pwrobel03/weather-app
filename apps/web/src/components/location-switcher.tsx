"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useState, useTransition } from "react";

import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import { setActiveLocationAction } from "@/lib/active-location/actions";
import type { ActiveLocation } from "@/lib/active-location/cookie";
import type { LocationSearchResult } from "@/lib/location/search";
import type { SavedLocation } from "@/lib/saved-locations/api";

type LocationSwitcherProps = {
  active: ActiveLocation;
  savedLocations: SavedLocation[];
};

/** Cookie write + `revalidatePath("/")` (active-location/actions.ts) refetches
 * the whole home screen server-side for the new coordinates - there is no
 * client-side weather re-fetch to wire up here. */
export function LocationSwitcher({ active, savedLocations }: LocationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function select(location: ActiveLocation) {
    setOpen(false);
    startTransition(() => {
      void setActiveLocationAction(location);
    });
  }

  return (
    <div className="relative">
      <Button
        variant="glass"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        disabled={isPending}
      >
        <MapPin />
        {active.name}
        <ChevronDown />
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {savedLocations.length > 0 && (
            <ul className="mb-2 flex flex-col divide-y divide-border">
              {savedLocations.map((location) => (
                <li key={location.id}>
                  <button
                    type="button"
                    onClick={() =>
                      select({
                        savedLocationId: location.id,
                        name: location.name,
                        latitude: location.latitude,
                        longitude: location.longitude,
                      })
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {location.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <LocationSearch
            onSelect={(result: LocationSearchResult) =>
              select({
                savedLocationId: null,
                name: result.name,
                latitude: result.latitude,
                longitude: result.longitude,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
